"""
Browser Automation Module — Playwright-based Chrome automation.

Provides:
  - Headless/headed Chrome browser pool
  - Page loading with screenshot capture
  - DOM analysis (element counting, text extraction)
  - Network request monitoring
  - Competitor site visiting
  - Real-time data polling (check if values change over time)
"""

import asyncio
import os
import time
from dataclasses import dataclass
from typing import Any, Optional

from rich.console import Console

try:
    from playwright.async_api import async_playwright, Browser, Page, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

from config import BROWSER_HEADLESS, BROWSER_TIMEOUT, SCREENSHOT_DIR, PROD_BASE_URL


console = Console()


@dataclass
class PageAnalysis:
    """Results from analyzing a web page."""
    url: str
    title: str = ""
    load_time_ms: float = 0.0
    status_code: int = 0
    screenshot_path: str = ""
    text_content: str = ""
    element_counts: dict[str, int] = None
    network_requests: list[dict] = None
    console_errors: list[str] = None
    dom_metrics: dict[str, Any] = None

    def __post_init__(self):
        self.element_counts = self.element_counts or {}
        self.network_requests = self.network_requests or []
        self.console_errors = self.console_errors or []
        self.dom_metrics = self.dom_metrics or {}


@dataclass
class RealTimeCheck:
    """Results from checking real-time data updates."""
    url: str
    snapshots: list[dict[str, Any]]  # [{timestamp, values}]
    values_changed: bool = False
    update_interval_ms: float = 0.0
    stale_elements: list[str] = None

    def __post_init__(self):
        self.stale_elements = self.stale_elements or []


class BrowserPool:
    """Manages a shared Playwright browser instance for all agents."""

    def __init__(self):
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._lock = asyncio.Lock()
        self._context_count = 0

    async def start(self):
        """Launch the browser."""
        if not PLAYWRIGHT_AVAILABLE:
            console.print("[yellow]Playwright not installed. Run: pip install playwright && playwright install chromium[/]")
            return

        async with self._lock:
            if self._browser is None:
                self._playwright = await async_playwright().start()
                self._browser = await self._playwright.chromium.launch(
                    headless=BROWSER_HEADLESS,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                    ],
                )
                console.print("[green bold]Browser launched[/] (headless={})".format(BROWSER_HEADLESS))

    async def stop(self):
        """Close the browser."""
        async with self._lock:
            if self._browser:
                await self._browser.close()
                self._browser = None
            if self._playwright:
                await self._playwright.stop()
                self._playwright = None

    async def new_context(self) -> Optional[BrowserContext]:
        """Create a new isolated browser context (like incognito)."""
        if not self._browser:
            return None
        ctx = await self._browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        )
        self._context_count += 1
        return ctx

    @property
    def is_available(self) -> bool:
        return self._browser is not None


# ─── Singleton browser pool ─────────────────────────────────────────────────
browser_pool = BrowserPool()


# ─── Page Analysis Functions ─────────────────────────────────────────────────

async def analyze_page(
    url: str,
    agent_id: str = "unknown",
    take_screenshot: bool = True,
    wait_for_selector: Optional[str] = None,
) -> PageAnalysis:
    """
    Load a page and collect comprehensive metrics.
    Returns PageAnalysis with timing, DOM stats, network, console errors.
    """
    result = PageAnalysis(url=url)

    if not browser_pool.is_available:
        result.console_errors.append("Browser not available — Playwright not installed")
        return result

    ctx = await browser_pool.new_context()
    if not ctx:
        return result

    try:
        page = await ctx.new_page()

        # Collect network requests
        requests_log = []
        page.on("request", lambda req: requests_log.append({
            "url": req.url[:200],
            "method": req.method,
            "resource_type": req.resource_type,
        }))

        # Collect console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # Navigate and time it
        start = time.monotonic()
        response = await page.goto(url, wait_until="networkidle", timeout=BROWSER_TIMEOUT)
        result.load_time_ms = round((time.monotonic() - start) * 1000, 1)
        result.status_code = response.status if response else 0

        # Wait for specific selector if provided
        if wait_for_selector:
            try:
                await page.wait_for_selector(wait_for_selector, timeout=10_000)
            except Exception:
                pass

        # Page title
        result.title = await page.title()

        # Element counts for UI analysis
        result.element_counts = await page.evaluate("""() => {
            return {
                total_elements: document.querySelectorAll('*').length,
                buttons: document.querySelectorAll('button').length,
                inputs: document.querySelectorAll('input').length,
                tables: document.querySelectorAll('table').length,
                canvases: document.querySelectorAll('canvas').length,
                svgs: document.querySelectorAll('svg').length,
                images: document.querySelectorAll('img').length,
                links: document.querySelectorAll('a').length,
                divs_with_overflow: document.querySelectorAll('[style*="overflow"]').length,
            }
        }""")

        # DOM metrics
        result.dom_metrics = await page.evaluate("""() => {
            const body = document.body;
            return {
                scroll_height: body.scrollHeight,
                scroll_width: body.scrollWidth,
                has_dark_theme: getComputedStyle(body).backgroundColor !== 'rgb(255, 255, 255)',
                font_family: getComputedStyle(body).fontFamily.substring(0, 50),
                viewport_width: window.innerWidth,
                viewport_height: window.innerHeight,
            }
        }""")

        # Text content (truncated)
        result.text_content = (await page.inner_text("body"))[:5000]

        # Screenshot
        if take_screenshot:
            os.makedirs(SCREENSHOT_DIR, exist_ok=True)
            ss_path = os.path.join(SCREENSHOT_DIR, f"{agent_id}_{int(time.time())}.png")
            await page.screenshot(path=ss_path, full_page=False)
            result.screenshot_path = ss_path

        result.network_requests = requests_log[:100]  # cap at 100
        result.console_errors = console_errors

    except Exception as e:
        result.console_errors.append(f"Page analysis error: {str(e)}")
    finally:
        await ctx.close()

    return result


async def check_realtime_updates(
    url: str,
    selector: str,
    agent_id: str = "unknown",
    check_count: int = 3,
    interval_seconds: float = 5.0,
) -> RealTimeCheck:
    """
    Visit a page multiple times and check if displayed values change.
    Used to verify real-time data updates.
    """
    result = RealTimeCheck(url=url, snapshots=[])

    if not browser_pool.is_available:
        return result

    ctx = await browser_pool.new_context()
    if not ctx:
        return result

    try:
        page = await ctx.new_page()
        await page.goto(url, wait_until="networkidle", timeout=BROWSER_TIMEOUT)

        for i in range(check_count):
            try:
                elements = await page.query_selector_all(selector)
                values = []
                for el in elements[:20]:  # cap at 20 elements
                    text = await el.inner_text()
                    values.append(text.strip())

                result.snapshots.append({
                    "timestamp": time.time(),
                    "check_index": i,
                    "values": values,
                })
            except Exception:
                pass

            if i < check_count - 1:
                await asyncio.sleep(interval_seconds)

        # Analyze if values changed
        if len(result.snapshots) >= 2:
            first_values = set(result.snapshots[0].get("values", []))
            last_values = set(result.snapshots[-1].get("values", []))
            result.values_changed = first_values != last_values

            if len(result.snapshots) >= 2:
                t0 = result.snapshots[0]["timestamp"]
                t1 = result.snapshots[-1]["timestamp"]
                result.update_interval_ms = round((t1 - t0) * 1000 / max(len(result.snapshots) - 1, 1), 1)

    except Exception as e:
        result.stale_elements.append(f"Real-time check error: {str(e)}")
    finally:
        await ctx.close()

    return result


async def visit_competitor(
    competitor_url: str,
    agent_id: str = "unknown",
) -> PageAnalysis:
    """Visit a competitor page and capture basic analysis."""
    return await analyze_page(
        url=competitor_url,
        agent_id=f"{agent_id}_competitor",
        take_screenshot=True,
        wait_for_selector="body",
    )


async def check_api_endpoint(
    api_url: str,
    agent_id: str = "unknown",
) -> dict[str, Any]:
    """
    Fetch an API endpoint and analyze the response.
    Returns dict with status, timing, data shape, sample.
    """
    import aiohttp

    result = {
        "url": api_url,
        "status": 0,
        "latency_ms": 0,
        "content_type": "",
        "data_size_bytes": 0,
        "is_json": False,
        "sample_keys": [],
        "record_count": 0,
        "error": None,
    }

    try:
        start = time.monotonic()
        async with aiohttp.ClientSession() as session:
            async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                result["latency_ms"] = round((time.monotonic() - start) * 1000, 1)
                result["status"] = resp.status
                result["content_type"] = resp.content_type or ""

                body = await resp.read()
                result["data_size_bytes"] = len(body)

                if "json" in result["content_type"]:
                    import json
                    data = json.loads(body)
                    result["is_json"] = True

                    if isinstance(data, dict):
                        result["sample_keys"] = list(data.keys())[:20]
                        # Check for nested arrays
                        for key, val in data.items():
                            if isinstance(val, list):
                                result["record_count"] = max(result["record_count"], len(val))
                    elif isinstance(data, list):
                        result["record_count"] = len(data)
                        if data:
                            result["sample_keys"] = list(data[0].keys())[:20] if isinstance(data[0], dict) else []

    except Exception as e:
        result["error"] = str(e)

    return result
