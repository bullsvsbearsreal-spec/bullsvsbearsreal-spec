'use client';

/**
 * /dashboard/widgets — Custom Dashboard (Pro tier feature)
 *
 * Drag-to-reorder tile grid backed by /api/dashboard/widgets. HTML5
 * native drag/drop (no extra library) — sufficient for the "reorder +
 * add/remove" UX. Layout autosaves on every change.
 *
 * Widget renderers (right now): 8 lightweight tile types that pull from
 * existing public endpoints. Each tile encapsulates its own data fetch
 * so adding a new widget type is a single component, not a refactor.
 *
 * Tier behaviour: wrapped in <TierGate requires="pro">. With
 * LAUNCH_GATING_ENABLED=false (current launch window) every signed-in
 * user sees the hint chip + full grid. When gating flips on, Free +
 * Trader users see the paywall card instead.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import TierGate from '@/components/TierGate';
import { LayoutDashboard, Plus, GripVertical, X as XIcon, RotateCcw, Save, Loader2 } from 'lucide-react';

type WidgetType =
  | 'funding' | 'oi' | 'liquidations' | 'watchlist'
  | 'alerts' | 'whales' | 'news' | 'positions';

interface Widget {
  id: string;
  type: WidgetType;
  config?: Record<string, unknown>;
}

interface WidgetTypeMeta {
  type: WidgetType;
  label: string;
  description: string;
  /** Optional `config` defaults — applied when the user adds this type. */
  defaultConfig?: Record<string, unknown>;
  /** Whether the type can have multiple instances (e.g. funding for
   *  multiple symbols) — single-instance widgets disable Add when
   *  already present. */
  multiInstance: boolean;
}

const WIDGET_CATALOG: WidgetTypeMeta[] = [
  { type: 'funding',      label: 'Funding rate',  description: 'Live funding for one symbol across venues', multiInstance: true,  defaultConfig: { symbol: 'BTC' } },
  { type: 'oi',           label: 'Open interest', description: '24h OI + change for one symbol',            multiInstance: true,  defaultConfig: { symbol: 'BTC' } },
  { type: 'liquidations', label: 'Liquidations',  description: '7d liquidation count + biggest hit',        multiInstance: true,  defaultConfig: { symbol: 'BTC' } },
  { type: 'watchlist',    label: 'Watchlist',     description: 'Your watchlisted symbols, live prices',     multiInstance: false },
  { type: 'alerts',       label: 'Alerts',        description: 'Active alert count + recent fires',         multiInstance: false },
  { type: 'whales',       label: 'Whale trades',  description: 'Latest large trades from monitored wallets', multiInstance: false },
  { type: 'news',         label: 'News feed',     description: 'Latest crypto news headlines',              multiInstance: false },
  { type: 'positions',    label: 'Open positions', description: 'Your open positions across connected exchanges', multiInstance: false },
];

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DashboardWidgetsPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-6">
        <TierGate requires="pro">
          <PageHero
            icon={LayoutDashboard}
            eyebrow="Customisable · Pro"
            title="Custom"
            accentNoun="dashboard"
            accent="emerald"
            description={
              <>
                Drag tiles to reorder. Add or remove widgets from the catalog. Layout
                auto-saves as you change it. <Link href="/dashboard" className="text-emerald-300 hover:underline">Back to the standard dashboard →</Link>
              </>
            }
          />
          <DashboardWidgetsBody />
        </TierGate>
      </main>
      <Footer />
    </div>
  );
}

function DashboardWidgetsBody() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  // Debounce-save: every layout change triggers a 500ms-delayed PUT so
  // rapid drag swaps don't hammer the API.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(true); // initial GET shouldn't trigger PUT

  const persist = useCallback(async (next: Widget[]) => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/dashboard/widgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error || 'Save failed.');
      } else {
        setIsDefault(false);
      }
    } catch {
      setErr('Network error — your layout will retry on next change.');
    } finally {
      setSaving(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/widgets', { cache: 'no-store' });
        if (res.status === 401) {
          if (!cancelled) {
            setErr('Sign in to customise your dashboard.');
            setLoading(false);
          }
          return;
        }
        const j = await res.json();
        if (!cancelled) {
          setWidgets(Array.isArray(j.widgets) ? j.widgets : []);
          setIsDefault(Boolean(j.isDefault));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setErr('Could not load layout.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Autosave on widget changes (after the initial load).
  useEffect(() => {
    if (loading) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { persist(widgets); }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [widgets, loading, persist]);

  const onAdd = (type: WidgetType) => {
    const meta = WIDGET_CATALOG.find((c) => c.type === type);
    if (!meta) return;
    if (!meta.multiInstance && widgets.some((w) => w.type === type)) return; // already exists
    if (widgets.length >= 24) return;
    setWidgets((prev) => [...prev, { id: newId(), type, ...(meta.defaultConfig ? { config: meta.defaultConfig } : {}) }]);
    setShowCatalog(false);
  };

  const onRemove = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const onReset = async () => {
    if (!confirm('Reset to the default layout? Your customisations will be lost.')) return;
    // Push empty array → server returns default on next GET. We refetch to
    // pick that up rather than hardcoding the default client-side (keeps
    // the default in one place).
    skipNextSaveRef.current = true;
    setWidgets([]);
    await persist([]);
    const res = await fetch('/api/dashboard/widgets', { cache: 'no-store' });
    const j = await res.json();
    setWidgets(j.widgets);
    setIsDefault(j.isDefault);
  };

  // ─── HTML5 drag/drop ───
  const dragId = useRef<string | null>(null);
  const onDragStart = (id: string) => () => { dragId.current = id; };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop = (targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;
    setWidgets((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((w) => w.id === sourceId);
      const toIdx = next.findIndex((w) => w.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  if (loading) {
    return <div className="py-16 text-center text-neutral-500 text-sm"><Loader2 className="w-4 h-4 inline mr-2 animate-spin" />Loading…</div>;
  }
  if (err && widgets.length === 0) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.04] p-4 text-center">
        <p className="text-[13px] text-amber-200">{err}</p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowCatalog((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add widget
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:bg-white/[0.08] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
        <div className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
          {saving ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
          ) : err ? (
            <span className="text-amber-300">{err}</span>
          ) : isDefault ? (
            <><Save className="w-3 h-3" /> Default layout · drag to make it yours</>
          ) : (
            <><Save className="w-3 h-3 text-emerald-400" /> Saved</>
          )}
        </div>
      </div>

      {/* Catalog */}
      {showCatalog && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-3 font-semibold">Widget catalog</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {WIDGET_CATALOG.map((meta) => {
              const present = widgets.some((w) => w.type === meta.type);
              const disabled = !meta.multiInstance && present;
              return (
                <button
                  key={meta.type}
                  type="button"
                  onClick={() => onAdd(meta.type)}
                  disabled={disabled || widgets.length >= 24}
                  className="text-left rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.05] hover:border-emerald-400/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="text-[12px] font-bold text-white mb-0.5">{meta.label}</div>
                  <div className="text-[10px] text-neutral-500 leading-snug">{meta.description}</div>
                  {disabled && <div className="text-[9px] text-amber-400 mt-1 uppercase tracking-wider">Already added</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid */}
      {widgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.01] p-10 text-center">
          <LayoutDashboard className="w-8 h-8 text-neutral-700 mx-auto mb-3" aria-hidden />
          <p className="text-[13px] text-neutral-400 mb-3">Empty canvas — add widgets to get started.</p>
          <button
            type="button"
            onClick={() => setShowCatalog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Open catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {widgets.map((w) => (
            <WidgetCard
              key={w.id}
              widget={w}
              onDragStart={onDragStart(w.id)}
              onDragOver={onDragOver}
              onDrop={onDrop(w.id)}
              onRemove={() => onRemove(w.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Widget card shell ──────────────────────────────────────────── */

function WidgetCard({
  widget, onDragStart, onDragOver, onDrop, onRemove,
}: {
  widget: Widget;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
}) {
  const meta = WIDGET_CATALOG.find((c) => c.type === widget.type);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="group rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-colors min-h-[140px] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
        <GripVertical className="w-3.5 h-3.5 text-neutral-600 cursor-grab active:cursor-grabbing" aria-label="Drag to reorder" />
        <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-300 flex-1">
          {meta?.label ?? widget.type}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-neutral-600 hover:text-rose-400 transition-colors"
          aria-label="Remove widget"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Body — type-specific renderer */}
      <div className="p-3 flex-1">
        <WidgetBody widget={widget} />
      </div>
    </div>
  );
}

/* ─── Widget body renderers ───────────────────────────────────────
 *
 * Each renderer fetches its own data lazily. All 8 widget types have
 * real implementations as of May 2026 — the v1 StubWidget placeholder
 * was removed once every type got wired.
 */

function WidgetBody({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'funding':      return <FundingWidget config={widget.config} />;
    case 'oi':           return <OpenInterestWidget config={widget.config} />;
    case 'liquidations': return <LiquidationsWidget config={widget.config} />;
    case 'alerts':       return <AlertsWidget />;
    case 'watchlist':    return <WatchlistWidget />;
    case 'whales':       return <WhalesWidget />;
    case 'news':         return <NewsWidget />;
    case 'positions':    return <PositionsWidget />;
    default:             return <div className="text-[11px] text-neutral-500">Unknown widget type.</div>;
  }
}

/** Funding-rate widget — fetches /api/funding (the live cross-venue
 *  feed), filters to the configured symbol, and averages the funding
 *  rate across exchanges. The endpoint name "funding-rates" was a typo
 *  in the v1 widget — actual endpoint is /api/funding. */
function FundingWidget({ config }: { config?: Record<string, unknown> }) {
  const symbol = (typeof config?.symbol === 'string' ? config.symbol : 'BTC').toUpperCase();
  const [rate, setRate] = useState<number | null>(null);
  const [venueCount, setVenueCount] = useState(0);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/funding', { cache: 'no-store' });
        if (!res.ok) { setErr(true); return; }
        const j = await res.json();
        if (cancelled) return;
        const rows: any[] = Array.isArray(j?.data) ? j.data : [];
        // Match rows whose normalised symbol equals our target (covers
        // "BTC", "BTCUSDT", "BTC-PERP", etc.). Exclude index/inverse
        // variants by skipping symbols with extra suffixes (BTCDOM).
        const candidates: number[] = [];
        for (const r of rows) {
          const rowSym = String(r?.symbol ?? '').toUpperCase();
          if (rowSym !== symbol) continue;
          if (r?.marginType === 'inverse') continue; // skip inverse perps
          const v = Number(r?.fundingRate);
          if (Number.isFinite(v)) candidates.push(v);
        }
        if (candidates.length === 0) { setErr(true); return; }
        const avg = candidates.reduce((a, b) => a + b, 0) / candidates.length;
        setRate(avg);
        setVenueCount(candidates.length);
      } catch { if (!cancelled) setErr(true); }
    })();
    return () => { cancelled = true; };
  }, [symbol]);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{symbol} · Funding (avg)</div>
      <div className={`text-2xl font-bold ${rate != null && rate > 0 ? 'text-emerald-300' : rate != null && rate < 0 ? 'text-rose-300' : 'text-neutral-400'}`}>
        {rate != null ? `${(rate * 100).toFixed(4)}%` : err ? '—' : '…'}
      </div>
      <div className="text-[10px] text-neutral-500 mt-1">
        per 8h · avg across {venueCount > 0 ? `${venueCount} ${venueCount === 1 ? 'venue' : 'venues'}` : 'venues'}
      </div>
    </div>
  );
}

/** OI widget — aggregate open interest for one symbol across venues
 *  plus 24h change. Fetches /api/openinterest?changes=1 once on mount;
 *  the endpoint serves a 2-minute server-cached snapshot so per-widget
 *  fetches are cheap. */
function OpenInterestWidget({ config }: { config?: Record<string, unknown> }) {
  const symbol = (typeof config?.symbol === 'string' ? config.symbol : 'BTC').toUpperCase();
  const [data, setData] = useState<{ totalUsd: number; pct24h: number | null; venueCount: number } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/openinterest?changes=1', { cache: 'no-store' });
        if (!res.ok) { setErr(true); return; }
        const j = await res.json();
        if (cancelled) return;
        const rows: any[] = Array.isArray(j?.data) ? j.data : [];
        // Sum OI USD across all exchanges for the chosen symbol
        let totalUsd = 0;
        let venueCount = 0;
        for (const r of rows) {
          const rowSym = String(r?.symbol ?? '').toUpperCase();
          if (rowSym !== symbol) continue;
          const v = Number(r?.openInterestValue ?? r?.openInterestUsd ?? 0);
          if (v > 0) { totalUsd += v; venueCount += 1; }
        }
        // 24h change from the change map (when ?changes=1 returned it)
        const changes = (j?.oiChanges && typeof j.oiChanges === 'object') ? j.oiChanges : null;
        const pct24h = changes && typeof changes[symbol]?.pct24h === 'number' ? changes[symbol].pct24h : null;
        if (totalUsd === 0) { setErr(true); return; }
        setData({ totalUsd, pct24h, venueCount });
      } catch { if (!cancelled) setErr(true); }
    })();
    return () => { cancelled = true; };
  }, [symbol]);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{symbol} · Open Interest</div>
      {data ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              ${data.totalUsd >= 1e9 ? `${(data.totalUsd / 1e9).toFixed(2)}B` : `${(data.totalUsd / 1e6).toFixed(1)}M`}
            </span>
            {data.pct24h != null && (
              <span className={`text-sm font-mono font-semibold ${data.pct24h >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {data.pct24h >= 0 ? '+' : ''}{data.pct24h.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            aggregated · {data.venueCount} {data.venueCount === 1 ? 'venue' : 'venues'}
          </div>
          <Link href={`/open-interest?symbol=${symbol}`} className="text-[11px] text-emerald-300 hover:underline mt-2 inline-block">Open full chart →</Link>
        </>
      ) : err ? (
        <div className="text-[11px] text-neutral-500">No OI data for {symbol}.</div>
      ) : (
        <div className="text-[11px] text-neutral-500">Loading…</div>
      )}
    </div>
  );
}

/** Liquidations widget — recent count + biggest hit (long/short) for the
 *  configured symbol. /api/liquidations REQUIRES `symbol` so we default
 *  to BTC if the user didn't customise. Was previously calling without
 *  a symbol and getting 400 silently. */
function LiquidationsWidget({ config }: { config?: Record<string, unknown> }) {
  const symbol = (typeof config?.symbol === 'string' ? config.symbol : 'BTC').toUpperCase();
  const [data, setData] = useState<{ count: number; biggestSide: 'long' | 'short' | null; biggestUsd: number } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/liquidations?symbol=${encodeURIComponent(symbol)}&limit=100`, { cache: 'no-store' });
        if (!res.ok) { setErr(true); return; }
        const j = await res.json();
        if (cancelled) return;
        const rows: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j?.liquidations) ? j.liquidations : [];
        if (rows.length === 0) { setData({ count: 0, biggestSide: null, biggestUsd: 0 }); return; }
        let biggestUsd = 0;
        let biggestSide: 'long' | 'short' | null = null;
        for (const r of rows) {
          const usd = Number(r?.usd ?? r?.amountUsd ?? r?.value ?? 0);
          if (usd > biggestUsd) {
            biggestUsd = usd;
            const side = String(r?.side ?? '').toLowerCase();
            biggestSide = side === 'long' || side === 'buy' ? 'long' : side === 'short' || side === 'sell' ? 'short' : null;
          }
        }
        setData({ count: rows.length, biggestSide, biggestUsd });
      } catch { if (!cancelled) setErr(true); }
    })();
    return () => { cancelled = true; };
  }, [symbol]);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{symbol} · Liquidations 7d</div>
      {data ? (
        <>
          <div className="text-2xl font-bold text-white">{data.count.toLocaleString()}</div>
          <div className="text-[10px] text-neutral-500 mt-1">
            {data.biggestUsd > 0
              ? <>biggest: {data.biggestSide && <strong className={data.biggestSide === 'long' ? 'text-rose-300' : 'text-emerald-300'}>{data.biggestSide.toUpperCase()}</strong>} ${data.biggestUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</>
              : <>no liquidations in window</>
            }
          </div>
          <Link href={`/liquidations?symbol=${symbol}`} className="text-[11px] text-emerald-300 hover:underline mt-2 inline-block">Full feed →</Link>
        </>
      ) : err ? (
        <div className="text-[11px] text-neutral-500">Could not load liquidations.</div>
      ) : (
        <div className="text-[11px] text-neutral-500">Loading…</div>
      )}
    </div>
  );
}

/** Alerts widget — active rule count + recent notifications. */
function AlertsWidget() {
  const [data, setData] = useState<{ active: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/alerts', { cache: 'no-store' });
        if (res.status === 401) { setErr('Sign in to see alerts.'); return; }
        if (!res.ok) { setErr('Could not load alerts.'); return; }
        const j = await res.json();
        if (cancelled) return;
        const rules = Array.isArray(j?.rules) ? j.rules : [];
        const active = rules.filter((r: any) => r?.enabled).length;
        setData({ active, total: rules.length });
      } catch { if (!cancelled) setErr('Network error.'); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Alert rules</div>
      {data ? (
        <>
          <div className="text-2xl font-bold text-emerald-300">{data.active}</div>
          <div className="text-[10px] text-neutral-500 mt-1">
            active of {data.total} total · funding/price/OI
          </div>
          <Link href="/alerts" className="text-[11px] text-emerald-300 hover:underline mt-2 inline-block">Manage alerts →</Link>
        </>
      ) : err ? (
        <div className="text-[11px] text-neutral-500">{err}</div>
      ) : (
        <div className="text-[11px] text-neutral-500">Loading…</div>
      )}
    </div>
  );
}

/** Whales widget — mixes 2 HL biggest positions + 1 top smart-money
 *  trader. Two parallel fetches; the first to finish renders, the
 *  other replaces its slot on arrival. Tolerant to either endpoint
 *  failing — partial data is better than empty. */
function WhalesWidget() {
  const [hl, setHl] = useState<Array<{ coin: string; side: 'long' | 'short'; usd: number; label: string }> | null>(null);
  const [sm, setSm] = useState<{ name: string; pnl: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    // HL whales fetch
    (async () => {
      try {
        const res = await fetch('/api/hl-whales', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        // Tolerant to shape variations: top-level array OR { whales: [...] } OR { data: [...] }
        const whales: any[] = Array.isArray(j) ? j : Array.isArray(j?.whales) ? j.whales : Array.isArray(j?.data) ? j.data : [];
        // Flatten all positions across whales, sort by USD desc, take top 2
        const flat: Array<{ coin: string; side: 'long' | 'short'; usd: number; label: string }> = [];
        for (const w of whales) {
          const positions: any[] = Array.isArray(w?.positions) ? w.positions : [];
          for (const p of positions) {
            const usd = Math.abs(Number(p?.positionValue ?? p?.notional ?? 0));
            if (!usd || !p?.coin) continue;
            flat.push({
              coin: String(p.coin).toUpperCase(),
              side: p?.side === 'short' ? 'short' : 'long',
              usd,
              label: String(w?.label ?? w?.address?.slice(0, 6) ?? '—'),
            });
          }
        }
        flat.sort((a, b) => b.usd - a.usd);
        setHl(flat.slice(0, 2));
      } catch { /* swallow */ }
    })();
    // Smart-money top trader fetch
    (async () => {
      try {
        const res = await fetch('/api/smart-money?limit=5', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        const wallets: any[] = Array.isArray(j?.wallets) ? j.wallets : Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        if (wallets.length === 0) return;
        // Pick the highest realised PnL — tolerant to a few naming variations
        let topPnl = -Infinity;
        let topName: string | null = null;
        for (const w of wallets) {
          const pnl = Number(w?.realizedPnl ?? w?.pnl ?? w?.lifetimePnl ?? 0);
          if (pnl > topPnl) {
            topPnl = pnl;
            topName = String(w?.label ?? w?.displayName ?? w?.address?.slice(0, 6) ?? '—');
          }
        }
        if (topName) setSm({ name: topName, pnl: topPnl });
      } catch { /* swallow */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const loaded = hl !== null || sm !== null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Whales · live</div>
      {!loaded ? (
        <div className="text-[11px] text-neutral-500">Loading…</div>
      ) : (
        <div className="space-y-1.5">
          {(hl ?? []).map((p, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="font-mono font-semibold text-white">
                <span className={p.side === 'long' ? 'text-emerald-300' : 'text-rose-300'}>{p.side === 'long' ? 'L' : 'S'}</span>{' '}
                {p.coin}
              </span>
              <span className="text-neutral-400 font-mono">${p.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
          {sm && (
            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/[0.04]">
              <span className="text-amber-300 truncate">★ {sm.name}</span>
              <span className={`font-mono ${sm.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                ${Math.abs(sm.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
          {(hl ?? []).length === 0 && !sm && (
            <div className="text-[11px] text-neutral-500 italic">No whale activity in window.</div>
          )}
        </div>
      )}
      <Link href="/hl-whales" className="text-[11px] text-emerald-300 hover:underline mt-2 inline-block">All whales →</Link>
    </div>
  );
}

/** News widget — 5 latest headlines from /api/news. Trims long titles
 *  to fit a small tile. Click goes to /news. */
function NewsWidget() {
  const [articles, setArticles] = useState<Array<{ title: string; source: string; url: string; ts: number }> | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/news?limit=5', { cache: 'no-store' });
        if (!res.ok) { setErr(true); return; }
        const j = await res.json();
        if (cancelled) return;
        // News API shape: array of articles or { articles: [...] } or { data: [...] }
        const raw: any[] = Array.isArray(j?.articles) ? j.articles : Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        const cleaned = raw.slice(0, 5).map((a) => ({
          title: String(a?.title ?? '').trim(),
          source: String(a?.source ?? a?.source_info?.name ?? a?.publisher ?? '').trim(),
          url: String(a?.url ?? a?.link ?? '#'),
          ts: Number(a?.published_on ?? a?.publishedAt ?? a?.ts ?? 0) || 0,
        })).filter((a) => a.title.length > 0);
        setArticles(cleaned);
      } catch { if (!cancelled) setErr(true); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">News · latest</div>
      {articles === null ? (
        <div className="text-[11px] text-neutral-500">{err ? 'Could not load news.' : 'Loading…'}</div>
      ) : articles.length === 0 ? (
        <div className="text-[11px] text-neutral-500 italic">No headlines.</div>
      ) : (
        <ul className="space-y-1">
          {articles.map((a, i) => (
            <li key={i}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[11px] text-neutral-300 hover:text-emerald-300 transition-colors leading-snug line-clamp-2"
                title={a.title}
              >
                {a.title}
                {a.source && <span className="text-[9px] text-neutral-600 ml-1">· {a.source}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
      <Link href="/news" className="text-[11px] text-emerald-300 hover:underline mt-2 inline-block">All news →</Link>
    </div>
  );
}

/** Positions widget — count + total unrealised PnL + biggest gainer.
 *  Hits /api/account/positions (auth required). */
function PositionsWidget() {
  const [data, setData] = useState<{ count: number; unrealised: number; biggest: { symbol: string; pct: number } | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/positions', { cache: 'no-store' });
        if (res.status === 401) { setErr('Sign in to see positions.'); return; }
        if (!res.ok) { setErr('Could not load positions.'); return; }
        const j = await res.json();
        if (cancelled) return;
        const positions: any[] = Array.isArray(j?.positions) ? j.positions : [];
        if (positions.length === 0) { setData({ count: 0, unrealised: 0, biggest: null }); return; }
        const unrealised = positions.reduce((acc, p) => acc + Number(p?.unrealizedPnl ?? p?.unrealized ?? 0), 0);
        // Biggest mover by % roe
        let biggestPct = -Infinity;
        let biggestSymbol: string | null = null;
        for (const p of positions) {
          const roe = Number(p?.roe ?? p?.unrealizedRoe ?? p?.pnlPct ?? 0);
          if (Math.abs(roe) > Math.abs(biggestPct)) {
            biggestPct = roe;
            biggestSymbol = String(p?.symbol ?? p?.coin ?? '').toUpperCase() || null;
          }
        }
        setData({
          count: positions.length,
          unrealised,
          biggest: biggestSymbol ? { symbol: biggestSymbol, pct: biggestPct } : null,
        });
      } catch { if (!cancelled) setErr('Network error.'); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Open positions</div>
      {data === null ? (
        <div className="text-[11px] text-neutral-500">{err ?? 'Loading…'}</div>
      ) : data.count === 0 ? (
        <div>
          <div className="text-2xl font-bold text-neutral-400">0</div>
          <div className="text-[10px] text-neutral-500 mt-1">No open positions. <Link href="/account/connections" className="text-emerald-300 hover:underline">Connect an exchange →</Link></div>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{data.count}</span>
            <span className={`text-sm font-mono font-semibold ${data.unrealised >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {data.unrealised >= 0 ? '+' : ''}${data.unrealised.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            unrealised
            {data.biggest && (
              <> · biggest: <strong className={data.biggest.pct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{data.biggest.symbol} {data.biggest.pct >= 0 ? '+' : ''}{(data.biggest.pct * 100).toFixed(1)}%</strong></>
            )}
          </div>
          <Link href="/positions" className="text-[11px] text-emerald-300 hover:underline mt-2 inline-block">Full positions →</Link>
        </>
      )}
    </div>
  );
}

/** Watchlist widget — reads localStorage `infohub_watchlist` + joins
 *  with /api/tickers for live prices + 24h change. Renders the top 5
 *  symbols as a compact price list. Two fetches that run in parallel:
 *  localStorage on mount (cheap), then a ticker fetch (network). The
 *  ticker fetch reuses the same endpoint /watchlist itself uses, so
 *  the response is already cached server-side. */
function WatchlistWidget() {
  const [rows, setRows] = useState<Array<{ symbol: string; price: number; pct24h: number }> | null>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    // Read localStorage first — cheap, no network
    let symbols: string[] = [];
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('infohub_watchlist') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          symbols = parsed.filter((s) => typeof s === 'string').slice(0, 5) as string[];
        }
      }
    } catch { /* swallow */ }

    if (symbols.length === 0) { setEmpty(true); return; }
    const upper = new Set(symbols.map((s) => s.toUpperCase()));

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tickers', { cache: 'no-store' });
        if (!res.ok) { setRows([]); return; }
        const j = await res.json();
        if (cancelled) return;
        // Endpoint returns either an array directly or { data: [...] }
        const raw: any[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
        // Aggregate per-symbol: take the highest-volume ticker as the
        // reference price (binance usually wins; if not, the next venue).
        const bestBySymbol = new Map<string, { price: number; pct24h: number; volume: number }>();
        for (const t of raw) {
          const sym = String(t?.symbol ?? '').toUpperCase().replace(/USDT$|USDC$|USD$/, '');
          if (!upper.has(sym)) continue;
          const price = Number(t?.lastPrice ?? t?.price ?? 0);
          const pct24h = Number(t?.priceChangePercent24h ?? t?.change24h ?? 0);
          const vol = Number(t?.volume24h ?? 0);
          if (!price) continue;
          const existing = bestBySymbol.get(sym);
          if (!existing || vol > existing.volume) {
            bestBySymbol.set(sym, { price, pct24h, volume: vol });
          }
        }
        // Preserve the user's watchlist order
        const ordered = symbols
          .map((s) => {
            const u = s.toUpperCase();
            const v = bestBySymbol.get(u);
            return v ? { symbol: u, price: v.price, pct24h: v.pct24h } : null;
          })
          .filter((x): x is { symbol: string; price: number; pct24h: number } => x !== null);
        setRows(ordered);
      } catch { if (!cancelled) setRows([]); }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Watchlist · live</div>
      {empty ? (
        <div className="text-[11px] text-neutral-500 italic">No symbols yet. <Link href="/watchlist" className="text-emerald-300 hover:underline">Add one →</Link></div>
      ) : rows === null ? (
        <div className="text-[11px] text-neutral-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-[11px] text-neutral-500 italic">Couldn&apos;t load prices. <Link href="/watchlist" className="text-emerald-300 hover:underline">Open watchlist →</Link></div>
      ) : (
        <>
          <ul className="space-y-1 mb-2">
            {rows.map((r) => (
              <li key={r.symbol}>
                <Link
                  href={`/chart?symbol=${encodeURIComponent(r.symbol)}`}
                  className="flex items-center justify-between text-[11px] py-0.5 px-1 -mx-1 rounded hover:bg-white/[0.04] transition-colors"
                >
                  <span className="font-mono font-semibold text-neutral-200">{r.symbol}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-neutral-300">
                      ${r.price >= 1000 ? r.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : r.price >= 1 ? r.price.toFixed(2)
                        : r.price.toPrecision(4)}
                    </span>
                    <span className={`font-mono text-[10px] ${r.pct24h >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {r.pct24h >= 0 ? '+' : ''}{r.pct24h.toFixed(1)}%
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/watchlist" className="text-[11px] text-emerald-300 hover:underline">Manage watchlist →</Link>
        </>
      )}
    </div>
  );
}
