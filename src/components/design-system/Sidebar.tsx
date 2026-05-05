'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const I = {
  fundRate:  '<path d="M3 3v18h18"/><polyline points="7 14 11 10 14 13 19 7"/>',
  fundHeat:  '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  fundArb:   '<path d="M21 7H3M16 3l5 4-5 4"/><path d="M3 17h18M8 13l-5 4 5 4"/>',
  oi:        '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  oiHeat:    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  liqHeat:   '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  search:    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  liq:       '<path d="M12 2v8"/><path d="m6 6 6 6 6-6"/><path d="M5 22h14"/>',
  liqMap:    '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
  liqLevels: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><circle cx="6" cy="12" r="2" fill="currentColor"/>',
  ls:        '<path d="M3 12h4M17 12h4"/><path d="M7 7h10v10H7z"/><path d="M12 4v16"/>',
  etf:       '<path d="M3 3h18v18H3z"/><path d="M3 9h18M9 3v18"/>',
  spreads:   '<path d="m3 7 9 5 9-5"/><path d="M3 17l9-5 9 5"/>',
  screener:  '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  chart:     '<path d="M3 3v18h18"/><path d="M7 16V8m4 8V11m4 5V6m4 10v-3"/>',
  options:   '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
  alerts:    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  news:      '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zM4 22a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>',
  dash:      '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  watch:     '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  flame:     '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  rocket:    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
  globe:     '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  layers:    '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  whale:     '<path d="M2 12c0-3 4-6 10-6s10 3 10 6-4 6-10 6c-3 0-6-1-8-2"/><circle cx="17" cy="11" r="1" fill="currentColor"/>',
  shield:    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  user:      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1z"/>',
  book:      '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  gift:      '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  heart:     '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  zap:       '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  calendar:  '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  pieChart:  '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  trending:  '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  trendingD: '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  scale:     '<path d="M16 16l3-8 3 8c-2 1-4 1-6 0z"/><path d="M2 16l3-8 3 8c-2 1-4 1-6 0z"/><path d="M7 21h10"/><path d="M12 3v18"/>',
  building:  '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/>',
  coin:      '<circle cx="12" cy="12" r="10"/><path d="M9 12l3 3 6-6"/>',
  cube:      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  trophy:    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  signal:    '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20v-12"/><path d="M22 20v-16"/>',
  star:      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  bitcoin:   '<path d="M12 2v20M8 5h7a3 3 0 0 1 0 6H8M8 13h8a3 3 0 0 1 0 6H8"/>',
  wallet:    '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
};

interface SidebarItem { href: string; label: string; color: string; icon: string; }
interface SidebarSection { id: string; label: string; items: SidebarItem[]; }

const PUMP = 'var(--pump-mild)';
const REKT = 'var(--rekt-mild)';
const ACC  = 'var(--hub-accent)';
const ACL  = 'var(--hub-accent-light)';
const PUR  = 'var(--highlight-purple)';
const MUTE = 'var(--fg-muted)';

const DEFAULT_SECTIONS: SidebarSection[] = [
  { id: 'derivatives', label: 'Derivatives', items: [
    { href: '/funding',                  label: 'Funding Rates',   color: PUMP, icon: I.fundRate },
    { href: '/funding-heatmap',          label: 'Funding Heatmap', color: PUMP, icon: I.fundHeat },
    { href: '/funding-countdown',        label: 'Funding Countdown', color: PUMP, icon: I.fundRate },
    { href: '/funding-paid',             label: 'Funding Paid 30d', color: PUMP, icon: I.coin },
    { href: '/funding-leaderboard',      label: 'Funding Leaderboard', color: PUMP, icon: I.coin },
    { href: '/funding-flips',            label: 'Funding Flips',  color: PUMP, icon: I.signal },
    { href: '/funding-predictor',        label: 'Funding Predictor', color: PUMP, icon: I.signal },
    { href: '/orderbook-imbalance',      label: 'OB Imbalance',   color: PUMP, icon: I.scale },
    { href: '/spread-scanner',           label: 'Funding Arb',     color: PUMP, icon: I.fundArb },
    { href: '/funding-arb',              label: 'Funding Arb (alt)', color: PUMP, icon: I.fundArb },
    { href: '/basis',                    label: 'Basis',           color: PUMP, icon: I.scale },
    { href: '/cme-basis',                label: 'CME Basis',       color: PUMP, icon: I.scale },
    { href: '/premiums',                 label: 'Premiums',        color: PUMP, icon: I.coin },
    { href: '/open-interest',            label: 'Open Interest',   color: ACL,  icon: I.oi },
    { href: '/oi-heatmap',               label: 'OI Heatmap',      color: ACL,  icon: I.oiHeat },
    { href: '/perp-dex-volume',          label: 'Perp DEX Volume', color: ACL,  icon: I.signal },
    { href: '/volume-share',             label: 'CEX vs DEX Vol',  color: ACL, icon: I.pieChart },
    { href: '/options',                  label: 'Options',         color: MUTE, icon: I.options },
    { href: '/options-iv',               label: 'Options IV',      color: MUTE, icon: I.options },
    { href: '/max-pain',                 label: 'Max Pain',        color: MUTE, icon: I.flame },
    { href: '/skew',                     label: 'Skew',            color: MUTE, icon: I.signal },
    { href: '/rv-iv',                    label: 'RV vs IV',        color: MUTE, icon: I.signal },
    { href: '/longshort',                label: 'Long / Short',    color: PUR,  icon: I.ls },
    { href: '/etf',                      label: 'ETF Tracker',     color: ACC,  icon: I.etf },
    { href: '/etf-flows',                label: 'ETF Flows',       color: ACC,  icon: I.etf },
    { href: '/etf-counterfactual',       label: 'ETF Counterfactual', color: ACC, icon: I.etf },
    { href: '/crypto-stocks',            label: 'Crypto Stocks',   color: ACC,  icon: I.building },
  ]},
  { id: 'risk', label: 'Risk & Liquidations', items: [
    { href: '/liquidations',             label: 'Liquidations',    color: REKT, icon: I.liq },
    { href: '/liquidation-heatmap',      label: 'Liq Heatmap',     color: REKT, icon: I.liqHeat },
    { href: '/liquidation-map',          label: 'Liq Map',         color: REKT, icon: I.liqMap },
    { href: '/liquidation-levels',       label: 'Liq Levels',      color: REKT, icon: I.liqLevels },
    { href: '/liq-calculator',           label: 'Liq Calculator',  color: REKT, icon: I.shield },
    { href: '/leverage',                 label: 'Leverage',        color: REKT, icon: I.zap },
    { href: '/position-size',            label: 'Position Sizer',  color: REKT, icon: I.scale },
    { href: '/rekt',                     label: 'Rekt Feed',       color: REKT, icon: I.flame },
    { href: '/whale-alert',              label: 'Whale Alert',     color: PUR,  icon: I.whale },
    { href: '/alerts',                   label: 'Alerts',          color: ACC,  icon: I.alerts },
  ]},
  { id: 'spot', label: 'Spot & Markets', items: [
    { href: '/screener',          label: 'Screener',     color: MUTE, icon: I.screener },
    { href: '/chart',             label: 'Chart',        color: MUTE, icon: I.chart },
    { href: '/spreads',           label: 'Spreads',      color: MUTE, icon: I.spreads },
    { href: '/execution-costs',   label: 'Execution Cost', color: MUTE, icon: I.scale },
    { href: '/trade-optimizer',   label: 'Trade Optimizer', color: ACC, icon: I.scale },
    { href: '/exchange-comparison', label: 'Exchanges',    color: MUTE, icon: I.building },
    { href: '/exchange-fees',     label: 'Exchange Fees', color: MUTE, icon: I.coin },
    { href: '/exchange-reserves', label: 'Reserves',     color: MUTE, icon: I.building },
    { href: '/listings',          label: 'New Listings', color: MUTE, icon: I.layers },
    { href: '/tge-calendar',      label: 'TGE Calendar', color: MUTE, icon: I.layers },
    { href: '/prediction-markets', label: 'Prediction Markets', color: MUTE, icon: I.trophy },
  ]},
  { id: 'discovery', label: 'Movers & Discovery', items: [
    { href: '/top-movers',        label: 'Top Movers',     color: PUMP, icon: I.rocket },
    { href: '/momentum',          label: 'Momentum',       color: PUMP, icon: I.trending },
    { href: '/breakouts',         label: 'Breakouts',      color: PUMP, icon: I.zap },
    { href: '/bounce',            label: 'Bounce',         color: PUMP, icon: I.trending },
    { href: '/outperformers',     label: 'Outperformers',  color: PUMP, icon: I.trending },
    { href: '/trending-tokens',   label: 'Trending Tokens', color: PUMP, icon: I.flame },
    { href: '/memecoin-radar',    label: 'Memecoin Radar', color: PUMP, icon: I.flame },
    { href: '/market-heatmap',    label: 'Market Heatmap', color: ACL,  icon: I.fundHeat },
    { href: '/stock-heatmap',     label: 'Stock Heatmap',  color: ACL,  icon: I.fundHeat },
    { href: '/rsi-heatmap',       label: 'RSI Heatmap',    color: ACL,  icon: I.signal },
    { href: '/dominance',         label: 'Dominance',      color: ACC,  icon: I.pieChart },
    { href: '/correlation',       label: 'Correlation',    color: MUTE, icon: I.signal },
    { href: '/altseason',         label: 'Altseason',      color: ACC,  icon: I.flame },
    { href: '/sectors',           label: 'Sector Rotation', color: ACC, icon: I.layers },
    { href: '/market-cycle',      label: 'Market Cycle',   color: MUTE, icon: I.signal },
    { href: '/cycle-phase',       label: 'Cycle Phase',    color: ACC,  icon: I.signal },
    { href: '/crowdedness',       label: 'Crowdedness',    color: ACC,  icon: I.signal },
  ]},
  { id: 'onchain', label: 'On-Chain & Flows', items: [
    { href: '/onchain',           label: 'On-Chain',       color: PUR,  icon: I.cube },
    { href: '/hash-ribbons',      label: 'Hash Ribbons',   color: PUR,  icon: I.signal },
    { href: '/cvd',               label: 'CVD',            color: PUR,  icon: I.signal },
    { href: '/orderflow',         label: 'Order Flow',     color: PUR,  icon: I.signal },
    { href: '/stablecoin-flows',  label: 'Stablecoin Flows', color: ACC, icon: I.coin },
    { href: '/stablecoin-supply', label: 'Stablecoin Supply', color: ACC, icon: I.coin },
    { href: '/stablecoin-peg',    label: 'Stablecoin Peg', color: ACC,  icon: I.coin },
    { href: '/gas-tracker',       label: 'Gas Tracker',    color: ACC,  icon: I.zap },
    { href: '/protocol-revenue',  label: 'Protocol Rev',   color: ACL,  icon: I.coin },
    { href: '/yields',            label: 'Yields',         color: PUMP, icon: I.trending },
    { href: '/staking',           label: 'Staking',        color: PUMP, icon: I.shield },
    { href: '/validators',        label: 'Validator Econ', color: PUMP, icon: I.shield },
    { href: '/restaking-delta',   label: 'Restaking Delta', color: PUMP, icon: I.shield },
  ]},
  { id: 'whales', label: 'Smart Money & Whales', items: [
    { href: '/smart-money',       label: 'Smart Money',    color: PUR,  icon: I.signal },
    { href: '/smart-money-composite', label: 'SM Composite', color: PUR, icon: I.pieChart },
    { href: '/hl-traders',        label: 'HL Traders',     color: PUR,  icon: I.user },
    { href: '/hl-vaults',         label: 'HL Vaults',      color: PUR,  icon: I.shield },
    { href: '/hl-whales',         label: 'HL Whales',      color: PUR,  icon: I.whale },
    { href: '/gmx-traders',       label: 'GMX Traders',    color: PUR,  icon: I.user },
    { href: '/wallet-tracker',    label: 'Wallet Tracker', color: PUR,  icon: I.wallet },
    { href: '/compare-traders',   label: 'Compare Traders', color: PUR, icon: I.scale },
  ]},
  { id: 'macro', label: 'Macro & Events', items: [
    { href: '/economic-calendar', label: 'Event Calendar', color: ACC,  icon: I.calendar },
    { href: '/fomc-playbook',     label: 'FOMC Playbook',  color: ACC,  icon: I.calendar },
    { href: '/token-unlocks',     label: 'Token Unlocks',  color: ACC,  icon: I.calendar },
    { href: '/cliff-watch',       label: 'Cliff Watch',    color: ACC,  icon: I.calendar },
    { href: '/airdrops',          label: 'Airdrops',       color: ACC,  icon: I.gift },
    { href: '/bitcoin-treasuries', label: 'BTC Treasuries', color: ACL, icon: I.bitcoin },
    { href: '/fear-greed',        label: 'Fear & Greed',   color: ACC,  icon: I.flame },
    { href: '/news',              label: 'News',           color: MUTE, icon: I.news },
  ]},
  { id: 'tools', label: 'Tools', items: [
    { href: '/dashboard',          label: 'Dashboard',     color: ACC,  icon: I.dash },
    { href: '/positions',          label: 'Positions',     color: ACC,  icon: I.briefcase },
    { href: '/account/connections', label: 'Connections',  color: ACC,  icon: I.user },
    { href: '/social',             label: 'KOL Feed',      color: MUTE, icon: I.news },
    { href: '/watchlist',          label: 'Watchlists',    color: ACC,  icon: I.watch },
    { href: '/portfolio',          label: 'Portfolio (manual)', color: MUTE, icon: I.briefcase },
    { href: '/compare',            label: 'Compare',       color: MUTE, icon: I.scale },
  ]},
  { id: 'account', label: 'Account', items: [
    { href: '/profile',           label: 'Profile',        color: MUTE, icon: I.user },
    { href: '/settings',          label: 'Settings',       color: MUTE, icon: I.settings },
    { href: '/login',             label: 'Sign In',        color: MUTE, icon: I.user },
    { href: '/signup',            label: 'Sign Up',        color: MUTE, icon: I.user },
    { href: '/referrals',         label: 'Referrals',      color: ACC,  icon: I.gift },
    { href: '/donate',            label: 'Donate',         color: ACC,  icon: I.heart },
    { href: '/points',            label: 'Points',         color: ACC,  icon: I.star },
  ]},
  { id: 'resources', label: 'Resources', items: [
    { href: '/guides',            label: 'Guides',         color: MUTE, icon: I.book },
    { href: '/faq',               label: 'FAQ',            color: MUTE, icon: I.book },
    { href: '/api-docs',          label: 'API Docs',       color: MUTE, icon: I.book },
    { href: '/developers',        label: 'Developers',     color: MUTE, icon: I.cube },
    { href: '/brand',             label: 'Brand',          color: MUTE, icon: I.heart },
    { href: '/team',              label: 'Team',           color: MUTE, icon: I.user },
    { href: '/privacy',           label: 'Privacy',        color: MUTE, icon: I.shield },
    { href: '/terms',             label: 'Terms',          color: MUTE, icon: I.book },
  ]},
  { id: 'admin', label: 'Admin', items: [
    { href: '/admin',             label: 'Admin',          color: REKT, icon: I.shield },
    { href: '/admin-panel',       label: 'Admin Panel',    color: REKT, icon: I.settings },
  ]},
];

interface SidebarProps { sections?: SidebarSection[]; online?: number; dexCount?: number; msgPerSec?: number; className?: string; }

export default function Sidebar({ sections = DEFAULT_SECTIONS, online = 33, dexCount = 15, msgPerSec = 1247, className }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const [q, setQ] = useState('');

  // Hide Admin section unless the current user has the admin role
  const visibleSections = useMemo(
    () => isAdmin ? sections : sections.filter(s => s.id !== 'admin'),
    [sections, isAdmin]
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return visibleSections;
    const ql = q.toLowerCase();
    return visibleSections.map(s => ({ ...s, items: s.items.filter(it => it.label.toLowerCase().includes(ql)) })).filter(s => s.items.length);
  }, [q, visibleSections]);

  return (
    <aside className={className} style={{ width: 232, flexShrink: 0, background: 'var(--hub-black)', borderRight: '1px solid var(--hub-border-subtle)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto' }} aria-label="Primary navigation">
      <div style={{ position: 'relative', padding: '0 4px' }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', display: 'inline-flex' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search coin…" style={{ width: '100%', background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 7, padding: '7px 10px 7px 30px', color: 'var(--fg-default)', fontFamily: 'var(--font-sans)', fontSize: 12, outline: 'none' }} />
      </div>
      {filtered.map(sec => (
        <div key={sec.id}>
          <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, padding: '0 12px 6px' }}>{sec.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sec.items.map(it => {
              const on = pathname === it.href;
              return (
                <Link key={it.href} href={it.href} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', background: on ? 'rgba(255,165,0,0.08)' : 'transparent', borderLeft: on ? '2px solid var(--hub-accent)' : '2px solid transparent', borderRadius: on ? '0 6px 6px 0' : 6, fontFamily: 'var(--font-sans)', fontSize: 12, color: on ? 'var(--fg-default)' : 'var(--fg-muted)', fontWeight: on ? 600 : 500, textAlign: 'left', textDecoration: 'none', transition: 'background 100ms' }}>
                  <span style={{ color: on ? it.color : 'var(--fg-subtle)', flexShrink: 0, display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${it.icon}</svg>` }} />
                  <span style={{ flex: 1 }}>{it.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ padding: 10, background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 700, color: 'var(--pump-mild)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          <span style={{ width: 5, height: 5, background: 'var(--pump-mild)', borderRadius: 999, boxShadow: '0 0 6px var(--pump-mild)' }} />Online · {online}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 700, color: 'var(--hub-accent-light)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          <span style={{ width: 5, height: 5, background: 'var(--hub-accent-light)', borderRadius: 999 }} />DEX · {dexCount}
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{(msgPerSec / 1000).toFixed(1)}k msg/s</div>
      </div>
    </aside>
  );
}
