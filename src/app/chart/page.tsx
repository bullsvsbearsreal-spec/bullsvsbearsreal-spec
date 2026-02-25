'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  type MouseEventParams,
} from 'lightweight-charts';
import { ArrowLeft, ChevronDown, Search, X, TrendingUp, TrendingDown, Star } from 'lucide-react';
import Logo from '@/components/Logo';
import { TokenIconSimple } from '@/components/TokenIcon';

/* ═══════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════ */

const PINNED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'AVAX', 'LINK', 'ADA', 'DOT'];

interface TickerInfo {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  isPinned: boolean;
}

const TIMEFRAMES = [
  { label: '1m', value: '1m', key: '1' },
  { label: '5m', value: '5m', key: '2' },
  { label: '15m', value: '15m', key: '3' },
  { label: '1H', value: '1h', key: '4' },
  { label: '4H', value: '4h', key: '5' },
  { label: '1D', value: '1d', key: '6' },
  { label: '1W', value: '1w', key: '7' },
] as const;

type IndicatorKey = 'ema9' | 'ema21' | 'sma50' | 'sma200' | 'bb';

const INDICATOR_CONFIG: {
  key: IndicatorKey;
  label: string;
  color: string;
}[] = [
  { key: 'ema9', label: 'EMA 9', color: '#eab308' },
  { key: 'ema21', label: 'EMA 21', color: '#3b82f6' },
  { key: 'sma50', label: 'SMA 50', color: '#f97316' },
  { key: 'sma200', label: 'SMA 200', color: '#a855f7' },
  { key: 'bb', label: 'BB(20,2)', color: '#6b7280' },
];

const CANDLE_UP = '#eab308';
const CANDLE_DOWN = '#ef4444';
const VOL_UP = 'rgba(34,197,94,0.30)';
const VOL_DOWN = 'rgba(239,68,68,0.30)';

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface Candle {
  time: number;  // ms epoch from Binance
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OhlcLegend {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

/* ═══════════════════════════════════════════════════════════════════════
   Indicator calculations
   ═══════════════════════════════════════════════════════════════════════ */

function calcEMA(data: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (ema === null) {
      ema = data.slice(0, period).reduce((a, b) => a + b) / period;
    } else {
      ema = data[i] * k + ema * (1 - k);
    }
    result.push(ema);
  }
  return result;
}

function calcSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b) / period;
  });
}

function calcBollinger(
  data: number[],
  period = 20,
  stdDev = 2,
): { upper: number | null; middle: number | null; lower: number | null }[] {
  const sma = calcSMA(data, period);
  return sma.map((avg, i) => {
    if (avg === null) return { upper: null, middle: null, lower: null };
    const slice = data.slice(i - period + 1, i + 1);
    const variance = slice.reduce((sum, v) => sum + (v - avg) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    return { upper: avg + stdDev * sd, middle: avg, lower: avg - stdDev * sd };
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

/** Convert ms epoch to lightweight-charts UTCTimestamp (seconds) */
function toChartTime(ms: number): Time {
  return (ms / 1000) as Time;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.001) return price.toFixed(6);
  return price.toFixed(8);
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(2) + 'B';
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(2) + 'M';
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
  return vol.toFixed(2);
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/** Refresh interval (ms) per timeframe */
function pollInterval(tf: string): number {
  if (tf === '1m' || tf === '5m') return 10_000;
  if (tf === '15m' || tf === '1h') return 30_000;
  return 60_000;
}

/* ═══════════════════════════════════════════════════════════════════════
   Page component
   ═══════════════════════════════════════════════════════════════════════ */

export default function ChartPage() {
  /* ─── State ────────────────────────────────────────────────────────── */
  const [symbol, setSymbol] = useState('BTC');
  const [interval, setInterval_] = useState('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Crosshair legend
  const [legend, setLegend] = useState<OhlcLegend | null>(null);

  // Symbol search
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState('');
  const symbolRef = useRef<HTMLDivElement>(null);
  const [allTickers, setAllTickers] = useState<TickerInfo[]>([]);

  // Indicators
  const [indicators, setIndicators] = useState<Record<IndicatorKey, boolean>>({
    ema9: false,
    ema21: false,
    sma50: false,
    sma200: false,
    bb: false,
  });

  /* ─── Refs ─────────────────────────────────────────────────────────── */
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const candlesRef = useRef<Candle[]>([]);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Derived ──────────────────────────────────────────────────────── */
  const currentCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const price24hAgo = candles.length > 1 ? candles[0].close : null;
  const currentPrice = currentCandle?.close ?? 0;
  const change24h = price24hAgo ? ((currentPrice - price24hAgo) / price24hAgo) * 100 : 0;

  // Fetch all tickers for the symbol selector
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tickers');
        if (!res.ok) return;
        const json = await res.json();
        const raw: any[] = json.data || [];

        // Deduplicate by symbol — keep highest volume entry per symbol
        const bySymbol = new Map<string, { price: number; change24h: number; volume24h: number }>();
        for (const t of raw) {
          const sym = (t.symbol as string).toUpperCase();
          const vol = t.volume24h || t.quoteVolume24h || 0;
          const existing = bySymbol.get(sym);
          if (!existing || vol > existing.volume24h) {
            bySymbol.set(sym, {
              price: t.lastPrice || t.price || 0,
              change24h: t.priceChangePercent24h ?? t.changePercent24h ?? 0,
              volume24h: vol,
            });
          }
        }

        const tickers: TickerInfo[] = [];
        for (const [sym, data] of bySymbol) {
          tickers.push({
            symbol: sym,
            price: data.price,
            change24h: data.change24h,
            volume24h: data.volume24h,
            isPinned: PINNED_SYMBOLS.includes(sym),
          });
        }

        // Sort: pinned first (in original order), then by volume desc
        tickers.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          if (a.isPinned && b.isPinned) {
            return PINNED_SYMBOLS.indexOf(a.symbol) - PINNED_SYMBOLS.indexOf(b.symbol);
          }
          return b.volume24h - a.volume24h;
        });

        if (!cancelled) setAllTickers(tickers);
      } catch { /* fail silently — pinned symbols still work */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredSymbols = useMemo(() => {
    const q = symbolQuery.toUpperCase().trim();

    // If we have tickers loaded
    if (allTickers.length > 0) {
      if (!q) return allTickers.slice(0, 50); // Top 50 by volume (pinned first)
      return allTickers.filter((t) => t.symbol.includes(q)).slice(0, 30);
    }

    // Fallback to pinned symbols if tickers haven't loaded
    const pinned = PINNED_SYMBOLS.map((s) => ({
      symbol: s, price: 0, change24h: 0, volume24h: 0, isPinned: true,
    }));
    if (!q) return pinned;
    return pinned.filter((t) => t.symbol.includes(q));
  }, [symbolQuery, allTickers]);

  /* ─── Fetch klines ─────────────────────────────────────────────────── */
  const fetchCandles = useCallback(
    async (updateOnly = false) => {
      try {
        const limit = updateOnly ? 2 : 500;
        const res = await fetch(`/api/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const fetched: Candle[] = json.candles || [];

        if (updateOnly && fetched.length > 0 && candlesRef.current.length > 0) {
          // Merge: update last candle or append new one
          const latest = fetched[fetched.length - 1];
          const existing = [...candlesRef.current];
          const lastIdx = existing.length - 1;

          if (existing[lastIdx].time === latest.time) {
            // Same candle — update in place
            existing[lastIdx] = latest;
          } else {
            // New candle appeared
            existing.push(latest);
          }

          candlesRef.current = existing;
          setCandles(existing);
        } else {
          candlesRef.current = fetched;
          setCandles(fetched);
        }

        setError(null);
      } catch (e) {
        if (!updateOnly) setError(e instanceof Error ? e.message : 'Failed to load chart data');
      } finally {
        if (!updateOnly) setLoading(false);
      }
    },
    [symbol, interval],
  );

  // Initial load + set polling
  useEffect(() => {
    setLoading(true);
    setError(null);
    setCandles([]);
    candlesRef.current = [];
    fetchCandles(false);

    const iv = pollInterval(interval);
    pollRef.current = globalThis.setInterval(() => fetchCandles(true), iv);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchCandles, interval]);

  /* ─── Build / update chart ─────────────────────────────────────────── */
  const buildChart = useCallback(() => {
    if (!containerRef.current) return;

    // Destroy old chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        minBarSpacing: 3,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255,255,255,0.15)',
          labelBackgroundColor: '#1a1a1a',
        },
        horzLine: {
          color: 'rgba(255,255,255,0.15)',
          labelBackgroundColor: '#1a1a1a',
        },
      },
    });

    chartRef.current = chart;

    // Candlestick series
    const cs = chart.addCandlestickSeries({
      upColor: CANDLE_UP,
      downColor: CANDLE_DOWN,
      borderUpColor: CANDLE_UP,
      borderDownColor: CANDLE_DOWN,
      wickUpColor: CANDLE_UP,
      wickDownColor: CANDLE_DOWN,
    });
    candleSeriesRef.current = cs;

    // Volume series on separate price scale
    const vs = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = vs;

    // Crosshair event
    chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
      if (!param.time || !param.seriesData) {
        setLegend(null);
        return;
      }
      const ohlc = param.seriesData.get(cs) as CandlestickData<Time> | undefined;
      const vol = param.seriesData.get(vs) as HistogramData<Time> | undefined;
      if (ohlc) {
        setLegend({
          open: ohlc.open,
          high: ohlc.high,
          low: ohlc.low,
          close: ohlc.close,
          volume: vol?.value ?? 0,
          time: typeof param.time === 'number' ? param.time * 1000 : 0,
        });
      }
    });

    return chart;
  }, []);

  // Create chart on mount
  useEffect(() => {
    buildChart();

    const container = containerRef.current;
    if (!container || !chartRef.current) return;

    const ro = new ResizeObserver(() => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  // Push data to chart whenever candles or indicators change
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    const cs = candleSeriesRef.current;
    const vs = volumeSeriesRef.current;

    // Candlestick data
    const candleData: CandlestickData<Time>[] = candles.map((c) => ({
      time: toChartTime(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    cs.setData(candleData);

    // Volume data
    const volData: HistogramData<Time>[] = candles.map((c) => ({
      time: toChartTime(c.time),
      value: c.volume,
      color: c.close >= c.open ? VOL_UP : VOL_DOWN,
    }));
    vs.setData(volData);

    // Technical indicators
    const closes = candles.map((c) => c.close);
    const times = candles.map((c) => toChartTime(c.time));
    const chart = chartRef.current;

    // Remove old indicator series
    const entries = Array.from(indicatorSeriesRef.current.entries());
    for (const [key, series] of entries) {
      try {
        chart.removeSeries(series);
      } catch {
        // series may already be removed
      }
      indicatorSeriesRef.current.delete(key);
    }

    // EMA 9
    if (indicators.ema9) {
      const vals = calcEMA(closes, 9);
      const lineData: LineData<Time>[] = [];
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] !== null) lineData.push({ time: times[i], value: vals[i]! });
      }
      const s = chart.addLineSeries({ color: '#eab308', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(lineData);
      indicatorSeriesRef.current.set('ema9', s);
    }

    // EMA 21
    if (indicators.ema21) {
      const vals = calcEMA(closes, 21);
      const lineData: LineData<Time>[] = [];
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] !== null) lineData.push({ time: times[i], value: vals[i]! });
      }
      const s = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(lineData);
      indicatorSeriesRef.current.set('ema21', s);
    }

    // SMA 50
    if (indicators.sma50) {
      const vals = calcSMA(closes, 50);
      const lineData: LineData<Time>[] = [];
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] !== null) lineData.push({ time: times[i], value: vals[i]! });
      }
      const s = chart.addLineSeries({ color: '#f97316', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(lineData);
      indicatorSeriesRef.current.set('sma50', s);
    }

    // SMA 200
    if (indicators.sma200) {
      const vals = calcSMA(closes, 200);
      const lineData: LineData<Time>[] = [];
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] !== null) lineData.push({ time: times[i], value: vals[i]! });
      }
      const s = chart.addLineSeries({ color: '#a855f7', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(lineData);
      indicatorSeriesRef.current.set('sma200', s);
    }

    // Bollinger Bands
    if (indicators.bb) {
      const bb = calcBollinger(closes, 20, 2);

      const upperData: LineData<Time>[] = [];
      const middleData: LineData<Time>[] = [];
      const lowerData: LineData<Time>[] = [];

      for (let i = 0; i < bb.length; i++) {
        const b = bb[i];
        if (b.upper !== null) upperData.push({ time: times[i], value: b.upper });
        if (b.middle !== null) middleData.push({ time: times[i], value: b.middle });
        if (b.lower !== null) lowerData.push({ time: times[i], value: b.lower });
      }

      const sUpper = chart.addLineSeries({
        color: 'rgba(107,114,128,0.6)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sUpper.setData(upperData);
      indicatorSeriesRef.current.set('bb_upper', sUpper);

      const sMiddle = chart.addLineSeries({
        color: 'rgba(107,114,128,0.4)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sMiddle.setData(middleData);
      indicatorSeriesRef.current.set('bb_middle', sMiddle);

      const sLower = chart.addLineSeries({
        color: 'rgba(107,114,128,0.6)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sLower.setData(lowerData);
      indicatorSeriesRef.current.set('bb_lower', sLower);
    }

    // Fit content on initial load only
    if (!loading) {
      chart.timeScale().fitContent();
    }
  }, [candles, indicators, loading]);

  /* ─── Keyboard shortcuts ───────────────────────────────────────────── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't capture when typing in search input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Timeframe shortcuts 1-7
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < TIMEFRAMES.length) {
        setInterval_(TIMEFRAMES[idx].value);
        return;
      }

      // Zoom shortcuts
      if (e.key === '=' || e.key === '+') {
        chartRef.current?.timeScale().scrollToPosition(5, false);
      }
      if (e.key === '-') {
        chartRef.current?.timeScale().scrollToPosition(-5, false);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  /* ─── Close symbol dropdown on outside click ───────────────────────── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (symbolRef.current && !symbolRef.current.contains(e.target as Node)) {
        setSymbolOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ─── Toggle indicator ─────────────────────────────────────────────── */
  function toggleIndicator(key: IndicatorKey) {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  /* ─── Render ───────────────────────────────────────────────────────── */
  const displayLegend = legend || (currentCandle
    ? { open: currentCandle.open, high: currentCandle.high, low: currentCandle.low, close: currentCandle.close, volume: currentCandle.volume, time: currentCandle.time }
    : null);

  return (
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden">
      {/* ─── Header bar ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-black/80 backdrop-blur-sm">
        <div className="flex items-center px-3 py-2 gap-2">
          {/* Logo + back */}
          <Link
            href="/"
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mr-2 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <Logo variant="full" size="xs" />
          </Link>

          {/* Divider */}
          <div className="w-px h-6 bg-white/[0.06] flex-shrink-0" />

          {/* Symbol selector */}
          <div ref={symbolRef} className="relative flex-shrink-0">
            <button
              onClick={() => setSymbolOpen(!symbolOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            >
              <TokenIconSimple symbol={symbol} size={18} />
              <span className="text-sm font-bold text-white">{symbol}/USDT</span>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${symbolOpen ? 'rotate-180' : ''}`} />
            </button>

            {symbolOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 w-80 bg-[#111] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden animate-scale-in">
                {/* Search input */}
                <div className="relative px-3 py-2 border-b border-white/[0.06]">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search symbol..."
                    value={symbolQuery}
                    onChange={(e) => setSymbolQuery(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/[0.12]"
                    autoFocus
                  />
                  {symbolQuery && (
                    <button
                      onClick={() => setSymbolQuery('')}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {/* Symbol list */}
                <div className="max-h-72 overflow-y-auto py-1 scrollbar-thin">
                  {filteredSymbols.length === 0 && (
                    <div className="px-4 py-3 text-xs text-neutral-500">No symbols found</div>
                  )}
                  {/* Pinned divider */}
                  {!symbolQuery.trim() && filteredSymbols.some((t) => t.isPinned) && (
                    <div className="px-3 pt-1.5 pb-1 flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-hub-yellow/60" />
                      <span className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider">Popular</span>
                    </div>
                  )}
                  {filteredSymbols.map((t, idx) => {
                    // Show "All Markets" divider after pinned section
                    const showAllDivider = !symbolQuery.trim()
                      && idx > 0
                      && filteredSymbols[idx - 1].isPinned
                      && !t.isPinned;

                    return (
                      <div key={t.symbol}>
                        {showAllDivider && (
                          <div className="px-3 pt-2.5 pb-1 border-t border-white/[0.04] mt-1">
                            <span className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider">All Markets</span>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setSymbol(t.symbol);
                            setSymbolOpen(false);
                            setSymbolQuery('');
                          }}
                          className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2.5 ${
                            t.symbol === symbol
                              ? 'bg-hub-yellow/10'
                              : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          {/* Token icon */}
                          <TokenIconSimple symbol={t.symbol} size={20} />
                          {/* Symbol name */}
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${t.symbol === symbol ? 'text-hub-yellow' : 'text-white'}`}>
                              {t.symbol}
                            </span>
                            <span className="text-neutral-600 text-xs">/USDT</span>
                          </div>
                          {/* Price + change */}
                          {t.price > 0 && (
                            <div className="text-right flex-shrink-0">
                              <div className="text-xs text-neutral-300 font-mono tabular-nums">
                                {formatPrice(t.price)}
                              </div>
                              <div className={`text-[10px] font-medium tabular-nums ${
                                t.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                              </div>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/[0.06] flex-shrink-0" />

          {/* Price + 24h change */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-lg font-bold text-white font-mono tabular-nums">
              {currentPrice > 0 ? formatPrice(currentPrice) : '---'}
            </span>
            {price24hAgo !== null && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  change24h >= 0
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-red-400 bg-red-500/10'
                }`}
              >
                {formatChange(change24h)}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/[0.06] flex-shrink-0 hidden sm:block" />

          {/* OHLCV legend (crosshair or latest) */}
          {displayLegend && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono tabular-nums flex-shrink-0 overflow-x-auto">
              <span className="text-neutral-500">
                O <span className="text-neutral-300">{formatPrice(displayLegend.open)}</span>
              </span>
              <span className="text-neutral-500">
                H <span className="text-neutral-300">{formatPrice(displayLegend.high)}</span>
              </span>
              <span className="text-neutral-500">
                L <span className="text-neutral-300">{formatPrice(displayLegend.low)}</span>
              </span>
              <span className="text-neutral-500">
                C{' '}
                <span
                  className={
                    displayLegend.close >= displayLegend.open ? 'text-green-400' : 'text-red-400'
                  }
                >
                  {formatPrice(displayLegend.close)}
                </span>
              </span>
              <span className="text-neutral-500">
                Vol <span className="text-neutral-300">{formatVolume(displayLegend.volume)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Timeframes + indicators */}
        <div className="flex items-center px-3 py-1.5 gap-1.5 overflow-x-auto border-t border-white/[0.03]">
          {/* Timeframe buttons */}
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setInterval_(tf.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                interval === tf.value
                  ? 'bg-hub-yellow text-black'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
              }`}
              title={`Shortcut: ${tf.key}`}
            >
              {tf.label}
            </button>
          ))}

          {/* Separator */}
          <div className="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />

          {/* Indicator toggles */}
          {INDICATOR_CONFIG.map((ind) => (
            <button
              key={ind.key}
              onClick={() => toggleIndicator(ind.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 flex items-center gap-1.5 ${
                indicators[ind.key]
                  ? 'bg-white/[0.08] text-white'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: indicators[ind.key] ? ind.color : 'transparent',
                  border: `1.5px solid ${ind.color}`,
                }}
              />
              {ind.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Chart area ────────────────────────────────────────────── */}
      <div className="flex-1 relative min-h-0">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
              <span className="text-sm text-neutral-400">Loading {symbol} chart...</span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <p className="text-red-400 text-sm mb-2">{error}</p>
              <button
                onClick={() => fetchCandles(false)}
                className="px-4 py-2 text-xs rounded-lg bg-white/[0.06] text-white hover:bg-white/[0.1] transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* The lightweight-charts container */}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: 0 }}
        />

        {/* Mobile OHLC legend (bottom overlay) */}
        {displayLegend && (
          <div className="sm:hidden absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/[0.06]">
            <span className="text-neutral-500">
              O <span className="text-neutral-300">{formatPrice(displayLegend.open)}</span>
            </span>
            <span className="text-neutral-500">
              H <span className="text-neutral-300">{formatPrice(displayLegend.high)}</span>
            </span>
            <span className="text-neutral-500">
              L <span className="text-neutral-300">{formatPrice(displayLegend.low)}</span>
            </span>
            <span className="text-neutral-500">
              C{' '}
              <span className={displayLegend.close >= displayLegend.open ? 'text-green-400' : 'text-red-400'}>
                {formatPrice(displayLegend.close)}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
