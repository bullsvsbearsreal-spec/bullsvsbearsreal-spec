'use client';

import { TokenIconSimple } from './TokenIcon';

/* ------------------------------------------------------------------ */
/*  Sample data for preview tables on empty personal pages             */
/* ------------------------------------------------------------------ */

export const SAMPLE_WATCHLIST = [
  { symbol: 'BTC', price: 66738, change24h: 0.54, avgFunding: 0.0042, totalOI: 14_200_000_000, volume: 28_400_000_000 },
  { symbol: 'ETH', price: 2057, change24h: 0.68, avgFunding: 0.0031, totalOI: 5_100_000_000, volume: 12_800_000_000 },
  { symbol: 'SOL', price: 148.2, change24h: -1.23, avgFunding: 0.0058, totalOI: 2_300_000_000, volume: 4_100_000_000 },
  { symbol: 'DOGE', price: 0.178, change24h: 2.41, avgFunding: 0.0125, totalOI: 680_000_000, volume: 1_600_000_000 },
  { symbol: 'XRP', price: 0.612, change24h: -0.31, avgFunding: -0.0012, totalOI: 720_000_000, volume: 2_100_000_000 },
];

export const SAMPLE_PORTFOLIO = [
  { symbol: 'BTC', qty: 0.5, entry: 62000, current: 66738, value: 33369, pnl: 2369, pnlPct: 7.63, allocation: 58.2 },
  { symbol: 'ETH', qty: 5, entry: 1900, current: 2057, value: 10285, pnl: 785, pnlPct: 8.26, allocation: 17.9 },
  { symbol: 'SOL', qty: 50, entry: 135, current: 148.2, value: 7410, pnl: 660, pnlPct: 9.78, allocation: 12.9 },
  { symbol: 'LINK', qty: 200, entry: 14.5, current: 16.2, value: 3240, pnl: 340, pnlPct: 11.72, allocation: 5.7 },
  { symbol: 'AVAX', qty: 100, entry: 28, current: 30.5, value: 3050, pnl: 250, pnlPct: 8.93, allocation: 5.3 },
];

export const SAMPLE_ALERTS = [
  { symbol: 'BTC', metric: 'Price', condition: 'drops below', value: '$60,000', active: true },
  { symbol: 'ETH', metric: 'Price', condition: 'rises above', value: '$2,500', active: true },
  { symbol: 'SOL', metric: 'Funding Rate', condition: 'exceeds', value: '0.05%', active: false },
  { symbol: 'BTC', metric: 'OI Change 1h', condition: 'drops below', value: '-5%', active: true },
];

/* ------------------------------------------------------------------ */
/*  Preview wrapper — faded overlay + "Sample Data" label              */
/* ------------------------------------------------------------------ */

interface SamplePreviewProps {
  children: React.ReactNode;
  label?: string;
}

export default function SampleDataPreview({ children, label = 'Sample preview' }: SamplePreviewProps) {
  return (
    <div className="relative mt-6">
      <div className="absolute -top-3 left-4 z-10">
        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-hub-yellow/15 text-hub-yellow rounded-full">
          {label}
        </span>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-dashed border-white/[0.08]">
        <div className="pointer-events-none select-none opacity-40">
          {children}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-hub-black to-transparent" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable sample table for watchlist                                */
/* ------------------------------------------------------------------ */

function fmtCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function SampleWatchlistTable() {
  return (
    <SampleDataPreview label="What your watchlist looks like">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-neutral-500 uppercase">Symbol</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-neutral-500 uppercase">Price</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-neutral-500 uppercase">24h</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-neutral-500 uppercase hidden sm:table-cell">Funding</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-neutral-500 uppercase hidden md:table-cell">Open Interest</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-neutral-500 uppercase hidden md:table-cell">Volume 24h</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_WATCHLIST.map(row => (
            <tr key={row.symbol} className="border-b border-white/[0.03]">
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <TokenIconSimple symbol={row.symbol} size={20} />
                  <span className="text-white font-medium">{row.symbol}</span>
                </div>
              </td>
              <td className="px-4 py-2 text-right text-neutral-300 font-mono tabular-nums">
                ${row.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: row.price < 1 ? 4 : 2 })}
              </td>
              <td className="px-4 py-2 text-right">
                <span className={`delta-badge text-[11px] ${row.change24h >= 0 ? 'delta-badge-up pip-up' : 'delta-badge-down pip-down'}`}>
                  {row.change24h >= 0 ? '+' : ''}{row.change24h.toFixed(2)}%
                </span>
              </td>
              <td className="px-4 py-2 text-right hidden sm:table-cell">
                <span className={`font-mono text-xs ${row.avgFunding >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {row.avgFunding >= 0 ? '+' : ''}{row.avgFunding.toFixed(4)}%
                </span>
              </td>
              <td className="px-4 py-2 text-right text-neutral-400 font-mono text-xs hidden md:table-cell">{fmtCompact(row.totalOI)}</td>
              <td className="px-4 py-2 text-right text-neutral-400 font-mono text-xs hidden md:table-cell">{fmtCompact(row.volume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SampleDataPreview>
  );
}

/* ------------------------------------------------------------------ */
/*  Sample portfolio table                                             */
/* ------------------------------------------------------------------ */

export function SamplePortfolioTable() {
  const totalValue = SAMPLE_PORTFOLIO.reduce((s, r) => s + r.value, 0);
  const totalPnl = SAMPLE_PORTFOLIO.reduce((s, r) => s + r.pnl, 0);

  return (
    <SampleDataPreview label="What your portfolio looks like">
      <div className="p-4">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/[0.02] rounded-lg p-3">
            <p className="text-neutral-500 text-xs">Total Value</p>
            <p className="text-lg font-bold text-white font-mono">${totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3">
            <p className="text-neutral-500 text-xs">Total P&L</p>
            <p className="text-lg font-bold text-green-400 font-mono pip-up">+${totalPnl.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3">
            <p className="text-neutral-500 text-xs">Assets</p>
            <p className="text-lg font-bold text-white font-mono">{SAMPLE_PORTFOLIO.length}</p>
          </div>
        </div>
        {/* Holdings table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase">Asset</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase">Qty</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase">Value</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase">P&L</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase hidden sm:table-cell">Alloc</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_PORTFOLIO.map(row => (
              <tr key={row.symbol} className="border-b border-white/[0.03]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <TokenIconSimple symbol={row.symbol} size={20} />
                    <span className="text-white font-medium">{row.symbol}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-neutral-300 font-mono tabular-nums">{row.qty}</td>
                <td className="px-3 py-2 text-right text-white font-mono tabular-nums">${row.value.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`font-mono text-xs ${row.pnl >= 0 ? 'text-green-400 pip-up' : 'text-red-400 pip-down'}`}>
                    {row.pnl >= 0 ? '+' : ''}${row.pnl.toLocaleString()} ({row.pnlPct.toFixed(1)}%)
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-neutral-400 text-xs hidden sm:table-cell">{row.allocation.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SampleDataPreview>
  );
}

/* ------------------------------------------------------------------ */
/*  Sample alerts list                                                 */
/* ------------------------------------------------------------------ */

export function SampleAlertsList() {
  return (
    <SampleDataPreview label="What your alerts look like">
      <div className="space-y-2 p-4">
        {SAMPLE_ALERTS.map((alert, i) => (
          <div key={i} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3">
            <TokenIconSimple symbol={alert.symbol} size={24} />
            <div className="flex-1">
              <span className="text-white font-medium text-sm">{alert.symbol}</span>
              <span className="text-neutral-500 text-xs ml-2">{alert.metric} {alert.condition} {alert.value}</span>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              alert.active ? 'bg-green-500/15 text-green-400' : 'bg-neutral-500/15 text-neutral-500'
            }`}>
              {alert.active ? 'Active' : 'Paused'}
            </span>
          </div>
        ))}
      </div>
    </SampleDataPreview>
  );
}
