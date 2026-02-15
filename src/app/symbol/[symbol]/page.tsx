'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { RefreshCw, Star, ArrowLeft, TrendingUp, TrendingDown, Info } from 'lucide-react';
import Link from 'next/link';
import { TokenIconSimple } from '@/components/TokenIcon';
import { formatPrice, formatCompact, formatFundingRate } from '@/lib/utils/format';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/storage/watchlist';

/* ─── Types ──────────────────────────────────────────────────────── */

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TickerInfo {
  exchange: string;
  lastPrice: number;
  volume24h: number;
  change24h: number;
}

interface FundingInfo {
  exchange: string;
  rate: number;
  interval?: string;
}

interface OIInfo {
  exchange: string;
  openInterest: number;
}

type Interval = '1h' | '4h' | '1d' | '1w';

/* ─── Mini Candle Chart (SVG) ────────────────────────────────────── */

function CandleChart({ candles, width = 800, height = 300 }: { candles: Candle[]; width?: number; height?: number }) {
  if (candles.length === 0) return null;

  const minLow = Math.min(...candles.map((c) => c.low));
  const maxHigh = Math.max(...candles.map((c) => c.high));
  const range = maxHigh - minLow || 1;
  const padding = 4;
  const candleW = Math.max(1, (width - padding * 2) / candles.length - 1);

  const scaleY = (val: number) => padding + (1 - (val - minLow) / range) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => {
        const y = padding + pct * (height - padding * 2);
        const price = maxHigh - pct * range;
        return (
          <g key={pct}>
            <line x1={0} y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.04)" />
            <text x={4} y={y - 2} fill="rgba(255,255,255,0.2)" fontSize="9">
              {formatPrice(price)}
            </text>
          </g>
        );
      })}

      {candles.map((c, i) => {
        const x = padding + i * ((width - padding * 2) / candles.length);
        const isGreen = c.close >= c.open;
        const bodyTop = scaleY(Math.max(c.open, c.close));
        const bodyBottom = scaleY(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBottom - bodyTop);
        const color = isGreen ? '#22c55e' : '#ef4444';

        return (
          <g key={i}>
            {/* Wick */}
            <line
              x1={x + candleW / 2}
              y1={scaleY(c.high)}
              x2={x + candleW / 2}
              y2={scaleY(c.low)}
              stroke={color}
              strokeWidth={1}
            />
            {/* Body */}
            <rect
              x={x}
              y={bodyTop}
              width={candleW}
              height={bodyH}
              fill={color}
              rx={0.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Volume Chart (SVG) ─────────────────────────────────────────── */

function VolumeChart({ candles, width = 800, height = 80 }: { candles: Candle[]; width?: number; height?: number }) {
  if (candles.length === 0) return null;

  const maxVol = Math.max(...candles.map((c) => c.volume)) || 1;
  const padding = 4;
  const barW = Math.max(1, (width - padding * 2) / candles.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {candles.map((c, i) => {
        const x = padding + i * ((width - padding * 2) / candles.length);
        const barH = (c.volume / maxVol) * (height - padding);
        const isGreen = c.close >= c.open;

        return (
          <rect
            key={i}
            x={x}
            y={height - barH}
            width={barW}
            height={barH}
            fill={isGreen ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function SymbolPage() {
  const params = useParams();
  const symbol = (params.symbol as string)?.toUpperCase() || 'BTC';

  const [interval, setInterval_] = useState<Interval>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [tickers, setTickers] = useState<TickerInfo[]>([]);
  const [funding, setFunding] = useState<FundingInfo[]>([]);
  const [oi, setOI] = useState<OIInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [klinesRes, tickerRes, fundingRes, oiRes] = await Promise.all([
        fetch(`/api/klines?symbol=${symbol}&interval=${interval}&limit=200`)
          .then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/tickers').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/funding').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/openinterest').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (klinesRes?.candles) setCandles(klinesRes.candles);

      if (tickerRes?.data) {
        setTickers(
          (tickerRes.data as any[])
            .filter((t: any) => t.symbol === symbol)
            .map((t: any) => ({
              exchange: t.exchange,
              lastPrice: t.lastPrice || 0,
              volume24h: t.volume24h || 0,
              change24h: t.priceChangePercent24h ?? t.change24h ?? 0,
            })),
        );
      }

      if (fundingRes?.data) {
        setFunding(
          (fundingRes.data as any[])
            .filter((f: any) => f.symbol === symbol)
            .map((f: any) => ({
              exchange: f.exchange,
              rate: f.rate ?? f.fundingRate ?? 0,
              interval: f.interval,
            })),
        );
      }

      if (oiRes?.data) {
        setOI(
          (oiRes.data as any[])
            .filter((o: any) => o.symbol === symbol)
            .map((o: any) => ({
              exchange: o.exchange,
              openInterest: o.openInterest || 0,
            })),
        );
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30_000);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    setWatched(isInWatchlist(symbol));
  }, [symbol]);

  const toggleWatch = () => {
    if (watched) removeFromWatchlist(symbol);
    else addToWatchlist(symbol);
    setWatched(!watched);
  };

  // Aggregated stats
  const avgPrice = useMemo(() => {
    if (tickers.length === 0) return 0;
    return tickers.reduce((s, t) => s + t.lastPrice, 0) / tickers.length;
  }, [tickers]);

  const totalVolume = useMemo(() => tickers.reduce((s, t) => s + t.volume24h, 0), [tickers]);
  const totalOI = useMemo(() => oi.reduce((s, o) => s + o.openInterest, 0), [oi]);
  const avgFunding = useMemo(() => {
    if (funding.length === 0) return 0;
    return funding.reduce((s, f) => s + f.rate, 0) / funding.length;
  }, [funding]);
  const avgChange = useMemo(() => {
    if (tickers.length === 0) return 0;
    return tickers.reduce((s, t) => s + t.change24h, 0) / tickers.length;
  }, [tickers]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-hub-dark text-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          {/* Back + Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Link href="/screener" className="text-neutral-500 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <TokenIconSimple symbol={symbol} size={32} />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  {symbol}
                  <span className="text-sm text-neutral-500 font-normal">/ USDT</span>
                </h1>
                <p className="text-sm text-neutral-500">
                  {avgPrice > 0 ? formatPrice(avgPrice) : '-'}{' '}
                  {avgChange !== 0 && (
                    <span className={avgChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleWatch}
                className={`p-2 rounded-lg transition-colors ${
                  watched
                    ? 'bg-hub-yellow/20 text-hub-yellow'
                    : 'bg-white/[0.04] text-neutral-400 hover:text-white'
                }`}
              >
                <Star className={`w-4 h-4 ${watched ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
              <p className="text-xs text-neutral-500">Price</p>
              <p className="text-lg font-bold text-white">{avgPrice > 0 ? formatPrice(avgPrice) : '-'}</p>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
              <p className="text-xs text-neutral-500">24h Change</p>
              <p className={`text-lg font-bold flex items-center gap-1 ${avgChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {avgChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
              </p>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
              <p className="text-xs text-neutral-500">Volume 24h</p>
              <p className="text-lg font-bold text-white">${formatCompact(totalVolume)}</p>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
              <p className="text-xs text-neutral-500">Open Interest</p>
              <p className="text-lg font-bold text-white">${formatCompact(totalOI)}</p>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
              <p className="text-xs text-neutral-500">Avg Funding</p>
              <p className={`text-lg font-bold ${avgFunding >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatFundingRate(avgFunding)}
              </p>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
            {/* Interval selector */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Price Chart</h2>
              <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
                {(['1h', '4h', '1d', '1w'] as Interval[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setInterval_(tf)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      interval === tf
                        ? 'bg-hub-yellow text-black'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {loading && candles.length === 0 ? (
              <div className="flex items-center justify-center h-[300px]">
                <RefreshCw className="w-5 h-5 animate-spin text-hub-yellow" />
              </div>
            ) : candles.length > 0 ? (
              <>
                <div className="h-[300px]">
                  <CandleChart candles={candles} />
                </div>
                <div className="h-[80px] mt-1">
                  <VolumeChart candles={candles} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-neutral-500 text-sm">
                No chart data available for {symbol}
              </div>
            )}
          </div>

          {/* Two-column: Funding + OI by exchange */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Funding by exchange */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Funding Rate by Exchange</h2>
              {funding.length === 0 ? (
                <p className="text-xs text-neutral-500 py-4 text-center">No funding data</p>
              ) : (
                <div className="space-y-2">
                  {funding
                    .sort((a, b) => b.rate - a.rate)
                    .map((f) => (
                      <div key={f.exchange} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                        <span className="text-xs text-neutral-300">{f.exchange}</span>
                        <span className={`text-xs font-mono ${f.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatFundingRate(f.rate)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* OI by exchange */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Open Interest by Exchange</h2>
              {oi.length === 0 ? (
                <p className="text-xs text-neutral-500 py-4 text-center">No OI data</p>
              ) : (
                <div className="space-y-2">
                  {oi
                    .sort((a, b) => b.openInterest - a.openInterest)
                    .map((o) => (
                      <div key={o.exchange} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                        <span className="text-xs text-neutral-300">{o.exchange}</span>
                        <span className="text-xs font-mono text-white">${formatCompact(o.openInterest)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Tickers across exchanges */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-white mb-3">Price Across Exchanges</h2>
            {tickers.length === 0 ? (
              <p className="text-xs text-neutral-500 py-4 text-center">No ticker data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-2 text-neutral-500 font-medium">Exchange</th>
                      <th className="text-right py-2 text-neutral-500 font-medium">Price</th>
                      <th className="text-right py-2 text-neutral-500 font-medium">24h Change</th>
                      <th className="text-right py-2 text-neutral-500 font-medium">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickers
                      .sort((a, b) => b.volume24h - a.volume24h)
                      .map((t) => (
                        <tr key={t.exchange} className="border-b border-white/[0.04]">
                          <td className="py-2 text-neutral-300">{t.exchange}</td>
                          <td className="py-2 text-right text-white font-mono">{formatPrice(t.lastPrice)}</td>
                          <td className={`py-2 text-right font-mono ${t.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                          </td>
                          <td className="py-2 text-right text-neutral-400">${formatCompact(t.volume24h)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Info footer */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 border-l-2 border-l-hub-yellow">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
              <div className="text-xs text-neutral-400 space-y-1">
                <p>
                  <strong className="text-neutral-300">Multi-Timeframe Dashboard</strong> shows price action,
                  funding rates, and open interest for {symbol} across all tracked exchanges.
                </p>
                <p>
                  Candlestick chart data from Binance. Funding and OI aggregated from 17+ exchanges.
                  Auto-refreshes every 30 seconds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
