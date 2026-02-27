'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

interface ExchangeHealth {
  name: string;
  status: 'ok' | 'error' | 'empty';
  count: number;
  latencyMs: number;
  error?: string;
}

interface RouteHealth {
  health: ExchangeHealth[];
  cache: string;
  meta: { totalExchanges: number; activeExchanges: number; totalEntries: number; timestamp: number };
}

interface Props {
  exchangeHealth: {
    status: string;
    routes: Record<string, RouteHealth>;
    errors: Array<{ exchange: string; route: string; error: string; latencyMs: number }>;
  };
  staleExchanges: Array<{ name: string; route: string; ageMinutes: number }>;
}

interface ExchangeRow {
  name: string;
  funding: ExchangeHealth | null;
  oi: ExchangeHealth | null;
  tickers: ExchangeHealth | null;
}

type SortKey = 'name' | 'funding' | 'oi' | 'tickers' | 'latency';

function StatusDot({ h }: { h: ExchangeHealth | null }) {
  if (!h) return <span className="text-neutral-600 text-center block">--</span>;
  const color = h.status === 'ok' ? 'text-green-400' : h.status === 'error' ? 'text-red-400' : 'text-yellow-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${h.status === 'ok' ? 'bg-green-400' : h.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'}`} />
      <span className={`font-medium text-[11px] ${color}`}>{h.status.toUpperCase()}</span>
      {h.status === 'ok' && <span className="text-neutral-600 text-[10px]">{h.count}</span>}
    </div>
  );
}

function LatencyBar({ ms }: { ms: number }) {
  if (!ms) return <span className="text-neutral-600">--</span>;
  const pct = Math.min(100, (ms / 10000) * 100);
  const color = ms < 2000 ? 'bg-green-400' : ms < 5000 ? 'bg-yellow-400' : 'bg-red-400';
  const textColor = ms < 2000 ? 'text-green-400' : ms < 5000 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] tabular-nums ${textColor}`}>{(ms / 1000).toFixed(1)}s</span>
    </div>
  );
}

export default function ExchangeStatusBoard({ exchangeHealth, staleExchanges }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  if (!exchangeHealth) {
    return <p className="text-xs text-neutral-600 py-4 text-center">No exchange health data available.</p>;
  }

  const exchangeMap = new Map<string, ExchangeRow>();
  for (const h of exchangeHealth.routes?.funding?.health || []) {
    if (!exchangeMap.has(h.name)) exchangeMap.set(h.name, { name: h.name, funding: null, oi: null, tickers: null });
    exchangeMap.get(h.name)!.funding = h;
  }
  for (const h of exchangeHealth.routes?.openinterest?.health || []) {
    if (!exchangeMap.has(h.name)) exchangeMap.set(h.name, { name: h.name, funding: null, oi: null, tickers: null });
    exchangeMap.get(h.name)!.oi = h;
  }
  for (const h of exchangeHealth.routes?.tickers?.health || []) {
    if (!exchangeMap.has(h.name)) exchangeMap.set(h.name, { name: h.name, funding: null, oi: null, tickers: null });
    exchangeMap.get(h.name)!.tickers = h;
  }

  let rows = Array.from(exchangeMap.values());
  if (filter) {
    const f = filter.toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(f));
  }

  const getAvg = (r: ExchangeRow) => {
    const vals = [r.funding?.latencyMs, r.oi?.latencyMs, r.tickers?.latencyMs].filter(Boolean) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 99999;
  };

  rows.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'funding': cmp = (a.funding?.status || 'z').localeCompare(b.funding?.status || 'z'); break;
      case 'oi': cmp = (a.oi?.status || 'z').localeCompare(b.oi?.status || 'z'); break;
      case 'tickers': cmp = (a.tickers?.status || 'z').localeCompare(b.tickers?.status || 'z'); break;
      case 'latency': cmp = getAvg(a) - getAvg(b); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };
  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />) : null;

  const getErrors = (r: ExchangeRow) => {
    const errs: string[] = [];
    if (r.funding?.error) errs.push(`Funding: ${r.funding.error}`);
    if (r.oi?.error) errs.push(`OI: ${r.oi.error}`);
    if (r.tickers?.error) errs.push(`Tickers: ${r.tickers.error}`);
    return errs;
  };

  const errorCount = exchangeHealth.errors?.length || 0;
  const staleCount = staleExchanges?.length || 0;

  // Summary badges
  const okCount = rows.filter(r => r.funding?.status === 'ok' || r.oi?.status === 'ok' || r.tickers?.status === 'ok').length;
  const errExchanges = rows.filter(r => r.funding?.status === 'error' || r.oi?.status === 'error' || r.tickers?.status === 'error').length;

  return (
    <div className="space-y-3">
      {/* Overall status bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs font-semibold px-2 py-1 rounded ${
          exchangeHealth.status === 'healthy' ? 'bg-green-500/10 text-green-400' :
          exchangeHealth.status === 'degraded' ? 'bg-yellow-500/10 text-yellow-400' :
          'bg-red-500/10 text-red-400'
        }`}>
          {(exchangeHealth.status || 'unknown').toUpperCase()}
        </span>
        <span className="text-[11px] text-neutral-500">{okCount} active</span>
        {errExchanges > 0 && <span className="text-[11px] text-red-400">{errExchanges} with errors</span>}
        {staleCount > 0 && <span className="text-[11px] text-yellow-400">{staleCount} stale</span>}
      </div>

      {/* Stale warnings */}
      {staleCount > 0 && (
        <div className="p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-[12px] text-yellow-400">
          Stale: {staleExchanges.map(s => `${s.name} (${s.route})`).join(', ')}
        </div>
      )}

      {/* Exchange table */}
      <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
          <span className="text-[11px] text-neutral-500 uppercase tracking-wider">{rows.length} exchanges</span>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter..."
            className="rounded px-2 py-1 text-xs text-white outline-none w-28 bg-transparent border border-white/[0.08] focus:border-white/[0.15]"
          />
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-neutral-500 text-left border-b border-white/[0.06]">
              <th className="px-3 py-2 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('name')}>Exchange {arrow('name')}</th>
              <th className="px-3 py-2 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('funding')}>Funding {arrow('funding')}</th>
              <th className="px-3 py-2 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('oi')}>OI {arrow('oi')}</th>
              <th className="px-3 py-2 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('tickers')}>Tickers {arrow('tickers')}</th>
              <th className="px-3 py-2 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('latency')}>Avg Latency {arrow('latency')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const errors = getErrors(row);
              const hasError = errors.length > 0;
              const isExpanded = expandedRow === row.name;
              const avg = getAvg(row);

              return (
                <tr key={row.name} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <button
                      onClick={() => hasError && setExpandedRow(isExpanded ? null : row.name)}
                      className={`flex items-center gap-1.5 ${hasError ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="text-white font-medium">{row.name}</span>
                      {hasError && <span className="text-red-500 text-[10px]">{isExpanded ? '▼' : '▶'}</span>}
                    </button>
                    {isExpanded && errors.map((err, i) => (
                      <div key={i} className="mt-1 text-[11px] pl-3 py-0.5 rounded-r text-red-400/80 border-l-2 border-red-500/30 bg-red-500/[0.03]">
                        {err}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2"><StatusDot h={row.funding} /></td>
                  <td className="px-3 py-2"><StatusDot h={row.oi} /></td>
                  <td className="px-3 py-2"><StatusDot h={row.tickers} /></td>
                  <td className="px-3 py-2"><LatencyBar ms={avg === 99999 ? 0 : avg} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Error log */}
      {errorCount > 0 ? (
        <div className="rounded-lg border border-red-500/20 overflow-hidden">
          <div className="px-3 py-2 flex items-center gap-2 border-b border-red-500/10 bg-red-500/[0.03]">
            <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Error Log</span>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-red-400 ml-auto">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {exchangeHealth.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2 text-[11px] border-b border-white/[0.04] border-l-2 border-red-500/30">
                <span className="text-white font-medium shrink-0 w-20">{err.exchange}</span>
                <span className="text-neutral-500 shrink-0 w-14">/{err.route}</span>
                <span className="text-red-400/80 flex-1 truncate">{err.error}</span>
                <span className="text-neutral-600 shrink-0">{(err.latencyMs / 1000).toFixed(1)}s</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-white/[0.06] p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider">All systems operational</p>
        </div>
      )}
    </div>
  );
}
