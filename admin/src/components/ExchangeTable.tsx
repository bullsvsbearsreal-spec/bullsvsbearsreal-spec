'use client';

import { useState } from 'react';
import { HealthResponse, ExchangeHealth } from '@/lib/types';

interface ExchangeRow {
  name: string;
  funding: ExchangeHealth | null;
  oi: ExchangeHealth | null;
  tickers: ExchangeHealth | null;
}

function StatusCell({ health }: { health: ExchangeHealth | null }) {
  if (!health) return <td className="text-neutral-700 text-center">—</td>;

  const color =
    health.status === 'ok' ? 'text-emerald-400' :
    health.status === 'error' ? 'text-red-400' : 'text-amber-400';

  const bgColor =
    health.status === 'ok' ? '' :
    health.status === 'error' ? 'status-bg-error' : 'status-bg-empty';

  return (
    <td className={`${bgColor}`}>
      <div className="flex items-center gap-2">
        <span className={`${color} font-medium`}>{health.status.toUpperCase()}</span>
        {health.status === 'ok' && (
          <span className="text-neutral-600">{health.count}</span>
        )}
      </div>
    </td>
  );
}

function LatencyCell({ health }: { health: ExchangeHealth | null }) {
  if (!health) return <td className="text-neutral-700 text-center">—</td>;

  const sec = (health.latencyMs / 1000).toFixed(1);
  const color =
    health.latencyMs < 2000 ? 'text-neutral-500' :
    health.latencyMs < 5000 ? 'text-amber-400' : 'text-red-400';

  return <td className={color}>{sec}s</td>;
}

type SortKey = 'name' | 'funding' | 'oi' | 'tickers' | 'latency';

export default function ExchangeTable({ data }: { data: HealthResponse }) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  // Merge health arrays into unified rows
  const exchangeMap = new Map<string, ExchangeRow>();

  for (const h of data.routes.funding.health) {
    if (!exchangeMap.has(h.name)) exchangeMap.set(h.name, { name: h.name, funding: null, oi: null, tickers: null });
    exchangeMap.get(h.name)!.funding = h;
  }
  for (const h of data.routes.openinterest.health) {
    if (!exchangeMap.has(h.name)) exchangeMap.set(h.name, { name: h.name, funding: null, oi: null, tickers: null });
    exchangeMap.get(h.name)!.oi = h;
  }
  for (const h of data.routes.tickers.health) {
    if (!exchangeMap.has(h.name)) exchangeMap.set(h.name, { name: h.name, funding: null, oi: null, tickers: null });
    exchangeMap.get(h.name)!.tickers = h;
  }

  let rows = Array.from(exchangeMap.values());

  // Filter
  if (filter) {
    const f = filter.toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(f));
  }

  // Sort
  rows.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'funding':
        cmp = (a.funding?.status || 'z').localeCompare(b.funding?.status || 'z');
        break;
      case 'oi':
        cmp = (a.oi?.status || 'z').localeCompare(b.oi?.status || 'z');
        break;
      case 'tickers':
        cmp = (a.tickers?.status || 'z').localeCompare(b.tickers?.status || 'z');
        break;
      case 'latency': {
        const avgA = getAvgLatency(a);
        const avgB = getAvgLatency(b);
        cmp = avgA - avgB;
        break;
      }
    }
    return sortAsc ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  function getAvgLatency(row: ExchangeRow) {
    const vals = [row.funding?.latencyMs, row.oi?.latencyMs, row.tickers?.latencyMs].filter(Boolean) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 99999;
  }

  function getErrorText(row: ExchangeRow) {
    const errs: string[] = [];
    if (row.funding?.error) errs.push(`Funding: ${row.funding.error}`);
    if (row.oi?.error) errs.push(`OI: ${row.oi.error}`);
    if (row.tickers?.error) errs.push(`Tickers: ${row.tickers.error}`);
    return errs;
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  return (
    <div className="admin-card !p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
        <span className="text-[11px] text-neutral-500 uppercase tracking-wider">
          Exchange Health
          <span className="text-neutral-700 ml-2">{rows.length} exchanges</span>
        </span>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="bg-transparent border border-terminal-border rounded px-2 py-1 text-xs text-white outline-none focus:border-terminal-green/30 w-32"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')}>Exchange{sortArrow('name')}</th>
              <th onClick={() => handleSort('funding')}>Funding{sortArrow('funding')}</th>
              <th onClick={() => handleSort('oi')}>OI{sortArrow('oi')}</th>
              <th onClick={() => handleSort('tickers')}>Tickers{sortArrow('tickers')}</th>
              <th onClick={() => handleSort('latency')}>Avg Latency{sortArrow('latency')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const errors = getErrorText(row);
              const hasError = errors.length > 0;
              const isExpanded = expandedRow === row.name;

              return (
                <tr key={row.name} className="group">
                  <td>
                    <button
                      onClick={() => hasError && setExpandedRow(isExpanded ? null : row.name)}
                      className={`flex items-center gap-1.5 ${hasError ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="text-white font-medium">{row.name}</span>
                      {hasError && (
                        <span className="text-red-500 text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                      )}
                    </button>
                    {isExpanded && errors.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {errors.map((err, i) => (
                          <div key={i} className="text-[11px] text-red-400/80 pl-3 border-l border-red-500/20">
                            {err}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <StatusCell health={row.funding} />
                  <StatusCell health={row.oi} />
                  <StatusCell health={row.tickers} />
                  <LatencyCell health={{
                    name: row.name,
                    status: 'ok',
                    count: 0,
                    latencyMs: getAvgLatency(row) === 99999 ? 0 : getAvgLatency(row),
                  }} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
