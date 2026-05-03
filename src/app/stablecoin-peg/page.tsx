'use client';

import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Activity, AlertTriangle } from 'lucide-react';

interface StablecoinPegRow {
  id: string;
  symbol: string;
  name: string;
  issuer: string;
  backing: string;
  price: number;
  deviationBps: number;
  absDeviationBps: number;
  change24hPct: number;
  marketCap: number;
  severity: 'normal' | 'watch' | 'depeg';
}

interface PegResponse {
  data: StablecoinPegRow[];
  summary: {
    totalMarketCap: number;
    trackedCount: number;
    depegCount: number;
    watchCount: number;
    maxDeviationBps: number;
    maxDeviationSymbol: string | null;
  };
  meta: { timestamp: number };
}

function fmtBps(bps: number): string {
  const sign = bps >= 0 ? '+' : '';
  return `${sign}${bps.toFixed(1)} bps`;
}
function fmtPrice(n: number): string {
  return `$${n.toFixed(4)}`;
}
function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(3)}%`;
}

export default function StablecoinPegPage() {
  const { data, isLoading, isRefreshing, error, refresh } = useApi<PegResponse>({
    key: 'stablecoin-peg',
    fetcher: async () => {
      const res = await fetch('/api/stablecoin-peg', { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 30_000,
  });

  const worstOff = data?.data?.[0];

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Stablecoin Peg Monitor</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={1} lastUpdated={data?.meta?.timestamp ?? null} sources={['CoinGecko']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Real-time peg deviation tracker for major USD stablecoins. Watch threshold 25bp · depeg threshold 100bp. 1bp = 0.01%.
          </p>
        </div>

        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
            aria-label="Stablecoin peg monitor summary"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total Market Cap</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={data.summary.totalMarketCap} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Tracked</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">{data.summary.trackedCount}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-green-400/80 mb-1 font-medium">At Peg</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-green-400">
                {data.summary.trackedCount - data.summary.depegCount - data.summary.watchCount}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-yellow-400/80 mb-1 font-medium">Watch</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-yellow-400">{data.summary.watchCount}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-red-400/80 mb-1 font-medium">Depeg Risk</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-red-400">{data.summary.depegCount}</div>
            </div>
          </div>
        )}

        {worstOff && worstOff.severity !== 'normal' && (
          <div className={`card-premium p-4 mb-4 flex items-start gap-3 ${
            worstOff.severity === 'depeg' ? 'border border-red-400/30 bg-red-500/[0.04]' : 'border border-yellow-400/30 bg-yellow-500/[0.04]'
          }`}>
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${worstOff.severity === 'depeg' ? 'text-red-400' : 'text-yellow-400'}`} />
            <div className="flex-1 text-[13px]">
              <div className={`font-semibold mb-1 ${worstOff.severity === 'depeg' ? 'text-red-300' : 'text-yellow-300'}`}>
                {worstOff.symbol} at {fmtPrice(worstOff.price)} — {fmtBps(worstOff.deviationBps)} from peg
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {worstOff.severity === 'depeg' ? (
                  <>Significant deviation. Historical depegs often snap back quickly but can cascade in stressed markets. Check the issuer&apos;s official communications before trading around it.</>
                ) : (
                  <>Minor deviation — worth monitoring but not unusual for this stablecoin class.</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Main table */}
        <div className="card-premium p-3 min-h-[400px]">
          <div className="hidden md:grid md:grid-cols-[120px,1fr,80px,100px,100px,100px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>Symbol</div>
            <div>Issuer</div>
            <div className="text-right">Backing</div>
            <div className="text-right">Price</div>
            <div className="text-right">Deviation</div>
            <div className="text-right">Market Cap</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="h-14 bg-white/[0.03] rounded animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {data?.data?.map(r => {
            const sevCls = r.severity === 'depeg' ? 'bg-red-500/[0.06] border-l-2 border-red-400'
              : r.severity === 'watch' ? 'bg-yellow-500/[0.04] border-l-2 border-yellow-400'
              : '';
            const devColor = r.absDeviationBps >= 100 ? 'text-red-400'
              : r.absDeviationBps >= 25 ? 'text-yellow-400'
              : r.absDeviationBps >= 5 ? 'text-neutral-300' : 'text-green-400';
            return (
              <div
                key={r.id}
                className={`md:grid md:grid-cols-[120px,1fr,80px,100px,100px,100px] gap-3 px-3 py-2 items-center rounded transition-colors hover:bg-white/[0.02] ${sevCls}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-white font-semibold">{r.symbol}</span>
                  {r.severity === 'depeg' && (
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-red-400/15 text-red-400">
                      depeg
                    </span>
                  )}
                  {r.severity === 'watch' && (
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-yellow-400/15 text-yellow-400">
                      watch
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-400 truncate">{r.name} · <span className="text-neutral-600">{r.issuer}</span></div>
                <div className="text-right text-[10px] text-neutral-500 uppercase tracking-wider">{r.backing}</div>
                <div className="text-right font-mono tabular-nums text-sm text-white">{fmtPrice(r.price)}</div>
                <div className={`text-right font-mono tabular-nums text-sm font-semibold ${devColor}`}>
                  {fmtBps(r.deviationBps)}
                  <div className="text-[10px] text-neutral-600 font-mono tabular-nums">
                    24h {fmtPct(r.change24hPct)}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums text-xs text-neutral-300">
                  <UsdDisplay amount={r.marketCap} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-[10px] text-neutral-600 flex items-center gap-2">
          <Activity className="w-3 h-3" />
          Prices from CoinGecko · refresh every 30s. A ±5bp deviation is normal noise; watch ≥25bp for signs of stress; ≥100bp (1%) is a genuine depeg.
        </div>
      </main>
      <Footer />
    </div>
  );
}
