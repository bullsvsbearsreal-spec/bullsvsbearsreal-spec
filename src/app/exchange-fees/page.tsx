'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { DollarSign, Info, ExternalLink, Crown, CheckCircle2 } from 'lucide-react';

/**
 * Static fee table across the major CEXes we track.
 * Rates are "regular" tier for a typical retail account.
 * VIP / volume discounts noted separately.
 * Updated periodically by hand — if something's off, ping @info_hub69.
 */
interface ExchangeFee {
  name: string;
  kind: 'CEX' | 'DEX';
  spot: { maker: number; taker: number };
  perp: { maker: number; taker: number };
  withdrawalBtc?: string;      // flat fee label like "0.00005 BTC" or "~$1"
  withdrawalUsdt?: string;     // usually network-dependent
  notes?: string;
  affiliate?: { url: string; rebate: string }; // optional affiliate program summary
  color: string;
  logoHint?: string;           // optional logo URL pattern
}

const FEES: ExchangeFee[] = [
  // CEX tier 1
  { name: 'Binance',  kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '~$1.20',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://binance.com', rebate: 'up to 50%' }, color: '#f0b90b' },
  { name: 'Bybit',    kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.055 }, withdrawalBtc: '0.00005 BTC', withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://bybit.com', rebate: 'up to 50%' }, color: '#f7a600' },
  { name: 'OKX',      kind: 'CEX', spot: { maker: 0.080, taker: 0.100 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '0.0004 BTC',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://okx.com', rebate: 'up to 50%' }, color: '#ffffff' },
  { name: 'Bitget',   kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.060 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://bitget.com', rebate: 'up to 50%' }, color: '#54ffc1' },
  { name: 'MEXC',     kind: 'CEX', spot: { maker: 0.000, taker: 0.050 }, perp: { maker: 0.000, taker: 0.020 }, withdrawalBtc: '0.0004 BTC',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://mexc.com', rebate: 'up to 60%' }, notes: '0% maker fees on spot — lowest among tier-1 CEX', color: '#0c77e4' },
  { name: 'Kraken',   kind: 'CEX', spot: { maker: 0.250, taker: 0.400 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '0.00015 BTC', withdrawalUsdt: 'ERC20 $5', color: '#5741d9' },
  { name: 'BingX',    kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', affiliate: { url: 'https://bingx.com', rebate: 'up to 70%' }, notes: 'Highest affiliate commission in the industry', color: '#2354e6' },
  { name: 'KuCoin',   kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.060 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', color: '#24ae8f' },
  { name: 'Phemex',   kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.010, taker: 0.060 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', color: '#ff4d19' },
  { name: 'Bitunix',  kind: 'CEX', spot: { maker: 0.100, taker: 0.100 }, perp: { maker: 0.020, taker: 0.060 }, color: '#22d3ee' },
  { name: 'HTX',      kind: 'CEX', spot: { maker: 0.200, taker: 0.200 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: '0.0005 BTC',  withdrawalUsdt: 'TRC20 $1', color: '#1d3fcf' },
  { name: 'Gate.io',  kind: 'CEX', spot: { maker: 0.200, taker: 0.200 }, perp: { maker: 0.015, taker: 0.050 }, withdrawalBtc: '~$1.50',   withdrawalUsdt: 'TRC20 $1', color: '#2354e6' },
  { name: 'Coinbase', kind: 'CEX', spot: { maker: 0.400, taker: 0.600 }, perp: { maker: 0.020, taker: 0.050 }, withdrawalBtc: 'Network fee only', withdrawalUsdt: 'Network fee only', notes: 'High retail spot fees. Coinbase Advanced Trade is cheaper.', color: '#0052ff' },
  { name: 'Deribit',  kind: 'CEX', spot: { maker: 0.000, taker: 0.000 }, perp: { maker: -0.005, taker: 0.050 }, notes: 'Options focus. Rebate on maker futures. No spot.', color: '#22c55e' },

  // DEX
  { name: 'Hyperliquid', kind: 'DEX', spot: { maker: 0.000, taker: 0.000 }, perp: { maker: -0.002, taker: 0.035 }, notes: 'Maker rebate, spot launching. No gas.', color: '#50d2c1' },
  { name: 'dYdX',        kind: 'DEX', spot: { maker: 0.000, taker: 0.000 }, perp: { maker: 0.020, taker: 0.050 }, notes: 'dYdX v4 on Cosmos.', color: '#6966ff' },
  { name: 'GMX',         kind: 'DEX', spot: { maker: 0.000, taker: 0.000 }, perp: { maker: 0.050, taker: 0.070 }, notes: 'GLP-backed. Borrow fees on top of open/close.', color: '#3fcfcf' },
  { name: 'Aster',       kind: 'DEX', spot: { maker: 0.000, taker: 0.000 }, perp: { maker: 0.000, taker: 0.035 }, notes: '0% maker, points earning on trades.', color: '#bf00ff' },
  { name: 'Lighter',     kind: 'DEX', spot: { maker: 0.000, taker: 0.000 }, perp: { maker: 0.000, taker: 0.000 }, notes: 'RWA pairs 0 fees. Perps fees set tier-by-tier.', color: '#a855f7' },
];

type Sort = 'perpTaker' | 'spotTaker' | 'affiliate' | 'name';
type KindFilter = 'all' | 'CEX' | 'DEX';

function fmtFee(n: number): string {
  if (n === 0) return '0%';
  if (n < 0) return `${n.toFixed(3)}% rebate`;
  return `${n.toFixed(3)}%`;
}

export default function ExchangeFeesPage() {
  const [sort, setSort] = useState<Sort>('perpTaker');
  const [kind, setKind] = useState<KindFilter>('all');

  const sorted = useMemo(() => {
    let rows = FEES;
    if (kind !== 'all') rows = rows.filter(r => r.kind === kind);
    const list = [...rows];
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'spotTaker') list.sort((a, b) => a.spot.taker - b.spot.taker);
    else if (sort === 'affiliate') list.sort((a, b) => {
      const aHas = a.affiliate ? 1 : 0;
      const bHas = b.affiliate ? 1 : 0;
      return bHas - aHas;
    });
    else list.sort((a, b) => a.perp.taker - b.perp.taker);
    return list;
  }, [sort, kind]);

  // Cheapest in each category
  const cheapestPerpTaker = FEES.slice().sort((a, b) => a.perp.taker - b.perp.taker)[0];
  const cheapestSpotTaker = FEES.slice().sort((a, b) => a.spot.taker - b.spot.taker)[0];
  const bestMakerRebate = FEES.slice().sort((a, b) => a.perp.maker - b.perp.maker)[0];
  const highestAffiliate = FEES.filter(f => f.affiliate).slice().sort((a, b) => {
    const pctA = parseInt(a.affiliate?.rebate.match(/\d+/)?.[0] || '0', 10);
    const pctB = parseInt(b.affiliate?.rebate.match(/\d+/)?.[0] || '0', 10);
    return pctB - pctA;
  })[0];

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Exchange Fee Comparison</h1>
          </div>
          <p className="text-sm text-neutral-500">
            Spot + perp maker/taker fees across 20 exchanges. VIP tiers and volume discounts not shown — these are the retail entry rates. Updated Apr 2026.
          </p>
        </div>

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
              {cheapestSpotTaker.name}
            </div>
            <div className="text-[10px] text-green-400 mt-0.5 font-mono">{fmtFee(cheapestSpotTaker.spot.taker)}</div>
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

          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit">
            {([
              ['perpTaker', 'Perp taker ↑'],
              ['spotTaker', 'Spot taker ↑'],
              ['affiliate', 'Affiliate first'],
              ['name', 'A-Z'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                  sort === k ? 'bg-green-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[140px,60px,130px,130px,130px,130px,100px,50px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>Exchange</div>
            <div>Type</div>
            <div className="text-right">Spot maker</div>
            <div className="text-right">Spot taker</div>
            <div className="text-right">Perp maker</div>
            <div className="text-right">Perp taker</div>
            <div className="text-right">Affiliate</div>
            <div className="text-right"></div>
          </div>

          {sorted.map(r => (
            <div
              key={r.name}
              className="md:grid md:grid-cols-[140px,60px,130px,130px,130px,130px,100px,50px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} aria-hidden />
                <div className="min-w-0">
                  <div className="text-sm text-white font-semibold truncate">{r.name}</div>
                  {r.notes && (
                    <div className="text-[10px] text-neutral-600 truncate">{r.notes}</div>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-neutral-500 font-mono uppercase">{r.kind}</div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                {fmtFee(r.spot.maker)}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                {fmtFee(r.spot.taker)}
              </div>
              <div className={`text-right font-mono text-xs tabular-nums ${r.perp.maker < 0 ? 'text-green-400 font-semibold' : 'text-neutral-300'}`}>
                {fmtFee(r.perp.maker)}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-white font-semibold">
                {fmtFee(r.perp.taker)}
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
            Fees shown are <strong className="text-neutral-300">regular-tier retail rates</strong>. Most exchanges have VIP tiers based on 30-day volume or staked native-token balance that can cut maker/taker in half or better.
            Perp fees shown are for USDT/USDC-margined contracts. Inverse (coin-margined) usually differs.
            Affiliate rebate is the max % of generated fees you earn when referring users — exact percentage depends on your volume tier with the exchange.
            Verified manually; if you spot something stale, ping{' '}
            <a href="https://x.com/info_hub69" target="_blank" rel="noopener noreferrer" className="text-hub-yellow hover:underline">@info_hub69</a>.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
