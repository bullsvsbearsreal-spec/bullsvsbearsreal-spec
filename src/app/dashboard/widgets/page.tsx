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
  { type: 'liquidations', label: 'Liquidations',  description: '24h liquidation summary',                   multiInstance: false },
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
 * Each renderer fetches its own data lazily. Heavy widgets fall back to
 * a stub for v1 so the framework is shippable — they'll get real
 * implementations as separate, smaller PRs.
 */

function WidgetBody({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'funding':      return <FundingWidget config={widget.config} />;
    case 'oi':           return <OpenInterestWidget config={widget.config} />;
    case 'liquidations': return <LiquidationsWidget />;
    case 'alerts':       return <AlertsWidget />;
    case 'watchlist':    return <WatchlistWidget />;
    case 'whales':       return <StubWidget label="Whale trades" hint="Wires up next — see /hl-whales for the full live view." />;
    case 'news':         return <StubWidget label="News" hint="Wires up next — see /news for the full feed." />;
    case 'positions':    return <StubWidget label="Open positions" hint="Wires up next — see /positions for full PnL." />;
    default:             return <div className="text-[11px] text-neutral-500">Unknown widget type.</div>;
  }
}

/** Funding-rate widget — fetches latest rate for the configured symbol. */
function FundingWidget({ config }: { config?: Record<string, unknown> }) {
  const symbol = (typeof config?.symbol === 'string' ? config.symbol : 'BTC').toUpperCase();
  const [rate, setRate] = useState<number | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/funding-rates?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' });
        if (!res.ok) { setErr(true); return; }
        const j = await res.json();
        if (cancelled) return;
        // Tolerant shape — different endpoints return slightly different
        // payloads. Pull the first numeric `rate` field we find.
        const candidates: number[] = [];
        if (Array.isArray(j?.data)) {
          for (const row of j.data) {
            if (typeof row?.rate === 'number') candidates.push(row.rate);
          }
        }
        if (typeof j?.rate === 'number') candidates.push(j.rate);
        if (candidates.length > 0) {
          // Average across venues — close enough for a glance widget.
          const avg = candidates.reduce((a, b) => a + b, 0) / candidates.length;
          setRate(avg);
        } else {
          setErr(true);
        }
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
      <div className="text-[10px] text-neutral-500 mt-1">per 8h · average across venues</div>
    </div>
  );
}

/** OI widget — placeholder until we wire to /api/open-interest properly. */
function OpenInterestWidget({ config }: { config?: Record<string, unknown> }) {
  const symbol = (typeof config?.symbol === 'string' ? config.symbol : 'BTC').toUpperCase();
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{symbol} · Open Interest</div>
      <div className="text-[11px] text-neutral-500 italic">Live wiring lands in next PR — placeholder for now.</div>
      <Link href={`/open-interest?symbol=${symbol}`} className="text-[11px] text-emerald-300 hover:underline mt-2 inline-block">Open full chart →</Link>
    </div>
  );
}

/** Reusable stub for the widgets whose real wiring lands in follow-up PRs.
 *  Frame is shipped today so users can experiment with the layout. */
function StubWidget({ label, hint }: { label: string; hint: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{label}</div>
      <div className="text-[11px] text-neutral-500 italic leading-relaxed">{hint}</div>
    </div>
  );
}

/** Liquidations widget — recent count + biggest hit symbol. Pulls the
 *  default OKX 7d feed from /api/liquidations (no symbol filter). */
function LiquidationsWidget() {
  const [data, setData] = useState<{ count: number; biggestSymbol: string | null; biggestUsd: number } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/liquidations?limit=100', { cache: 'no-store' });
        if (!res.ok) { setErr(true); return; }
        const j = await res.json();
        if (cancelled) return;
        const rows: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j?.liquidations) ? j.liquidations : [];
        if (rows.length === 0) { setData({ count: 0, biggestSymbol: null, biggestUsd: 0 }); return; }
        // Find biggest by usd. Tolerant to multiple shape variants.
        let biggestUsd = 0;
        let biggestSymbol: string | null = null;
        for (const r of rows) {
          const usd = Number(r?.usd ?? r?.amountUsd ?? r?.value ?? 0);
          if (usd > biggestUsd) { biggestUsd = usd; biggestSymbol = String(r?.symbol ?? r?.instrument ?? '').toUpperCase() || null; }
        }
        setData({ count: rows.length, biggestSymbol, biggestUsd });
      } catch { if (!cancelled) setErr(true); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Liquidations · last batch</div>
      {data ? (
        <>
          <div className="text-2xl font-bold text-white">{data.count.toLocaleString()}</div>
          <div className="text-[10px] text-neutral-500 mt-1">
            {data.biggestSymbol && data.biggestUsd > 0
              ? <>biggest: <strong className="text-rose-300">{data.biggestSymbol}</strong> · ${data.biggestUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</>
              : <>no liquidations in window</>
            }
          </div>
          <Link href="/liquidations" className="text-[11px] text-emerald-300 hover:underline mt-2 inline-block">Full feed →</Link>
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

/** Watchlist widget — reads localStorage `infohub_watchlist` (the same
 *  store the rest of the app uses). Renders up to 6 symbols with a CTA
 *  to the full /watchlist page. Future: pull live prices once a unified
 *  watchlist+prices endpoint lands. */
function WatchlistWidget() {
  const [symbols, setSymbols] = useState<string[] | null>(null);
  useEffect(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('infohub_watchlist') : null;
      if (!raw) { setSymbols([]); return; }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((s) => typeof s === 'string').slice(0, 6) as string[];
        setSymbols(cleaned);
      } else {
        setSymbols([]);
      }
    } catch { setSymbols([]); }
  }, []);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Watchlist</div>
      {symbols === null ? (
        <div className="text-[11px] text-neutral-500">Loading…</div>
      ) : symbols.length === 0 ? (
        <div className="text-[11px] text-neutral-500 italic">No symbols yet. <Link href="/watchlist" className="text-emerald-300 hover:underline">Add one →</Link></div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 mb-2">
            {symbols.map((s) => (
              <Link
                key={s}
                href={`/chart?symbol=${encodeURIComponent(s)}`}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-white/[0.06] border border-white/[0.08] text-neutral-200 hover:border-emerald-400/30 hover:text-emerald-300 transition-colors"
              >
                {s}
              </Link>
            ))}
          </div>
          <Link href="/watchlist" className="text-[11px] text-emerald-300 hover:underline">Manage watchlist →</Link>
        </>
      )}
    </div>
  );
}
