"""
Supervisor Agent — the 18th agent.

Responsibilities:
  - Orchestrate parallel execution of all 17 specialist agents
  - Collect and cross-validate reports
  - Resolve conflicts between agent findings
  - Generate the final consolidated audit report
  - Produce executive summary with prioritized fix list
"""

import asyncio
import json
import os
import time
from datetime import datetime
from typing import Optional

from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.table import Table
from rich.text import Text
from rich.columns import Columns

from config import PAGES, REPORT_DIR, SUPERVISOR_POLL_INTERVAL, MAX_AGENT_RUNTIME
from .base_agent import BaseAgent, AgentReport, AgentScore, AgentState
from .specialist_agent import SpecialistAgent


class SupervisorAgent(BaseAgent):
    """
    The 18th agent — supervises and coordinates all 17 specialists.
    """

    def __init__(self, console: Optional[Console] = None):
        super().__init__(
            agent_id="supervisor",
            name="Supervisor Agent",
            console=console or Console(),
        )
        self.specialists: list[SpecialistAgent] = []
        self.reports: list[AgentReport] = []
        self._progress: Optional[Progress] = None

    def initialize_specialists(self):
        """Create all 17 specialist agents."""
        self.specialists = [
            SpecialistAgent(page_config=page, console=self.console)
            for page in PAGES
        ]
        self.log(f"Initialized {len(self.specialists)} specialist agents")

    async def run(self) -> AgentReport:
        """Orchestrate all specialists and produce consolidated report."""
        supervisor_report = AgentReport(
            agent_id="supervisor",
            agent_name="Supervisor Agent",
            page_name="ALL PAGES",
            category="SUPERVISOR",
        )

        # Initialize specialists
        self.initialize_specialists()

        # ─── Phase 1: Launch all 17 agents in parallel ───────────────
        self.console.print()
        self.console.print(Panel(
            "[bold white]PHASE 1: Launching 17 Specialist Agents in Parallel[/]",
            border_style="bright_blue",
            padding=(0, 2),
        ))

        self.reports = await self._run_all_specialists()

        # ─── Phase 2: Cross-validate findings ────────────────────────
        self.console.print()
        self.console.print(Panel(
            "[bold white]PHASE 2: Cross-Validating Findings[/]",
            border_style="bright_yellow",
            padding=(0, 2),
        ))

        cross_validation = self._cross_validate()
        supervisor_report.data_verification = cross_validation

        # ─── Phase 3: Generate consolidated scores ───────────────────
        self.console.print()
        self.console.print(Panel(
            "[bold white]PHASE 3: Computing Consolidated Scores[/]",
            border_style="bright_green",
            padding=(0, 2),
        ))

        self._print_scoreboard()

        # ─── Phase 4: Prioritized fix list ───────────────────────────
        fix_list = self._generate_fix_list()
        supervisor_report.improvement_proposals = fix_list

        # Aggregate supervisor score from all specialists
        if self.reports:
            avg_scores = AgentScore(
                ui_ux=round(sum(r.score.ui_ux for r in self.reports) / len(self.reports), 1),
                data_accuracy=round(sum(r.score.data_accuracy for r in self.reports) / len(self.reports), 1),
                real_time=round(sum(r.score.real_time for r in self.reports) / len(self.reports), 1),
                bug_risk=round(sum(r.score.bug_risk for r in self.reports) / len(self.reports), 1),
            )
            supervisor_report.score = avg_scores

        # ─── Phase 5: Save all reports ───────────────────────────────
        self._save_reports(supervisor_report)

        # ─── Phase 6: Print executive summary ────────────────────────
        self._print_executive_summary(supervisor_report)

        return supervisor_report

    # ─── Parallel Execution ──────────────────────────────────────────────

    async def _run_all_specialists(self) -> list[AgentReport]:
        """Run all 17 specialist agents concurrently with progress tracking."""
        reports = []

        progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(bar_width=30),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=self.console,
        )

        overall_task = progress.add_task("Overall Progress", total=len(self.specialists))
        agent_tasks = {}
        for spec in self.specialists:
            agent_tasks[spec.agent_id] = progress.add_task(
                f"  {spec.page.name}", total=1, visible=True
            )

        async def run_one(specialist: SpecialistAgent) -> AgentReport:
            report = await specialist.execute()
            progress.update(agent_tasks[specialist.agent_id], completed=1)
            progress.update(overall_task, advance=1)
            return report

        with progress:
            # Create all tasks
            tasks = [run_one(spec) for spec in self.specialists]

            # Run with timeout
            try:
                results = await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=MAX_AGENT_RUNTIME,
                )
            except asyncio.TimeoutError:
                self.log_warn(f"Some agents timed out after {MAX_AGENT_RUNTIME}s")
                results = []

        for result in results:
            if isinstance(result, AgentReport):
                reports.append(result)
            elif isinstance(result, Exception):
                self.log_error(f"Agent failed: {result}")

        self.log_success(f"Collected {len(reports)}/{len(self.specialists)} reports")
        return reports

    # ─── Cross-Validation ────────────────────────────────────────────────

    def _cross_validate(self) -> list[dict]:
        """Cross-validate findings across agents."""
        validations = []

        # Check for consistent API health
        api_statuses = {}
        for r in self.reports:
            for v in r.data_verification:
                if v.get("type") == "api_check" and v.get("endpoint"):
                    api_statuses[v["endpoint"]] = v.get("status", 0)

        failing_apis = {ep: st for ep, st in api_statuses.items() if st != 200}
        if failing_apis:
            validations.append({
                "type": "cross_validation",
                "finding": "api_health",
                "severity": "critical",
                "details": f"{len(failing_apis)} API endpoints returning non-200 status",
                "endpoints": failing_apis,
            })

        # Check for consistent security issues
        all_security = []
        for r in self.reports:
            for s in r.security_issues:
                all_security.append({"page": r.page_name, **s})

        if all_security:
            validations.append({
                "type": "cross_validation",
                "finding": "security_summary",
                "total_issues": len(all_security),
                "critical": sum(1 for s in all_security if s.get("severity") == "critical"),
                "high": sum(1 for s in all_security if s.get("severity") == "high"),
                "details": all_security,
            })

        # Check for SWR key bugs across pages (the pattern we already found)
        swr_bugs = []
        for r in self.reports:
            for b in r.bugs_found:
                if b.get("type") == "swr_static_key":
                    swr_bugs.append({"page": r.page_name, **b})

        if swr_bugs:
            validations.append({
                "type": "cross_validation",
                "finding": "swr_key_pattern",
                "severity": "high",
                "details": f"{len(swr_bugs)} pages have static SWR keys with dynamic params",
                "pages": [s["page"] for s in swr_bugs],
            })

        # Check for pages without error handling
        no_error_handling = [
            r.page_name for r in self.reports
            if any(b.get("type") == "api_no_error_handling" for b in r.bugs_found)
        ]
        if no_error_handling:
            validations.append({
                "type": "cross_validation",
                "finding": "missing_error_handling",
                "severity": "high",
                "details": f"{len(no_error_handling)} API routes lack try/catch error handling",
                "pages": no_error_handling,
            })

        self.log_success(f"Cross-validation complete: {len(validations)} findings")
        return validations

    # ─── Scoreboard ──────────────────────────────────────────────────────

    def _print_scoreboard(self):
        """Print a beautiful scoreboard table."""
        table = Table(
            title="Dashboard Audit Scoreboard",
            show_header=True,
            header_style="bold white on dark_blue",
            border_style="bright_blue",
            padding=(0, 1),
        )

        table.add_column("Page", style="bold white", min_width=20)
        table.add_column("Category", style="dim")
        table.add_column("UI/UX", justify="center")
        table.add_column("Data", justify="center")
        table.add_column("RT", justify="center")
        table.add_column("Bugs", justify="center")
        table.add_column("Overall", justify="center", style="bold")
        table.add_column("Time", justify="right", style="dim")

        for r in sorted(self.reports, key=lambda x: x.score.overall):
            table.add_row(
                r.page_name,
                r.category,
                self._color_score(r.score.ui_ux),
                self._color_score(r.score.data_accuracy),
                self._color_score(r.score.real_time),
                self._color_score(r.score.bug_risk),
                self._color_score(r.score.overall),
                f"{r.duration_seconds:.1f}s",
            )

        # Average row
        if self.reports:
            n = len(self.reports)
            table.add_section()
            table.add_row(
                "[bold]AVERAGE[/]",
                "",
                self._color_score(round(sum(r.score.ui_ux for r in self.reports) / n, 1)),
                self._color_score(round(sum(r.score.data_accuracy for r in self.reports) / n, 1)),
                self._color_score(round(sum(r.score.real_time for r in self.reports) / n, 1)),
                self._color_score(round(sum(r.score.bug_risk for r in self.reports) / n, 1)),
                self._color_score(round(sum(r.score.overall for r in self.reports) / n, 1)),
                f"{sum(r.duration_seconds for r in self.reports):.1f}s",
            )

        self.console.print(table)

    def _color_score(self, score: float) -> str:
        """Color a score red/yellow/green based on value."""
        if score >= 8:
            return f"[green]{score}[/]"
        elif score >= 6:
            return f"[yellow]{score}[/]"
        else:
            return f"[red]{score}[/]"

    # ─── Fix List ────────────────────────────────────────────────────────

    def _generate_fix_list(self) -> list[dict]:
        """Generate a prioritized fix list from all reports."""
        all_issues = []

        for r in self.reports:
            # Critical bugs
            for bug in r.bugs_found:
                all_issues.append({
                    "page": r.page_name,
                    "type": "bug",
                    "severity": bug.get("severity", "low"),
                    "description": bug.get("note", ""),
                    "category": bug.get("type", ""),
                })

            # Security issues
            for sec in r.security_issues:
                all_issues.append({
                    "page": r.page_name,
                    "type": "security",
                    "severity": sec.get("severity", "medium"),
                    "description": sec.get("note", ""),
                    "category": sec.get("type", ""),
                })

            # Performance issues
            for perf in r.performance_issues:
                all_issues.append({
                    "page": r.page_name,
                    "type": "performance",
                    "severity": perf.get("severity", "low"),
                    "description": perf.get("note", ""),
                    "category": perf.get("type", ""),
                })

        # Sort by severity
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        all_issues.sort(key=lambda x: severity_order.get(x["severity"], 4))

        # Print prioritized list
        if all_issues:
            self.console.print()
            fix_table = Table(
                title="Prioritized Fix List",
                show_header=True,
                header_style="bold white on dark_red",
                border_style="red",
            )
            fix_table.add_column("#", justify="right", width=4)
            fix_table.add_column("Severity", justify="center", width=10)
            fix_table.add_column("Page", width=18)
            fix_table.add_column("Type", width=12)
            fix_table.add_column("Description", min_width=40)

            for i, issue in enumerate(all_issues[:30], 1):  # Top 30
                sev = issue["severity"]
                sev_style = {"critical": "red bold", "high": "red", "medium": "yellow", "low": "dim"}.get(sev, "")
                fix_table.add_row(
                    str(i),
                    f"[{sev_style}]{sev.upper()}[/]",
                    issue["page"],
                    issue["type"],
                    issue["description"][:80],
                )

            self.console.print(fix_table)

        return all_issues

    # ─── Save Reports ────────────────────────────────────────────────────

    def _save_reports(self, supervisor_report: AgentReport):
        """Save all reports to disk as JSON and Markdown."""
        os.makedirs(REPORT_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Save individual agent reports as JSON
        all_data = {
            "timestamp": timestamp,
            "supervisor": supervisor_report.to_dict(),
            "agents": [r.to_dict() for r in self.reports],
        }

        json_path = os.path.join(REPORT_DIR, f"audit_{timestamp}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(all_data, f, indent=2, default=str)

        self.log_success(f"JSON report saved: {json_path}")

        # Save Markdown report
        md_path = os.path.join(REPORT_DIR, f"audit_{timestamp}.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(self._generate_markdown(supervisor_report, timestamp))

        self.log_success(f"Markdown report saved: {md_path}")

        # Save HTML report
        html_path = os.path.join(REPORT_DIR, f"audit_{timestamp}.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(self._generate_html(supervisor_report, timestamp))

        self.log_success(f"HTML report saved: {html_path}")

    # ─── Markdown Generation ─────────────────────────────────────────────

    def _generate_markdown(self, supervisor_report: AgentReport, timestamp: str) -> str:
        """Generate a comprehensive Markdown audit report."""
        md = []
        md.append(f"# InfoHub Dashboard Audit Report")
        md.append(f"**Generated:** {timestamp}")
        md.append(f"**Pages Audited:** {len(self.reports)}")
        md.append(f"**Total Duration:** {sum(r.duration_seconds for r in self.reports):.1f}s")
        md.append("")

        # Executive Summary
        md.append("## Executive Summary")
        md.append("")
        if self.reports:
            avg = supervisor_report.score
            md.append(f"| Metric | Score |")
            md.append(f"|--------|-------|")
            md.append(f"| UI/UX | {avg.ui_ux}/10 |")
            md.append(f"| Data Accuracy | {avg.data_accuracy}/10 |")
            md.append(f"| Real-time | {avg.real_time}/10 |")
            md.append(f"| Bug Risk | {avg.bug_risk}/10 |")
            md.append(f"| **Overall** | **{avg.overall}/10** |")
            md.append("")

        total_bugs = sum(len(r.bugs_found) for r in self.reports)
        total_security = sum(len(r.security_issues) for r in self.reports)
        total_perf = sum(len(r.performance_issues) for r in self.reports)
        md.append(f"- **Bugs Found:** {total_bugs}")
        md.append(f"- **Security Issues:** {total_security}")
        md.append(f"- **Performance Issues:** {total_perf}")
        md.append(f"- **Improvement Proposals:** {sum(len(r.improvement_proposals) for r in self.reports)}")
        md.append("")

        # Scoreboard
        md.append("## Scoreboard")
        md.append("")
        md.append("| Page | Category | UI/UX | Data | RT | Bugs | Overall |")
        md.append("|------|----------|-------|------|----|------|---------|")
        for r in sorted(self.reports, key=lambda x: x.score.overall):
            md.append(
                f"| {r.page_name} | {r.category} | {r.score.ui_ux} | "
                f"{r.score.data_accuracy} | {r.score.real_time} | "
                f"{r.score.bug_risk} | **{r.score.overall}** |"
            )
        md.append("")

        # Per-page details
        for r in self.reports:
            md.append(f"## {r.page_name} ({r.category})")
            md.append(f"*Agent: {r.agent_id} | Duration: {r.duration_seconds}s*")
            md.append("")

            if r.bugs_found:
                md.append("### Bugs")
                for bug in r.bugs_found:
                    md.append(f"- **[{bug.get('severity', 'low').upper()}]** {bug.get('note', '')}")
                md.append("")

            if r.security_issues:
                md.append("### Security")
                for sec in r.security_issues:
                    md.append(f"- **[{sec.get('severity', 'low').upper()}]** {sec.get('note', '')}")
                md.append("")

            if r.improvement_proposals:
                md.append("### Improvements")
                for prop in r.improvement_proposals:
                    md.append(f"- [{prop.get('priority', 'low').upper()}] **{prop.get('title', '')}** — {prop.get('description', '')}")
                md.append("")

        # Cross-validation
        if supervisor_report.data_verification:
            md.append("## Cross-Validation Results")
            for cv in supervisor_report.data_verification:
                md.append(f"- **{cv.get('finding', '')}** [{cv.get('severity', 'info')}]: {cv.get('details', '')}")
            md.append("")

        # Fix list
        if supervisor_report.improvement_proposals:
            md.append("## Prioritized Fix List")
            md.append("")
            md.append("| # | Severity | Page | Type | Description |")
            md.append("|---|----------|------|------|-------------|")
            for i, fix in enumerate(supervisor_report.improvement_proposals[:30], 1):
                md.append(
                    f"| {i} | {fix['severity'].upper()} | {fix['page']} | "
                    f"{fix['type']} | {fix['description'][:60]} |"
                )
            md.append("")

        return "\n".join(md)

    # ─── HTML Generation ─────────────────────────────────────────────────

    def _generate_html(self, supervisor_report: AgentReport, timestamp: str) -> str:
        """Generate a styled HTML dashboard report."""
        total_bugs = sum(len(r.bugs_found) for r in self.reports)
        total_security = sum(len(r.security_issues) for r in self.reports)
        total_proposals = sum(len(r.improvement_proposals) for r in self.reports)
        avg = supervisor_report.score

        # Build per-page cards
        cards_html = ""
        for r in sorted(self.reports, key=lambda x: x.score.overall):
            bugs_html = ""
            for bug in r.bugs_found[:5]:
                sev = bug.get("severity", "low")
                bugs_html += f'<li class="sev-{sev}">[{sev.upper()}] {bug.get("note", "")}</li>'

            improvements_html = ""
            for prop in r.improvement_proposals[:3]:
                improvements_html += f'<li><strong>{prop.get("title", "")}</strong> — {prop.get("description", "")[:80]}</li>'

            score_color = "#4caf50" if r.score.overall >= 8 else "#ff9800" if r.score.overall >= 6 else "#f44336"

            cards_html += f"""
            <div class="card">
                <div class="card-header">
                    <h3>{r.page_name}</h3>
                    <span class="badge" style="background:{score_color}">{r.score.overall}</span>
                </div>
                <div class="card-category">{r.category}</div>
                <div class="scores-grid">
                    <div class="score-item"><span class="score-label">UI/UX</span><span>{r.score.ui_ux}</span></div>
                    <div class="score-item"><span class="score-label">Data</span><span>{r.score.data_accuracy}</span></div>
                    <div class="score-item"><span class="score-label">RT</span><span>{r.score.real_time}</span></div>
                    <div class="score-item"><span class="score-label">Bugs</span><span>{r.score.bug_risk}</span></div>
                </div>
                {"<h4>Issues</h4><ul>" + bugs_html + "</ul>" if bugs_html else ""}
                {"<h4>Improvements</h4><ul>" + improvements_html + "</ul>" if improvements_html else ""}
                <div class="card-footer">Duration: {r.duration_seconds:.1f}s</div>
            </div>"""

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>InfoHub Dashboard Audit — {timestamp}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ background: #0a0a0f; color: #e0e0e0; font-family: 'Inter', -apple-system, sans-serif; padding: 24px; }}
        .header {{ text-align: center; padding: 32px 0; border-bottom: 1px solid #1a1a2e; margin-bottom: 32px; }}
        .header h1 {{ font-size: 28px; color: #fff; margin-bottom: 8px; }}
        .header .subtitle {{ color: #888; font-size: 14px; }}
        .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }}
        .summary-card {{ background: #12121f; border: 1px solid #1a1a2e; border-radius: 12px; padding: 20px; text-align: center; }}
        .summary-card .value {{ font-size: 32px; font-weight: 700; color: #fff; }}
        .summary-card .label {{ font-size: 12px; color: #888; text-transform: uppercase; margin-top: 4px; }}
        .cards-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }}
        .card {{ background: #12121f; border: 1px solid #1a1a2e; border-radius: 12px; padding: 20px; }}
        .card-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }}
        .card-header h3 {{ font-size: 18px; color: #fff; }}
        .badge {{ padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 14px; color: #fff; }}
        .card-category {{ font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 12px; }}
        .scores-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }}
        .score-item {{ text-align: center; padding: 8px; background: #0a0a15; border-radius: 8px; }}
        .score-label {{ display: block; font-size: 10px; color: #666; text-transform: uppercase; }}
        .card h4 {{ font-size: 13px; color: #aaa; margin: 8px 0 4px; }}
        .card ul {{ font-size: 12px; padding-left: 16px; color: #999; }}
        .card li {{ margin-bottom: 4px; }}
        .sev-critical {{ color: #f44336 !important; font-weight: 600; }}
        .sev-high {{ color: #ff9800 !important; }}
        .sev-medium {{ color: #ffc107 !important; }}
        .card-footer {{ font-size: 11px; color: #444; margin-top: 12px; text-align: right; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>InfoHub Dashboard Audit Report</h1>
        <div class="subtitle">Generated {timestamp} | {len(self.reports)} pages audited | 18 AI agents</div>
    </div>

    <div class="summary">
        <div class="summary-card"><div class="value">{avg.overall}</div><div class="label">Overall Score</div></div>
        <div class="summary-card"><div class="value">{avg.ui_ux}</div><div class="label">UI/UX</div></div>
        <div class="summary-card"><div class="value">{avg.data_accuracy}</div><div class="label">Data Accuracy</div></div>
        <div class="summary-card"><div class="value">{avg.real_time}</div><div class="label">Real-time</div></div>
        <div class="summary-card"><div class="value">{avg.bug_risk}</div><div class="label">Bug Risk</div></div>
        <div class="summary-card"><div class="value" style="color:#f44336">{total_bugs}</div><div class="label">Bugs Found</div></div>
        <div class="summary-card"><div class="value" style="color:#ff9800">{total_security}</div><div class="label">Security Issues</div></div>
        <div class="summary-card"><div class="value" style="color:#4caf50">{total_proposals}</div><div class="label">Improvements</div></div>
    </div>

    <div class="cards-grid">
        {cards_html}
    </div>
</body>
</html>"""

    # ─── Executive Summary ───────────────────────────────────────────────

    def _print_executive_summary(self, supervisor_report: AgentReport):
        """Print a beautiful executive summary to console."""
        self.console.print()

        total_bugs = sum(len(r.bugs_found) for r in self.reports)
        total_security = sum(len(r.security_issues) for r in self.reports)
        total_proposals = sum(len(r.improvement_proposals) for r in self.reports)
        total_time = sum(r.duration_seconds for r in self.reports)

        summary = Table.grid(padding=(0, 2))
        summary.add_row(
            f"[bold]Pages Audited:[/] {len(self.reports)}/17",
            f"[bold]Total Time:[/] {total_time:.1f}s",
        )
        summary.add_row(
            f"[red bold]Bugs:[/] {total_bugs}",
            f"[yellow bold]Security:[/] {total_security}",
        )
        summary.add_row(
            f"[green bold]Proposals:[/] {total_proposals}",
            f"[bold]Overall Score:[/] {supervisor_report.score.overall}/10",
        )

        self.console.print(Panel(
            summary,
            title="[bold white]EXECUTIVE SUMMARY[/]",
            border_style="bright_green",
            padding=(1, 2),
        ))

        # Top issues
        worst_pages = sorted(self.reports, key=lambda r: r.score.overall)[:3]
        if worst_pages:
            self.console.print()
            self.console.print("[bold red]Pages Needing Most Attention:[/]")
            for r in worst_pages:
                self.console.print(
                    f"  [red]{r.page_name}[/] — Score: {r.score.overall}/10 | "
                    f"Bugs: {len(r.bugs_found)} | Security: {len(r.security_issues)}"
                )

        # Best pages
        best_pages = sorted(self.reports, key=lambda r: r.score.overall, reverse=True)[:3]
        if best_pages:
            self.console.print()
            self.console.print("[bold green]Top Performing Pages:[/]")
            for r in best_pages:
                self.console.print(
                    f"  [green]{r.page_name}[/] — Score: {r.score.overall}/10"
                )

        # Feature ideas
        self.console.print()
        self.console.print("[bold cyan]Bonus Feature Ideas:[/]")
        ideas = [
            "WebSocket-powered real-time mode for all pages (replace SWR polling)",
            "Cross-page correlation alerts (e.g., funding spike + OI drop = liquidation risk)",
            "Mobile-first responsive redesign with swipe gestures",
            "Data export to CSV/JSON on every page",
            "Custom alert system — get notified when metrics cross thresholds",
            "Dark/light theme toggle with system preference detection",
            "Keyboard shortcuts for power users (j/k navigation, / search)",
        ]
        for idea in ideas:
            self.console.print(f"  [dim]-[/] {idea}")
