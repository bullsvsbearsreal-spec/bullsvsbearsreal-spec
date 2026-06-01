'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import {
  DollarSign, Info, ExternalLink, Crown, Sparkles,
  TrendingDown, Calculator, Search,
} from 'lucide-react';

/**
 * Static fee table across the major CEXes + DEXes we track.
 * Rates are "regular" tier for a typical retail account (no VIP bonuses,
 * no native-token discounts, no kickback subscriptions).
 *
 * Updated periodically by hand. If something is off, ping @info_hub69.
 */
interface ExchangeFee {
  name: string;
  kind: 'CEX' | 'DEX';
  spot: { maker: number; taker: number } | null;  // null = no spot market
  perp: { maker: number; taker: number };
  withdrawalBtc?: string;
  withdrawalUsdt?: string;
  notes?: string;
  affiliate?: { url: string; rebate: string };
  vipFloor?: { maker: number; taker: number };    // best-case VIP rates if known
  color: string;
}

const FEES: ExchangeFee[] = [
  // ─── CEX tier 1 ──────────────────────────────────────────────
  { name: 'Binance',  kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '~$1.20',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://binance.com', rebate: 'up to 50%' }, vipFloor: { maker: 0.000, taker: 0.017 }, color: '#f0b90b' },
  { name: 'Bybit',    kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.055 }, withdrawalBtc: '0.00005 BTC', withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://bybit.com', rebate: 'up to 50%' }, vipFloor: { maker: 0.000, taker: 0.020 }, color: '#f7a600' },
  { name: 'OKX',      kind: 'CEX', spot: { maker: 0.080, taker: 0.100 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '0.0004 BTC',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://okx.com', rebate: 'up to 50%' }, vipFloor: { maker: -0.005, taker: 0.015 }, color: '#ffffff' },
  { name: 'Bitget',   kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.060 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://bitget.com', rebate: 'up to 50%' }, vipFloor: { maker: 0.000, taker: 0.017 }, color: '#54ffc1' },
  { name: 'MEXC',     kind: 'CEX', spot: { maker: 0.000, taker: 0.050 }, perp: { maker: 0.000, taker: 0.020 }, withdrawalBtc: '0.0004 BTC',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://mexc.com', rebate: 'up to 60%' }, notes: '0% maker on spot — best in tier-1 CEX', color: '#0c77e4' },
  { name: 'Kraken',   kind: 'CEX', spot: { maker: 0.250, taker: 0.400 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '0.00015 BTC', withdrawalUsdt: 'ERC20 $5', vipFloor: { maker: 0.000, taker: 0.080 }, color: '#5741d9' },
  { name: 'BingX',    kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://bingx.com', rebate: 'up to 70%' }, notes: 'Top affiliate cut in the industry', color: '#2354e6' },
  { name: 'KuCoin',   kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.060 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', color: '#24ae8f' },
  { name: 'Phemex',   kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.010, taker: 0.060 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', color: '#ff4d19' },
  { name: 'Bitunix',  kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.060 }, color: '#22d3ee' },
  { name: 'HTX',      kind: 'CEX', spot: { maker: 0.200, taker: 0.200 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', color: '#1d3fcf' },
  { name: 'Gate.io',  kind: 'CEX', spot: { maker: 0.200, taker: 0.200 }, perp: { maker: 0.015, taker: 0.050 }, withdrawalBtc: '~$1.50',   withdrawalUsdt: 'TRC20 $1', color: '#2354e6' },
  { name: 'Coinbase', kind: 'CEX', spot: { maker: 0.400, taker: 0.600 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: 'Network fee only', withdrawalUsdt: 'Network fee only', notes: 'Coinbase Advanced Trade is much cheaper than the retail app.', color: '#0052ff' },
  { name: 'Deribit',  kind: 'CEX', spot: null, perp: { maker: -0.005, taker: 0.050 }, notes: 'Options-first. Maker rebate. No spot market.', color: '#22c55e' },
  { name: 'BitMEX',   kind: 'CEX', spot: { maker: 0.200, taker: 0.200 }, perp: { maker: -0.010, taker: 0.075 }, withdrawalBtc: '0.0001 BTC', notes: 'Pioneered crypto perps. Maker rebate.', color: '#1f2937' },
  { name: 'Bitfinex', kind: 'CEX', spot: { maker: 0.100, taker: 0.200 }, perp: { maker: 0.020, taker: 0.060 }, withdrawalBtc: '~$1', color: '#16b157' },
  { name: 'CoinEx',   kind: 'CEX', spot: { maker: 0.200, taker: 0.200 }, perp: { maker: 0.020, taker: 0.060 }, color: '#5cd6b5' },
  { name: 'WhiteBIT', kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.010, taker: 0.035 }, withdrawalBtc: '0.0006 BTC', notes: 'Aggressive perp taker pricing.', color: '#d1d5db' },

  // ─── DEX ─────────────────────────────────────────────────────
  { name: 'Hyperliquid', kind: 'DEX', spot: { maker: 0.000, taker: 0.000 }, perp: { maker: -0.002, taker: 0.035 }, notes: 'Maker rebate, native gas-free. HL Spot uses 0% taker.', color: '#50d2c1' },
  { name: 'dYdX',        kind: 'DEX', spot: null, perp: { maker: 0.020, taker: 0.050 }, notes: 'dYdX v4 on Cosmos. Validator-run orderbook.', color: '#6966ff' },
  { name: 'GMX',         kind: 'DEX', spot: null, perp: { maker: 0.050, taker: 0.070 }, notes: 'GLP-backed. Borrow + price-impact fees on top.', color: '#3fcfcf' },
  { name: 'Aster',       kind: 'DEX', spot: null, perp: { maker: 0.000, taker: 0.035 }, notes: '0% maker, points farm running.', color: '#bf00ff' },
  { name: 'Lighter',     kind: 'DEX', spot: null, perp: { maker: 0.000, taker: 0.000 }, notes: 'zk-rollup, fully gasless, points incentivized.', color: '#a855f7' },
  { name: 'Aevo',        kind: 'DEX', spot: null, perp: { maker: 0.020, taker: 0.050 }, notes: 'Options + perps on its own L2.', color: '#fb7185' },
  { name: 'Paradex',     kind: 'DEX', spot: null, perp: { maker: 0.005, taker: 0.030 }, notes: 'Starknet appchain. Tight perp fees.', color: '#7c3aed' },
  { name: 'Backpack',    kind: 'DEX', spot: { maker: 0.080, taker: 0.100 }, perp: { maker: 0.020, taker: 0.050 }, notes: 'Solana-native. Spot + perps.', color: '#ef4444' },
  { name: 'edgeX',       kind: 'DEX', spot: null, perp: { maker: 0.010, taker: 0.040 }, color: '#38bdf8' },
  { name: 'Orderly',     kind: 'DEX', spot: null, perp: { maker: 0.020, taker: 0.060 }, notes: 'Shared liquidity layer for partner DEXes.', color: '#a78bfa' },
  { name: 'gTrade',      kind: 'DEX', spot: null, perp: { maker: 0.080, taker: 0.080 }, notes: 'Synthetic perps. Spread fee depends on volatility tier.', color: '#14b8a6' },
];

type Sort = 'perpTaker' | 'spotTaker' | 'perpMaker' | 'affiliate' | 'name';
type KindFilter = 'all' | 'CEX' | 'DEX';

function fmtFee(n: number): string {
  if (n === 0) return '0%';
  if (n < 0) return `${n.toFixed(3)}% rebate`;
  return `${n.toFixed(3)}%`;
}

function feeAmount(rate: number, notional: number): number {
  return (rate / 100) * notional;
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(3)}`;
}

export default function ExchangeFeesPage() {
  const [sort, setSort] = useState<Sort>('perpTaker');
  const [kind, setKind] = useState<KindFilter>('all');
  const [query, setQuery] = useState('');
  // Cost calculator state
  const [calcSize, setCalcSize] = useState<number>(10_000);
  const [calcTakerShare, setCalcTakerShare] = useState<number>(50);

  const filtered = useMemo(() => {
    let rows = FEES;
    if (kind !== 'all') rows = rows.filter(r => r.kind === kind);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }
    const list = [...rows];
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'spotTaker') list.sort((a, b) => (a.spot?.taker ?? 999) - (b.spot?.taker ?? 999));
    else if (sort === 'perpMaker') list.sort((a, b) => a.perp.maker - b.perp.maker);
    else if (sort === 'affiliate') list.sort((a, b) => {
      const aHas = a.affiliate ? 1 : 0;
      const bHas = b.affiliate ? 1 : 0;
      return bHas - aHas;
    });
    else list.sort((a, b) => a.perp.taker - b.perp.taker);
    return list;
  }, [sort, kind, query]);

  // Cheapest in each category (across full FEES list, not filtered)
  const cheapestPerpTaker = FEES.slice().sort((a, b) => a.perp.taker - b.perp.taker)[0];
  const withSpot = FEES.filter(f => f.spot != null);
  const cheapestSpotTaker = withSpot.slice().sort((a, b) => a.spot!.taker - b.spot!.taker)[0];
  const bestMakerRebate = FEES.slice().sort((a, b) => a.perp.maker - b.perp.maker)[0];
  const highestAffiliate = FEES.filter(f => f.affiliate).slice().sort((a, b) => {
    const pctA = parseInt(a.affiliate?.rebate.match(/\d+/)?.[0] || '0', 10);
    const pctB = parseInt(b.affiliate?.rebate.match(/\d+/)?.[0] || '0', 10);
    return pctB - pctA;
  })[0];

  // Calculator: assume calcSize round-trip per month, calcTakerShare% taker fills,
  // remainder maker. Show cheapest vs typical (median taker fee).
  const calc = useMemo(() => {
    const list = kind === 'all' ? FEES : FEES.filter(f => f.kind === kind);
    if (list.length === 0) return null;
    const takerShare = calcTakerShare / 100;
    const makerShare = 1 - takerShare;
    // Round-trip = open + close = 2x size
    const notional = calcSize * 2;
    const ranked = list.map(f => {
      const cost = feeAmount(f.perp.maker, notional * makerShare) + feeAmount(f.perp.taker, notional * takerShare);
      return { name: f.name, color: f.color, cost };
    }).sort((a, b) => a.cost - b.cost);
    const cheapest = ranked[0];
    const median = ranked[Math.floor(ranked.length / 2)];
    const worst = ranked[ranked.length - 1];
    return { cheapest, median, worst, all: ranked };
  }, [calcSize, calcTakerShare, kind]);

  const monthlyVolume = useMemo(() => calcSize * 2 * 30, [calcSize]); // assume 1 round-trip/day

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={DollarSign}
          eyebrow="Fees · maker/taker schedule"
          eyebrowExtra={
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {FEES.length} venues · curated
            </span>
          }
          title="Exchange"
          accentNoun="fees"
          accent="emerald"
          description={
            <>Spot + perp maker/taker fees across the{' '}
              <span className="text-white font-medium">{FEES.length} biggest</span> CEX and DEX venues.
              Retail entry tier shown by default. VIP / volume floors shown where known
              (hover any row). Updated periodically by hand.
            </>
          }
          className="mb-4"
        />

        {/* Winner highlights */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-400" /> Cheapest perp taker
            </div>
            <div className="font-mono tabular-nums text-sm font-semibold text-white">
              {cheapestPerpTaker.name}
            </div>
            <div className="text-[10px] text-green-400 mt-0.5 font-mono">{fmtFee(cheapestPerpTaker.perp.taker)}</div>
          </div>
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-400" /> Cheapest spot taker
            </div>
            <div className="font-mono tabular-nums text-sm font-semibold text-white">
              {cheapestSpotTaker?.name ?? '—'}
            </div>
            <div className="text-[10px] text-green-400 mt-0.5 font-mono">{cheapestSpotTaker ? fmtFee(cheapestSpotTaker.spot!.taker) : '—'}</div>
          </div>
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-400" /> Best maker rebate
            </div>
            <div className="font-mono tabular-nums text-sm font-semibold text-white">
              {bestMakerRebate.name}
            </div>
            <div className="text-[10px] text-green-400 mt-0.5 font-mono">{fmtFee(bestMakerRebate.perp.maker)}</div>
          </div>
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-400" /> Top affiliate cut
            </div>
            <div className="font-mono tabular-nums text-sm font-semibold text-white">
              {highestAffiliate?.name || '—'}
            </div>
            <div className="text-[10px] text-hub-yellow mt-0.5 font-mono">{highestAffiliate?.affiliate?.rebate || '—'}</div>
          </div>
        </div>

        {/* ── Cost calculator ─────────────────────────────────────── */}
        <div className="card-premium p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-hub-yellow" />
            <h2 className="text-sm font-bold text-white">Cost calculator</h2>
            <span className="text-[10px] text-neutral-500 font-mono">round-trip · per {fmtUsd(calcSize * 2)} traded</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">
                Position size · {fmtUsd(calcSize)}
              </label>
              <input
                type="range"
                min={100}
                max={1_000_000}
                step={100}
                value={calcSize}
                onChange={(e) => setCalcSize(Number(e.target.value))}
                className="w-full accent-hub-yellow"
                aria-label="Position size in USD"
              />
              <div className="flex justify-between text-[10px] text-neutral-600 font-mono mt-1">
                <span>$100</span><span>$1k</span><span>$10k</span><span>$100k</span><span>$1M</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">
                Taker fill % · {calcTakerShare}% taker / {100 - calcTakerShare}% maker
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={calcTakerShare}
                onChange={(e) => setCalcTakerShare(Number(e.target.value))}
                className="w-full accent-hub-yellow"
                aria-label="Taker fill percentage"
              />
              <div className="flex justify-between text-[10px] text-neutral-600 font-mono mt-1">
                <span>all maker</span><span>50/50</span><span>all taker</span>
              </div>
            </div>
          </div>

          {calc && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium mb-1 inline-flex items-center justify-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Cheapest
                </div>
                <div className="font-mono tabular-nums text-base font-semibold text-white">
                  {fmtUsd(calc.cheapest.cost)}
                </div>
                <div className="text-[10px] text-emerald-300 mt-0.5">{calc.cheapest.name}</div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1">
                  Median venue
                </div>
                <div className="font-mono tabular-nums text-base font-semibold text-white">
                  {fmtUsd(calc.median.cost)}
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">{calc.median.name}</div>
              </div>
              <div className="bg-rose-500/[0.06] border border-rose-500/15 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-rose-400 font-medium mb-1">
                  Most expensive
                </div>
                <div className="font-mono tabular-nums text-base font-semibold text-white">
                  {fmtUsd(calc.worst.cost)}
                </div>
                <div className="text-[10px] text-rose-300 mt-0.5">{calc.worst.name}</div>
              </div>
            </div>
          )}

          {calc && calc.median.cost > calc.cheapest.cost && (
            <p className="text-[11px] text-neutral-500 mt-3 leading-relaxed inline-flex items-start gap-1.5">
              <Sparkles className="w-3 h-3 text-hub-yellow mt-0.5 flex-shrink-0" />
              Switching from a median-priced venue to the cheapest saves{' '}
              <span className="text-emerald-400 font-semibold font-mono">{fmtUsd(calc.median.cost - calc.cheapest.cost)}</span>{' '}
              per round-trip. At 1 RT/day that&apos;s{' '}
              <span className="text-emerald-400 font-semibold font-mono">{fmtUsd((calc.median.cost - calc.cheapest.cost) * 30)}</span>/month{' '}
              on {fmtUsd(monthlyVolume)} of monthly volume.
            </p>
          )}
        </div>

        {/* Filters + search */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit">
            {([
              ['all', 'All'],
              ['CEX', 'CEX'],
              ['DEX', 'DEX'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                  kind === k ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit overflow-x-auto">
            {([
              ['perpTaker', 'Perp taker ↑'],
              ['perpMaker', 'Perp maker ↑'],
              ['spotTaker', 'Spot taker ↑'],
              ['affiliate', 'Affiliate first'],
              ['name', 'A-Z'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                  sort === k ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="md:ml-auto relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              placeholder="Search venues…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/40 w-full md:w-48"
            />
          </div>
        </div>

        {/* Table */}
        <div className="card-premium p-3 min-h-[500px] overflow-x-auto">
          <div className="hidden md:grid md:grid-cols-[150px,55px,110px,110px,110px,110px,140px,90px,40px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>Exchange</div>
            <div>Type</div>
            <div className="text-right">Spot maker</div>
            <div className="text-right">Spot taker</div>
            <div className="text-right">Perp maker</div>
            <div className="text-right">Perp taker</div>
            <div className="text-right">Withdraw (BTC / USDT)</div>
            <div className="text-right">Affiliate</div>
            <div className="text-right"></div>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-neutral-500">
              No venues match the current filters.
            </div>
          )}

          {filtered.map(r => (
            <div
              key={r.name}
              className="md:grid md:grid-cols-[150px,55px,110px,110px,110px,110px,140px,90px,40px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
              title={r.vipFloor ? `VIP floor — maker ${fmtFee(r.vipFloor.maker)}, taker ${fmtFee(r.vipFloor.taker)}` : undefined}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} aria-hidden />
                <div className="min-w-0">
                  <div className="text-sm text-white font-semibold truncate flex items-center gap-1.5">
                    {r.name}
                    {r.vipFloor && (
                      <span className="text-[9px] text-neutral-600 font-mono uppercase border border-white/[0.06] rounded px-1 py-px">VIP</span>
                    )}
                  </div>
                  {r.notes && (
                    <div className="text-[10px] text-neutral-600 truncate">{r.notes}</div>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-neutral-500 font-mono uppercase">{r.kind}</div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                {r.spot ? fmtFee(r.spot.maker) : <span className="text-neutral-700">—</span>}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                {r.spot ? fmtFee(r.spot.taker) : <span className="text-neutral-700">—</span>}
              </div>
              <div className={`text-right font-mono text-xs tabular-nums ${r.perp.maker < 0 ? 'text-green-400 font-semibold' : 'text-neutral-300'}`}>
                {fmtFee(r.perp.maker)}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-white font-semibold">
                {fmtFee(r.perp.taker)}
              </div>
              <div className="text-right font-mono text-[10px] tabular-nums text-neutral-500">
                <div>{r.withdrawalBtc ?? <span className="text-neutral-700">—</span>}</div>
                <div className="text-neutral-600">{r.withdrawalUsdt ?? ''}</div>
              </div>
              <div className="text-right text-[10px] font-mono">
                {r.affiliate ? (
                  <span className="text-hub-yellow">{r.affiliate.rebate}</span>
                ) : (
                  <span className="text-neutral-600">—</span>
                )}
              </div>
              <div className="text-right">
                {r.affiliate ? (
                  <a
                    href={r.affiliate.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-end text-neutral-500 hover:text-hub-yellow transition-colors"
                    aria-label={`Open ${r.name} affiliate signup`}
                    title="Affiliate signup"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Fees shown are <strong className="text-neutral-300">regular-tier retail rates</strong>. Most CEXes have VIP tiers based on 30-day volume or staked native-token balance that can cut maker/taker in half or better. Hover a row to see VIP floor where known.
            Perp fees shown are for USDT/USDC-margined contracts. Inverse (coin-margined) usually differs.
            Affiliate rebate is the max % of generated fees you earn when referring users. Exact cut depends on your volume tier.
            Verified manually. If you spot something stale, ping{' '}
            <a href="https://x.com/info_hub69" target="_blank" rel="noopener noreferrer" className="text-hub-yellow hover:underline">@info_hub69</a>.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
