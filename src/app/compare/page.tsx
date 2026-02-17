'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { GitCompareArrows, Plus, X, RefreshCw } from 'lucide-react';
import { formatPrice, formatNumber, formatPercent, formatFundingRate, formatUSD } from '@/lib/utils/format';

interface TickerEntry { symbol: string; lastPrice: number; priceChangePercent24h: number; quoteVolume24h: number; exchange: string; }
interface FundingEntry { symbol: string; fundingRate: number; exchange: string; fundingInterval?: string; }
interface OIEntry { symbol: string; openInterestValue: number; exchange: string; }

interface CoinData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  avgFunding: number;
  totalOI: number;
  fundingByExchange: { exchange: string; rate: number }[];
  oiByExchange: { exchange: string; value: number }[];
}

const POPULAR = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK', 'SUI', 'ARB', 'OP'];

function normalizeSymbol(raw: string): string {
  return raw.toUpperCase().replace(/[-_]/g, '').replace(/(USDT|USD|USDC|BUSD|PERP|SWAP)$/i, '').replace(/^1000/, '');
}

export default function ComparePage() {
  const [selected, setSelected] = useState<string[]>(['BTC', 'ETH']);
  const [inputValue, setInputValue] = useState('');
  const [tickers, setTickers] = useState<TickerEntry[]>([]);
  const [funding, setFunding] = useState<FundingEntry[]>([]);
  const [oi, setOI] = useState<OIEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tickerRes, fundingRes, oiRes] = await Promise.all([
        fetch('/api/tickers').then(r => r.json()),
        fetch('/api/funding?assetClass=crypto').then(r => r.json()),
        fetch('/api/openinterest').then(r => r.json()),
      ]);
      setTickers(Array.isArray(tickerRes) ? tickerRes : tickerRes?.data || []);
      setFunding(fundingRes?.data || []);
      setOI(oiRes?.data || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Compare fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const coinData = useMemo((): CoinData[] => {
    return selected.map(sym => {
      // Tickers
      let bestPrice = 0, bestChange = 0, totalVol = 0;
      let maxVol = 0;
      tickers.forEach(t => {
        const ns = normalizeSymbol(t.symbol);
        if (ns !== sym) return;
        const vol = t.quoteVolume24h || 0;
        totalVol += vol;
        if (vol > maxVol) { maxVol = vol; bestPrice = t.lastPrice; bestChange = t.priceChangePercent24h; }
      });

      // Funding by exchange
      const fundingByExchange: { exchange: string; rate: number }[] = [];
      let fundingSum = 0, fundingCount = 0;
      funding.forEach(f => {
        const ns = normalizeSymbol(f.symbol);
        if (ns !== sym) return;
        fundingByExchange.push({ exchange: f.exchange, rate: f.fundingRate });
        fundingSum += f.fundingRate;
        fundingCount++;
      });

      // OI by exchange
      const oiByExchange: { exchange: string; value: number }[] = [];
      let totalOI = 0;
      oi.forEach(o => {
        const ns = normalizeSymbol(o.symbol);
        if (ns !== sym) return;
        oiByExchange.push({ exchange: o.exchange, value: o.openInterestValue });
        totalOI += o.openInterestValue;
      });

      oiByExchange.sort((a, b) => b.value - a.value);
      fundingByExchange.sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));

      return {
        symbol: sym,
        price: bestPrice,
        change24h: bestChange,
        volume: totalVol,
        avgFunding: fundingCount > 0 ? fundingSum / fundingCount : 0,
        totalOI,
        fundingByExchange,
        oiByExchange,
      };
    });
  }, [selected, tickers, funding, oi]);

  const handleAdd = (sym: string) => {
    const upper = sym.toUpperCase().trim();
    if (!upper || selected.includes(upper) || selected.length >= 4) return;
    setSelected([...selected, upper]);
    setInputValue('');
  };

  const handleRemove = (sym: string) => {
    if (selected.length <= 1) return;
    setSelected(selected.filter(s => s !== sym));
  };

  // Quick-add suggestions: popular coins not already selected
  const suggestions = POPULAR.filter(s => !selected.includes(s)).slice(0, 6);

  return (
    <div className="min-h-screen bg-hub-black text-white">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <GitCompareArrows className="w-5 h-5 text-hub-yellow" />
              Compare
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Side-by-side comparison across all exchanges
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UpdatedAgo date={lastUpdate} />
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Coin Selector */}
        <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {selected.map(sym => (
              <div key={sym} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20">
                <TokenIconSimple symbol={sym} size={18} />
                <span className="text-hub-yellow font-semibold text-sm">{sym}</span>
                {selected.length > 1 && (
                  <button onClick={() => handleRemove(sym)} className="text-hub-yellow/50 hover:text-hub-yellow transition-colors ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {selected.length < 4 && (
              <form onSubmit={e => { e.preventDefault(); handleAdd(inputValue); }} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value.toUpperCase())}
                  placeholder="Add coin..."
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 w-28"
                />
                <button type="submit" disabled={!inputValue.trim()} className="p-1.5 rounded-lg bg-hub-yellow text-black disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-neutral-600 text-xs mr-1">Quick add:</span>
            {suggestions.map(sym => (
              <button
                key={sym}
                onClick={() => handleAdd(sym)}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.04] text-neutral-500 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        {/* Comparison Grid */}
        {loading && coinData.every(c => c.price === 0) ? (
          <div className="text-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-hub-yellow mx-auto mb-2" />
            <span className="text-neutral-500 text-sm">Loading comparison data...</span>
          </div>
        ) : (
          <>
            {/* Key Metrics Comparison */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${selected.length}, minmax(0, 1fr))` }}>
              {coinData.map(coin => (
                <div key={coin.symbol} className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
                    <TokenIconSimple symbol={coin.symbol} size={28} />
                    <div>
                      <span className="text-white font-bold text-lg">{coin.symbol}</span>
                      <div className="text-xs text-neutral-500">{coin.price > 0 ? formatPrice(coin.price) : '--'}</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600 text-xs">24h Change</span>
                      <span className={`font-mono text-sm font-semibold ${coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPercent(coin.change24h)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600 text-xs">Volume</span>
                      <span className="text-white font-mono text-sm">{formatNumber(coin.volume)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600 text-xs">Total OI</span>
                      <span className="text-white font-mono text-sm">{formatUSD(coin.totalOI)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600 text-xs">Avg Funding</span>
                      <span className={`font-mono text-sm ${coin.avgFunding >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatFundingRate(coin.avgFunding)}
                      </span>
                    </div>
                  </div>

                  {/* Funding by Exchange */}
                  <div>
                    <span className="text-neutral-500 text-[10px] uppercase tracking-wider font-medium">Funding by Exchange</span>
                    <div className="mt-1.5 space-y-1">
                      {coin.fundingByExchange.slice(0, 6).map(f => (
                        <div key={f.exchange} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ExchangeLogo exchange={f.exchange.toLowerCase()} size={12} />
                            <span className="text-neutral-400 text-[11px]">{f.exchange}</span>
                          </div>
                          <span className={`font-mono text-[11px] ${f.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {f.rate >= 0 ? '+' : ''}{f.rate.toFixed(4)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OI by Exchange */}
                  <div>
                    <span className="text-neutral-500 text-[10px] uppercase tracking-wider font-medium">OI by Exchange</span>
                    <div className="mt-1.5 space-y-1">
                      {coin.oiByExchange.slice(0, 6).map(o => {
                        const pct = coin.totalOI > 0 ? (o.value / coin.totalOI) * 100 : 0;
                        return (
                          <div key={o.exchange}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <ExchangeLogo exchange={o.exchange.toLowerCase()} size={12} />
                                <span className="text-neutral-400 text-[11px]">{o.exchange}</span>
                              </div>
                              <span className="text-white font-mono text-[11px]">{formatUSD(o.value)}</span>
                            </div>
                            <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                              <div className="h-full bg-hub-yellow rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Visual Comparison Bars */}
            <div className="mt-6 bg-hub-darker border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-4">Visual Comparison</h3>

              {/* OI Comparison */}
              <div className="mb-4">
                <span className="text-neutral-500 text-[10px] uppercase tracking-wider font-medium">Open Interest</span>
                <div className="mt-2 space-y-2">
                  {coinData.map(coin => {
                    const maxOI = Math.max(...coinData.map(c => c.totalOI), 1);
                    const pct = (coin.totalOI / maxOI) * 100;
                    return (
                      <div key={coin.symbol} className="flex items-center gap-3">
                        <span className="text-white font-semibold text-xs w-12">{coin.symbol}</span>
                        <div className="flex-1 h-5 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-hub-yellow to-hub-orange rounded-full transition-all flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 5)}%` }}>
                            <span className="text-[9px] font-mono text-black font-bold">{formatUSD(coin.totalOI)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Volume Comparison */}
              <div className="mb-4">
                <span className="text-neutral-500 text-[10px] uppercase tracking-wider font-medium">24h Volume</span>
                <div className="mt-2 space-y-2">
                  {coinData.map(coin => {
                    const maxVol = Math.max(...coinData.map(c => c.volume), 1);
                    const pct = (coin.volume / maxVol) * 100;
                    return (
                      <div key={coin.symbol} className="flex items-center gap-3">
                        <span className="text-white font-semibold text-xs w-12">{coin.symbol}</span>
                        <div className="flex-1 h-5 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 5)}%` }}>
                            <span className="text-[9px] font-mono text-white font-bold">{formatNumber(coin.volume)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Funding Comparison */}
              <div>
                <span className="text-neutral-500 text-[10px] uppercase tracking-wider font-medium">Avg Funding Rate</span>
                <div className="mt-2 space-y-2">
                  {coinData.map(coin => {
                    const maxFunding = Math.max(...coinData.map(c => Math.abs(c.avgFunding)), 0.001);
                    const pct = (Math.abs(coin.avgFunding) / maxFunding) * 50;
                    return (
                      <div key={coin.symbol} className="flex items-center gap-3">
                        <span className="text-white font-semibold text-xs w-12">{coin.symbol}</span>
                        <div className="flex-1 h-5 bg-white/[0.04] rounded-full overflow-hidden relative">
                          {/* Center line */}
                          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/10" />
                          {coin.avgFunding >= 0 ? (
                            <div
                              className="absolute top-0 bottom-0 left-1/2 bg-green-500/60 rounded-r-full flex items-center justify-end pr-1"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            >
                              <span className="text-[9px] font-mono text-green-200 font-bold">+{coin.avgFunding.toFixed(4)}%</span>
                            </div>
                          ) : (
                            <div
                              className="absolute top-0 bottom-0 bg-red-500/60 rounded-l-full flex items-center pl-1"
                              style={{ width: `${Math.max(pct, 2)}%`, right: '50%' }}
                            >
                              <span className="text-[9px] font-mono text-red-200 font-bold">{coin.avgFunding.toFixed(4)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Info */}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            Compare up to 4 coins side-by-side. Data aggregated from all active exchanges.
            Funding rates are averaged across exchanges. Open interest and volume are summed.
            Data refreshes every 60 seconds.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
