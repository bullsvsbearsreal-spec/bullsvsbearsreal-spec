"""
Configuration for the 18-Agent Dashboard Auditor.
Maps all 17 pages from the InfoHub sidebar to their agent configurations.
"""

import os
from dataclasses import dataclass, field
from typing import Optional

# ─── Base URLs ───────────────────────────────────────────────────────────────
PROD_BASE_URL = os.getenv("INFOHUB_URL", "https://bullvsbear.info")
LOCAL_BASE_URL = "http://localhost:3000"

# ─── Source code root (relative to audit-system/) ────────────────────────────
SRC_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))

# ─── Report output ───────────────────────────────────────────────────────────
REPORT_DIR = os.path.join(os.path.dirname(__file__), "audit_reports")

# ─── Competitor sites for cross-referencing ──────────────────────────────────
COMPETITORS = {
    "coinglass":     "https://www.coinglass.com",
    "tradingview":   "https://www.tradingview.com",
    "tradinglite":   "https://www.tradinglite.com",
    "hyblock":       "https://www.hyblock.co",
    "bookmap":       "https://bookmap.com",
    "laevitas":      "https://app.laevitas.ch",
    "velo_data":     "https://velo.xyz",
    "coinank":       "https://coinank.com",
}


@dataclass
class PageConfig:
    """Configuration for a single dashboard page/feature."""
    name: str                     # Human-readable name
    agent_id: str                 # Unique agent identifier
    route: str                    # Next.js route path
    api_route: Optional[str]      # Backend API route (if any)
    category: str                 # Sidebar category
    source_file: str              # Page source relative to src/
    api_source: Optional[str]     # API route source relative to src/
    description: str              # What the page does
    data_sources: list[str]       # External data sources used
    competitor_pages: dict[str, str] = field(default_factory=dict)
    key_metrics: list[str] = field(default_factory=list)
    real_time: bool = False       # Whether page has real-time data


# ─── All 17 Pages ────────────────────────────────────────────────────────────
PAGES: list[PageConfig] = [
    # ═══ ANALYSIS (6 pages) ═══
    PageConfig(
        name="Chart",
        agent_id="chart_agent",
        route="/chart",
        api_route="/api/klines",
        category="ANALYSIS",
        source_file="app/chart/page.tsx",
        api_source="app/api/klines/route.ts",
        description="TradingView-style candlestick charts with indicators (RSI, MACD, Bollinger Bands). Uses Lightweight Charts library.",
        data_sources=["Binance klines API"],
        competitor_pages={"tradingview": "/chart", "coinglass": "/"},
        key_metrics=["candle accuracy", "indicator math", "zoom/pan performance"],
        real_time=True,
    ),
    PageConfig(
        name="Screener",
        agent_id="screener_agent",
        route="/screener",
        api_route="/api/tickers",
        category="ANALYSIS",
        source_file="app/screener/page.tsx",
        api_source="app/api/tickers/route.ts",
        description="Multi-exchange screener: filter & scan markets by price, volume, change, funding rate. 28+ exchanges.",
        data_sources=["28 exchange ticker APIs"],
        competitor_pages={"coinglass": "/screener", "tradingview": "/screener"},
        key_metrics=["sort speed", "filter accuracy", "volume aggregation"],
        real_time=True,
    ),
    PageConfig(
        name="Options",
        agent_id="options_agent",
        route="/options",
        api_route="/api/options",
        category="ANALYSIS",
        source_file="app/options/page.tsx",
        api_source="app/api/options/route.ts",
        description="Options flow & greeks dashboard. IV surface, put/call ratio, max pain, OI by strike. 4 exchanges: Binance, Bybit, Deribit, OKX.",
        data_sources=["Binance", "Bybit", "Deribit", "OKX options APIs"],
        competitor_pages={"laevitas": "/options", "coinglass": "/options"},
        key_metrics=["IV calculation", "greeks accuracy", "max pain formula"],
    ),
    PageConfig(
        name="Basis",
        agent_id="basis_agent",
        route="/basis",
        api_route="/api/spot-prices",
        category="ANALYSIS",
        source_file="app/basis/page.tsx",
        api_source="app/api/spot-prices/route.ts",
        description="Spot-perpetual premium/discount tracker. Shows basis (%) across exchanges for arbitrage opportunities.",
        data_sources=["Spot + perp price APIs from multiple exchanges"],
        competitor_pages={"coinglass": "/basis", "velo_data": "/basis"},
        key_metrics=["basis calculation", "spread accuracy", "cross-exchange sync"],
    ),
    PageConfig(
        name="Predictions",
        agent_id="predictions_agent",
        route="/prediction-markets",
        api_route="/api/prediction-markets",
        category="ANALYSIS",
        source_file="app/prediction-markets/page.tsx",
        api_source="app/api/prediction-markets/route.ts",
        description="Prediction market aggregator showing crypto-related prediction markets (Polymarket, etc.).",
        data_sources=["Polymarket API", "Manifold API"],
        competitor_pages={},
        key_metrics=["market accuracy", "odds display", "resolution tracking"],
    ),
    PageConfig(
        name="Execution Costs",
        agent_id="execution_costs_agent",
        route="/execution-costs",
        api_route="/api/execution-costs",
        category="ANALYSIS",
        source_file="app/execution-costs/page.tsx",
        api_source="app/api/execution-costs/route.ts",
        description="Compare trading fees, slippage, and execution costs across exchanges. Maker/taker fees, funding impact.",
        data_sources=["Exchange fee schedules", "GMX/gTrade on-chain fees"],
        competitor_pages={"coinglass": "/exchange-comparison"},
        key_metrics=["fee accuracy", "slippage estimation", "total cost calculation"],
    ),

    # ═══ FUNDING & OI (4 pages) ═══
    PageConfig(
        name="Funding Rates",
        agent_id="funding_rates_agent",
        route="/funding",
        api_route="/api/funding",
        category="FUNDING & OI",
        source_file="app/funding/page.tsx",
        api_source="app/api/funding/route.ts",
        description="Live funding rates from 30 exchanges (16 CEX + 12 DEX + 2 blocked). Sortable table with heatmap coloring, arbitrage calculator.",
        data_sources=["30 exchange funding rate APIs"],
        competitor_pages={"coinglass": "/funding-rate", "velo_data": "/funding"},
        key_metrics=["rate accuracy vs source", "update frequency", "arbitrage calc math"],
        real_time=True,
    ),
    PageConfig(
        name="Funding Heatmap",
        agent_id="funding_heatmap_agent",
        route="/funding-heatmap",
        api_route="/api/funding",
        category="FUNDING & OI",
        source_file="app/funding-heatmap/page.tsx",
        api_source="app/api/funding/route.ts",
        description="Visual heatmap grid of funding rates across symbols and exchanges. Color-coded positive/negative rates.",
        data_sources=["Same as Funding Rates"],
        competitor_pages={"coinglass": "/funding-rate/heatmap", "coinank": "/fundingRate"},
        key_metrics=["color scale accuracy", "cell rendering perf", "tooltip data"],
    ),
    PageConfig(
        name="Open Interest",
        agent_id="open_interest_agent",
        route="/open-interest",
        api_route="/api/openinterest",
        category="FUNDING & OI",
        source_file="app/open-interest/page.tsx",
        api_source="app/api/openinterest/route.ts",
        description="Aggregated open interest across 26 exchanges. Bar charts, pie charts, historical OI delta. ~$56-60B total.",
        data_sources=["26 exchange OI APIs"],
        competitor_pages={"coinglass": "/open-interest", "coinank": "/openInterest"},
        key_metrics=["OI aggregation accuracy", "delta calculation", "exchange coverage"],
        real_time=True,
    ),
    PageConfig(
        name="OI Heatmap",
        agent_id="oi_heatmap_agent",
        route="/oi-heatmap",
        api_route="/api/oi-delta",
        category="FUNDING & OI",
        source_file="app/oi-heatmap/page.tsx",
        api_source="app/api/oi-delta/route.ts",
        description="Open interest change heatmap — shows OI delta (%) per symbol over time. Color-coded grid cells.",
        data_sources=["OI delta snapshots"],
        competitor_pages={"coinglass": "/open-interest-heatmap"},
        key_metrics=["delta % accuracy", "color scale", "time window handling"],
    ),

    # ═══ LIQUIDATIONS (3 pages) ═══
    PageConfig(
        name="Liquidations",
        agent_id="liquidations_agent",
        route="/liquidations",
        api_route="/api/liquidations",
        category="LIQUIDATIONS",
        source_file="app/liquidations/page.tsx",
        api_source="app/api/liquidations/route.ts",
        description="Real-time liquidation feed + treemap. Shows individual liq events with size, side, exchange. ~$146M total.",
        data_sources=["Binance (deprecated)", "OKX", "Bybit liquidation streams"],
        competitor_pages={"coinglass": "/liquidations", "hyblock": "/liquidations"},
        key_metrics=["liq event accuracy", "total volume", "feed latency"],
        real_time=True,
    ),
    PageConfig(
        name="Liq Map",
        agent_id="liq_map_agent",
        route="/liquidation-map",
        api_route="/api/liquidation-map",
        category="LIQUIDATIONS",
        source_file="app/liquidation-map/page.tsx",
        api_source="app/api/liquidation-map/route.ts",
        description="Liquidation level map — SVG chart showing estimated liquidation clusters at price levels based on OI + leverage tiers. Synthetic data (50/50 L/S by design).",
        data_sources=["OI data + leverage tier model"],
        competitor_pages={"coinglass": "/liquidation-map", "hyblock": "/liquidation-map"},
        key_metrics=["leverage tier accuracy", "volume estimation", "price level mapping"],
    ),
    PageConfig(
        name="Liq Heatmap",
        agent_id="liq_heatmap_agent",
        route="/liquidation-heatmap",
        api_route="/api/liquidation-heatmap",
        category="LIQUIDATIONS",
        source_file="app/liquidation-heatmap/page.tsx",
        api_source="app/api/liquidation-heatmap/route.ts",
        description="Liquidation heatmap — time vs price grid showing liquidation intensity. Recently fixed SWR cache key bug (symbol+timeframe).",
        data_sources=["OKX live liqs", "DB for 24h/7d timeframes"],
        competitor_pages={"coinglass": "/liquidation-heatmap", "hyblock": "/heatmap"},
        key_metrics=["heatmap cell accuracy", "timeframe switching", "data freshness"],
        real_time=True,
    ),

    # ═══ FLOW (4 pages) ═══
    PageConfig(
        name="Long/Short",
        agent_id="longshort_agent",
        route="/longshort",
        api_route="/api/longshort",
        category="FLOW",
        source_file="app/longshort/page.tsx",
        api_source="app/api/longshort/route.ts",
        description="Binance Long/Short Account Ratio. 10 symbols, history chart + multi-symbol table. Shows % of accounts long vs short.",
        data_sources=["Binance Long/Short Ratio API"],
        competitor_pages={"coinglass": "/long-short", "coinank": "/longShort"},
        key_metrics=["ratio accuracy", "symbol coverage", "history depth"],
    ),
    PageConfig(
        name="CVD",
        agent_id="cvd_agent",
        route="/cvd",
        api_route="/api/aggtrades",
        category="FLOW",
        source_file="app/cvd/page.tsx",
        api_source="app/api/aggtrades/route.ts",
        description="Cumulative Volume Delta — SVG line chart + volume bars from Binance aggregate trades. Shows buying vs selling pressure.",
        data_sources=["Binance aggTrades API"],
        competitor_pages={"tradinglite": "/", "bookmap": "/"},
        key_metrics=["CVD calculation", "volume bar accuracy", "trade classification"],
        real_time=True,
    ),
    PageConfig(
        name="Order Flow",
        agent_id="orderflow_agent",
        route="/orderflow",
        api_route="/api/orderbook",
        category="FLOW",
        source_file="app/orderflow/page.tsx",
        api_source="app/api/orderbook/route.ts",
        description="Multi-exchange order book depth (8 exchanges). 4 tabs: Depth Chart, Exchange Comparison, Order Book, Tape. Recently fixed $ prefix bug.",
        data_sources=["8 exchange orderbook APIs"],
        competitor_pages={"bookmap": "/", "tradinglite": "/"},
        key_metrics=["depth aggregation", "price formatting", "cross-exchange sync"],
        real_time=True,
    ),
    PageConfig(
        name="RSI Heatmap",
        agent_id="rsi_heatmap_agent",
        route="/rsi-heatmap",
        api_route="/api/rsi",
        category="FLOW",
        source_file="app/rsi-heatmap/page.tsx",
        api_source="app/api/rsi/route.ts",
        description="RSI-14 heatmap for 50 symbols across 1H/4H/1D timeframes. Color-coded cells with filter/sort/search.",
        data_sources=["Binance klines for RSI calculation"],
        competitor_pages={"coinglass": "/indicators/rsi"},
        key_metrics=["RSI-14 formula accuracy", "color scale", "timeframe sync"],
    ),
]

# ─── Quick lookup by agent_id ────────────────────────────────────────────────
PAGE_MAP: dict[str, PageConfig] = {p.agent_id: p for p in PAGES}

# ─── Browser config ──────────────────────────────────────────────────────────
BROWSER_HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"
BROWSER_TIMEOUT = 30_000  # ms
SCREENSHOT_DIR = os.path.join(REPORT_DIR, "screenshots")

# ─── Timing ──────────────────────────────────────────────────────────────────
SUPERVISOR_POLL_INTERVAL = 30  # seconds
MAX_AGENT_RUNTIME = 300        # 5 minutes per agent max
