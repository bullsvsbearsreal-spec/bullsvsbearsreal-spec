#!/usr/bin/env python3
"""
dashboard_auditor.py — 18-Agent Dashboard Audit System
=======================================================

Runs 17 specialist agents (one per page) + 1 supervisor agent
to audit, verify, and improve the InfoHub crypto trading dashboard.

Usage:
    python dashboard_auditor.py                  # Full audit with browser
    python dashboard_auditor.py --no-browser     # Skip browser automation
    python dashboard_auditor.py --headed         # Show browser window
    python dashboard_auditor.py --streamlit      # Launch Streamlit dashboard after audit

Requirements:
    pip install -r requirements.txt
    playwright install chromium
"""

import argparse
import asyncio
import os
import sys
import time
from datetime import datetime

from rich.console import Console
from rich.panel import Panel
from rich.text import Text

# ─── Ensure imports work from the audit-system directory ─────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import PAGES, REPORT_DIR, PROD_BASE_URL
from agents import SupervisorAgent


console = Console()


# ─── ASCII Banner ────────────────────────────────────────────────────────────
BANNER = r"""
 ___  ___        _                    _      _            _   _ _
|   \|   \ __ _ | |_  ____  __ _ _ _| |_   /_\ _  _ __ | |_(_| |_ ___ _ _
| |) | |) / _` ||  _|/ _  \/ _` | '_|  _| / _ | || / _||  _| |  _/ _ | '_|
|___/|___/\__,_| \__|\__, \__,_|_|  \__|/_/ \_\_,_\__| \__|_|\__\___/_|
                     |___/
"""


def parse_args():
    parser = argparse.ArgumentParser(description="18-Agent Dashboard Auditor")
    parser.add_argument("--no-browser", action="store_true", help="Skip Playwright browser automation")
    parser.add_argument("--headed", action="store_true", help="Show browser window (not headless)")
    parser.add_argument("--streamlit", action="store_true", help="Launch Streamlit dashboard after audit")
    parser.add_argument("--url", type=str, default=None, help="Override base URL to audit")
    return parser.parse_args()


async def main():
    args = parse_args()

    # Override config if needed
    if args.url:
        import config
        config.PROD_BASE_URL = args.url

    if args.headed:
        os.environ["HEADLESS"] = "false"

    # ─── Print banner ────────────────────────────────────────────────
    console.print(BANNER, style="bold bright_blue")
    console.print(Panel(
        f"[bold white]18-AGENT DASHBOARD AUDIT SYSTEM[/]\n"
        f"[dim]Target: {PROD_BASE_URL}[/]\n"
        f"[dim]Pages: {len(PAGES)} | Agents: {len(PAGES) + 1} (17 specialists + 1 supervisor)[/]\n"
        f"[dim]Browser: {'Disabled' if args.no_browser else 'Headless' if not args.headed else 'Headed'}[/]\n"
        f"[dim]Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/]",
        border_style="bright_blue",
        title="[bold]InfoHub Auditor[/]",
        subtitle=f"[dim]v1.0.0[/]",
        padding=(1, 2),
    ))

    # ─── Initialize browser if enabled ───────────────────────────────
    if not args.no_browser:
        try:
            from browser_automation import browser_pool
            console.print("\n[bold]Launching browser...[/]")
            await browser_pool.start()
        except Exception as e:
            console.print(f"[yellow]Browser launch failed: {e}[/]")
            console.print("[yellow]Continuing without browser automation.[/]")

    # ─── Create output directory ─────────────────────────────────────
    os.makedirs(REPORT_DIR, exist_ok=True)

    # ─── Run the supervisor (which runs all 17 specialists) ──────────
    console.print()
    start_time = time.monotonic()

    supervisor = SupervisorAgent(console=console)
    final_report = await supervisor.execute()

    total_time = round(time.monotonic() - start_time, 1)

    # ─── Final output ────────────────────────────────────────────────
    console.print()
    console.print(Panel(
        f"[bold green]AUDIT COMPLETE[/]\n\n"
        f"[bold]Total time:[/] {total_time}s\n"
        f"[bold]Reports saved to:[/] {os.path.abspath(REPORT_DIR)}/\n"
        f"[bold]Overall score:[/] {final_report.score.overall}/10\n\n"
        f"[dim]Files generated:[/]\n"
        f"  - audit_*.json  (raw data)\n"
        f"  - audit_*.md    (Markdown report)\n"
        f"  - audit_*.html  (visual dashboard)\n"
        f"  - screenshots/  (page captures)",
        border_style="bright_green",
        title="[bold]Done[/]",
        padding=(1, 2),
    ))

    # ─── Cleanup browser ─────────────────────────────────────────────
    if not args.no_browser:
        try:
            from browser_automation import browser_pool
            await browser_pool.stop()
        except Exception:
            pass

    # ─── Launch Streamlit if requested ───────────────────────────────
    if args.streamlit:
        console.print("\n[bold]Launching Streamlit dashboard...[/]")
        os.system(f"streamlit run {os.path.join(os.path.dirname(__file__), 'streamlit_dashboard.py')}")


# ─── Entry point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    asyncio.run(main())
