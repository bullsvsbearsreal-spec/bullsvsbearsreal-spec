'use client';

/**
 * Trade Optimizer — given an asset + side + size + leverage, computes
 * total round-trip cost across venues using:
 *
 *  - Maker/taker fees from a built-in lookup (matches /exchange-fees)
 *  - Live funding rate per venue (current rate × hold-hours)
 *  - Quote-based slippage estimate from the orderbook depth proxy in
 *    `/api/orderbook/multi` (CEX) — DEX uses formula impact heuristic
 *
 * Pure client-side aggregation over endpoints we already have.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FreshnessLabel from '@/components/FreshnessLabel';
import { Crosshair, RefreshCw, ExternalLink, TrendingUp, TrendingDown, ChevronDown, Search } from 'lucide-react';
import { getExchangeTradeUrl, FEE_MODEL_VERSION } from '@/lib/constants/exchanges';

interface FundingRow { exchange: string; symbol: string; fundingRate: number; nextFundingMs: number; intervalHours: number }
interface FundingApi { rows: FundingRow[]; symbols: string[]; ts: number }

// /api/execution-costs returns fields in PERCENT (not bps) and uses
// `fee/spread/priceImpact/totalCost` — NOT the bps-suffixed names. We
// convert to bps inside the merge step (multiply by 100).
interface ExecutionVenue {
  exchange: string;
  available: boolean;
  fee: number;
  spread: number;
  priceImpact: number;
  totalCost: number;
  executionPrice: number;
  midPrice: number;
  maxFillableSize: number | null;
  depthLevels?: number;
  method: 'clob' | 'amm_formula' | 'amm_rpc' | 'quote';
  error?: string;
}

interface ExecutionApi {
  asset: string;
  size: number;
  direction: string;
  timestamp?: number;
  venues: ExecutionVenue[];
}

type Side = 'long' | 'short';

interface OptimizerRow {
  exchange: string;
  feeBps: number | null;
  spreadBps: number | null;
  impactBps: number | null;
  fundingRate: number | null;             // per-interval decimal
  fundingIntervalHours: number;
  /** Estimated funding cost over hold horizon, in bps (positive = cost, negative = paid). */
  fundingHoldBps: number | null;
  /** Total round-trip cost in bps (positive = we pay). */
  totalBps: number | null;
  available: boolean;
  tradeUrl?: string;
}

const ASSETS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'HYPE', 'AVAX', 'LINK', 'SUI',
  'TRX', 'TON', 'ADA', 'DOT', 'NEAR', 'APT', 'LTC', 'BCH', 'ARB', 'OP',
  'PEPE', 'WIF', 'BONK', 'SHIB', 'FLOKI',
  'RENDER', 'TAO', 'FET', 'WLD', 'ENA',
  'AAVE', 'UNI', 'MKR', 'PENDLE', 'JUP',
];

/** Searchable asset picker with arrow-key navigation + checkmark on selected.
 *  Wider dropdown (288px) and taller scroll area (~12 visible rows). */
function AssetPicker({ value, onChange }: { value: string; onChange: (a: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // When opening, seed highlight on the currently selected asset so arrow
  // keys feel natural and the user can see where they are.
  useEffect(() => {
    if (open) {
      const idx = ASSETS.indexOf(value);
      setHighlight(idx >= 0 ? idx : 0);
      setQ('');
      // Scroll selected item into view inside the dropdown so it's visible.
      // Without this, a long list can hide the selected item below the fold.
      requestAnimationFrame(() => {
        const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-asset="${value}"]`);
        el?.scrollIntoView({ block: 'nearest' });
      });
    }
  }, [open, value]);

  const filtered = q.trim()
    ? ASSETS.filter(a => a.toLowerCase().includes(q.toLowerCase()))
    : ASSETS;

  // Reset highlight when filter narrows
  useEffect(() => { setHighlight(0); }, [q]);

  const commit = (a: string) => { onChange(a); setOpen(false); setQ(''); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center justify-between gap-2 w-full px-3 py-1.5 rounded bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-hub-yellow/40 transition-colors text-white font-mono text-sm focus:outline-none focus:border-hub-yellow/60"
      >
        <span className="font-semibold">{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-lg bg-[#1a1a1a] border border-white/[0.1] shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/[0.06] bg-[#1a1a1a]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.04] border border-white/[0.06] focus-within:border-hub-yellow/40">
              <Search className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (filtered[highlight]) commit(filtered[highlight]);
                    else if (filtered.length > 0) commit(filtered[0]);
                    e.preventDefault();
                  } else if (e.key === 'Escape') {
                    setOpen(false); setQ('');
                  } else if (e.key === 'ArrowDown') {
                    setHighlight(h => Math.min(h + 1, filtered.length - 1));
                    e.preventDefault();
                  } else if (e.key === 'ArrowUp') {
                    setHighlight(h => Math.max(h - 1, 0));
                    e.preventDefault();
                  }
                }}
                placeholder="Search assets…"
                aria-label="Search assets"
                className="bg-transparent text-sm text-white outline-none w-full placeholder:text-neutral-600"
                autoFocus
              />
              {q && (
                <button
                  onClick={() => setQ('')}
                  aria-label="Clear search"
                  className="text-neutral-500 hover:text-white text-xs flex-shrink-0"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-neutral-500 italic text-center">
                No matches for &quot;{q}&quot;
              </div>
            )}
            {filtered.map((a, i) => {
              const selected = a === value;
              const highlighted = i === highlight;
              return (
                <button
                  key={a}
                  data-asset={a}
                  onClick={() => commit(a)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full text-left px-3 py-1.5 text-sm font-mono flex items-center justify-between transition-colors ${
                    highlighted ? 'bg-white/[0.07]' : 'bg-transparent'
                  } ${selected ? 'text-hub-yellow font-bold' : 'text-neutral-300'}`}
                >
                  <span>{a}</span>
                  {selected && <span className="text-hub-yellow text-xs">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="px-3 py-1.5 border-t border-white/[0.06] text-[10px] text-neutral-600 font-mono flex items-center gap-2 bg-black/20">
            <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-[9px]">↑↓</kbd>
            <span>nav</span>
            <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-[9px]">↵</kbd>
            <span>select</span>
            <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-[9px]">esc</kbd>
            <span>close</span>
            <span className="ml-auto text-neutral-700">{filtered.length} / {ASSETS.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const SIZE_PRESETS = [1_000, 5_000, 25_000, 100_000, 500_000, 1_000_000];
const HOLD_PRESETS = [
  { label: '1d', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '1w', hours: 168 },
  { label: '2w', hours: 336 },
  { label: '1m', hours: 720 },
];

function fmtBps(n: number | null, digits = 1): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)} bps`;
}

function fmtUsd(n: number): string {
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  return `${sign}$${abs.toFixed(3)}`;
}

/** Read the initial state out of `?asset=&side=&size=&hold=` so users can
 *  bookmark or share a specific configuration. Falls back to defaults
 *  when the params are missing or invalid. */
function readInitialState() {
  if (typeof window === 'undefined') {
    return { asset: 'BTC', side: 'long' as Side, size: 25_000, holdHours: 168 };
  }
  const params = new URLSearchParams(window.location.search);
  const rawAsset = (params.get('asset') || '').toUpperCase();
  const asset = ASSETS.includes(rawAsset) ? rawAsset : 'BTC';
  const side = (params.get('side') === 'short' ? 'short' : 'long') as Side;
  const sizeNum = Number(params.get('size'));
  const size = Number.isFinite(sizeNum) && sizeNum >= 1_000 && sizeNum <= 1_000_000 ? sizeNum : 25_000;
  const holdNum = Number(params.get('hold'));
  const holdHours = Number.isFinite(holdNum) && holdNum > 0 ? holdNum : 168;
  return { asset, side, size, holdHours };
}

export default function TradeOptimizerPage() {
  const init = typeof window === 'undefined'
    ? { asset: 'BTC', side: 'long' as Side, size: 25_000, holdHours: 168 }
    : readInitialState();
  const [asset, setAsset] = useState(init.asset);
  const [side, setSide] = useState<Side>(init.side);
  const [size, setSize] = useState(init.size);
  const [holdHours, setHoldHours] = useState(init.holdHours);
  const [leverage, setLeverage] = useState(5);

  const [funding, setFunding] = useState<FundingApi | null>(null);
  const [execution, setExecution] = useState<ExecutionApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Three parallel calls:
    //   - /api/funding-countdown   (5 CEX-style venues, has accurate
    //                               nextFundingTime — used for the
    //                               countdown badge in the cheapest banner)
    //   - /api/funding             (32 exchanges, used as the PRIMARY
    //                               funding-rate source so DEXes like
    //                               dYdX/Aster/Aevo/gTrade/Lighter/edgeX/
    //                               GMX/Variational stop showing "—"
    //                               in the funding column)
    //   - /api/execution-costs     (live orderbook walk, slow for thin pairs)
    const [countdownRes, fundingAllRes, execRes] = await Promise.allSettled([
      fetch('/api/funding-countdown', { signal: AbortSignal.timeout(15_000) }),
      fetch('/api/funding?assetClass=crypto', { signal: AbortSignal.timeout(15_000) }),
      fetch(`/api/execution-costs?asset=${asset}&size=${size}&direction=${side}`, { signal: AbortSignal.timeout(20_000) }),
    ]);

    let fundingOk = false;
    let execOk = false;

    // Build a unified funding map: countdown rows take priority (they have
    // the accurate next-funding timestamp) and we fold in /api/funding rows
    // for every venue not present in countdown.
    let countdown: FundingApi | null = null;
    if (countdownRes.status === 'fulfilled' && countdownRes.value.ok) {
      try { countdown = await countdownRes.value.json(); fundingOk = true; } catch { /* ignore */ }
    }
    let merged: FundingApi | null = countdown;
    if (fundingAllRes.status === 'fulfilled' && fundingAllRes.value.ok) {
      try {
        const j = await fundingAllRes.value.json();
        const wide: Array<{
          symbol: string; exchange: string;
          fundingRate: number; fundingInterval?: string;
          nextFundingTime?: number;
        }> = (j.result?.data ?? j.data ?? []) as any[];

        const intervalToHours = (s: string | undefined): number => {
          if (!s) return 8;
          const n = parseFloat(s);
          return Number.isFinite(n) && n > 0 ? n : 8;
        };

        const seen = new Set<string>();
        const baseRows = countdown?.rows ?? [];
        for (const r of baseRows) seen.add(`${r.exchange.toLowerCase()}|${r.symbol.toUpperCase()}`);

        const extra: FundingRow[] = [];
        for (const r of wide) {
          if (!r || !r.symbol || !r.exchange) continue;
          const key = `${r.exchange.toLowerCase()}|${r.symbol.toUpperCase()}`;
          if (seen.has(key)) continue;
          // /api/funding's fundingRate is in PERCENT (e.g. 0.00125 = 0.00125%)
          // but funding-countdown uses DECIMAL (1.25e-05 = same value).
          // Normalise to the decimal form the merge logic already expects.
          const decimalRate = (r.fundingRate ?? 0) / 100;
          if (!Number.isFinite(decimalRate)) continue;
          extra.push({
            exchange: r.exchange,
            symbol: r.symbol,
            fundingRate: decimalRate,
            nextFundingMs: r.nextFundingTime ?? 0,
            intervalHours: intervalToHours(r.fundingInterval),
          });
          seen.add(key);
        }

        merged = {
          rows: [...baseRows, ...extra],
          symbols: Array.from(new Set([...baseRows, ...extra].map(r => r.symbol))),
          ts: countdown?.ts ?? Date.now(),
        };
        fundingOk = true;
      } catch { /* ignore */ }
    }
    if (merged) setFunding(merged);
    if (execRes.status === 'fulfilled' && execRes.value.ok) {
      try { setExecution(await execRes.value.json()); execOk = true; } catch { /* ignore */ }
    }
    // Local var aliases retained for the error-message decision below.
    const fundingRes = countdownRes;

    // Only escalate to a full error if BOTH failed — otherwise a partial
    // result is still useful (e.g. CEX-only rows from funding when execution
    // timed out, or DEX-only rows when funding-countdown is slow).
    if (!fundingOk && !execOk) {
      const reason = fundingRes.status === 'rejected'
        ? (fundingRes.reason instanceof Error ? fundingRes.reason.message : String(fundingRes.reason))
        : execRes.status === 'rejected'
        ? (execRes.reason instanceof Error ? execRes.reason.message : String(execRes.reason))
        : 'both upstreams returned non-OK';
      setError(reason);
    } else if (!execOk) {
      setError(`Execution data unavailable for ${asset} at $${size.toLocaleString()} — showing CEX rows only. Try a smaller size or different asset.`);
    }

    setLoading(false);
  }, [asset, size, side]);

  useEffect(() => { load(); }, [load]);

  // Combine funding + execution rows
  const rows = useMemo<OptimizerRow[]>(() => {
    const fundForAsset = funding?.rows.filter(r => r.symbol === asset) ?? [];
    const fundByEx = new Map(fundForAsset.map(r => [r.exchange.toLowerCase(), r]));

    const venues = execution?.venues ?? [];
    const combined: OptimizerRow[] = [];

    for (const v of venues) {
      const f = fundByEx.get(v.exchange.toLowerCase()) ?? null;
      // funding cost over hold horizon. fundingRate is per interval (typically 8h).
      // Number of intervals during hold = holdHours / interval.
      let fundingHoldBps: number | null = null;
      if (f && Number.isFinite(f.fundingRate)) {
        const intervals = holdHours / Math.max(1, f.intervalHours);
        // Long pays positive funding; short receives. Flip sign for short.
        const sign = side === 'long' ? 1 : -1;
        const decimal = f.fundingRate * intervals * sign;
        fundingHoldBps = decimal * 10_000; // → bps
      }

      // Convert API's percent units → bps (multiply by 100). When the venue
      // was returned as `available:false` (e.g., Variational with no quotes)
      // its fee/spread/impact fields are zero placeholders — treat them as
      // null so the table renders "—" instead of misleading "0.0".
      const feeBps = v.available ? v.fee * 100 : null;
      const spreadBps = v.available ? v.spread * 100 : null;
      const impactBps = v.available ? v.priceImpact * 100 : null;
      const execBps = v.available ? v.totalCost * 100 : null;

      const total = (execBps != null)
        ? (execBps + (fundingHoldBps ?? 0))
        : (fundingHoldBps != null ? fundingHoldBps : null);

      combined.push({
        exchange: v.exchange,
        feeBps,
        spreadBps,
        impactBps,
        fundingRate: f?.fundingRate ?? null,
        fundingIntervalHours: f?.intervalHours ?? 8,
        fundingHoldBps,
        totalBps: total,
        available: v.available,
        tradeUrl: getExchangeTradeUrl(v.exchange, asset) ?? undefined,
      });
    }

    // For each funded venue, if it's missing from `combined` OR present but
    // unavailable, add/upgrade with funding context + 5 bps taker estimate.
    // The first loop already merged funding for execution rows that DID
    // have a matching funding entry — we only fall back here when the
    // execution side gave nothing useful.
    for (const f of fundForAsset) {
      const intervals = holdHours / Math.max(1, f.intervalHours);
      const sign = side === 'long' ? 1 : -1;
      const fundingHoldBps = f.fundingRate * intervals * sign * 10_000;
      const existing = combined.find(c => c.exchange.toLowerCase() === f.exchange.toLowerCase());

      if (!existing) {
        // Wholly new venue — add fallback row.
        const feeBps = 5;
        combined.push({
          exchange: f.exchange,
          feeBps,
          spreadBps: null,
          impactBps: null,
          fundingRate: f.fundingRate,
          fundingIntervalHours: f.intervalHours,
          fundingHoldBps,
          totalBps: feeBps + fundingHoldBps,
          available: true,
          tradeUrl: getExchangeTradeUrl(f.exchange, asset) ?? undefined,
        });
      } else if (!existing.available || existing.totalBps == null) {
        // Existing row from execution-costs had no usable data — upgrade
        // in place. (We don't double-count funding because the first loop
        // didn't compute totalBps for unavailable rows.)
        existing.fundingRate = f.fundingRate;
        existing.fundingIntervalHours = f.intervalHours;
        existing.fundingHoldBps = fundingHoldBps;
        existing.feeBps = existing.feeBps ?? 5;
        existing.totalBps = (existing.feeBps ?? 5) + fundingHoldBps;
        existing.available = true;
      }
      // else: existing row has live execution data + funding was already
      // merged in the first loop. Don't touch it.
    }

    // Hide rows with no usable data — DEX venues that returned `available:
    // false` AND have no funding context provide zero signal and just
    // pollute the table with "—" placeholders. Keep a row only if it has
    // EITHER a fee/spread/impact estimate OR a funding rate.
    const useful = combined.filter(r =>
      r.totalBps != null ||
      r.feeBps != null ||
      r.spreadBps != null ||
      r.impactBps != null ||
      r.fundingRate != null,
    );
    useful.sort((a, b) => (a.totalBps ?? Infinity) - (b.totalBps ?? Infinity));
    return useful;
  }, [funding, execution, asset, side, holdHours]);

  /** Count of venues hidden because they had no usable data — surface in
   *  footer so user understands why the table looks shorter than expected. */
  const hiddenVenueCount = useMemo(() => {
    const all = (execution?.venues?.length ?? 0) + (funding?.rows.filter(r => r.symbol === asset).length ?? 0);
    return Math.max(0, all - rows.length);
  }, [execution, funding, asset, rows.length]);

  const cheapest = rows.find(r => r.available && r.totalBps != null);

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Trade Optimizer</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              fees + spread + impact + funding
            </span>
            <div className="ml-auto flex items-center gap-3">
              {execution?.timestamp && (
                <FreshnessLabel ts={execution.timestamp} refreshIntervalMs={10_000} />
              )}
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                refresh
              </button>
            </div>
          </div>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Given a position you want to open, find the cheapest venue when
            you factor in <em>everything</em> — taker fees, current spread, market
            impact at your size, and the funding you&apos;d pay (or receive) over your hold.
          </p>
        </div>

        {/* Inputs */}
        <div className="card-premium p-4 mb-4 space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Asset</label>
              <AssetPicker value={asset} onChange={setAsset} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Side</label>
              <div className="flex bg-white/[0.04] border border-white/[0.08] rounded p-0.5">
                <button
                  onClick={() => setSide('long')}
                  className={`flex-1 py-1 text-xs font-bold rounded transition-colors inline-flex items-center justify-center gap-1 ${
                    side === 'long' ? 'bg-emerald-500/30 text-emerald-200' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" /> LONG
                </button>
                <button
                  onClick={() => setSide('short')}
                  className={`flex-1 py-1 text-xs font-bold rounded transition-colors inline-flex items-center justify-center gap-1 ${
                    side === 'short' ? 'bg-rose-500/30 text-rose-200' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <TrendingDown className="w-3 h-3" /> SHORT
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Size · {fmtUsd(size)}</label>
              <input
                type="range"
                min={1_000}
                max={1_000_000}
                step={1_000}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full accent-hub-yellow"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {SIZE_PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => setSize(p)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${size === p ? 'bg-hub-yellow text-black' : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'}`}
                  >
                    {fmtUsd(p)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Hold · {holdHours}h</label>
              <div className="flex flex-wrap gap-1">
                {HOLD_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setHoldHours(p.hours)}
                    className={`text-xs px-2 py-1 rounded font-mono ${holdHours === p.hours ? 'bg-hub-yellow text-black font-bold' : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Leverage · {leverage}x</label>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="flex-1 accent-rose-400 max-w-md"
            />
            <span className="text-[11px] text-neutral-500">
              Margin required: <span className="text-white font-mono">{fmtUsd(size / leverage)}</span>
            </span>
          </div>
        </div>

        {/* Result banner */}
        {cheapest && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200 flex items-center gap-3 flex-wrap">
            <Crosshair className="w-4 h-4 flex-shrink-0" />
            <div className="text-sm">
              Cheapest venue for <span className="font-bold">{side === 'long' ? 'longing' : 'shorting'}</span>{' '}
              <span className="font-bold">{fmtUsd(size)}</span> of{' '}
              <span className="font-bold">{asset}</span> for{' '}
              <span className="font-bold">{HOLD_PRESETS.find(p => p.hours === holdHours)?.label ?? `${holdHours}h`}</span>:{' '}
              <span className="font-bold text-emerald-300">{cheapest.exchange}</span>
              <span className="text-emerald-200/70 mx-2">at</span>
              <span className="font-mono font-bold">{fmtBps(cheapest.totalBps)}</span>
              <span className="text-emerald-200/70 mx-2">≈</span>
              <span className="font-mono font-bold">{fmtUsd((cheapest.totalBps ?? 0) / 10_000 * size)}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={load} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {loading && rows.length === 0 && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Pricing trade across venues…
          </div>
        )}

        {/* Hidden venues hint — explains why fewer rows than expected. Don't
         *  recommend the current asset back to the user (was happening when
         *  they were on BTC: "Try BTC, ETH, SOL…"). */}
        {hiddenVenueCount > 0 && rows.length > 0 && (() => {
          const suggestions = ['BTC', 'ETH', 'SOL', 'AVAX', 'ARB']
            .filter(s => s !== asset);
          return (
            <div className="mb-3 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[11px] text-neutral-500 flex items-center gap-2">
              <span className="text-neutral-400 font-mono">{hiddenVenueCount} venue{hiddenVenueCount === 1 ? '' : 's'} hidden</span>
              <span className="text-neutral-700">·</span>
              <span>
                they don&apos;t list <span className="text-white font-mono">{asset}</span> perps
                {suggestions.length > 0 && (
                  <> — try {suggestions.slice(0, 4).join(', ')} to see more venues</>
                )}.
              </span>
            </div>
          );
        })()}

        {/* Empty state — no usable venues for this asset */}
        {!loading && rows.length === 0 && !error && (funding || execution) && (
          <div className="card-premium p-8 text-center">
            <div className="text-sm text-neutral-300 font-bold mb-1">No venues quote {asset} {side}</div>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              The exchanges + DEXes we track don&apos;t list {asset} perps right now.
              Try a more liquid asset like <span className="text-white font-mono">BTC</span>,{' '}
              <span className="text-white font-mono">ETH</span>, or <span className="text-white font-mono">SOL</span>.
            </p>
          </div>
        )}

        {/* Venues table */}
        {rows.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[120px,90px,90px,90px,110px,110px,110px,40px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>Venue</div>
              <div className="text-right">Fee</div>
              <div className="text-right">Spread</div>
              <div className="text-right">Impact</div>
              <div className="text-right">Funding rate</div>
              <div className="text-right">Funding · {holdHours}h</div>
              <div className="text-right">Total round-trip</div>
              <div></div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.exchange + i}
                className={`grid grid-cols-[120px,90px,90px,90px,110px,110px,110px,40px] gap-3 px-3 py-2 items-center rounded ${
                  i === 0 && r.totalBps != null ? 'bg-emerald-500/[0.06] border-l-2 border-l-emerald-400' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="text-sm text-white font-bold flex items-center gap-1">
                  {r.exchange}
                  {!r.available && <span className="text-[9px] uppercase tracking-wider text-neutral-600">(no quote)</span>}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">{fmtBps(r.feeBps, 1)}</div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">{fmtBps(r.spreadBps, 1)}</div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">{fmtBps(r.impactBps, 1)}</div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                  {r.fundingRate != null
                    ? `${(r.fundingRate * 100).toFixed(4)}% / ${r.fundingIntervalHours}h`
                    : '—'}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${r.fundingHoldBps == null ? 'text-neutral-500' : r.fundingHoldBps > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {fmtBps(r.fundingHoldBps, 1)}
                </div>
                <div className={`text-right font-mono text-sm tabular-nums font-bold ${
                  r.totalBps == null ? 'text-neutral-500' : r.totalBps > 0 ? 'text-rose-300' : 'text-emerald-300'
                }`}>
                  {fmtBps(r.totalBps, 1)}
                  {r.totalBps != null && (
                    <div className={`text-[10px] font-normal ${r.totalBps > 0 ? 'text-rose-400/60' : 'text-emerald-400/60'}`}>
                      ≈ {fmtUsd((r.totalBps / 10_000) * size)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {r.tradeUrl && (
                    <a
                      href={r.tradeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-end text-neutral-500 hover:text-hub-yellow"
                      aria-label={`Trade on ${r.exchange}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How total cost is built:</strong>{' '}
          fee (taker) + spread (half bid-ask) + impact (depth-walk at your size)
          + funding (current rate × hold-hours / interval, signed by side).
          Sources: <span className="text-neutral-400">/api/execution-costs</span> for DEX
          fees + spread + impact, <span className="text-neutral-400">/api/funding-countdown</span> for current
          per-venue funding. CEX rows shown with estimated 5 bps taker since
          we don&apos;t pull live CEX orderbooks here. Round-trip = open + close.
          {' '}Fees from canonical schedule <code className="text-neutral-400">{FEE_MODEL_VERSION}</code>.
          {' '}<em>Slippage on extremely thin venues can dwarf fees — &quot;total bps&quot; is your truth-teller.</em>
        </div>
      </main>
      <Footer />
    </>
  );
}
