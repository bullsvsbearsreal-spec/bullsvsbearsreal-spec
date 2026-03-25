'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowUpDown, ArrowLeftRight, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { getCoinIcon } from '@/lib/coinIcons';
import { ExchangeLogo } from '@/components/ExchangeLogos';

interface SpreadRow {
  symbol: string;
  spreadUsd: number;
  spreadPct: number;
  highExchange: string;
  highPrice: number;
  lowExchange: string;
  lowPrice: number;
  exchangeCount: number;
}

type SortKey = 'symbol' | 'spreadUsd' | 'spreadPct' | 'exchangeCount';

function fp(v: number) {
  if (v >= 10000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

export default function SpreadScannerPage() {
  const [rows, setRows] = useState<SpreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('spreadPct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState('');
  const [cexOnly, setCexOnly] = useState(false);
  const CEX_SET = new Set(['Binance','Bybit','OKX','Bitget','MEXC','Kraken','BingX','HTX','Phemex','KuCoin','Bitfinex','WhiteBIT','Coinbase','CoinEx','Bitunix','Deribit','BitMEX','Gate.io']);

  const fetchData = () => {
    fetch('/api/spreads/current')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data) {
          setRows(json.data);
          setLastUpdate(Date.now());
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'symbol' ? 'asc' : 'desc'); }
  };

  const sorted = useMemo(() => {
    let f = rows;
    if (filter) f = f.filter(r => r.symbol.toLowerCase().includes(filter.toLowerCase()));
    if (cexOnly) f = f.filter(r => CEX_SET.has(r.highExchange) && CEX_SET.has(r.lowExchange));
    return [...f].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'symbol') return mul * a.symbol.localeCompare(b.symbol);
      return mul * ((a[sortKey] as number) - (b[sortKey] as number));
    });
  }, [rows, sortKey, sortDir, filter, cexOnly]);

  const SortIcon = ({ k }: { k: SortKey }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sortKey === k ? 'text-hub-yellow' : 'text-neutral-600'}`} />
  );

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <ArrowLeftRight className="w-7 h-7 text-hub-yellow" />
              Spread Scanner
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Live cross-exchange price spreads for all tracked coins. Click a row to view detailed spread chart.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-neutral-600">
              {rows.length} coins · refreshes every 30s
            </span>
            <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition" title="Refresh">
              <RefreshCw className={`w-4 h-4 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search + filters */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Filter by symbol..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full sm:w-64 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/30"
          />
          <button
            onClick={() => setCexOnly(c => !c)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${cexOnly ? 'bg-hub-yellow/10 text-hub-yellow border-hub-yellow/30' : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:text-neutral-300'}`}>
            {cexOnly ? 'CEX Only ✓' : 'CEX Only'}
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-neutral-500 text-xs">
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-white transition" onClick={() => handleSort('symbol')}>
                    SYMBOL <SortIcon k="symbol" />
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition" onClick={() => handleSort('spreadUsd')}>
                    SPREAD $ <SortIcon k="spreadUsd" />
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition" onClick={() => handleSort('spreadPct')}>
                    SPREAD % <SortIcon k="spreadPct" />
                  </th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">HIGH EXCHANGE</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">LOW EXCHANGE</th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition hidden md:table-cell" onClick={() => handleSort('exchangeCount')}>
                    EXCHANGES <SortIcon k="exchangeCount" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <Link key={r.symbol} href={`/spreads?s=${r.symbol}`} className="contents">
                    <tr className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition cursor-pointer ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <img src={getCoinIcon(r.symbol)} alt="" className="w-5 h-5 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <span className="font-semibold text-white">{r.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-hub-yellow font-medium">
                        ${fp(r.spreadUsd)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono font-medium ${r.spreadPct > 0.1 ? 'text-green-400' : r.spreadPct > 0.05 ? 'text-hub-yellow' : 'text-neutral-400'}`}>
                          {r.spreadPct.toFixed(3)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <ExchangeLogo exchange={r.highExchange} size={14} />
                          <span className="text-green-400 text-xs">{r.highExchange}</span>
                          <span className="font-mono text-[11px] text-neutral-500">${fp(r.highPrice)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <ExchangeLogo exchange={r.lowExchange} size={14} />
                          <span className="text-red-400 text-xs">{r.lowExchange}</span>
                          <span className="font-mono text-[11px] text-neutral-500">${fp(r.lowPrice)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-500 hidden md:table-cell">
                        {r.exchangeCount}
                      </td>
                    </tr>
                  </Link>
                ))}
                {sorted.length === 0 && !loading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-600">No spread data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {lastUpdate > 0 && (
          <p className="text-[10px] text-neutral-600 mt-3 text-center">
            Last updated {new Date(lastUpdate).toLocaleTimeString()}
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
