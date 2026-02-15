'use client';

import { useState, useMemo } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRate, getExchangeColor } from '../utils';
import { isExchangeDex } from '@/lib/constants';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react';
import Pagination from './Pagination';

interface ArbitrageItem {
  symbol: string;
  spread: number;
  exchanges: { exchange: string; rate: number }[];
}

interface FundingArbitrageViewProps {
  arbitrageData: ArbitrageItem[];
  oiMap?: Map<string, number>;
  markPrices?: Map<string, number>;
  intervalMap?: Map<string, string>; // "SYMBOL|EXCHANGE" → "1h" | "4h"
}

type SortKey = 'spread' | 'annualized' | 'dailyPnl' | 'symbol' | 'oi';

const ROWS_PER_PAGE = 30;

function formatUSD(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPnl(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  if (Math.abs(value) >= 1000) return `${prefix}$${(value / 1000).toFixed(1)}K`;
  return `${prefix}$${value.toFixed(2)}`;
}

const TAKER_FEE = 0.10; // 0.10% round-trip fee estimate (0.05% each side)

function IntervalMark({ symbol, exchange, intervalMap }: { symbol: string; exchange: string; intervalMap?: Map<string, string> }) {
  const interval = intervalMap?.get(`${symbol}|${exchange}`);
  if (interval === '1h') return <span className="text-amber-400 text-[8px] font-bold ml-0.5" title="1h payout">*</span>;
  if (interval === '4h') return <span className="text-blue-400 text-[8px] font-bold ml-0.5" title="4h payout">**</span>;
  return null;
}

export default function FundingArbitrageView({ arbitrageData, oiMap, markPrices, intervalMap }: FundingArbitrageViewProps) {
  const [portfolio, setPortfolio] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ih_arb_portfolio');
      return saved ? parseInt(saved, 10) : 10000;
    }
    return 10000;
  });
  const [sortKey, setSortKey] = useState<SortKey>('spread');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handlePortfolioChange = (val: number) => {
    setPortfolio(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ih_arb_portfolio', String(val));
    }
  };

  const enriched = useMemo(() => {
    return arbitrageData.map(item => {
      const sorted = [...item.exchanges].sort((a, b) => b.rate - a.rate);
      const high = sorted[0];
      const low = sorted[sorted.length - 1];
      const grossSpread = item.spread;
      const netSpread = Math.max(0, grossSpread - TAKER_FEE);
      const annualized = grossSpread * 3 * 365;
      const netAnnualized = netSpread * 3 * 365;
      // Daily PnL: net spread per 8h settlement, 3 settlements/day
      const dailyPnl = (netSpread / 100) * portfolio * 3;
      const monthlyPnl = dailyPnl * 30;

      // OI: sum across all exchanges for this symbol
      let totalOI = 0;
      if (oiMap) {
        item.exchanges.forEach(ex => {
          const oi = oiMap.get(`${item.symbol}|${ex.exchange}`);
          if (oi) totalOI += oi;
        });
      }

      const price = markPrices?.get(item.symbol) || 0;

      return {
        ...item,
        sorted,
        high,
        low,
        grossSpread,
        netSpread,
        annualized,
        netAnnualized,
        dailyPnl,
        monthlyPnl,
        totalOI,
        price,
      };
    });
  }, [arbitrageData, oiMap, markPrices, portfolio]);

  const sortedData = useMemo(() => {
    return [...enriched].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'spread': cmp = a.grossSpread - b.grossSpread; break;
        case 'annualized': cmp = a.netAnnualized - b.netAnnualized; break;
        case 'dailyPnl': cmp = a.dailyPnl - b.dailyPnl; break;
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'oi': cmp = a.totalOI - b.totalOI; break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [enriched, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageData = sortedData.slice(startIdx, startIdx + ROWS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-hub-yellow" /> : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header with portfolio input */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-white font-semibold text-sm">Arbitrage Opportunities</h3>
          <p className="text-neutral-600 text-xs">
            Cross-exchange funding rate spreads (CEX + DEX) &middot; Net of ~{TAKER_FEE.toFixed(2)}% est. fees
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 text-xs">Portfolio:</span>
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1">
            <span className="text-neutral-400 text-xs">$</span>
            <input
              type="number"
              value={portfolio}
              onChange={(e) => handlePortfolioChange(Math.max(100, parseInt(e.target.value) || 100))}
              className="bg-transparent text-white text-xs font-mono w-20 outline-none"
              min={100}
              step={1000}
            />
          </div>
          {[1000, 10000, 50000, 100000].map(v => (
            <button
              key={v}
              onClick={() => handlePortfolioChange(v)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                portfolio === v ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white bg-white/[0.04]'
              }`}
            >
              {v >= 1000 ? `${v / 1000}K` : v}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-8">#</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('symbol')}>
                <div className="flex items-center gap-1">Symbol <SortIcon k="symbol" /></div>
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Price</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('spread')}>
                <div className="flex items-center gap-1 justify-end">Spread <SortIcon k="spread" /></div>
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('annualized')}>
                <div className="flex items-center gap-1 justify-end">Net Ann.% <SortIcon k="annualized" /></div>
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Short Side</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Long Side</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('dailyPnl')}>
                <div className="flex items-center gap-1 justify-end">Daily PnL <SortIcon k="dailyPnl" /></div>
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">30d PnL</th>
              {oiMap && oiMap.size > 0 && (
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('oi')}>
                  <div className="flex items-center gap-1 justify-end">OI <SortIcon k="oi" /></div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageData.map((item, index) => (
              <>
                <tr
                  key={item.symbol}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === item.symbol ? null : item.symbol)}
                >
                  <td className="px-3 py-2 text-neutral-600 text-xs font-mono">
                    <div className="flex items-center gap-1">
                      {expandedRow === item.symbol ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {startIdx + index + 1}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <TokenIconSimple symbol={item.symbol} size={20} />
                      <span className="text-white font-semibold text-sm">{item.symbol}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-neutral-400 font-mono text-xs">
                      {item.price > 0 ? `$${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: item.price < 1 ? 6 : 2 })}` : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div>
                      <span className="text-hub-yellow font-bold font-mono text-sm">{item.grossSpread.toFixed(4)}%</span>
                      {item.netSpread < item.grossSpread && (
                        <div className="text-neutral-600 text-[10px] font-mono">net {item.netSpread.toFixed(4)}%</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono text-xs font-semibold ${item.netAnnualized > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                      {item.netAnnualized > 0 ? '+' : ''}{item.netAnnualized.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <ExchangeLogo exchange={item.high.exchange.toLowerCase()} size={14} />
                      <span className="text-xs text-neutral-300">{item.high.exchange}</span>
                      {isExchangeDex(item.high.exchange) && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>}
                      <span className="text-red-400 font-mono text-[11px] ml-auto">{formatRate(item.high.rate)}<IntervalMark symbol={item.symbol} exchange={item.high.exchange} intervalMap={intervalMap} /></span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <ExchangeLogo exchange={item.low.exchange.toLowerCase()} size={14} />
                      <span className="text-xs text-neutral-300">{item.low.exchange}</span>
                      {isExchangeDex(item.low.exchange) && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>}
                      <span className="text-green-400 font-mono text-[11px] ml-auto">{formatRate(item.low.rate)}<IntervalMark symbol={item.symbol} exchange={item.low.exchange} intervalMap={intervalMap} /></span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono text-xs font-semibold ${item.dailyPnl > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                      {formatPnl(item.dailyPnl)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono text-xs ${item.monthlyPnl > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                      {formatPnl(item.monthlyPnl)}
                    </span>
                  </td>
                  {oiMap && oiMap.size > 0 && (
                    <td className="px-3 py-2 text-right">
                      <span className="text-neutral-400 font-mono text-xs">
                        {item.totalOI > 0 ? formatUSD(item.totalOI) : '-'}
                      </span>
                    </td>
                  )}
                </tr>
                {/* Expanded row: all exchanges */}
                {expandedRow === item.symbol && (
                  <tr key={`${item.symbol}-expanded`} className="bg-white/[0.01]">
                    <td colSpan={oiMap && oiMap.size > 0 ? 10 : 9} className="px-6 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {item.sorted.map((ex) => (
                          <div key={ex.exchange} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.04]">
                            <ExchangeLogo exchange={ex.exchange.toLowerCase()} size={14} />
                            <span className="text-neutral-400 text-[11px]">{ex.exchange}</span>
                            {isExchangeDex(ex.exchange) && <span className="px-0.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>}
                            <span className={`font-mono text-[11px] font-semibold ${ex.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatRate(ex.rate)}<IntervalMark symbol={item.symbol} exchange={ex.exchange} intervalMap={intervalMap} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {arbitrageData.length === 0 && (
        <div className="p-8 text-center text-neutral-600 text-sm">
          No arbitrage opportunities found.
        </div>
      )}

      <Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={sortedData.length}
        rowsPerPage={ROWS_PER_PAGE}
        onPageChange={setCurrentPage}
        label="opportunities"
      />

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-white/[0.06] space-y-1">
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-neutral-600">Payout interval:</span>
          <span className="text-neutral-500">No mark = 8h</span>
          <span className="text-amber-400 font-bold">*</span><span className="text-neutral-500 -ml-2">= 1h</span>
          <span className="text-blue-400 font-bold">**</span><span className="text-neutral-500 -ml-2">= 4h</span>
        </div>
        <p className="text-neutral-700 text-[10px]">
          PnL estimates assume equal position size on short &amp; long sides. Fee estimate: {TAKER_FEE}% round-trip (taker). Actual fees vary by exchange &amp; VIP tier. Not financial advice.
        </p>
      </div>
    </div>
  );
}
