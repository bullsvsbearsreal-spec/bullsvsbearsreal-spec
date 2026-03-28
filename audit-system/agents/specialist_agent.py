"""
Specialist Agent — one instance per dashboard page.

Each specialist performs 6 audit tasks:
  1. UI/UX analysis
  2. Real data verification (browser + API)
  3. Real-time actualization check
  4. Bug hunting & technical audit
  5. Competitor research
  6. Improvement proposals
"""

import asyncio
import os
import re
import time
from typing import Any, Optional

from rich.console import Console

from config import PageConfig, PROD_BASE_URL, SRC_ROOT, COMPETITORS
from .base_agent import BaseAgent, AgentReport, AgentScore

# Import browser automation (may not be available)
try:
    from browser_automation import (
        analyze_page,
        check_realtime_updates,
        visit_competitor,
        check_api_endpoint,
        browser_pool,
    )
    BROWSER_OK = True
except ImportError:
    BROWSER_OK = False


class SpecialistAgent(BaseAgent):
    """
    Specialist agent for a single dashboard page.
    Runs all 6 audit tasks and produces a structured AgentReport.
    """

    def __init__(self, page_config: PageConfig, console: Optional[Console] = None):
        super().__init__(
            agent_id=page_config.agent_id,
            name=f"{page_config.name} Agent",
            console=console,
        )
        self.page = page_config
        self.full_url = f"{PROD_BASE_URL}{self.page.route}"
        self.api_url = f"{PROD_BASE_URL}{self.page.api_route}" if self.page.api_route else None

    async def run(self) -> AgentReport:
        """Execute all 6 audit tasks for this page."""
        report = AgentReport(
            agent_id=self.agent_id,
            agent_name=self.name,
            page_name=self.page.name,
            category=self.page.category,
        )

        self.log(f"Auditing: {self.page.name} ({self.page.route})")

        # Run all 6 tasks concurrently where possible
        results = await asyncio.gather(
            self._task_1_ui_ux(report),
            self._task_2_data_verification(report),
            self._task_3_realtime_check(report),
            self._task_4_bug_hunting(report),
            self._task_5_competitor_research(report),
            self._task_6_improvements(report),
            return_exceptions=True,
        )

        # Log any task-level exceptions
        task_names = ["UI/UX", "Data Verification", "Real-time", "Bug Hunt", "Competitor", "Improvements"]
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                report.errors.append(f"Task {task_names[i]} failed: {str(result)}")
                self.log_warn(f"Task {task_names[i]} failed: {result}")

        # Calculate scores
        report.score = self._calculate_scores(report)

        return report

    # ─── Task 1: UI/UX Analysis ──────────────────────────────────────────

    async def _task_1_ui_ux(self, report: AgentReport):
        """Analyze UI/UX by reading source code + browser analysis."""
        self.log("Task 1/6: UI/UX Analysis")

        findings = []

        # Read the page source code
        source_path = os.path.join(SRC_ROOT, self.page.source_file)
        source_code = self._read_source(source_path)

        if source_code:
            # Analyze component structure
            findings.extend(self._analyze_ui_patterns(source_code))

        # Browser-based UI analysis
        if BROWSER_OK and browser_pool.is_available:
            page_analysis = await analyze_page(
                url=self.full_url,
                agent_id=self.agent_id,
                wait_for_selector="main, [class*='container'], [class*='grid']",
            )

            if page_analysis.screenshot_path:
                report.screenshots.append(page_analysis.screenshot_path)

            findings.append({
                "type": "page_metrics",
                "load_time_ms": page_analysis.load_time_ms,
                "total_elements": page_analysis.element_counts.get("total_elements", 0),
                "has_dark_theme": page_analysis.dom_metrics.get("has_dark_theme", False),
                "console_errors": len(page_analysis.console_errors),
                "status_code": page_analysis.status_code,
            })

            # Check for accessibility issues
            if page_analysis.element_counts.get("buttons", 0) > 0:
                findings.append({
                    "type": "accessibility",
                    "note": f"Found {page_analysis.element_counts['buttons']} buttons — verify aria-labels",
                })

            if page_analysis.load_time_ms > 3000:
                findings.append({
                    "type": "performance_concern",
                    "severity": "medium",
                    "note": f"Page loads in {page_analysis.load_time_ms}ms (>3s threshold)",
                })

        report.ui_ux_findings = findings

    def _analyze_ui_patterns(self, source: str) -> list[dict]:
        """Static analysis of UI patterns in source code."""
        findings = []
        lines = source.split("\n")
        line_count = len(lines)

        # File size check
        if line_count > 500:
            findings.append({
                "type": "code_size",
                "severity": "medium",
                "note": f"Page component is {line_count} lines — consider splitting into sub-components",
                "line_count": line_count,
            })

        # Check for responsive design
        has_responsive = any(kw in source for kw in ["md:", "lg:", "xl:", "sm:", "@media", "useMediaQuery"])
        if not has_responsive:
            findings.append({
                "type": "responsiveness",
                "severity": "high",
                "note": "No responsive breakpoints detected — page may not be mobile-friendly",
            })

        # Check for loading states
        has_loading = any(kw in source for kw in ["isLoading", "loading", "skeleton", "Skeleton", "spinner", "Spinner"])
        if not has_loading:
            findings.append({
                "type": "loading_state",
                "severity": "medium",
                "note": "No loading state detected — users see blank screen during data fetch",
            })

        # Check for error handling in UI
        has_error_ui = any(kw in source for kw in ["error", "Error", "isError", "errorMessage"])
        if not has_error_ui:
            findings.append({
                "type": "error_handling",
                "severity": "medium",
                "note": "No error state UI detected — API failures show nothing to user",
            })

        # Check for animations/transitions
        has_animations = any(kw in source for kw in ["transition", "animate", "motion", "framer"])
        if not has_animations:
            findings.append({
                "type": "micro_interactions",
                "severity": "low",
                "note": "No animations/transitions detected — UI may feel static",
            })

        # Check for tooltips on data
        has_tooltips = any(kw in source for kw in ["tooltip", "Tooltip", "title=", "data-tooltip"])
        if not has_tooltips:
            findings.append({
                "type": "tooltips",
                "severity": "low",
                "note": "No tooltips detected — complex data may need hover explanations",
            })

        # Check for empty state handling
        has_empty = any(kw in source for kw in ["empty", "no data", "No data", "noData", "length === 0", "length===0"])
        if not has_empty:
            findings.append({
                "type": "empty_state",
                "severity": "medium",
                "note": "No empty state handling — what shows when there is no data?",
            })

        # Check for accessibility
        has_a11y = any(kw in source for kw in ["aria-", "role=", "tabIndex", "sr-only"])
        if not has_a11y:
            findings.append({
                "type": "accessibility",
                "severity": "medium",
                "note": "No ARIA attributes detected — screen readers cannot parse this page",
            })

        return findings

    # ─── Task 2: Data Verification ───────────────────────────────────────

    async def _task_2_data_verification(self, report: AgentReport):
        """Verify data is real by checking API endpoints and comparing with competitors."""
        self.log("Task 2/6: Data Verification")

        verifications = []

        # Check our API endpoint
        if self.api_url:
            api_result = None
            if BROWSER_OK:
                api_result = await check_api_endpoint(self.api_url, self.agent_id)
            else:
                # Fallback: use aiohttp directly
                import aiohttp
                try:
                    start = time.monotonic()
                    async with aiohttp.ClientSession() as session:
                        async with session.get(self.api_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                            latency = round((time.monotonic() - start) * 1000, 1)
                            body = await resp.text()
                            api_result = {
                                "url": self.api_url,
                                "status": resp.status,
                                "latency_ms": latency,
                                "data_size_bytes": len(body),
                                "is_json": "json" in (resp.content_type or ""),
                                "error": None,
                            }
                except Exception as e:
                    api_result = {"url": self.api_url, "error": str(e)}

            if api_result:
                verifications.append({
                    "type": "api_check",
                    "endpoint": self.api_url,
                    "status": api_result.get("status"),
                    "latency_ms": api_result.get("latency_ms"),
                    "data_size_bytes": api_result.get("data_size_bytes"),
                    "is_json": api_result.get("is_json"),
                    "record_count": api_result.get("record_count", 0),
                    "error": api_result.get("error"),
                })

                if api_result.get("status") != 200:
                    verifications.append({
                        "type": "api_error",
                        "severity": "critical",
                        "note": f"API returned status {api_result.get('status')} — data may be missing",
                    })

        # Verify data sources are real
        for source in self.page.data_sources:
            verifications.append({
                "type": "data_source",
                "source": source,
                "configured": True,
                "note": f"Data source '{source}' is configured in API route",
            })

        # Cross-check with page content
        if BROWSER_OK and browser_pool.is_available:
            page_data = await analyze_page(
                url=self.full_url,
                agent_id=f"{self.agent_id}_data",
                take_screenshot=False,
            )

            # Check if page has actual data or error messages
            content = page_data.text_content.lower()
            has_data_indicators = any(kw in content for kw in [
                "btc", "eth", "bitcoin", "binance", "bybit", "okx",
                "%", "$", "funding", "rate", "volume", "open interest",
            ])

            verifications.append({
                "type": "content_check",
                "has_data_indicators": has_data_indicators,
                "content_length": len(page_data.text_content),
                "has_errors": any("error" in e.lower() for e in page_data.console_errors),
            })

        report.data_verification = verifications

    # ─── Task 3: Real-time Check ─────────────────────────────────────────

    async def _task_3_realtime_check(self, report: AgentReport):
        """Check if data updates in real time."""
        self.log("Task 3/6: Real-time Check")

        checks = []

        if not self.page.real_time:
            checks.append({
                "type": "not_realtime",
                "note": f"{self.page.name} is not expected to have real-time updates",
            })
            report.realtime_check = checks
            return

        # Check source for WebSocket / SWR / polling patterns
        source_path = os.path.join(SRC_ROOT, self.page.source_file)
        source = self._read_source(source_path)

        if source:
            has_websocket = any(kw in source for kw in ["WebSocket", "ws://", "wss://", "useWebSocket"])
            has_swr = "useSWR" in source or "useApi" in source or "refreshInterval" in source
            has_polling = "setInterval" in source or "setTimeout" in source
            has_sse = "EventSource" in source

            update_mechanism = []
            if has_websocket:
                update_mechanism.append("WebSocket")
            if has_swr:
                update_mechanism.append("SWR (stale-while-revalidate)")
            if has_polling:
                update_mechanism.append("setInterval polling")
            if has_sse:
                update_mechanism.append("Server-Sent Events")

            # Extract refresh intervals from SWR config
            swr_intervals = re.findall(r'refreshInterval[:\s]*(\d+)', source)
            refresh_ms = int(swr_intervals[0]) if swr_intervals else None

            checks.append({
                "type": "update_mechanism",
                "mechanisms": update_mechanism or ["none detected"],
                "refresh_interval_ms": refresh_ms,
                "has_realtime": bool(update_mechanism),
            })

            if not update_mechanism:
                checks.append({
                    "type": "missing_realtime",
                    "severity": "high",
                    "note": f"{self.page.name} is marked real-time but has no update mechanism",
                })

        # Browser-based real-time check
        if BROWSER_OK and browser_pool.is_available:
            rt_check = await check_realtime_updates(
                url=self.full_url,
                selector="td, [class*='cell'], [class*='value'], [class*='price']",
                agent_id=self.agent_id,
                check_count=3,
                interval_seconds=5.0,
            )

            checks.append({
                "type": "live_update_test",
                "snapshots_taken": len(rt_check.snapshots),
                "values_changed": rt_check.values_changed,
                "avg_interval_ms": rt_check.update_interval_ms,
                "stale_elements": rt_check.stale_elements,
            })

        report.realtime_check = checks

    # ─── Task 4: Bug Hunting ─────────────────────────────────────────────

    async def _task_4_bug_hunting(self, report: AgentReport):
        """Hunt for bugs, security issues, and performance problems."""
        self.log("Task 4/6: Bug Hunting")

        bugs = []
        security = []
        perf = []

        source_path = os.path.join(SRC_ROOT, self.page.source_file)
        source = self._read_source(source_path)

        if source:
            # ── Bug patterns ──
            # Null/undefined handling
            null_issues = len(re.findall(r'\.\w+\s*(?:===?\s*(?:null|undefined))?(?!\?)', source))
            optional_chains = source.count("?.")
            if null_issues > 10 and optional_chains < 5:
                bugs.append({
                    "type": "null_safety",
                    "severity": "medium",
                    "note": "Many property accesses without optional chaining (?.) — risk of 'Cannot read property of undefined'",
                })

            # Dependency arrays in useEffect
            effects_no_deps = len(re.findall(r'useEffect\(\s*\(\)\s*=>\s*\{', source))
            effects_with_deps = len(re.findall(r'useEffect\([^)]+\]\s*\)', source))
            if effects_no_deps > effects_with_deps:
                bugs.append({
                    "type": "effect_deps",
                    "severity": "medium",
                    "note": "Some useEffect hooks may have missing dependency arrays — causes infinite re-renders or stale closures",
                })

            # SWR key issues (the bug we just fixed!)
            swr_keys = re.findall(r"key:\s*['\"]([^'\"]+)['\"]", source)
            for key in swr_keys:
                if not any(c in key for c in ["${", "` + ", "-"]):
                    # Static key — check if the page has dynamic params
                    if any(kw in source for kw in ["useState", "selected", "symbol", "timeframe"]):
                        bugs.append({
                            "type": "swr_static_key",
                            "severity": "high",
                            "note": f"SWR key '{key}' is static but page has dynamic state — data won't refresh on param change",
                            "swr_key": key,
                        })

            # Division by zero
            divisions = re.findall(r'/\s*\w+(?!\s*[/=])', source)
            has_div_guards = "|| 1" in source or "|| 0.01" in source or "Math.max" in source
            if len(divisions) > 5 and not has_div_guards:
                bugs.append({
                    "type": "division_by_zero",
                    "severity": "low",
                    "note": "Multiple divisions without zero guards — risk of NaN/Infinity display",
                })

            # Array index out of bounds
            if "[0]" in source and ".length" not in source[:source.index("[0]") + 100] if "[0]" in source else False:
                bugs.append({
                    "type": "array_bounds",
                    "severity": "low",
                    "note": "Array index [0] access without length check",
                })

            # ── Security patterns ──
            # XSS via dangerouslySetInnerHTML
            if "dangerouslySetInnerHTML" in source:
                security.append({
                    "type": "xss_risk",
                    "severity": "high",
                    "note": "dangerouslySetInnerHTML used — ensure input is sanitized",
                })

            # API key exposure
            if re.search(r'(?:api[_-]?key|secret|token)\s*[:=]\s*["\'][^"\']{10,}', source, re.IGNORECASE):
                security.append({
                    "type": "exposed_secret",
                    "severity": "critical",
                    "note": "Possible API key/secret hardcoded in source",
                })

            # eval() usage
            if "eval(" in source:
                security.append({
                    "type": "eval_usage",
                    "severity": "critical",
                    "note": "eval() used — code injection risk",
                })

            # ── Performance patterns ──
            # Large inline arrays/objects that recreate every render
            inline_arrays = len(re.findall(r'(?:const|let)\s+\w+\s*=\s*\[', source))
            if inline_arrays > 10:
                perf.append({
                    "type": "render_allocations",
                    "severity": "low",
                    "note": f"{inline_arrays} inline array declarations — may cause unnecessary re-renders if in component body",
                })

            # Missing useMemo/useCallback
            has_memo = "useMemo" in source or "useCallback" in source or "React.memo" in source
            has_heavy_compute = any(kw in source for kw in [".sort(", ".filter(", ".reduce(", ".map("])
            if has_heavy_compute and not has_memo:
                perf.append({
                    "type": "missing_memoization",
                    "severity": "medium",
                    "note": "Array operations (.sort, .filter, .map) without useMemo — recalculates every render",
                })

            # Canvas/SVG rendering in component body
            if ("<canvas" in source or "<svg" in source.lower()) and "requestAnimationFrame" not in source:
                svg_count = source.lower().count("<svg") + source.lower().count("<canvas")
                if svg_count > 3:
                    perf.append({
                        "type": "heavy_rendering",
                        "severity": "medium",
                        "note": f"{svg_count} SVG/Canvas elements — consider virtualization for large datasets",
                    })

        # Also check API route for bugs
        if self.page.api_source:
            api_path = os.path.join(SRC_ROOT, self.page.api_source)
            api_source = self._read_source(api_path)
            if api_source:
                # Rate limiting
                if "rate" not in api_source.lower() and "throttle" not in api_source.lower():
                    security.append({
                        "type": "no_rate_limit",
                        "severity": "medium",
                        "note": "API route has no rate limiting — vulnerable to abuse",
                    })

                # Error handling
                try_blocks = api_source.count("try {") + api_source.count("try{")
                catch_blocks = api_source.count("catch")
                if try_blocks == 0:
                    bugs.append({
                        "type": "api_no_error_handling",
                        "severity": "high",
                        "note": "API route has no try/catch — unhandled errors crash the endpoint",
                    })

                # Timeout on external requests
                has_timeout = "timeout" in api_source.lower() or "AbortController" in api_source
                fetch_count = api_source.count("fetch(") + api_source.count("axios")
                if fetch_count > 0 and not has_timeout:
                    bugs.append({
                        "type": "no_fetch_timeout",
                        "severity": "medium",
                        "note": f"API makes {fetch_count} external requests without timeout — can hang indefinitely",
                    })

        report.bugs_found = bugs
        report.security_issues = security
        report.performance_issues = perf

    # ─── Task 5: Competitor Research ─────────────────────────────────────

    async def _task_5_competitor_research(self, report: AgentReport):
        """Compare with competitors using browser automation."""
        self.log("Task 5/6: Competitor Research")

        comparisons = []

        for comp_name, comp_path in self.page.competitor_pages.items():
            comp_base = COMPETITORS.get(comp_name, "")
            if not comp_base:
                continue

            comp_url = f"{comp_base}{comp_path}"

            if BROWSER_OK and browser_pool.is_available:
                try:
                    comp_analysis = await visit_competitor(comp_url, self.agent_id)
                    comparisons.append({
                        "competitor": comp_name,
                        "url": comp_url,
                        "status": comp_analysis.status_code,
                        "load_time_ms": comp_analysis.load_time_ms,
                        "total_elements": comp_analysis.element_counts.get("total_elements", 0),
                        "has_data": len(comp_analysis.text_content) > 100,
                        "screenshot": comp_analysis.screenshot_path,
                        "console_errors": len(comp_analysis.console_errors),
                    })
                except Exception as e:
                    comparisons.append({
                        "competitor": comp_name,
                        "url": comp_url,
                        "error": str(e),
                    })
            else:
                comparisons.append({
                    "competitor": comp_name,
                    "url": comp_url,
                    "note": "Browser not available — skipped live comparison",
                })

        # Always add analysis notes based on what we know
        comparisons.append({
            "type": "feature_comparison",
            "our_features": self.page.key_metrics,
            "data_sources_count": len(self.page.data_sources),
            "is_realtime": self.page.real_time,
        })

        report.competitor_comparison = comparisons

    # ─── Task 6: Improvement Proposals ───────────────────────────────────

    async def _task_6_improvements(self, report: AgentReport):
        """Generate improvement proposals based on all findings."""
        self.log("Task 6/6: Generating Improvements")

        proposals = []

        source_path = os.path.join(SRC_ROOT, self.page.source_file)
        source = self._read_source(source_path)

        if source:
            line_count = len(source.split("\n"))

            # Component splitting proposal
            if line_count > 400:
                proposals.append({
                    "type": "refactor",
                    "priority": "medium",
                    "title": "Split into sub-components",
                    "description": f"Page is {line_count} lines. Extract chart, table, filters into separate components for maintainability.",
                    "effort": "medium",
                })

            # WebSocket upgrade
            if self.page.real_time and "WebSocket" not in source:
                proposals.append({
                    "type": "feature",
                    "priority": "high",
                    "title": "Add WebSocket for real-time updates",
                    "description": f"Replace SWR polling with WebSocket connection for true real-time data on {self.page.name}.",
                    "effort": "high",
                    "code_hint": """
// Example WebSocket integration:
const ws = useRef<WebSocket | null>(null);
useEffect(() => {
  ws.current = new WebSocket('wss://stream.binance.com/ws');
  ws.current.onmessage = (e) => {
    const data = JSON.parse(e.data);
    setData(prev => mergeUpdate(prev, data));
  };
  return () => ws.current?.close();
}, []);""",
                })

            # Mobile responsiveness
            if not any(kw in source for kw in ["md:", "lg:", "sm:"]):
                proposals.append({
                    "type": "ui",
                    "priority": "high",
                    "title": "Add mobile responsive layout",
                    "description": "Add Tailwind responsive breakpoints (sm:, md:, lg:) for mobile users.",
                    "effort": "medium",
                })

            # Virtualization for large lists
            if any(kw in source for kw in [".map(", "forEach", "Array.from"]):
                proposals.append({
                    "type": "performance",
                    "priority": "medium",
                    "title": "Add virtualization for large data sets",
                    "description": "Use react-window or react-virtuoso to virtualize rows for better performance with 1000+ items.",
                    "effort": "medium",
                })

            # Keyboard navigation
            proposals.append({
                "type": "accessibility",
                "priority": "low",
                "title": "Add keyboard navigation",
                "description": "Support arrow keys for table navigation, Enter to select, Escape to close modals.",
                "effort": "low",
            })

            # Data export
            has_export = "export" in source.lower() or "download" in source.lower() or "csv" in source.lower()
            if not has_export:
                proposals.append({
                    "type": "feature",
                    "priority": "low",
                    "title": "Add data export (CSV/JSON)",
                    "description": f"Allow users to export {self.page.name} data as CSV or JSON for further analysis.",
                    "effort": "low",
                })

        report.improvement_proposals = proposals

    # ─── Score Calculation ───────────────────────────────────────────────

    def _calculate_scores(self, report: AgentReport) -> AgentScore:
        """Calculate 1-10 scores based on findings."""
        score = AgentScore()

        # UI/UX score: start at 8, deduct for issues
        ui_score = 8.0
        for finding in report.ui_ux_findings:
            severity = finding.get("severity", "low")
            if severity == "high":
                ui_score -= 1.5
            elif severity == "medium":
                ui_score -= 0.8
            elif severity == "low":
                ui_score -= 0.3
        score.ui_ux = max(1.0, min(10.0, round(ui_score, 1)))

        # Data accuracy: start at 8, deduct for verification failures
        data_score = 8.0
        for v in report.data_verification:
            if v.get("error"):
                data_score -= 2.0
            if v.get("status") and v["status"] != 200:
                data_score -= 1.5
            if v.get("has_data_indicators") is False:
                data_score -= 2.0
        score.data_accuracy = max(1.0, min(10.0, round(data_score, 1)))

        # Real-time score
        rt_score = 7.0
        for check in report.realtime_check:
            if check.get("type") == "not_realtime":
                rt_score = 7.0  # N/A, neutral score
                break
            if check.get("has_realtime") is False:
                rt_score -= 3.0
            if check.get("values_changed") is True:
                rt_score += 2.0
            if check.get("type") == "missing_realtime":
                rt_score -= 2.0
        score.real_time = max(1.0, min(10.0, round(rt_score, 1)))

        # Bug risk: start at 9, deduct heavily for critical bugs
        bug_score = 9.0
        for bug in report.bugs_found:
            severity = bug.get("severity", "low")
            if severity == "critical":
                bug_score -= 3.0
            elif severity == "high":
                bug_score -= 1.5
            elif severity == "medium":
                bug_score -= 0.8
            else:
                bug_score -= 0.3
        for sec in report.security_issues:
            severity = sec.get("severity", "low")
            if severity == "critical":
                bug_score -= 3.0
            elif severity == "high":
                bug_score -= 1.5
            else:
                bug_score -= 0.5
        score.bug_risk = max(1.0, min(10.0, round(bug_score, 1)))

        return score

    # ─── Helpers ─────────────────────────────────────────────────────────

    def _read_source(self, path: str) -> str:
        """Read a source file, return empty string on failure."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            self.log_warn(f"Could not read: {path}")
            return ""
