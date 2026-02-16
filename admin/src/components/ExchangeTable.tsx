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
  if (!health) return <td style={{ color: 'var(--admin-text-muted)' }} className="text-center">--</td>;

  const dotColor =
    health.status === 'ok' ? 'var(--admin-accent)' :
    health.status === 'error' ? '#ef4444' : '#f59e0b';

  const textColor =
    health.status === 'ok' ? 'var(--admin-accent)' :
    health.status === 'error' ? '#f87171' : '#fbbf24';

  return (
    <td>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
        <span className="font-medium" style={{ color: textColor }}>{health.status.toUpperCase()}</span>
        {health.status === 'ok' && (
          <span style={{ color: 'var(--admin-text-muted)' }} className="text-[11px]">{health.count}</span>
        )}
      </div>
    </td>
  );
}

function LatencyCell({ latencyMs }: { latencyMs: number }) {
  if (latencyMs === 0) return <td style={{ color: 'var(--admin-text-muted)' }} className="text-center">--</td>;

  const sec = (latencyMs / 1000).toFixed(1);
  const percent = Math.min(100, (latencyMs / 10000) * 100);
  const color = latencyMs < 2000 ? 'var(--admin-accent)' :
                latencyMs < 5000 ? '#f59e0b' : '#ef4444';

  return (
    <td>
      <div className="flex items-center gap-2">
        <div className="latency-bar w-16 flex-shrink-0">
          <div className="latency-bar-fill" style={{ width: `${percent}%`, background: color }} />
        </div>
        <span className="text-[11px] tabular-nums" style={{ color }}>{sec}s</span>
      </div>
    </td>
  );
}

type SortKey = 'name' | 'funding' | 'oi' | 'tickers' | 'latency';

export default function ExchangeTable({ data }: { data: HealthResponse }) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

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

  if (filter) {
    const f = filter.toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(f));
  }

  rows.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'funding': cmp = (a.funding?.status || 'z').localeCompare(b.funding?.status || 'z'); break;
      case 'oi': cmp = (a.oi?.status || 'z').localeCompare(b.oi?.status || 'z'); break;
      case 'tickers': cmp = (a.tickers?.status || 'z').localeCompare(b.tickers?.status || 'z'); break;
      case 'latency': cmp = getAvgLatency(a) - getAvgLatency(b); break;
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

  const sortArrow = (key: SortKey) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  return (
    <div className="admin-card admin-card-accent !p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--admin-border)' }}>
        <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
          Exchange Health
          <span className="ml-2" style={{ color: 'var(--admin-text-muted)', opacity: 0.5 }}>{rows.length} exchanges</span>
        </span>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="rounded px-2 py-1 text-xs text-white outline-none transition-colors w-32"
          style={{ background: 'transparent', border: '1px solid var(--admin-border)' }}
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
              const avgLatency = getAvgLatency(row);

              return (
                <tr key={row.name}>
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
                      <div className="mt-1.5 space-y-1">
                        {errors.map((err, i) => (
                          <div
                            key={i}
                            className="text-[11px] pl-3 py-0.5 rounded-r"
                            style={{
                              color: 'rgba(248, 113, 113, 0.8)',
                              borderLeft: '2px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.03)',
                            }}
                          >
                            {err}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <StatusCell health={row.funding} />
                  <StatusCell health={row.oi} />
                  <StatusCell health={row.tickers} />
                  <LatencyCell latencyMs={avgLatency === 99999 ? 0 : avgLatency} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
