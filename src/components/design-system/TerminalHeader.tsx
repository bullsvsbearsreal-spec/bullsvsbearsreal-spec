'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import BrandMark from './BrandMark';

// Popular pre-indexed symbols for the search palette — all open in /chart.
// Bucket by asset class so the fallback below can route into the right tab
// (crypto / stocks / forex / commodities) when the user types something
// not on the curated list.
const POPULAR_CRYPTO = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX',
  'LINK', 'DOT', 'TRX', 'TON', 'SHIB', 'SUI', 'NEAR', 'APT',
  'LTC', 'BCH', 'HYPE', 'PEPE', 'WIF', 'BONK', 'JUP', 'TAO',
  'OP', 'ARB', 'SEI', 'TIA', 'INJ', 'UNI', 'AAVE', 'PENDLE',
];

// Frequently-searched stocks (US-listed). The platform's /chart page
// supports any TradingView-resolvable ticker, but the palette previously
// only knew crypto — typing "CSX" / "AAPL" / "MSTR" returned zero
// results even though the page itself can load them. Curated list
// here gives keyword-search a fast path; the truly-anything fallback
// below catches the long tail.
const POPULAR_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META',
  'COIN', 'MSTR', 'HOOD', 'MARA', 'RIOT', 'CLSK', 'BITX',
  'SPY', 'QQQ', 'IWM', 'DIA',
  // Christian + co watch these for macro context
  'CSX', 'JPM', 'BAC', 'GS', 'XLF',
];

const POPULAR_FOREX = ['DXY', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];

const POPULAR_COMMODITIES = ['XAUUSD', 'XAGUSD', 'CL1!', 'NG1!', 'HG1!'];

// Pure-function helpers (looksLikeTicker etc.) live in searchHelpers.ts
// so they can be unit-tested without dragging in React's JSX runtime.
import { looksLikeTicker } from './searchHelpers';

interface NavItem { id: string; label: string; href: string; hint?: string; }
interface NavGroup { key: string; label: string; icon: React.ReactNode; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  { key: 'scan', label: 'Scan & Trade',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>,
    items: [
      { id: 'screener',     label: 'Screener',          href: '/screener',  hint: 'Filter & sort markets' },
      { id: 'chart',        label: 'Chart',             href: '/chart',              hint: 'Candles + book + tape' },
      { id: 'options',      label: 'Options',           href: '/options',   hint: 'Chain · Greeks · IV · max pain · skew · RV vs IV' },
      // /options-iv, /rv-iv, /max-pain, /skew consolidated into /options (May 2026)
      { id: 'spreads',      label: 'Spreads',           href: '/spreads',            hint: 'Cross-venue arb' },
      { id: 'funding-arb',  label: 'Funding Arb',       href: '/spread-scanner',     hint: 'Long/short pairs' },
      { id: 'basis',        label: 'Basis',             href: '/basis',              hint: 'Spot-perp premium' },
      { id: 'cme-basis',    label: 'CME Basis',         href: '/cme-basis',          hint: 'Futures vs spot · annualized' },
      { id: 'premiums',     label: 'Premiums',          href: '/premiums',           hint: 'Perp premiums' },
      { id: 'execution',    label: 'Execution Costs',   href: '/execution-costs',    hint: 'Slippage + fees' },
      { id: 'trade-opt',    label: 'Trade Optimizer',   href: '/trade-optimizer',    hint: 'Cheapest venue per trade' },
      { id: 'fees',         label: 'Exchange Fees',     href: '/exchange-fees',      hint: 'Maker/taker tiers' },
      { id: 'predictions',  label: 'Prediction Markets', href: '/prediction-markets', hint: 'Polymarket + others' },
    ]},
  { key: 'monitor', label: 'Monitor',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/></svg>,
    items: [
      { id: 'funding',         label: 'Funding Rates',   href: '/funding',          hint: 'Live across all venues' },
      { id: 'funding-heatmap', label: 'Funding Heatmap', href: '/funding-heatmap',   hint: 'Asset × venue grid' },
      { id: 'funding-countdown', label: 'Funding Countdown', href: '/funding-countdown', hint: 'Next settlement clocks' },
      { id: 'funding-paid',    label: 'Funding Paid · 30d', href: '/funding-paid',     hint: 'Most expensive longs' },
      // /funding-leaderboard, /funding-flips, /funding-predictor consolidated into /funding + /funding-paid (May 2026)
      { id: 'ob-imbalance',    label: 'OB Imbalance',     href: '/orderbook-imbalance', hint: 'Bid vs ask depth ratio' },
      { id: 'oi',              label: 'Open Interest',   href: '/open-interest',       hint: 'OI changes, dominance' },
      { id: 'oi-heatmap',      label: 'OI Heatmap',      href: '/oi-heatmap',        hint: 'OI flux grid' },
      { id: 'perp-vol',        label: 'Perp DEX Volume', href: '/perp-dex-volume',   hint: 'On-chain derivatives' },
      { id: 'volume-share',    label: 'CEX vs DEX Vol',  href: '/volume-share',      hint: 'Spot volume share · 30d' },
      { id: 'long-short',      label: 'Long / Short',    href: '/longshort',         hint: 'Crowd positioning' },
      { id: 'etf',             label: 'ETF Tracker',     href: '/etf',               hint: 'Spot ETF live quotes' },
      { id: 'etf-flows',       label: 'ETF Flows',        href: '/etf-flows',          hint: 'Daily net inflows · Farside' },
      // /etf-counterfactual consolidated into /etf-flows (May 2026)
      { id: 'crypto-stocks',   label: 'Crypto Stocks',    href: '/crypto-stocks',      hint: 'COIN · MSTR · miners · ETFs' },
      { id: 'memecoin-radar',  label: 'Memecoin Radar',  href: '/memecoin-radar',    hint: 'Solana DEX velocity' },
      { id: 'top-movers',      label: 'Top Movers',      href: '/top-movers',        hint: 'Biggest gainers/losers' },
      { id: 'momentum',        label: 'Momentum',        href: '/momentum',          hint: 'Trend strength' },
      { id: 'breakouts',       label: 'Breakouts',       href: '/breakouts',         hint: 'Range breaks' },
      { id: 'dominance',       label: 'Dominance',       href: '/dominance',         hint: 'BTC/ETH/alt share' },
      { id: 'altseason',       label: 'Altseason',       href: '/altseason',         hint: 'Alt rotation index' },
      { id: 'sectors',         label: 'Sector Rotation', href: '/sectors',           hint: 'Heatmap by category' },
      { id: 'market-cycle',    label: 'Market Cycle',    href: '/market-cycle',      hint: 'Macro phase' },
      { id: 'cycle-phase',     label: 'Cycle Phase',     href: '/cycle-phase',       hint: 'Composite of 5 cycle signals' },
      { id: 'crowdedness',     label: 'Crowdedness',     href: '/crowdedness',       hint: 'Per-coin positioning extremes' },
      { id: 'market-heatmap',  label: 'Market Heatmap',  href: '/market-heatmap',    hint: 'Treemap by mcap' },
      { id: 'rsi-heatmap',     label: 'RSI Heatmap',     href: '/rsi-heatmap',       hint: 'Overbought / oversold' },
      { id: 'fear-greed',      label: 'Fear & Greed',    href: '/fear-greed',        hint: 'Sentiment index' },
    ]},
  { key: 'risk', label: 'Risk',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    items: [
      { id: 'liq',             label: 'Liquidations',    href: '/liquidations', hint: 'Live rekt feed' },
      { id: 'liq-heatmap',     label: 'Liq Heatmap',     href: '/liquidation-heatmap',   hint: 'Heat tiles · whale tags' },
      { id: 'liq-map',         label: 'Liq Map',         href: '/liquidation-map',       hint: 'Price-level density' },
      { id: 'liq-levels',      label: 'Liq Levels',      href: '/liquidation-levels',    hint: 'Imminent zones' },
      { id: 'liq-calc',        label: 'Liq Calculator',  href: '/liq-calculator',        hint: 'Price needed to liquidate' },
      { id: 'leverage',        label: 'Leverage',        href: '/leverage',              hint: 'Position leverage' },
      { id: 'position-size',   label: 'Position Sizer',  href: '/position-size',         hint: 'Risk-based sizing' },
      // /whale-alert consolidated into /liquidations (May 2026)
      { id: 'alerts',          label: 'Alerts',          href: '/alerts',                hint: 'Triggers + history' },
    ]},
  { key: 'research', label: 'Research',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
    items: [
      { id: 'news',            label: 'News Feed',       href: '/news',         hint: 'Curated + signals' },
      { id: 'calendar',        label: 'Event Calendar',  href: '/economic-calendar',     hint: 'Macro + token events' },
      { id: 'fomc',            label: 'FOMC Playbook',   href: '/fomc-playbook',         hint: 'BTC reaction to past Fed decisions' },
      { id: 'unlocks',         label: 'Token Unlocks',   href: '/token-unlocks',         hint: 'Vesting schedules' },
      { id: 'tge-calendar',    label: 'TGE Calendar',    href: '/tge-calendar',          hint: 'Upcoming launches · FDV · cliffs' },
      { id: 'cliff-watch',     label: 'Cliff Watch',     href: '/cliff-watch',           hint: 'Upcoming unlocks ranked by impact' },
      { id: 'airdrops',        label: 'Airdrops',        href: '/airdrops',              hint: 'Upcoming + claimed' },
      { id: 'btc-treasuries',  label: 'BTC Treasuries',  href: '/bitcoin-treasuries',    hint: 'Corporate holdings' },
      { id: 'smart-money',     label: 'Smart Money',     href: '/smart-money',           hint: 'Top trader flows' },
      // /smart-money-composite folded into /smart-money (May 2026)
      { id: 'hl-traders',      label: 'HL Traders',      href: '/hl-traders',            hint: 'Hyperliquid leaderboard' },
      { id: 'hl-vaults',       label: 'HL Vaults',       href: '/hl-vaults',             hint: 'Hyperliquid vaults' },
      { id: 'hl-whales',       label: 'HL Whales',       href: '/hl-whales',             hint: 'Top HL positions' },
      { id: 'gmx-traders',     label: 'GMX Traders',     href: '/gmx-traders',           hint: 'GMX leaderboard' },
      // /wallet-tracker replaced by /watch (May 2026)
      { id: 'compare-traders', label: 'Compare Traders', href: '/compare-traders',       hint: 'Side-by-side' },
      { id: 'onchain',         label: 'On-Chain',        href: '/onchain',               hint: 'Network metrics' },
      { id: 'hash-ribbons',    label: 'Hash Ribbons',    href: '/hash-ribbons',          hint: 'BTC miner capitulation signal' },
      { id: 'cvd',             label: 'CVD',             href: '/cvd',                   hint: 'Cumulative volume delta' },
      { id: 'orderflow',       label: 'Order Flow',      href: '/orderflow',             hint: 'Tape + aggressor' },
      { id: 'stable-flows',    label: 'Stablecoin Flows', href: '/stablecoin-flows',     hint: 'Mint/burn tracker' },
      { id: 'stable-supply',   label: 'Stablecoin Supply', href: '/stablecoin-supply',   hint: 'USD pegs · 1d/7d/30d' },
      { id: 'stable-peg',      label: 'Stablecoin Peg',  href: '/stablecoin-peg',        hint: 'Peg deviations' },
      { id: 'gas',             label: 'Gas Tracker',     href: '/gas-tracker',           hint: 'L1/L2 fees' },
      { id: 'protocol-rev',    label: 'Protocol Revenue', href: '/protocol-revenue',     hint: 'Top earners' },
      { id: 'yields',          label: 'Yields',          href: '/yields',                hint: 'DeFi APYs' },
      { id: 'staking',         label: 'Staking',         href: '/staking',               hint: 'Validator yields' },
      { id: 'validators',      label: 'Validator Econ',  href: '/validators',            hint: 'LST + restaking yields' },
      // /restaking + /restaking-delta consolidated into /staking (May 2026)
      { id: 'reserves',        label: 'Exchange Reserves', href: '/exchange-reserves',   hint: 'CEX balances' },
      { id: 'listings',        label: 'New Listings',    href: '/listings',              hint: 'Recent debuts' },
      { id: 'guides',          label: 'Guides',          href: '/guides',                hint: 'Trading tutorials' },
      { id: 'api-docs',        label: 'API Docs',        href: '/api-docs',              hint: 'For developers' },
      { id: 'developers',      label: 'Developers',      href: '/developers',            hint: 'Integrations' },
      { id: 'pricing',         label: 'Pricing',         href: '/pricing',               hint: 'Free, Pro, Whale' },
      { id: 'faq',             label: 'FAQ',             href: '/faq',                   hint: 'Common questions' },
    ]},
  { key: 'tools', label: 'My Tools',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    items: [
      { id: 'dashboard',  label: 'Dashboard',     href: '/dashboard', hint: 'Portfolio overview' },
      { id: 'positions',  label: 'Positions',     href: '/positions',          hint: 'Live positions across CEX + DEX with funding context' },
      { id: 'connections', label: 'Connections',  href: '/account/connections', hint: 'Connect CEX API keys + wallets' },
      { id: 'social',     label: 'KOL Feed',      href: '/social',             hint: 'Curated crypto/macro voices' },
      { id: 'watchlist',  label: 'Watchlists',    href: '/watchlist',          hint: 'Pinned coins' },
      { id: 'portfolio',  label: 'Portfolio (manual)', href: '/portfolio',     hint: 'Manual holdings + P&L' },
      { id: 'compare',    label: 'Compare',       href: '/compare',            hint: 'Side-by-side coins' },
      { id: 'profile',    label: 'Profile',       href: '/profile',            hint: 'Your trader profile' },
      { id: 'referrals',  label: 'Referrals',     href: '/referrals',          hint: 'Invite friends' },
      { id: 'donate',     label: 'Donate',        href: '/donate',             hint: 'Support InfoHub' },
      { id: 'points',     label: 'Points',        href: '/points',             hint: 'Loyalty rewards' },
      { id: 'settings',   label: 'Settings',      href: '/settings',           hint: 'Account + API' },
      { id: 'login',      label: 'Sign In',       href: '/login',              hint: 'Existing account' },
      { id: 'signup',     label: 'Sign Up',       href: '/signup',             hint: 'Create account' },
      { id: 'forgot',     label: 'Forgot Password', href: '/forgot-password',  hint: 'Reset' },
    ]},
];

const iconBtn: React.CSSProperties = { position: 'relative', width: 32, height: 32, border: '1px solid var(--hub-border)', borderRadius: 8, background: 'var(--hub-darker)', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

export default function TerminalHeader({ onSearch }: { onSearch?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Search palette state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const callbackUrl = encodeURIComponent(pathname || '/');
  const isAuthed = status === 'authenticated';
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || '';
  const userImage = session?.user?.image || null;
  const showAvatar = !!userImage && !avatarError;
  const initials = userName ? userName.slice(0, 2).toUpperCase() : 'JD';

  // Reset error state when avatar URL changes (e.g. fresh upload).
  useEffect(() => { setAvatarError(false); }, [userImage]);

  // Build search index — flatten NAV_GROUPS pages + popular symbols
  // (crypto / stocks / forex / commodities) + a graceful fallback for
  // unknown tickers so typing "CSX" / "AAPL" / "XAGUSD" lands the user
  // on /chart rather than showing "no matches" for a symbol the chart
  // page actually supports.
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pages = NAV_GROUPS.flatMap(g => g.items.map(it => ({
      kind: 'page' as const,
      key: `page:${it.id}`,
      label: it.label,
      hint: it.hint || g.label,
      href: it.href,
      group: g.label,
    })));
    const symbolList: Array<{ s: string; ac: 'crypto' | 'stocks' | 'forex' | 'commodities' }> = [
      ...POPULAR_CRYPTO.map(s => ({ s, ac: 'crypto' as const })),
      ...POPULAR_STOCKS.map(s => ({ s, ac: 'stocks' as const })),
      ...POPULAR_FOREX.map(s => ({ s, ac: 'forex' as const })),
      ...POPULAR_COMMODITIES.map(s => ({ s, ac: 'commodities' as const })),
    ];
    const symbols = symbolList.map(({ s, ac }) => ({
      kind: 'symbol' as const,
      key: `sym:${ac}:${s}`,
      label: s,
      hint: ac === 'crypto' ? 'Open in /chart'
          : ac === 'stocks' ? 'Stock · /chart'
          : ac === 'forex' ? 'FX · /chart'
          : 'Commodity · /chart',
      href: `/chart?s=${encodeURIComponent(s)}${ac === 'crypto' ? '' : `&ac=${ac}`}`,
      group: ac === 'crypto' ? 'Crypto' : ac === 'stocks' ? 'Stocks' : ac === 'forex' ? 'FX' : 'Commodities',
    }));
    const all = [...symbols, ...pages];
    if (!q) return all.slice(0, 14);
    const matched = all
      .filter(r => r.label.toLowerCase().includes(q) || r.hint.toLowerCase().includes(q) || r.href.toLowerCase().includes(q))
      .slice(0, 30);
    // Long-tail fallback: when nothing matched and the query looks
    // like a ticker, offer to open it in /chart. The chart page
    // resolves TradingView's full symbol set, so this works for
    // anything not on the curated list above.
    if (matched.length === 0 && looksLikeTicker(searchQuery)) {
      const ticker = searchQuery.trim().toUpperCase();
      return [{
        kind: 'symbol' as const,
        key: `sym:fallback:${ticker}`,
        label: ticker,
        hint: 'Open in /chart (any TradingView-resolvable ticker)',
        href: `/chart?s=${encodeURIComponent(ticker)}`,
        group: 'Open',
      }];
    }
    return matched;
  }, [searchQuery]);

  // ⌘K / Ctrl+K to open, Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target;
      const inField = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target as HTMLElement | null)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(s => !s);
        return;
      }
      if (e.key === '/' && !inField && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  // Reset focus index when results change; focus input when palette opens
  useEffect(() => { setSearchFocus(0); }, [searchQuery]);
  useEffect(() => {
    if (searchOpen) {
      setSearchQuery('');
      setSearchFocus(0);
      setTimeout(() => searchInputRef.current?.focus(), 30);
    }
  }, [searchOpen]);

  const goToResult = (idx: number) => {
    const r = searchResults[idx];
    if (!r) return;
    setSearchOpen(false);
    router.push(r.href);
  };
  return (
    <header
      aria-label="terminal-header"
      className="terminal-header"
      style={{ position: 'sticky', top: 0, zIndex: 40, height: 48, flexShrink: 0, background: 'rgba(7,9,13,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--hub-border)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 4 }}
    >
      <Link href="/home" aria-label="Home" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', padding: '0 4px', height: '100%' }}>
        <BrandMark size="md" />
      </Link>
      <div style={{ width: 1, height: 24, background: 'var(--hub-border-subtle)', margin: '0 8px' }} />
      {/* The nav-group buttons (5 dropdowns × ~110px each) plus the
          search trigger + 3 icon buttons + sign-in fill the full
          1100-1200px width. Below that the nav was pushing the
          right-hand cluster off-screen. Globals.css collapses these
          on narrow viewports — see the "terminal-header" rules. */}
      <nav className="terminal-header-nav" style={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0, overflowX: 'auto', flexShrink: 1 }}>
        {NAV_GROUPS.map(g => {
          const isOpen = openKey === g.key;
          const groupActive = g.items.some(it => it.href === pathname);
          return (
            <div key={g.key} style={{ position: 'relative', height: '100%' }} onMouseEnter={() => setOpenKey(g.key)} onMouseLeave={() => setOpenKey(null)}>
              {/* Button needs onClick too — onMouseEnter alone doesn't
                  fire on touch devices. Mobile users couldn't open
                  any nav dropdown at all (the sidebar is now hidden
                  on mobile, so this was the only nav path). */}
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : g.key)}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                style={{ height: '100%', padding: '0 10px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 6, color: groupActive || isOpen ? 'var(--fg-default)' : 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: groupActive ? 600 : 500, letterSpacing: '-0.005em', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                <span style={{ color: 'var(--hub-accent)', display: 'inline-flex' }}>{g.icon}</span>
                {g.label}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-subtle)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}><polyline points="6 9 12 15 18 9" /></svg>
                {groupActive && <span style={{ position: 'absolute', left: 10, right: 10, bottom: 0, height: 2, background: 'var(--hub-accent)', boxShadow: '0 0 8px rgb(255 165 0 / 0.4)' }} />}
              </button>
              {isOpen && (
                <>
                  {/* Invisible bridge so the cursor can travel from the trigger to the menu without dropping hover */}
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: 8, zIndex: 49 }} />
                <div
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                    minWidth: 320, maxHeight: 'min(75vh, 640px)', overflowY: 'auto',
                    background: 'rgba(15,18,24,0.98)', backdropFilter: 'blur(10px)',
                    border: '1px solid var(--hub-border-hover)', borderRadius: 10,
                    boxShadow: '0 24px 48px -12px rgba(0,0,0,0.8), 0 0 0 1px rgb(var(--hub-accent-rgb) / 0.04)',
                    padding: 6, zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      padding: '6px 10px', fontSize: 9, color: 'var(--fg-subtle)',
                      textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{ color: 'var(--hub-accent)', display: 'inline-flex' }}>{g.icon}</span>
                    {g.label}
                  </div>
                  {g.items.map(it => {
                    const on = pathname === it.href;
                    return (
                      <Link
                        key={it.id}
                        href={it.href}
                        onClick={() => setOpenKey(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 6,
                          background: on ? 'rgb(var(--hub-accent-rgb) / 0.10)' : 'transparent',
                          color: 'var(--fg-default)', fontFamily: 'var(--font-sans)', fontSize: 12,
                          textDecoration: 'none',
                          borderLeft: on ? '2px solid var(--hub-accent)' : '2px solid transparent',
                          transition: 'background-color 100ms, color 100ms',
                        }}
                        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span
                          style={{
                            width: 4, height: 4, borderRadius: 999, flexShrink: 0,
                            background: on ? 'var(--hub-accent)' : 'var(--hub-border-hover)',
                          }}
                        />
                        <span style={{ fontWeight: on ? 600 : 500, color: on ? 'var(--hub-accent)' : 'var(--fg-default)' }}>{it.label}</span>
                        <span style={{ flex: 1 }} />
                        {it.hint && (
                          <span style={{ fontSize: 10, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
                            {it.hint}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          );
        })}
      </nav>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        aria-label="Open search palette"
        className="terminal-header-search-trigger"
        onClick={() => { setSearchOpen(true); onSearch?.(); }}
        style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-subtle)', fontFamily: 'var(--font-sans)', fontSize: 12, cursor: 'pointer', minWidth: 220, flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <span style={{ flex: 1, textAlign: 'left' }}>Search or jump to…</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', background: 'var(--hub-secondary)', padding: '1px 5px', borderRadius: 3 }}>⌘K</span>
      </button>
      {/* Top-level Pricing pill — Pricing was previously buried in the
          Research dropdown (position #25). Promoting it to chrome makes
          the launch tier system actually discoverable. */}
      <Link
        href="/pricing"
        title="Free, Pro, Whale — free during launch"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(245,158,11,0.18) 100%)',
          border: '1px solid rgba(16,185,129,0.35)',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 700,
          color: 'rgb(110,231,183)',
          textDecoration: 'none',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-sans)',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        Pricing
      </Link>
      <Link href="/donate" style={{ ...iconBtn, textDecoration: 'none' }} aria-label="Donate">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
      </Link>
      <button
        style={iconBtn}
        aria-label="Toggle theme"
        onClick={() => {
          if (typeof document !== 'undefined') {
            const cur = document.documentElement.dataset.theme;
            const next = cur === 'light' ? 'dark' : 'light';
            document.documentElement.dataset.theme = next;
            try { localStorage.setItem('infohub-theme', next); } catch {}
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
      </button>
      <Link href="/alerts" style={{ ...iconBtn, textDecoration: 'none' }} aria-label="Alerts">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 999, background: 'var(--hub-accent)', boxShadow: '0 0 6px var(--hub-accent)' }} />
      </Link>
      {!isAuthed ? (
        <Link
          href={`/login?callbackUrl=${callbackUrl}`}
          style={{
            background: 'linear-gradient(135deg,#FFB800,#FF8C00)',
            color: '#07090d',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: 8,
            textDecoration: 'none',
            marginLeft: 4,
            border: '1px solid rgba(255,140,0,0.5)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4) inset, 0 6px 16px -6px rgba(255,165,0,0.4)',
          }}
        >
          Sign in
        </Link>
      ) : (
        <div style={{ position: 'relative', marginLeft: 4 }} onMouseEnter={() => setUserMenuOpen(true)} onMouseLeave={() => setUserMenuOpen(false)}>
          <button
            aria-label={`Account · ${userName}`}
            style={{
              width: 32, height: 32, borderRadius: 999, padding: 0,
              border: '1px solid var(--hub-border)',
              background: showAvatar ? 'transparent' : 'linear-gradient(135deg,#FFB800,#FF8C00)',
              color: '#07090d', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 800,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {showAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage!}
                alt={userName}
                width={32}
                height={32}
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={() => setAvatarError(true)}
              />
            ) : (
              initials
            )}
          </button>
          {userMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, minWidth: 220, background: 'rgba(15,18,24,0.98)', backdropFilter: 'blur(8px)', border: '1px solid var(--hub-border-hover)', borderRadius: 10, boxShadow: '0 18px 40px -12px rgba(0,0,0,0.7)', padding: 6, marginTop: 4, zIndex: 50 }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--hub-border-subtle)', marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-default)' }}>{userName}</div>
                {session?.user?.email && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', marginTop: 2 }}>{session.user.email}</div>
                )}
              </div>
              {[
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/portfolio', label: 'Portfolio' },
                { href: '/watchlist', label: 'Watchlists' },
                { href: '/profile',   label: 'Profile' },
                { href: '/settings',  label: 'Settings' },
              ].map(it => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setUserMenuOpen(false)}
                  style={{ display: 'block', padding: '7px 10px', borderRadius: 6, color: 'var(--fg-default)', fontSize: 12, textDecoration: 'none' }}
                >
                  {it.label}
                </Link>
              ))}
              <div style={{ borderTop: '1px solid var(--hub-border-subtle)', marginTop: 4, paddingTop: 4 }}>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, color: 'var(--rekt-mild)', fontSize: 12, background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Search palette ─── */}
      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          onClick={() => setSearchOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '10vh',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(640px, 92vw)',
              background: 'rgba(15,18,24,0.98)',
              border: '1px solid var(--hub-border-hover)',
              borderRadius: 12,
              boxShadow: '0 30px 60px -12px rgba(0,0,0,0.7)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              maxHeight: '70vh',
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSearchFocus((i) => Math.min(i + 1, searchResults.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSearchFocus((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                goToResult(searchFocus);
              }
            }}
          >
            {/* Search input */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
              borderBottom: '1px solid var(--hub-border-subtle)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-muted)' }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search symbols, pages…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none', outline: 'none',
                  color: 'var(--fg-default)',
                  fontSize: 14, fontFamily: 'var(--font-sans)',
                }}
              />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)',
                padding: '2px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--hub-border-subtle)',
              }}>esc</span>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 6 }} role="listbox">
              {searchResults.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 12 }}>
                  No matches for &ldquo;{searchQuery}&rdquo;
                </div>
              )}
              {searchResults.map((r, i) => {
                const focused = i === searchFocus;
                const isSym = r.kind === 'symbol';
                return (
                  <button
                    key={r.key}
                    role="option"
                    aria-selected={focused}
                    onClick={() => goToResult(i)}
                    onMouseEnter={() => setSearchFocus(i)}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px',
                      borderRadius: 7,
                      background: focused ? 'rgba(var(--hub-accent-rgb), 0.15)' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: focused ? 'var(--hub-accent)' : 'var(--fg-default)',
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: 5,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      background: isSym ? 'rgba(var(--hub-accent-rgb), 0.18)' : 'rgba(96,165,250,0.18)',
                      color: isSym ? 'var(--hub-accent)' : '#60a5fa',
                      fontSize: 9, fontWeight: 800,
                    }}>
                      {isSym ? r.label.slice(0, 3) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </span>
                    <span style={{
                      fontWeight: 700, fontSize: 13,
                    }}>{r.label}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{
                      fontSize: 10, color: 'var(--fg-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}>{r.hint}</span>
                  </button>
                );
              })}
            </div>

            {/* Footer hints */}
            <div style={{
              padding: '8px 14px',
              borderTop: '1px solid var(--hub-border-subtle)',
              display: 'flex', alignItems: 'center', gap: 12,
              fontSize: 10, color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255,255,255,0.01)',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Kbd>↑↓</Kbd> navigate
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Kbd>↵</Kbd> open
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Kbd>⌘K</Kbd> toggle
              </span>
              <span style={{ flex: 1 }} />
              <span>{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '1px 5px',
      borderRadius: 3,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid var(--hub-border-subtle)',
      fontSize: 9, fontFamily: 'var(--font-mono)',
      color: 'var(--fg-default)',
    }}>{children}</kbd>
  );
}
