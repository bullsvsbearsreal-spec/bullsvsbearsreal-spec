'use client';

/**
 * The strip below the site header. Hosts asset-class tabs, symbol
 * selector (with picker modal), live price + 24h change, interval
 * buttons, chart-type icons, and the action buttons (Liq Map /
 * Funding / Compare / Trade).
 *
 * Trade button: uses NEXT_PUBLIC_BINANCE_REF when set, falls back to
 * a plain symbol URL. Liq Map / Funding deep-link to existing pages.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Star, ChevronDown, Map, Percent, Compass, Zap,
  BarChart2, LineChart, AreaChart, Search,
} from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ASSET_TABS, TIMEFRAMES, findBySymbol } from '../catalog';
import type { AssetClass, Timeframe } from '../catalog';
import type { ChartStyle } from './TradingViewChart';

const BINANCE_REF = process.env.NEXT_PUBLIC_BINANCE_REF;

export function TerminalControlBar({
  assetClass,
  symbolLabel,
  interval,
  chartStyle,
  livePrice,
  livePriceChange24h,
  isFavorited,
  onAssetClassChange,
  onSymbolChange,
  onIntervalChange,
  onChartStyleChange,
  onToggleFavorite,
}: {
  assetClass: AssetClass;
  symbolLabel: string;
  interval: Timeframe;
  chartStyle: ChartStyle;
  livePrice: number | null;
  livePriceChange24h: number | null;
  isFavorited: boolean;
  onAssetClassChange: (c: AssetClass) => void;
  onSymbolChange: (label: string) => void;
  onIntervalChange: (t: Timeframe) => void;
  onChartStyleChange: (s: ChartStyle) => void;
  onToggleFavorite: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const sym = findBySymbol(symbolLabel);
  const priceTone = livePriceChange24h !== null
    ? (livePriceChange24h > 0 ? 'text-emerald-400' : livePriceChange24h < 0 ? 'text-red-400' : 'text-white')
    : 'text-white';

  // Build the Trade link from active symbol + venue. For Binance,
  // pre-fill the perp pair; add the referral code when present.
  const tradeUrl = useMemo(() => {
    const pair = `${symbolLabel}USDT`;
    const base = `https://www.binance.com/en/futures/${pair}`;
    return BINANCE_REF ? `${base}?ref=${BINANCE_REF}` : base;
  }, [symbolLabel]);

  return (
    <div className="bg-black border-b border-white/[0.06] relative">
      <div className="flex items-center gap-3 px-3 py-2 overflow-x-auto">
        {/* Asset class tabs — active gets a yellow underline pill so the
            selection is unambiguous (was just text-color which read like
            a hover state) */}
        <div className="flex items-center gap-1 shrink-0">
          {ASSET_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onAssetClassChange(tab.id)}
              className={`relative text-xs font-semibold uppercase tracking-wider transition-colors px-2 py-1 rounded ${
                tab.id === assetClass
                  ? 'text-cyan-400 bg-cyan-400/[0.08]'
                  : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
              {tab.id === assetClass && (
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] h-[2px] w-6 bg-cyan-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/[0.08] shrink-0" />

        {/* Symbol selector */}
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] transition-colors shrink-0"
        >
          <TokenIconSimple symbol={symbolLabel} size={22} />
          <span className="text-sm font-bold text-white">{symbolLabel}</span>
          {sym?.displayPair && (
            <span className="text-xs text-neutral-400">{sym.displayPair}</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
        </button>

        <button
          onClick={onToggleFavorite}
          className="text-neutral-500 hover:text-cyan-400 shrink-0"
          title={isFavorited ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Star className={`w-4 h-4 ${isFavorited ? 'text-cyan-400 fill-cyan-400' : ''}`} />
        </button>

        {/* Price + 24h change */}
        <div className="flex items-baseline gap-2 shrink-0">
          <span className={`text-xl font-bold font-mono ${priceTone}`}>
            {livePrice !== null ? `$${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          </span>
          {livePriceChange24h !== null && (
            <>
              <span className={`text-xs font-mono ${priceTone}`}>
                {livePriceChange24h >= 0 ? '+' : ''}{livePriceChange24h.toFixed(2)}%
              </span>
              <span className="text-[10px] text-neutral-500 uppercase">24h</span>
            </>
          )}
        </div>

        <div className="flex-1 min-w-2" />

        {/* Interval */}
        <div className="flex items-center gap-1 shrink-0">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => onIntervalChange(tf.value)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                tf.value === interval
                  ? 'bg-cyan-400 text-black'
                  : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Chart type — candles / line / area. Drives TradingView's
            `style` prop. Active gets a yellow-tinted background + ring
            for stronger contrast against the dark surface (the prior
            yellow-text-only state read like a hover effect). */}
        <div className="flex items-center gap-0.5 shrink-0 border-l border-white/[0.08] pl-2">
          {([
            ['1', 'Candles', BarChart2],
            ['3', 'Line', LineChart],
            ['9', 'Area', AreaChart],
          ] as const).map(([style, label, Icon]) => {
            const active = chartStyle === style;
            return (
              <button
                key={style}
                onClick={() => onChartStyleChange(style)}
                title={label}
                className={`p-1.5 rounded-md transition-colors ${
                  active
                    ? 'text-cyan-400 bg-cyan-400/[0.12] ring-1 ring-cyan-400/30'
                    : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 border-l border-white/[0.08] pl-3">
          <Link
            href={`/liquidation-map?symbol=${symbolLabel}`}
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-300 hover:text-white px-2 py-1 rounded hover:bg-white/[0.04]"
          >
            <Map className="w-3.5 h-3.5" />
            Liq Map
          </Link>
          <Link
            href={`/funding?symbol=${symbolLabel}`}
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-300 hover:text-white px-2 py-1 rounded hover:bg-white/[0.04]"
          >
            <Percent className="w-3.5 h-3.5" />
            Funding
          </Link>
          <Link
            href={`/compare?symbols=${symbolLabel},${symbolLabel === 'BTC' ? 'ETH' : 'BTC'}`}
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-300 hover:text-white px-2 py-1 rounded hover:bg-white/[0.04]"
          >
            <Compass className="w-3.5 h-3.5" />
            Compare
          </Link>
          <a
            href={tradeUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center gap-1 text-[11px] font-bold text-black bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 rounded transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            Trade
          </a>
        </div>
      </div>

      {pickerOpen && (
        <SymbolPickerModal
          assetClass={assetClass}
          activeLabel={symbolLabel}
          onClose={() => setPickerOpen(false)}
          onPick={(label) => { onSymbolChange(label); setPickerOpen(false); }}
        />
      )}
    </div>
  );
}

function SymbolPickerModal({
  assetClass,
  activeLabel,
  onClose,
  onPick,
}: {
  assetClass: AssetClass;
  activeLabel: string;
  onClose: () => void;
  onPick: (label: string) => void;
}) {
  const [query, setQuery] = useState('');
  const tab = ASSET_TABS.find(t => t.id === assetClass) ?? ASSET_TABS[0];

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return tab.pinned;
    return tab.pinned.filter(s => s.label.toUpperCase().includes(q));
  }, [query, tab.pinned]);

  // Group by category. Use plain Record so Array.from(byCat.entries())
  // doesn't trip the "Map iteration needs downlevelIteration" lint.
  const byCat: Record<string, typeof tab.pinned> = useMemo(() => {
    const out: Record<string, typeof tab.pinned> = {};
    for (const s of filtered) {
      const cat = s.cat ?? 'All';
      if (!out[cat]) out[cat] = [];
      out[cat].push(s);
    }
    return out;
  }, [filtered, tab.pinned]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/80 backdrop-blur-sm"
         onClick={onClose}>
      <div
        className="bg-neutral-950 border border-white/[0.08] rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-neutral-500" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${tab.label} symbols…`}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none"
          />
          <span className="text-[10px] text-neutral-500">ESC to close</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {Object.entries(byCat).map(([cat, list]) => (
            <div key={cat} className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1.5 px-1">{cat}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {list.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => onPick(s.label)}
                    className={`flex items-center gap-2 text-left px-2 py-1.5 rounded transition-colors ${
                      s.label === activeLabel
                        ? 'bg-cyan-400/10 text-cyan-300 border border-cyan-400/30'
                        : 'bg-white/[0.03] text-neutral-300 hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <TokenIconSimple symbol={s.label} size={16} />
                    <span className="flex-1 min-w-0">
                      <span className="text-xs font-semibold truncate block">{s.label}</span>
                      {s.displayPair && (
                        <span className="text-[9px] text-neutral-500 truncate block">{s.displayPair}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-neutral-500">
              No symbols match &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
