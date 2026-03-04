'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Search, ChevronDown, ChevronUp, Shield, Coins, AlertTriangle, TrendingUp, Zap, Landmark, ExternalLink } from 'lucide-react';
import UpdatedAgo from '@/components/UpdatedAgo';
import { formatCompact } from '@/lib/utils/format';
import { useApi } from '@/hooks/useSWRApi';
import { TokenIconSimple } from '@/components/TokenIcon';

/* ─── Types ──────────────────────────────────────────────────────── */

interface YieldPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvl: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  stablecoin: boolean;
  ilRisk: string;
  apyChange7d: number | null;
  apyMean30d: number | null;
  prediction: string | null;
  poolMeta: string | null;
  exposure: string | null;
  category: string | null;
}

type SortField = 'symbol' | 'project' | 'chain' | 'apy' | 'apyBase' | 'tvl' | 'apyChange7d' | 'apyMean30d';
type CategoryFilter = 'all' | 'stablecoin' | 'bluechip' | 'highyield' | 'lowrisk';

/* ─── Constants ──────────────────────────────────────────────────── */

const PROJECT_DISPLAY: Record<string, string> = {
  'aave-v3': 'Aave V3', 'aave-v2': 'Aave V2', 'aave-v3-lido': 'Aave V3 Lido',
  'morpho-v1': 'Morpho', 'morpho-blue': 'Morpho Blue',
  'pendle': 'Pendle', 'compound-v3': 'Compound V3', 'compound-v2': 'Compound V2',
  'spark': 'Spark', 'euler-v2': 'Euler V2', 'fluid': 'Fluid',
  'venus': 'Venus', 'silo-v2': 'Silo V2', 'radiant-v2': 'Radiant V2',
  'benqi-lending': 'BenQi', 'moonwell': 'Moonwell', 'seamless-protocol': 'Seamless',
  'kamino-lend': 'Kamino', 'marginfi': 'Marginfi', 'drift-lending': 'Drift',
  'lido': 'Lido', 'rocketpool': 'Rocket Pool', 'jito': 'Jito', 'marinade': 'Marinade',
  'ethena': 'Ethena', 'maker': 'Maker', 'sky': 'Sky', 'usual-protocol': 'Usual',
  'mountain-protocol': 'Mountain', 'yearn-v3': 'Yearn V3', 'beefy': 'Beefy',
  'convex-finance': 'Convex', 'spectra': 'Spectra',
  'gmx-v2-perps': 'GMX V2', 'hyperliquid-hlp': 'Hyperliquid HLP',
  'ionic': 'Ionic', 'layerbank': 'LayerBank', 'zerolend': 'ZeroLend',
  'pac-finance': 'Pac Finance',
};

const CHAIN_COLORS: Record<string, string> = {
  'Ethereum': 'bg-blue-500/10 text-blue-400',
  'Arbitrum': 'bg-sky-500/10 text-sky-400',
  'Optimism': 'bg-red-500/10 text-red-400',
  'Base': 'bg-blue-600/10 text-blue-300',
  'Polygon': 'bg-purple-500/10 text-purple-400',
  'BSC': 'bg-yellow-500/10 text-yellow-400',
  'Avalanche': 'bg-red-600/10 text-red-300',
  'Solana': 'bg-gradient-to-r from-purple-500/10 to-green-500/10 text-green-400',
  'Hyperliquid L1': 'bg-emerald-500/10 text-emerald-400',
  'Monad': 'bg-violet-500/10 text-violet-400',
};

const BLUE_CHIPS = new Set(['BTC', 'ETH', 'WBTC', 'WETH', 'STETH', 'WSTETH', 'CBETH', 'RETH', 'SOL', 'MSOL', 'JITOSOL']);

const CATEGORY_TABS: { key: CategoryFilter; label: string; icon: typeof Coins }[] = [
  { key: 'all', label: 'All Pools', icon: Coins },
  { key: 'stablecoin', label: 'Stablecoins', icon: Shield },
  { key: 'bluechip', label: 'Blue Chips', icon: Landmark },
  { key: 'highyield', label: 'High Yield', icon: Zap },
  { key: 'lowrisk', label: 'Low Risk', icon: TrendingUp },
];

/* ─── Helpers ────────────────────────────────────────────────────── */

/** Known tokens that have icons — used to find the best match from a pool symbol */
const KNOWN_TOKENS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'UNI',
  'ATOM', 'LTC', 'BCH', 'BNB', 'USDT', 'USDC', 'DAI', 'FRAX', 'MKR', 'AAVE',
  'CRV', 'CVX', 'SNX', 'COMP', 'SUSHI', 'YFI', 'LDO', 'RPL', 'GMX', 'PENDLE',
  'ARB', 'OP', 'SUI', 'SEI', 'INJ', 'TIA', 'FTM', 'NEAR', 'APT', 'STX',
  'MATIC', 'POL', 'STETH', 'WETH', 'WBTC', 'CBETH', 'RETH', 'ENA', 'ONDO',
  'PEPE', 'BONK', 'SHIB', 'WIF', 'FLOKI', 'DYDX', 'FXS', 'GRT', 'ENS',
  'IMX', 'BLUR', 'EIGEN', 'ETHFI', 'TON', 'KAS', 'RENDER', 'FET', 'TAO',
  'HBAR', 'ICP', 'FIL', 'AR', 'THETA', 'ALGO', 'VET', 'OSMO', 'KAVA',
  'MORPHO', 'USUAL', 'HYPE', 'BERA', 'KAITO', 'JUP', 'JTO', 'PYTH',
]);

/** DeFi wrapper prefix → base token mapping */
const DEFI_UNWRAP: Record<string, string> = {
  'WBTC': 'BTC', 'WETH': 'ETH', 'WBNB': 'BNB', 'WAVAX': 'AVAX', 'WSOL': 'SOL',
  'WSTETH': 'STETH', 'STETH': 'ETH', 'CBETH': 'ETH', 'RETH': 'ETH', 'MSOL': 'SOL',
  'JITOSOL': 'SOL', 'BTCB': 'BTC', 'SOLVBTC': 'BTC', 'TBTC': 'BTC',
  'USDCE': 'USDC', 'USDTE': 'USDT', 'FRXETH': 'ETH', 'FRXUSD': 'FRAX',
  'SDAI': 'DAI', 'SUSDE': 'ENA', 'USDE': 'ENA', 'CRVUSD': 'CRV',
  'SDOLA': 'DAI', 'CVXCRV': 'CVX', 'YCRV': 'CRV', 'SDCRV': 'CRV',
  'CLEVCVX': 'CVX', 'MPENDLE': 'PENDLE', 'ASDPENDLE': 'PENDLE',
  'SKAITO': 'KAITO', 'ASDCRV': 'CRV', 'SCRVUSD': 'CRV',
  'REUSDE': 'ENA', 'APYUSD': 'USDC', 'YOUSD': 'USDC', 'OUSD': 'USDC',
  'MUSD': 'USDC', 'IUSD': 'USDC', 'PMUSD': 'USDC', 'MSUSD': 'USDC',
  'BOLD': 'USDC', 'USP': 'USDC', 'FXUSD': 'FRAX', 'USDAF': 'USDC',
};

/** Extract the best token from pool symbol for icon display */
function primaryToken(symbol: string): string {
  // Split multi-token symbols: "ETH-USDC" → ["ETH", "USDC"]
  const parts = symbol.toUpperCase().replace(/\./g, '').split('-');

  // Try each part: first exact match, then unwrap
  for (const part of parts) {
    if (KNOWN_TOKENS.has(part)) return part;
  }
  for (const part of parts) {
    const unwrapped = DEFI_UNWRAP[part];
    if (unwrapped && KNOWN_TOKENS.has(unwrapped)) return unwrapped;
  }

  // For single-token symbols, try stripping common prefixes
  const first = parts[0];
  const prefixes = ['W', 'ST', 'A', 'C', 'S', 'Y', 'R', 'M'];
  for (const p of prefixes) {
    if (first.startsWith(p) && first.length > p.length) {
      const stripped = first.slice(p.length);
      if (KNOWN_TOKENS.has(stripped)) return stripped;
    }
  }

  return first;
}

/** Get the APY bar width as a percentage (capped at 50% APY = 100% bar) */
function apyBarWidth(apy: number): number {
  return Math.min(100, (apy / 50) * 100);
}

/** Check if pool has IL risk */
function hasILRisk(pool: YieldPool): boolean {
  return pool.ilRisk === 'yes';
}

/** Check if pool is "blue chip" — involves major tokens */
function isBluechip(pool: YieldPool): boolean {
  const tokens = pool.symbol.toUpperCase().split('-');
  return tokens.some(t => BLUE_CHIPS.has(t));
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function YieldsPage() {
  const API_URL = '/api/yields?lending=true&minTvl=100000';
  const { data, isLoading, error, lastUpdate } = useApi<{
    data: YieldPool[];
    chains: string[];
    projects: string[];
    count: number;
  }>({
    key: API_URL,
    fetcher: () => fetch(API_URL).then(r => r.json()),
    refreshInterval: 300_000,
  });

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('apy');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [chainFilter, setChainFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const pools = data?.data || [];
  const chains = data?.chains || [];
  const projects = data?.projects || [];

  /* ─── Filtered + Sorted ─────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let list = pools;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.symbol.toLowerCase().includes(q) ||
        p.project.toLowerCase().includes(q) ||
        p.chain.toLowerCase().includes(q)
      );
    }
    if (chainFilter) list = list.filter(p => p.chain === chainFilter);
    if (projectFilter) list = list.filter(p => p.project === projectFilter);

    // Category filters
    if (categoryFilter === 'stablecoin') list = list.filter(p => p.stablecoin);
    if (categoryFilter === 'bluechip') list = list.filter(p => isBluechip(p));
    if (categoryFilter === 'highyield') list = list.filter(p => p.apy >= 15);
    if (categoryFilter === 'lowrisk') list = list.filter(p => !hasILRisk(p) && p.tvl >= 1_000_000);

    list = [...list].sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return list;
  }, [pools, search, chainFilter, projectFilter, categoryFilter, sortField, sortDir]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  /* ─── Summary Stats ─────────────────────────────────────────────── */

  const stats = useMemo(() => {
    if (!pools.length) return null;
    const stables = pools.filter(p => p.stablecoin && p.apy > 0);
    const totalTvl = pools.reduce((s, p) => s + p.tvl, 0);
    const avgStableApy = stables.length > 0
      ? stables.reduce((s, p) => s + p.apy, 0) / stables.length
      : 0;
    const topYield = pools.reduce((max, p) => p.apy > max.apy ? p : max, pools[0]);
    const medianApy = (() => {
      const sorted = [...pools].sort((a, b) => a.apy - b.apy);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid].apy : (sorted[mid - 1].apy + sorted[mid].apy) / 2;
    })();
    return { totalTvl, avgStableApy, topYield, poolCount: pools.length, medianApy };
  }, [pools]);

  /* ─── Sort Handler ──────────────────────────────────────────────── */

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(0);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-amber-400" />
      : <ChevronUp className="w-3 h-3 text-amber-400" />;
  }

  /* ─── Render ────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Coins className="w-6 h-6 text-amber-400" />
            <h1 className="text-xl font-semibold">DeFi Yields</h1>
            {data && <span className="text-xs text-neutral-500">{filtered.length} pools</span>}
          </div>
          {lastUpdate && <UpdatedAgo date={lastUpdate} />}
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white/[0.03] rounded-lg px-4 py-3 border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Total TVL</div>
              <div className="text-lg font-semibold">${formatCompact(stats.totalTvl)}</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg px-4 py-3 border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Avg Stable APY</div>
              <div className="text-lg font-semibold text-green-400">{stats.avgStableApy.toFixed(2)}%</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg px-4 py-3 border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Median APY</div>
              <div className="text-lg font-semibold text-blue-400">{stats.medianApy.toFixed(2)}%</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg px-4 py-3 border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Pools Tracked</div>
              <div className="text-lg font-semibold">{stats.poolCount}</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg px-4 py-3 border border-white/[0.06] col-span-2 md:col-span-1">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Top Yield</div>
              <div className="text-lg font-semibold text-amber-400">{stats.topYield.apy.toFixed(1)}%</div>
              <div className="text-[10px] text-neutral-500">{stats.topYield.symbol} · {PROJECT_DISPLAY[stats.topYield.project] || stats.topYield.project}</div>
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORY_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = categoryFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setCategoryFilter(tab.key); setPage(0); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
                  isActive
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search token, protocol, chain..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-10 pr-4 py-2 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </div>
          <select
            value={chainFilter}
            onChange={e => { setChainFilter(e.target.value); setPage(0); }}
            className="bg-[#141419] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer [&>option]:bg-[#141419] [&>option]:text-white"
          >
            <option value="">All Chains</option>
            {chains.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={projectFilter}
            onChange={e => { setProjectFilter(e.target.value); setPage(0); }}
            className="bg-[#141419] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer [&>option]:bg-[#141419] [&>option]:text-white"
          >
            <option value="">All Protocols</option>
            {projects.map(p => <option key={p} value={p}>{PROJECT_DISPLAY[p] || p}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-neutral-500">Loading yields...</div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-red-400">Failed to load yield data</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[#0d0d14]">
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('symbol')}>
                    <div className="flex items-center gap-1">Token <SortIcon field="symbol" /></div>
                  </th>
                  <th className="text-left px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('project')}>
                    <div className="flex items-center gap-1">Protocol <SortIcon field="project" /></div>
                  </th>
                  <th className="text-left px-3 py-3 cursor-pointer select-none hidden md:table-cell" onClick={() => toggleSort('chain')}>
                    <div className="flex items-center gap-1">Chain <SortIcon field="chain" /></div>
                  </th>
                  <th className="text-right px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('apy')}>
                    <div className="flex items-center justify-end gap-1">APY <SortIcon field="apy" /></div>
                  </th>
                  <th className="text-right px-3 py-3 cursor-pointer select-none hidden sm:table-cell" onClick={() => toggleSort('apyBase')}>
                    <div className="flex items-center justify-end gap-1">Base <SortIcon field="apyBase" /></div>
                  </th>
                  <th className="text-right px-3 py-3 hidden sm:table-cell">Reward</th>
                  <th className="text-right px-3 py-3 cursor-pointer select-none hidden lg:table-cell" onClick={() => toggleSort('apyMean30d')}>
                    <div className="flex items-center justify-end gap-1">30D Avg <SortIcon field="apyMean30d" /></div>
                  </th>
                  <th className="text-right px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('tvl')}>
                    <div className="flex items-center justify-end gap-1">TVL <SortIcon field="tvl" /></div>
                  </th>
                  <th className="text-right px-3 py-3 cursor-pointer select-none hidden lg:table-cell" onClick={() => toggleSort('apyChange7d')}>
                    <div className="flex items-center justify-end gap-1">7D <SortIcon field="apyChange7d" /></div>
                  </th>
                  <th className="text-center px-3 py-3 hidden xl:table-cell">Risk</th>
                  <th className="text-right px-4 py-3 hidden xl:table-cell">Outlook</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((pool, i) => {
                  const token = primaryToken(pool.symbol);
                  const mean30d = pool.apyMean30d;
                  const apyVsMean = mean30d && mean30d > 0 ? ((pool.apy - mean30d) / mean30d) * 100 : null;
                  return (
                    <tr
                      key={pool.pool}
                      className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group ${
                        i % 2 === 0 ? '' : 'bg-white/[0.01]'
                      }`}
                    >
                      {/* Token */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <TokenIconSimple symbol={token} size={24} />
                          <div>
                            <div className="font-medium flex items-center gap-1.5">
                              {pool.symbol}
                              {pool.poolMeta && (
                                <span className="text-[10px] text-neutral-500 font-normal">{pool.poolMeta}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {pool.stablecoin && (
                                <span className="text-[9px] text-green-400/80 bg-green-500/10 px-1 py-0 rounded">STABLE</span>
                              )}
                              {hasILRisk(pool) && (
                                <span className="text-[9px] text-orange-400/80 bg-orange-500/10 px-1 py-0 rounded">IL</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Protocol */}
                      <td className="px-3 py-2.5 text-neutral-300">
                        {PROJECT_DISPLAY[pool.project] || pool.project}
                      </td>

                      {/* Chain */}
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CHAIN_COLORS[pool.chain] || 'bg-white/[0.05] text-neutral-400'}`}>
                          {pool.chain}
                        </span>
                      </td>

                      {/* APY with visual bar */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`font-semibold tabular-nums ${pool.apy >= 20 ? 'text-amber-400' : pool.apy >= 8 ? 'text-green-400' : 'text-neutral-200'}`}>
                            {pool.apy.toFixed(2)}%
                          </span>
                          <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pool.apy >= 20 ? 'bg-amber-500/60' : pool.apy >= 8 ? 'bg-green-500/60' : 'bg-blue-500/40'}`}
                              style={{ width: `${apyBarWidth(pool.apy)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Base APY */}
                      <td className="px-3 py-2.5 text-right text-neutral-400 tabular-nums hidden sm:table-cell">
                        {pool.apyBase !== null ? `${pool.apyBase.toFixed(2)}%` : '—'}
                      </td>

                      {/* Reward APY */}
                      <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                        {pool.apyReward !== null && pool.apyReward > 0 ? (
                          <span className="text-purple-400 tabular-nums">+{pool.apyReward.toFixed(2)}%</span>
                        ) : '—'}
                      </td>

                      {/* 30D Mean APY */}
                      <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                        {mean30d !== null ? (
                          <div className="flex flex-col items-end">
                            <span className="text-neutral-300 tabular-nums">{mean30d.toFixed(2)}%</span>
                            {apyVsMean !== null && Math.abs(apyVsMean) > 10 && (
                              <span className={`text-[10px] tabular-nums ${apyVsMean > 0 ? 'text-amber-400/70' : 'text-blue-400/70'}`}>
                                {apyVsMean > 0 ? '+' : ''}{apyVsMean.toFixed(0)}% vs avg
                              </span>
                            )}
                          </div>
                        ) : '—'}
                      </td>

                      {/* TVL */}
                      <td className="px-3 py-2.5 text-right text-neutral-300 tabular-nums">
                        ${formatCompact(pool.tvl)}
                      </td>

                      {/* 7D Change */}
                      <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                        {pool.apyChange7d !== null ? (
                          <span className={`tabular-nums ${pool.apyChange7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pool.apyChange7d >= 0 ? '+' : ''}{pool.apyChange7d.toFixed(2)}%
                          </span>
                        ) : '—'}
                      </td>

                      {/* Risk */}
                      <td className="px-3 py-2.5 text-center hidden xl:table-cell">
                        {hasILRisk(pool) ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-orange-400/80 bg-orange-500/8 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" />IL
                          </span>
                        ) : (
                          <span className="text-[10px] text-green-400/60">Low</span>
                        )}
                      </td>

                      {/* Outlook */}
                      <td className="px-4 py-2.5 text-right hidden xl:table-cell">
                        {pool.prediction ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            pool.prediction.includes('Up') ? 'bg-green-500/10 text-green-400' :
                            pool.prediction.includes('Down') ? 'bg-red-500/10 text-red-400' :
                            'bg-white/[0.05] text-neutral-400'
                          }`}>
                            {pool.prediction}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-neutral-500">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded bg-white/[0.04] border border-white/[0.08] disabled:opacity-30 hover:bg-white/[0.08]"
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded bg-white/[0.04] border border-white/[0.08] disabled:opacity-30 hover:bg-white/[0.08]"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Source */}
        <div className="mt-6 text-center text-xs text-neutral-600 flex items-center justify-center gap-1">
          Data from{' '}
          <a href="https://defillama.com/yields" target="_blank" rel="noopener" className="text-neutral-500 hover:text-neutral-400 inline-flex items-center gap-0.5">
            DeFiLlama <ExternalLink className="w-3 h-3" />
          </a>
          {' '}· Updated every 5 minutes
        </div>
      </main>
      <Footer />
    </div>
  );
}
