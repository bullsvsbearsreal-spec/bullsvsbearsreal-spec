'use client';

/**
 * 7-cell stats strip above the chart. Adapts per asset class:
 *   · Crypto:      MARK | 24H VOL | OI | AVG FUNDING | 24H LIQUID | L/S RATIO | NEXT FUNDING
 *   · Stocks:      MARK | 24H VOL                                              (others hidden)
 *   · Forex/Idx:   MARK | 24H CHG                                              (everything else hidden)
 *
 * Hides irrelevant cells rather than greying them out — the strip
 * collapses so the chart gets the reclaimed space. (User picked
 * "hide irrelevant" over "grey out".)
 *
 * Data sources:
 *   · tickers: useTickers (60s) for MARK + 24H VOL
 *   · funding: useFundingRates(crypto) — avg + venue count for symbol
 *   · oi:      useOpenInterest (60s)
 *   · l/s:     useLongShort(symbol + 'USDT')
 *   · 24h liquidations: /api/liquidations?symbol=
 */
import { useEffect, useState } from 'react';
import { useTickers, useFundingRates, useOpenInterest, useLongShort } from '@/hooks/useSWRApi';
import type { AssetClass } from '../catalog';

interface Cell {
  label: string;
  primary: string;
  secondary?: string;
  tone?: 'pos' | 'neg' | 'neutral';
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
}

function formatPct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function formatCountdown(ms: number): string {
  if (ms < 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
}

export function TerminalStatsBar({
  symbol,
  assetClass,
}: {
  symbol: string;
  assetClass: AssetClass;
}) {
  const tickers = useTickers();
  const funding = useFundingRates('crypto');
  const oi = useOpenInterest();
  const ls = useLongShort(`${symbol}USDT`);
  const [now, setNow] = useState(() => Date.now());
  const [liq24h, setLiq24h] = useState<number | null>(null);
  const [liqDir, setLiqDir] = useState<{ long: number; short: number }>({ long: 0, short: 0 });

  // 1Hz tick for the funding countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // 24h liquidations for the active symbol. /api/liquidations
  // returns a raw `data` array of liquidation events (no summary
  // mode on the server), so we compute the totals client-side.
  useEffect(() => {
    if (assetClass !== 'crypto' || !symbol) {
      setLiq24h(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/liquidations?symbol=${encodeURIComponent(symbol)}&hours=24`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        const rows: Array<{ side?: string; value?: number }> = Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j) ? j : [];
        let long = 0;
        let short = 0;
        for (const ev of rows) {
          const v = ev.value ?? 0;
          if (ev.side === 'long') long += v;
          else if (ev.side === 'short') short += v;
        }
        setLiq24h(long + short);
        setLiqDir({ long, short });
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, assetClass]);

  // ── Compute per-cell values ───────────────────────────────────────
  // /api/tickers is crypto-only — looking up "AAPL" there returns
  // a tokenized stock from some crypto venue ($6M vol vs real $10B),
  // not the actual NASDAQ price. So we only consult tickers when the
  // active asset class is crypto. Non-crypto rows show "—" until we
  // wire a real stocks/forex price source.
  const isCrypto = assetClass === 'crypto';
  const symbolRows = isCrypto
    ? (tickers.data ?? []).filter(
        (r: { symbol?: string }) => (r.symbol ?? '').toUpperCase() === symbol.toUpperCase(),
      )
    : [];
  const markPrice = symbolRows.length > 0
    ? medianOf(symbolRows.map((r: { lastPrice?: number; price?: number }) => r.lastPrice ?? r.price ?? 0).filter(p => p > 0))
    : 0;
  const vol24h = symbolRows.reduce(
    (acc: number, r: { quoteVolume24h?: number }) => acc + (r.quoteVolume24h ?? 0),
    0,
  );
  const change24h = symbolRows.length > 0
    ? avgOf(symbolRows.map((r: { priceChangePercent24h?: number; changePercent24h?: number }) =>
        r.priceChangePercent24h ?? r.changePercent24h ?? 0))
    : 0;

  // Funding cell
  const fundingRows = (funding.data ?? []).filter(
    (r: { symbol?: string }) => (r.symbol ?? '').toUpperCase() === symbol.toUpperCase(),
  );
  const fundingAvg = fundingRows.length > 0
    ? avgOf(fundingRows.map((r: { fundingRate?: number }) => r.fundingRate ?? 0))
    : 0;
  const fundingNegativeCount = fundingRows.filter((r: { fundingRate?: number }) => (r.fundingRate ?? 0) < 0).length;
  const nextFundingTime = fundingRows.reduce(
    (min: number, r: { nextFundingTime?: number }) => {
      const t = r.nextFundingTime ?? 0;
      return t > 0 && t < min ? t : min;
    },
    Number.MAX_SAFE_INTEGER,
  );
  const fundingCountdown = nextFundingTime < Number.MAX_SAFE_INTEGER && nextFundingTime > now
    ? formatCountdown(nextFundingTime - now)
    : '—';

  // Open interest cell — sum across venues
  const oiRows = (oi.data ?? []).filter(
    (r: { symbol?: string }) => (r.symbol ?? '').toUpperCase() === symbol.toUpperCase(),
  );
  const totalOI = oiRows.reduce(
    (acc: number, r: { openInterestValue?: number; openInterestUsd?: number }) => acc + (r.openInterestValue ?? r.openInterestUsd ?? 0),
    0,
  );

  // L/S ratio cell — /api/longshort actually returns
  // `{longRatio, shortRatio}` (both as percentages 0-100, summing to
  // ~100). The "ratio" column callers want is long/short, so compute.
  const lsRow = (ls.data ?? null) as {
    longRatio?: number; shortRatio?: number;
    // Backwards-compat fields we still tolerate:
    longShortRatio?: number; ratio?: number; longAccount?: number; shortAccount?: number;
  } | null;
  const lsRatio = lsRow
    ? (lsRow.longShortRatio ?? lsRow.ratio
        ?? (lsRow.longRatio && lsRow.shortRatio && lsRow.shortRatio > 0
              ? lsRow.longRatio / lsRow.shortRatio
              : null))
    : null;
  const lsLongPct = lsRow?.longRatio ?? (lsRow?.longAccount ? lsRow.longAccount * 100 : null);

  // ── Build cell list per asset class ───────────────────────────────
  const cells: Cell[] = [];

  cells.push({
    label: 'Mark',
    primary: isCrypto && markPrice > 0 ? formatPrice(markPrice) : (isCrypto ? '—' : 'See chart'),
    secondary: isCrypto
      ? `Aggregated · ${symbolRows.length} ${symbolRows.length === 1 ? 'venue' : 'venues'}`
      : 'TradingView price · live on chart',
  });

  if (isCrypto) {
    cells.push({
      label: '24h Volume',
      primary: formatUsd(vol24h),
      secondary: 'Futures',
      tone: change24h > 0 ? 'pos' : change24h < 0 ? 'neg' : 'neutral',
    });
  }

  if (isCrypto) {
    cells.push({
      label: 'Open Interest',
      primary: formatUsd(totalOI),
      secondary: oiRows.length > 0
        ? `${oiRows.length} ${oiRows.length === 1 ? 'venue' : 'venues'}`
        : 'Loading…',
    });
    cells.push({
      label: 'Avg Funding',
      primary: formatPct(fundingAvg, 4),
      secondary: fundingRows.length > 0
        ? `${fundingNegativeCount}/${fundingRows.length} negative`
        : 'Loading…',
      tone: fundingAvg > 0 ? 'pos' : fundingAvg < 0 ? 'neg' : 'neutral',
    });
    cells.push({
      label: '24h Liquid.',
      primary: liq24h !== null ? formatUsd(liq24h) : '—',
      // Long/short numbers are big enough that the full "$12.44M long
      // · $3.66M short" overflows even the 140px min cell. Switch to a
      // tight ratio that fits any viewport: "L 78% · S 22%".
      secondary: liq24h !== null && liq24h > 0
        ? (() => {
            const longPct = (liqDir.long / liq24h) * 100;
            const shortPct = (liqDir.short / liq24h) * 100;
            return `L ${longPct.toFixed(0)}% · S ${shortPct.toFixed(0)}%`;
          })()
        : 'Loading…',
    });
    cells.push({
      label: 'L/S Ratio',
      primary: lsRatio !== null ? lsRatio.toFixed(2) : '—',
      // Drop "· Binance" — implied (it's the only L/S source we wire);
      // keeping it made the cell truncate to "64.6% lo…" at 140px width.
      secondary: lsLongPct !== null
        ? `${lsLongPct.toFixed(1)}% long`
        : 'Binance · 1h',
    });
    cells.push({
      label: 'Next Funding',
      primary: fundingCountdown,
      secondary: '8h schedule',
    });
  }
  // Non-crypto: just Mark cell. Live price + 24h change come from
  // the TradingView chart itself (OHLC bar at top of the chart).

  return (
    <div className="flex bg-black border-b border-white/[0.06] overflow-x-auto">
      {cells.map((c, i) => {
        const isLoading = c.primary === '—';
        return (
          <div
            key={i}
            className="flex-1 min-w-[140px] px-3 py-2.5 border-r border-white/[0.06] last:border-r-0"
          >
            <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold mb-1 whitespace-nowrap">
              {c.label}
            </div>
            <div className={`text-sm font-mono font-bold whitespace-nowrap ${
              isLoading
                ? 'text-neutral-600'
                : c.tone === 'pos' ? 'text-emerald-400'
                : c.tone === 'neg' ? 'text-red-400'
                : 'text-white'
            }`}>
              {/* Subtle pulse on the dash so it reads as 'loading' not 'no data' */}
              {isLoading ? <span className="inline-block w-8 h-3 bg-white/[0.04] rounded animate-pulse" /> : c.primary}
            </div>
            {c.secondary && (
              <div className="text-[10px] text-neutral-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                {c.secondary}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function medianOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function avgOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
