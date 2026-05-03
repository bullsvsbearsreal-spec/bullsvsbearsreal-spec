'use client';

import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Gem, ExternalLink, Search, Layers, Info, Zap, Clock,
} from 'lucide-react';

/* ─── Program registry ────────────────────────────────────────────── */

type ProgramStatus = 'live' | 'upcoming' | 'ended' | 'unknown';

interface PointsProgram {
  id: string;
  name: string;
  category: 'Perp DEX' | 'L2' | 'Infra' | 'Social' | 'DeFi';
  status: ProgramStatus;
  tgeEstimate: string;      // e.g. "Q2 2026", "Season 2", "TBA"
  season?: string;
  mechanics: string;         // 1-line explanation of how you earn
  officialUrl: string;
  /** If populated, `{address}` placeholder will be substituted with user's address */
  checkerTemplate?: string;
  /** If we have a live leaderboard integration, the internal route to query */
  liveIntegration?: 'hyperliquid';
  accent: string;
  tldr: string;              // 1-line summary
  risks?: string;            // optional caveats
  /** ISO date (YYYY-MM-DD) when the registry entry was last reviewed. */
  lastVerified: string;
}

/** Global registry-verified date — shown at top so users know freshness upfront. */
const REGISTRY_VERIFIED = '2026-04-20';

const PROGRAMS: PointsProgram[] = [
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: '$HYPE live since Nov 2024 · ongoing rewards',
    mechanics: 'Earn ongoing rewards from trading perps + adding liquidity to HLP. Trading volume and HLP staking tracked live.',
    officialUrl: 'https://app.hyperliquid.xyz/points',
    checkerTemplate: 'https://app.hyperliquid.xyz/address/{address}',
    liveIntegration: 'hyperliquid',
    accent: '#a855f7',
    tldr: 'Season 1 airdrop was $6.2B — largest by mcap ever. HYPE already trades.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'aster',
    name: 'Aster',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: 'Rh season active · TGE ETA unclear (monitor announcements)',
    mechanics: 'Rh points from trading perps. Multipliers from leverage, hold duration, referrals. Separate from earlier $AST airdrop.',
    officialUrl: 'https://www.asterdex.com/en/rewards',
    checkerTemplate: 'https://www.asterdex.com/en/portfolio',
    accent: '#f59e0b',
    tldr: 'BNB-chain perp DEX backed by YZi Labs (ex-Binance Labs).',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'lighter',
    name: 'Lighter',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: 'Points season ongoing · TGE unscheduled',
    mechanics: 'Points accrue on trading volume + LP positions on their zk-rollup. Daily position snapshots.',
    officialUrl: 'https://app.lighter.xyz/points',
    checkerTemplate: 'https://app.lighter.xyz/account/{address}',
    accent: '#3b82f6',
    tldr: 'zk-rollup perp DEX with 0-fee trading during points season.',
    risks: 'Withdrawals can lag during ZK circuit proofs — review their docs before committing large size.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'paradex',
    name: 'Paradex',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: 'XP season currently active · check app for current number',
    mechanics: 'XP from perp trading + LP into Paradex vault. Paradex runs its own Starknet appchain.',
    officialUrl: 'https://app.paradex.trade/rewards',
    checkerTemplate: 'https://app.paradex.trade/portfolio',
    accent: '#22c55e',
    tldr: 'Starknet appchain perp DEX, spun out of Paradigm.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'extended',
    name: 'Extended',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: 'TBA · points ongoing',
    mechanics: 'Points for perp trading, LP, and referrals. Low-latency Starknet execution focus.',
    officialUrl: 'https://app.extended.exchange/',
    checkerTemplate: 'https://app.extended.exchange/portfolio',
    accent: '#e040fb',
    tldr: 'Starknet perp DEX, rebrand of X10.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'jupiter-perps',
    name: 'Jupiter Perps',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: '$JUP already live · ongoing weekly rewards',
    mechanics: 'Trading volume rewards distributed in JUP weekly via LFG launchpad — no points system, direct token drops.',
    officialUrl: 'https://perps.jup.ag/',
    checkerTemplate: 'https://perps.jup.ag/portfolio',
    accent: '#ef4444',
    tldr: 'Solana\'s dominant perp DEX, built on Jupiter infra.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'backpack',
    name: 'Backpack',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: 'Multi-season points active · TGE tracked for 2026',
    mechanics: 'Points from Backpack Exchange trading + wallet usage. Mad Lads NFT holders get bonus allocation.',
    officialUrl: 'https://backpack.exchange/rewards',
    checkerTemplate: 'https://backpack.exchange/portfolio',
    accent: '#ec4899',
    tldr: 'Full-stack Solana exchange + wallet.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'drift',
    name: 'Drift',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: '$DRIFT already live · ongoing FUEL rewards',
    mechanics: 'FUEL points from trading, staking, insurance fund LP. DRIFT token drops tied to FUEL accumulation.',
    officialUrl: 'https://app.drift.trade/earn',
    checkerTemplate: 'https://app.drift.trade/overview',
    accent: '#6366f1',
    tldr: 'Solana perp DEX with longest-running points program.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'monad',
    name: 'Monad',
    category: 'L2',
    status: 'upcoming',
    tgeEstimate: 'Mainnet ETA 2026 · testnet activity tracked',
    mechanics: 'Testnet engagement is the main signal right now. Bridge + use testnet apps + early mainnet = likely rewarded.',
    officialUrl: 'https://testnet.monad.xyz/',
    accent: '#7c3aed',
    tldr: 'High-throughput L1 (10K TPS target) by ex-Jump team.',
    risks: 'Testnet-only. Heavy sybil filtering expected at launch.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'megaeth',
    name: 'MegaETH',
    category: 'L2',
    status: 'upcoming',
    tgeEstimate: 'Mainnet ETA 2026 · testnet live',
    mechanics: 'Real-time Ethereum L2. Testnet participation + early mainnet positioning likely rewarded.',
    officialUrl: 'https://testnet.megaeth.com/',
    accent: '#0ea5e9',
    tldr: '10ms block times — closest thing to CEX latency on-chain.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'hibachi',
    name: 'Hibachi',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: 'Points program early · TGE TBA',
    mechanics: 'High-performance perp DEX with points for trading volume and referrals. Fresh entrant to the meta.',
    officialUrl: 'https://hibachi.xyz/',
    checkerTemplate: 'https://hibachi.xyz/portfolio',
    accent: '#f97316',
    tldr: 'MEV-resistant perp DEX on its own chain.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'pacifica',
    name: 'Pacifica',
    category: 'Perp DEX',
    status: 'live',
    tgeEstimate: 'Early points · TGE unannounced',
    mechanics: 'Volume-weighted points from trading perps on a Solana-aligned venue. Fast fills, referrals boost.',
    officialUrl: 'https://www.pacifica.fi/',
    accent: '#14b8a6',
    tldr: 'Newer Solana-adjacent perp DEX with active points campaign.',
    lastVerified: REGISTRY_VERIFIED,
  },
  {
    id: 'boyco',
    name: 'Boyco (Berachain)',
    category: 'DeFi',
    status: 'ended',
    tgeEstimate: '$BERA airdrop distributed Feb 2025',
    mechanics: 'Historical: pre-deposit campaign for Berachain mainnet. Funds were locked for TGE allocation.',
    officialUrl: 'https://app.boyco.berachain.com/',
    accent: '#facc15',
    tldr: 'Largest pre-deposit campaign in crypto history — $3.5B locked.',
    lastVerified: REGISTRY_VERIFIED,
  },
];

const STATUS_STYLES: Record<ProgramStatus, { bg: string; text: string; label: string }> = {
  live:     { bg: 'bg-green-500/15', text: 'text-green-400', label: 'LIVE' },
  upcoming: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'UPCOMING' },
  ended:    { bg: 'bg-neutral-500/15', text: 'text-neutral-400', label: 'CLAIMED' },
  unknown:  { bg: 'bg-neutral-500/15', text: 'text-neutral-400', label: '—' },
};

/* ─── Card ──────────────────────────────────────────────────────── */

function ProgramCard({ p, walletAddr }: { p: PointsProgram; walletAddr: string }) {
  const status = STATUS_STYLES[p.status];
  const checkerUrl = p.checkerTemplate && walletAddr
    ? p.checkerTemplate.replace('{address}', walletAddr)
    : p.checkerTemplate;
  const addressIsValid = /^0x[a-fA-F0-9]{40}$/.test(walletAddr);
  const hasAddressPlaceholder = p.checkerTemplate?.includes('{address}');

  // "Verified N days ago" — live tick based on the per-program lastVerified date.
  // Anything >30 days old flips to amber so users know the entry might be stale.
  const daysSinceVerified = Math.floor(
    (Date.now() - new Date(p.lastVerified).getTime()) / 86_400_000,
  );
  const isStale = daysSinceVerified > 30;

  return (
    <div className="card-premium p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.accent }}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{p.name}</h3>
            <div className="text-[10px] text-neutral-500 mt-0.5">{p.category}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${status.bg} ${status.text}`}>
            {status.label}
          </div>
          <div
            className={`text-[9px] font-mono inline-flex items-center gap-1 ${
              isStale ? 'text-amber-400/80' : 'text-neutral-600'
            }`}
            title={`Entry reviewed ${p.lastVerified} (${daysSinceVerified}d ago)`}
          >
            <span className={`w-1 h-1 rounded-full ${isStale ? 'bg-amber-400' : 'bg-neutral-600'}`} />
            <span>{daysSinceVerified === 0 ? 'today' : `${daysSinceVerified}d`}</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-neutral-300 leading-relaxed">{p.tldr}</p>

      <div className="text-[10px] text-neutral-500 leading-relaxed space-y-1.5">
        <div className="flex items-start gap-1.5">
          <Clock className="w-3 h-3 mt-0.5 flex-shrink-0 text-neutral-600" />
          <span className="text-neutral-400">{p.tgeEstimate}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-neutral-600" />
          <span>{p.mechanics}</span>
        </div>
        {p.risks && (
          <div className="flex items-start gap-1.5 text-orange-300/70">
            <span className="text-orange-400 mt-0.5 flex-shrink-0" aria-hidden>!</span>
            <span>{p.risks}</span>
          </div>
        )}
      </div>

      <div className="mt-auto pt-2 border-t border-white/[0.04] space-y-1.5">
        <div className="flex items-center gap-2">
          <a
            href={p.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-semibold text-neutral-300 hover:text-white transition-colors"
          >
            Program page <ExternalLink className="w-2.5 h-2.5" />
          </a>
          {p.checkerTemplate && (
            // Always render the button when the program has a portfolio/checker URL.
            // If the URL has an {address} placeholder but the user hasn't typed
            // a wallet yet, fall back to the plain portfolio URL — still useful.
            <a
              href={checkerUrl || p.checkerTemplate.replace('{address}', '').replace(/\/$/, '')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-semibold bg-hub-yellow/15 text-hub-yellow hover:bg-hub-yellow/25 transition-colors"
              title={hasAddressPlaceholder && !addressIsValid ? 'Opens portfolio page. Paste a wallet above to pre-fill.' : 'Open checker'}
            >
              {hasAddressPlaceholder && !addressIsValid ? 'Open portal' : 'Check me'} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
        {p.liveIntegration === 'hyperliquid' && addressIsValid && (
          <Link
            href={`/trader/${walletAddr}`}
            className="w-full text-center inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-semibold bg-purple-500/15 text-purple-300 hover:bg-purple-500/25"
            title="See this wallet on InfoHub's cross-platform trader view (includes HL positions + volume)"
          >
            <Zap className="w-2.5 h-2.5" /> View on InfoHub
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

type CategoryFilter = 'all' | 'Perp DEX' | 'L2' | 'DeFi';
type SortKey = 'default' | 'name' | 'freshness';

export default function PointsHubPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | ProgramStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortKey>('default');
  const [wallet, setWallet] = useState('');

  const filtered = (() => {
    let list = PROGRAMS;
    if (filter !== 'all') list = list.filter(p => p.status === filter);
    if (categoryFilter !== 'all') list = list.filter(p => p.category === categoryFilter);
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'freshness') {
      list = [...list].sort((a, b) => {
        const aDate = new Date(a.lastVerified).getTime();
        const bDate = new Date(b.lastVerified).getTime();
        return bDate - aDate; // newest first
      });
    }
    return list;
  })();

  const handleLookup = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = wallet.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      router.push(`/trader/${trimmed}`);
    }
  }, [wallet, router]);

  const live = PROGRAMS.filter(p => p.status === 'live').length;
  const upcoming = PROGRAMS.filter(p => p.status === 'upcoming').length;
  const ended = PROGRAMS.filter(p => p.status === 'ended').length;

  // Category counts (respecting current status filter)
  const statusFiltered = filter === 'all' ? PROGRAMS : PROGRAMS.filter(p => p.status === filter);
  const catCounts = {
    all: statusFiltered.length,
    'Perp DEX': statusFiltered.filter(p => p.category === 'Perp DEX').length,
    'L2': statusFiltered.filter(p => p.category === 'L2').length,
    'DeFi': statusFiltered.filter(p => p.category === 'DeFi').length,
  };

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-md bg-hub-yellow/10 flex items-center justify-center">
              <Gem className="w-4 h-4 text-hub-yellow" />
            </div>
            <h1 className="text-xl font-bold text-white">Points &amp; Airdrop Hub</h1>
            <span className="text-xs text-neutral-500 font-mono">{PROGRAMS.length} programs tracked</span>
          </div>
          <p className="text-sm text-neutral-500 max-w-3xl">
            Curated list of active points programs with mechanics, timing, and direct checker links. Paste your wallet below to open each program&apos;s &ldquo;check me&rdquo; page pre-filled where supported.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span className="w-1 h-1 rounded-full bg-amber-500" />
            <span>Registry last verified {REGISTRY_VERIFIED}</span>
            <span className="text-neutral-700">·</span>
            <span>always confirm status on each program&apos;s official page before committing capital</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Programs</div>
            <div className="font-mono font-bold text-lg text-white tabular-nums">{PROGRAMS.length}</div>
          </div>
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-green-400/80 mb-1 font-semibold">Live</div>
            <div className="font-mono font-bold text-lg text-green-400 tabular-nums">{live}</div>
          </div>
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-yellow-400/80 mb-1 font-semibold">Upcoming</div>
            <div className="font-mono font-bold text-lg text-yellow-400 tabular-nums">{upcoming}</div>
          </div>
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Claimed</div>
            <div className="font-mono font-bold text-lg text-neutral-400 tabular-nums">{ended}</div>
          </div>
        </div>

        {/* Wallet lookup */}
        <form onSubmit={handleLookup} className="card-premium p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5 text-hub-yellow" />
            <span className="text-xs font-semibold text-white">Wallet lookup</span>
            <span className="text-[10px] text-neutral-500">— populates checker links + opens cross-platform view</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600 pointer-events-none" />
              <input
                type="text"
                value={wallet}
                onChange={e => setWallet(e.target.value)}
                placeholder="0x… paste wallet address"
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/40 font-mono"
                aria-label="Wallet address"
              />
            </div>
            <button
              type="submit"
              disabled={!/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-hub-yellow/15 text-hub-yellow hover:bg-hub-yellow/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              Open cross-platform view
            </button>
          </div>
        </form>

        {/* Filter rows */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          {/* Status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', 'live', 'upcoming', 'ended'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase transition-colors ${
                  filter === s ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-neutral-600 mr-1">type:</span>
            {(['all', 'Perp DEX', 'L2', 'DeFi'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  categoryFilter === c ? 'bg-white/[0.08] text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                {c === 'all' ? 'All' : c} <span className="text-neutral-600 font-mono">{catCounts[c]}</span>
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-600">sort:</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-white/[0.12]"
              aria-label="Sort programs"
            >
              <option value="default">Curated order</option>
              <option value="freshness">Recently verified first</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Cards grid */}
        {filtered.length === 0 ? (
          <div className="card-premium p-8 text-center">
            <div className="text-neutral-400 text-sm mb-2">No programs match these filters</div>
            <button
              type="button"
              onClick={() => { setFilter('all'); setCategoryFilter('all'); }}
              className="text-xs text-hub-yellow hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(p => <ProgramCard key={p.id} p={p} walletAddr={wallet.trim()} />)}
          </div>
        )}

        {/* Footer disclaimer */}
        <div className="mt-6 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">Honest disclaimer:</strong> Most points programs don't expose public leaderboard APIs — their data is behind wallet-signed auth or private. This page is a <strong>navigation hub</strong>, not a live aggregator. &ldquo;Check me&rdquo; buttons open each program's own portfolio page so you can verify points directly. Hyperliquid has a full public leaderboard and deep-links to its volume/PnL data via InfoHub's cross-platform view.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
