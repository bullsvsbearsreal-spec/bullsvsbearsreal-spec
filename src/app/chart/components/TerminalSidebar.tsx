'use client';

/**
 * Left-rail sidebar for /chart. Stacks:
 *   · Watchlist     — user favourites first, fall back to defaults
 *   · Recent        — last 4 symbols visited (auto-tracked)
 *   · Tools         — links to neighbouring InfoHub pages
 *   · Live signal   — rotates every 8s between funding-flip and news+funding
 *
 * Persistence:
 *   · Favourites live in localStorage `infohub_favorites` (same key the
 *     existing /chart used — back-compatible). Toggled via the star
 *     button on the control bar above; this component just renders.
 *   · Recent visits in `infohub_chart_recents`, FIFO max 4.
 *
 * Click behaviour: clicking any row sets the active symbol via the
 * onSelect callback. The parent owns the symbol state.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Percent, Layers, Ruler, BellRing, Crosshair, Flame,
} from 'lucide-react';
import { WATCHLIST_DEFAULTS, findBySymbol, ASSET_TABS } from '../catalog';
import { LiveSignalCard } from './LiveSignalCard';

interface SidebarTickerLite {
  label: string;
  price?: number;
  change24h?: number;
}

const TOOL_LINKS = [
  { href: '/liquidation-map', label: 'Liq Heatmap', icon: Flame, live: true },
  { href: '/funding-arb', label: 'Funding Arb', icon: Percent, live: false },
  { href: '/spread-scanner', label: 'Spread Scanner', icon: Layers, live: false },
  { href: '/position-size', label: 'Position Sizer', icon: Ruler, live: false },
  { href: '/whale-alerts', label: 'Whale Alerts', icon: BellRing, live: false },
  { href: '/signals', label: 'Signals', icon: Crosshair, live: false },
];

export function TerminalSidebar({
  activeSymbol,
  tickerLookup,
  recents,
  onSelect,
}: {
  activeSymbol: string;
  /** Map<label, {price, change24h}>. Built once in parent from useTickers. */
  tickerLookup: Map<string, SidebarTickerLite>;
  recents: string[];
  onSelect: (label: string) => void;
}) {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Hydrate favourites from localStorage. Effect-only — no SSR mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('infohub_favorites');
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) setFavorites(parsed.filter((s): s is string => typeof s === 'string'));
    } catch { /* ignore */ }
  }, []);

  // Watchlist = favourites first (de-duplicated), then defaults to fill
  // out the visible slate when the user has none / few saved.
  const watchlist = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const f of favorites) {
      if (!seen.has(f) && findBySymbol(f)) {
        out.push(f);
        seen.add(f);
      }
    }
    for (const d of WATCHLIST_DEFAULTS) {
      if (!seen.has(d)) {
        out.push(d);
        seen.add(d);
      }
    }
    return out.slice(0, 8);
  }, [favorites]);

  return (
    <aside className="flex flex-col h-full bg-black border-r border-white/[0.06] overflow-y-auto">
      {/* WATCHLIST */}
      <div className="border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Watchlist</span>
          <button
            onClick={() => onSelect('__add__')}
            className="text-neutral-500 hover:text-yellow-400"
            title="Star a symbol in the top bar to pin"
          >
            +
          </button>
        </div>
        <ul>
          {watchlist.map(label => {
            const sym = findBySymbol(label);
            const t = tickerLookup.get(label);
            const isActive = label === activeSymbol;
            const change = t?.change24h ?? 0;
            const changeColor = change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-neutral-500';
            return (
              <li key={label}>
                <button
                  onClick={() => onSelect(label)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-white/[0.04] transition-colors ${isActive ? 'bg-yellow-400/[0.06] border-l-2 border-yellow-400' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${isActive ? 'bg-yellow-400 text-black' : 'bg-white/[0.06] text-neutral-300'}`}>
                      {sym?.icon ? sym.label.slice(0, 1) : label.slice(0, 1)}
                    </span>
                    <span className={isActive ? 'text-white font-semibold' : 'text-neutral-300'}>{label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-neutral-300 text-[11px]">
                      {t?.price ? formatPrice(t.price) : '—'}
                    </span>
                    <span className={`${changeColor} text-[10px] w-12 text-right`}>
                      {change !== 0 ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* RECENT */}
      {recents.length > 0 && (
        <div className="border-b border-white/[0.06] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-2">Recent</div>
          <div className="flex flex-wrap gap-1">
            {recents.map(r => (
              <button
                key={r}
                onClick={() => onSelect(r)}
                className={`text-[10px] px-2 py-0.5 rounded ${r === activeSymbol ? 'bg-yellow-400/10 text-yellow-300' : 'bg-white/[0.05] text-neutral-300 hover:bg-white/[0.08]'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TOOLS */}
      <div className="border-b border-white/[0.06]">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold px-3 py-2">Tools</div>
        <ul>
          {TOOL_LINKS.map(({ href, label, icon: Icon, live }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center justify-between px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/[0.04] hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-neutral-500" />
                  {label}
                </span>
                {live && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 font-bold">
                    LIVE
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* LIVE SIGNAL */}
      <div className="mt-auto p-3">
        <LiveSignalCard symbol={activeSymbol} />
      </div>
    </aside>
  );
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(4);
}

/** Asset class for a symbol (utility for the parent — saves an import). */
export function assetClassForLabel(label: string): string | null {
  for (const tab of ASSET_TABS) {
    if (tab.pinned.some(s => s.label === label)) return tab.id;
  }
  return null;
}
