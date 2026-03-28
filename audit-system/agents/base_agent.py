"""
Base Agent class — foundation for all 18 agents.

Provides:
  - Async lifecycle (start / run / stop)
  - Structured reporting (AgentReport dataclass)
  - Logging with Rich console
  - Timing and error handling
"""

import asyncio
import time
import traceback
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from rich.console import Console
from rich.panel import Panel


# ─── Agent States ────────────────────────────────────────────────────────────
class AgentState(Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# ─── Scoring ─────────────────────────────────────────────────────────────────
@dataclass
class AgentScore:
    """Per-page scores (1-10 scale)."""
    ui_ux: float = 0.0
    data_accuracy: float = 0.0
    real_time: float = 0.0
    bug_risk: float = 0.0  # lower = more bugs found = worse

    @property
    def overall(self) -> float:
        return round((self.ui_ux + self.data_accuracy + self.real_time + self.bug_risk) / 4, 1)

    def to_dict(self) -> dict:
        return {
            "ui_ux": self.ui_ux,
            "data_accuracy": self.data_accuracy,
            "real_time": self.real_time,
            "bug_risk": self.bug_risk,
            "overall": self.overall,
        }


# ─── Structured Report ──────────────────────────────────────────────────────
@dataclass
class AgentReport:
    """Structured output from any agent."""
    agent_id: str
    agent_name: str
    page_name: str
    category: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    duration_seconds: float = 0.0
    state: str = "pending"
    score: AgentScore = field(default_factory=AgentScore)

    # Audit sections
    ui_ux_findings: list[dict[str, Any]] = field(default_factory=list)
    data_verification: list[dict[str, Any]] = field(default_factory=list)
    realtime_check: list[dict[str, Any]] = field(default_factory=list)
    bugs_found: list[dict[str, Any]] = field(default_factory=list)
    security_issues: list[dict[str, Any]] = field(default_factory=list)
    performance_issues: list[dict[str, Any]] = field(default_factory=list)
    competitor_comparison: list[dict[str, Any]] = field(default_factory=list)
    improvement_proposals: list[dict[str, Any]] = field(default_factory=list)

    # Evidence
    screenshots: list[str] = field(default_factory=list)
    code_snippets: list[dict[str, str]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "page_name": self.page_name,
            "category": self.category,
            "timestamp": self.timestamp,
            "duration_seconds": self.duration_seconds,
            "state": self.state,
            "score": self.score.to_dict(),
            "ui_ux_findings": self.ui_ux_findings,
            "data_verification": self.data_verification,
            "realtime_check": self.realtime_check,
            "bugs_found": self.bugs_found,
            "security_issues": self.security_issues,
            "performance_issues": self.performance_issues,
            "competitor_comparison": self.competitor_comparison,
            "improvement_proposals": self.improvement_proposals,
            "screenshots": self.screenshots,
            "code_snippets": self.code_snippets,
            "errors": self.errors,
        }


# ─── Base Agent ──────────────────────────────────────────────────────────────
class BaseAgent(ABC):
    """Abstract base class for all agents."""

    def __init__(self, agent_id: str, name: str, console: Optional[Console] = None):
        self.agent_id = agent_id
        self.name = name
        self.console = console or Console()
        self.state = AgentState.IDLE
        self._start_time: float = 0.0
        self._report: Optional[AgentReport] = None

    def log(self, message: str, style: str = "bold cyan"):
        """Print a styled log message."""
        self.console.print(f"  [{self.agent_id}] {message}", style=style)

    def log_success(self, message: str):
        self.console.print(f"  [green bold][OK][/] [{self.agent_id}] {message}")

    def log_warn(self, message: str):
        self.console.print(f"  [yellow bold][!!][/] [{self.agent_id}] {message}")

    def log_error(self, message: str):
        self.console.print(f"  [red bold][ERR][/] [{self.agent_id}] {message}")

    async def execute(self) -> AgentReport:
        """Full lifecycle: start -> run -> finalize. Returns the report."""
        self.state = AgentState.RUNNING
        self._start_time = time.monotonic()

        try:
            self._report = await self.run()
            self._report.duration_seconds = round(time.monotonic() - self._start_time, 2)
            self._report.state = "completed"
            self.state = AgentState.COMPLETED
            self.log_success(f"Completed in {self._report.duration_seconds}s")
        except Exception as e:
            elapsed = round(time.monotonic() - self._start_time, 2)
            self.log_error(f"Failed after {elapsed}s: {e}")
            if self._report is None:
                self._report = AgentReport(
                    agent_id=self.agent_id,
                    agent_name=self.name,
                    page_name="unknown",
                    category="unknown",
                )
            self._report.state = "failed"
            self._report.duration_seconds = elapsed
            self._report.errors.append(traceback.format_exc())
            self.state = AgentState.FAILED

        return self._report

    @abstractmethod
    async def run(self) -> AgentReport:
        """Override in subclasses. Perform the actual audit work."""
        ...

    @property
    def report(self) -> Optional[AgentReport]:
        return self._report
