# InfoHub Design System

> Real-time cryptocurrency derivatives intelligence. Bloomberg Terminal meets Coinglass — dense, live, trader-first. Dark-first, orange accent, tabular-numeric everywhere.

**Live product:** info-hub.io (aka infohub.exchange)
**Tagline:** *Real-time derivatives intelligence across 33 exchanges. Funding, OI, liquidations & more.*

---

## Product context

InfoHub aggregates **funding rates, open interest, liquidations, options data, and order flow** across **33 exchanges (18 CEX + 15 DEX)** into a single professional-grade dashboard. The target user is the active futures trader — someone who would otherwise be flipping between exchange tabs, glued to a Bloomberg-style terminal, or paying $50–200/mo for institutional data.

The product surface is **one huge web app** (Next.js 14, ~57 public routes, 115+ components, 100+ API endpoints). There is no mobile app and no separate marketing site — the homepage IS the terminal. Everything lives under one URL with a sticky header, an optional left rail, and dense data in the middle.

### Core data products
| Surface | What it does |
|---|---|
| **Funding Rates** | Live rates + heatmap + arbitrage scanner, 33 exchanges |
| **Open Interest** | Aggregated OI + delta tracking + heatmap |
| **Liquidations** | Real-time feed + heatmap + historical treemap |
| **Screener / Spreads** | Multi-coin filter & cross-exchange gap scanner |
| **Chart** | TradingView + tape/trade sidebar + metrics panel |
| **Options** | Flow + greeks, limited to Binance / Bybit / Deribit / OKX |
| **Dashboard** | 26 drag-and-drop widgets — user-customizable |
| **Portfolio / Watchlist / Alerts** | CRUD user features |

### Source of truth (read-only, mounted)
- `infohub/` — the full Next.js 14 codebase
  - `infohub/src/app/globals.css` — the **design tokens live here** (CSS vars, utility classes)
  - `infohub/tailwind.config.js` — Tailwind extension mapping
  - `infohub/src/components/` — 115+ React components (Header, Footer, Logo, StatCard, MarketTiles, LiquidationHeatmap, …)
  - `infohub/public/exchanges/*.png` — 35 exchange logos
  - `infohub/public/logos/`, `infohub/public/logo-*.svg`, `infohub/public/icon-*` — brand marks
- `infohub/CLIENT_BRIEF.md` — product summary, exchange coverage, user segments
- `infohub/INFOHUB_PRODUCT_UX_BLUEPRINT.md` — UX posture & future work
- `infohub/docs/` — backend + components inventory

---

## Content fundamentals — voice & copywriting

InfoHub's voice is **trader slang layered on top of data-dry labels.** It swings between two modes:

1. **UI labels — terse, lowercase-title-case, Bloomberg-flat.**
   "Funding Rates", "Open Interest", "Top Funding", "Latest News", "Top Movers".
   Section headers are usually **sentence-case Title Case** with no punctuation. No marketing fluff, no emoji, no exclamation.

2. **Tooltips / hero blurbs — trader-native, punchy, a little irreverent.**
   Real strings lifted from `HomeOrange.tsx`:
   - *"Funding printing — top signal?"*
   - *"Funding apocalypse"*
   - *"Longs paying premium"*
   - *"Shorts paying through the nose"*
   Category labels: **Scan & Trade · Monitor · Risk · Research · My Tools**
   Trader nouns used in CSS classnames: `rekt-nuclear`, `pump-hot`, `delta-badge-extreme-up`, `heartbeat-dot`.

### Tone rules
- **Second person is rare.** The product talks AT the market, not TO the user. "Real-time rekt" not "Track your liquidations".
- **Data before adjectives.** "33 exchanges · v2.0", "2,847 pairs", "Streaming". Numbers earn the user's attention; we don't puff them up.
- **Never use pure black / pure white in copy.** Same rule that applies to color applies to tone — nothing is absolute.
- **No emoji. No exclamation marks. No serif fonts.** Emoji in particular are explicitly out — we use icon+number pairs (Lucide icons, sized 12–16px).
- **Acronyms stay acronyms.** OI, CVD, L/S, RSI, ETF, DEX, CEX, BTC. First-time readers get a tooltip, not a gloss.
- **Disclaimer voice is flat and legal:** *"Not financial advice. Third-party data, may be delayed. DYOR."* Never "our humble suggestion".
- **Status strings are short and mechanical:** `Streaming`, `Offline`, `Stale`, `Online`, `Live`, `8s ago`, `v2.0`, `33/33 active`.

### Casing conventions
- **Navigation labels** — Title Case (`Funding Rates`, `Open Interest`, `Market Cycle`)
- **Utility labels / eyebrows** — UPPERCASE with `letter-spacing: 0.15em` (`PRICES`, `DERIVATIVES`, `ONLINE`)
- **Buttons** — Title Case, 13px, semibold
- **Numbers** — always tabular; `$112,842`, `+0.0375%`, `$2.41B`
- **Rates** — four decimal places with explicit sign: `+0.0420%`, `-0.0170%`

---

## Visual foundations

### Color philosophy — 60 : 30 : 10
InfoHub runs a strict **60% dominant dark / 30% secondary gray / 10% orange accent** rule. Orange is a precious resource — it marks CTAs, active state, logo, extreme values, and very little else. Red and green are **reserved exclusively for market direction** (longs/gains = green, shorts/losses = red). Purple is **reserved for Hub AI features.**

- **No pure `#000000`** (uses `#07090d`). **No pure `#ffffff`** for text (uses `#e6e6ea`). This is deliberate eye-care tuning for long-session traders.
- **Radial vignette on body:** `radial-gradient(1200px 700px at 50% -10%, rgba(255,165,0,0.015), transparent 60%)` — so the screen center reads slightly warmer than edges; reduces halation at night.
- **Semantic red/green are desaturated** (`#f87171`, `#4ade80`) not aggressive stoplight `#ff0000`/`#00ff00`.

### Typography
- **Inter** everywhere for UI sans. Uses Inter-specific font-feature-settings `"cv11", "ss01", "ss03"` and a global `letter-spacing: -0.011em` — the "Linear/Vercel premium feel" trick.
- **JetBrains Mono** for every number, ticker, price, funding rate, OI value, countdown. `font-variant-numeric: tabular-nums` and `font-feature-settings: "tnum"` on every data cell.
- **Scale is dense.** Body is 13px, not 16px. `text-[10px]`, `text-[11px]`, `text-[12px]` appear constantly for labels. Display sizes (`28px`, `40px`) are reserved for hero stats.
- **Headings** use negative tracking (`-0.02em` to `-0.03em`) and `text-wrap: balance`.

### Spacing & scale
- Gaps in dense regions are **3px, 6px, 8px** (Tailwind `gap-0.5`, `gap-1.5`, `gap-2`). This is a data terminal, not a marketing site.
- Card padding is **12–16px**, not 24px. Card gutters in bento grids are **8–12px**.
- Sidebar width is fixed **220px**. Top sticky header is **48px** (h-12). Market tape below is ~28px.

### Corner radii
Consistent **6 / 8 / 12 / 16** scale.
- **6px** — badges, pills, dense tape items
- **7–10px** — sidebar items, tape items, small buttons
- **12px** — primary cards (`.card`, `.section-card`, stat cards)
- **14–16px** — logo pill, hero cards, premium cards
- Never > 20px. Never `border-radius: 9999px` on large surfaces (only on tiny pills like `live-dot`).

### Backgrounds
- **Never full-bleed photography.** Never hand-drawn illustration. Never hero gradients with blue-purple.
- Two subtle decorations are allowed:
  1. `hero-mesh` — three low-opacity orange radial gradients (`rgba(255,165,0,0.06)` max), stacked.
  2. `noise-bg` — SVG fractal noise at `opacity: 0.02` for depth.
- Repeating patterns are out. Gradients on text/buttons use the orange spectrum only.

### Borders — the primary separation mechanism
Because surfaces are so close in luminance, **thin borders carry the UI**:
- `var(--hub-border-subtle)` `rgba(255,255,255,0.04)` — dividers, grid lines
- `var(--hub-border)` `rgba(255,255,255,0.07)` — default card border
- `var(--hub-border-hover)` `rgba(255,255,255,0.14)` — hover/focus/active

Borders > shadows. Shadows are reserved for **dropdowns** (`shadow-2xl shadow-black/60`) and **cards on hover**.

### Shadows & elevation
- **Cards at rest:** no shadow, just border.
- **Cards on hover:** border brightens to `hub-border-hover`, optional `0 2px 12px rgba(0,0,0,0.3)`.
- **Dropdowns/menus:** `shadow-2xl shadow-black/60` — heavy.
- **Glow** (`.glow-box`, `.accent-glow`): only used on extreme values and the primary CTA. `0 0 12px rgb(255 165 0 / 0.15)`.

### Animation
- **Duration is fast:** `150ms` is the default. `300ms` is the max for entrance. `200ms` only for carousel-style transitions.
- **Easing:** mostly `ease-out`. `cubic-bezier(0.4, 0, 0.6, 1)` for pulses.
- **Named primitives in tailwind.config.js:**
  - `breathe` (3s) — soft scale+fade on live indicators
  - `shimmer` (2s linear) — skeleton loaders
  - `marquee-scroll` (55s linear) — market tape
  - `enterUp` (0.3s) — content entrance; used with `.stagger > *:nth-child(n)` for 30ms stepped entry
  - `livePulse`, `heartbeat` — live-data dots
- **Data-update flashes** are CSS-only: `flash-green` (0 → transparent over 1.5s) on changed prices; `micro-glow` and `value-flash` on updates.
- **`prefers-reduced-motion`** kills all of it globally — durations forced to 0.01ms.

### Hover & press states
- Links/buttons: `color` transition, 150ms. Often `hover:bg-white/[0.05]` to lift row from table.
- Cards: `border-color` only (no translate). Sub-rule: `market-tile` gets a **2px orange left accent** on hover (`::before`).
- Press: no scale-down. Opacity drops to ~0.9 on `btn-primary`.
- **Hover-lift (`translateY(-2px)`)** is allowed only on cards in bento grids, never on rows.

### Transparency, blur, glass
Used sparingly and ALWAYS with intent:
- Sticky header: `bg-black/90 backdrop-blur-sm` — the one glass surface.
- Market tape: `rgba(10, 10, 10, 0.92); backdrop-filter: blur(10px)`.
- Data rows on hover: `rgba(255,255,255,0.04)` or `0.05`. Never higher.
- Tooltips: solid `var(--hub-secondary)` with 1px border. No blur.

### Layout rules
- **Max content width:** `1600px` (Bento homepage). Individual pages use `1400px`.
- **Sidebar is sticky** at `top: 110px`, collapses `display: none` below `lg`.
- **Mobile fallback is real** — everything has a mobile view; tables become `MobileCard`s; nav becomes an accordion.
- Bento grids are `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` with `gap-3`.
- **Fixed elements:** header, market tape, breadcrumbs, sidebar, footer status pill, chat widget (bottom-right).

---

## Iconography

InfoHub uses **[Lucide React](https://lucide.dev)** as its only icon system. Imported individually from `lucide-react`.

- **Stroke weight:** default Lucide (2px stroke, outline style). Never filled.
- **Sizes:** `w-3 h-3` (12px) in dense rows · `w-3.5 h-3.5` (14px) in buttons · `w-4 h-4` (16px) in nav · `w-5 h-5` (20px) is the maximum in-page.
- **Color:** typically `text-neutral-500` or `text-neutral-400` at rest; `text-white` on hover; `text-hub-yellow` when active. Domain-specific items can have category color (green for derivatives, purple for OI, red for liquidations, orange for spreads).
- **Inline with text:** icons sit in a wrapper square (`w-6 h-6 rounded-md bg-white/[0.05]`) to give them weight next to dense typography.

### Commonly used Lucide icons (mapped to concepts)
| Icon | Meaning |
|---|---|
| `Activity` | Funding, order flow, market cycle |
| `BarChart3` | Open Interest, dashboard, on-chain |
| `Zap` | Liquidations, risk |
| `Grid3X3` | Heatmaps |
| `Percent` | Funding rates |
| `ArrowLeftRight` | Spreads, L/S ratio |
| `Crosshair` | Liq map, execution costs, predictions |
| `Fish` | Whale alerts |
| `Bitcoin`, `Coins` | BTC-specific / stablecoins |
| `Bell` | Alerts |
| `Star` | Watchlist |
| `TrendingUp` / `TrendingDown` | Directional deltas |
| `Thermometer` | Fear & Greed |
| `Rocket` | Top movers |
| `Shield` | Options, disclaimers |
| `Search`, `Menu`, `X`, `ChevronDown`, `ChevronRight` | Chrome |

### Exchange logos
35 PNG logos live in `infohub/public/exchanges/` at ~64×64. Used inline in rows, cards, and badges (typically 18–24px). A companion `ExchangeLogo` component wraps them.

### Coin / token icons
Sourced via `TokenIcon` component. Sized 14–20px inline. Fallback is the ticker letter on a circle.

### No emoji
Emoji are explicitly NOT used anywhere — they would fight the terminal aesthetic and are not in the codebase. Unicode arrows `▲ ▼` appear ONLY in the `.pip-up::before` / `.pip-down::before` utilities (inline direction indicators next to tabular numbers).

### Logo system
Three marks, all orange-on-dark:
- **`assets/infohub-logo.svg`** / **`logo-full.svg`** — horizontal wordmark with "Info" in white + "Hub" in a black-on-orange gradient pill. The canonical brand lock-up.
- **`assets/logo-icon.svg`** / **`icon-512.png`** / **`icon-192.png`** — square icon: stylized "IH" in dark on an orange gradient square (circuit-trace motif).
- **`assets/favicon.svg`** — same IH mark, simplified for small sizes.
- There is also a **runtime React Logo** (`infohub/src/components/Logo.tsx`) that renders "Info" + "Hub" in a styled pill at 5 sizes — this is the most common in-app use. The UI kit recreates this exactly.

---

## Index — what's in this design system

| File | What |
|---|---|
| `README.md` | You are here |
| `SKILL.md` | Agent Skill entry point — cross-compatible with Claude Code |
| `colors_and_type.css` | CSS vars for colors, semantic type classes, radius, shadow |
| `assets/` | Brand marks (logos, favicons, og-image) + exchange PNGs |
| `assets/exchanges/` | 27+ exchange logos (binance, bybit, okx, …) |
| `preview/` | Design System cards (one file per concept — type, color, spacing, buttons, …) |
| `ui_kits/terminal/` | Full terminal UI recreation: `index.html`, JSX components |

### When you make new artifacts with this system
1. Link `colors_and_type.css` from the `<head>` — it gives you every CSS var and semantic class.
2. Use `var(--hub-black)` as the body background, `var(--hub-darker)` for cards.
3. Use Lucide icons via CDN (`https://unpkg.com/lucide-static@latest/icons/<name>.svg`) or copy the SVG inline. Don't draw new ones.
4. Use the exchange PNGs in `assets/exchanges/` directly — never re-render them.
5. Data cells use JetBrains Mono + tabular-nums. Always. There are no exceptions.
6. Orange is the only chromatic accent. Green & red are reserved for direction. Purple is reserved for AI.
