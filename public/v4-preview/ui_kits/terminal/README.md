# InfoHub Terminal — UI Kit

A high-fidelity recreation of the InfoHub dashboard. Click-through prototype of the live funding / open interest / liquidations experience.

## Files
- `index.html` — interactive terminal shell (navigate, open market detail, filter)
- `Logo.jsx` — exact recreation of `Logo.tsx` (Info + Hub pill)
- `Header.jsx` — 48px sticky nav with mega-menu + ⌘K search affordance
- `MarketTape.jsx` — 28px scrolling ticker under the header
- `FundingTable.jsx` — Bloomberg-flat dense table (primary data surface)
- `MarketDetail.jsx` — right-side drawer showing a coin's metrics
- `Sidebar.jsx` — left rail, collapsible, live status
- `StatCard.jsx` — hero stat cards (24h volume, OI total, etc)
- `LiquidationHeatmap.jsx` — the signature grid visualization
- `Footer.jsx` — status bar with exchange health pill

## What it shows
1. Header with Funding / OI / Liquidations / Screener / Chart / Options nav
2. Market tape live scrolling prices
3. Bento-style hero: 4 stat cards, funding heatmap, liquidation grid
4. Full funding rate table — click a row to open the market detail drawer
5. Sidebar with quick filters (All / Majors / Memes / Custom)
6. Footer status pill: "33/33 active · streaming"

## Not included (intentional)
- Real TradingView chart (uses placeholder)
- Real WebSocket stream (simulated with setInterval)
- Dashboard drag-and-drop, portfolio, alerts CRUD

## How to run
Open `index.html` directly. No build step.
