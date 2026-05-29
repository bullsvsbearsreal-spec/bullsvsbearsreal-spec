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
    <div
      className="border-b border-white/[0.08] relative z-20"
      style={{
        background: 'linear-gradient(180deg, #12161f 0%, #0d1016 100%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 16px -8px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex items-center gap-3 px-3 py-2.5 overflow-x-auto">
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

        {/* Symbol selector — subtle border + chevron rotation on hover
            for "this is clickable" affordance */}
        <button
          onClick={() => setPickerOpen(true)}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-cyan-400/30 transition-all shrink-0"
        >
          <TokenIconSimple symbol={symbolLabel} size={22} />
          <span className="text-sm font-bold text-white">{symbolLabel}</span>
          {sym?.displayPair && (
            <span className="text-xs text-neutral-400">{sym.displayPair}</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500 group-hover:text-cyan-400 transition-colors" />
        </button>

        <button
          onClick={onToggleFavorite}
          className="text-neutral-500 hover:text-cyan-400 shrink-0 transition-colors"
          title={isFavorited ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Star className={`w-4 h-4 transition-all ${isFavorited ? 'text-cyan-400 fill-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.5)]' : ''}`} />
        </button>

        {/* Price + 24h change — tabular-nums so the digits don't jiggle
            on every tick. Tone-glow on gain/loss for an at-a-glance read.
            Non-crypto has no reliable price source here (tickers API is
            crypto-only), so we point at the chart instead of showing a
            bare "—" or a tokenized-stock price. */}
        <div className="flex items-baseline gap-2 shrink-0">
          {livePrice !== null ? (
            <>
              <span
                className={`text-xl font-bold font-mono tabular-nums transition-colors ${priceTone}`}
                style={
                  livePriceChange24h !== null && livePriceChange24h !== 0
                    ? { textShadow: `0 0 12px ${livePriceChange24h > 0 ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}` }
                    : undefined
                }
              >
                ${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {livePriceChange24h !== null && (
                <>
                  <span className={`text-xs font-mono tabular-nums ${priceTone}`}>
                    {livePriceChange24h >= 0 ? '+' : ''}{livePriceChange24h.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-neutral-500 uppercase">24h</span>
                </>
              )}
            </>
          ) : assetClass === 'crypto' ? (
            // Crypto but no price yet — loading skeleton (pulse).
            <span className="inline-block w-24 h-5 bg-white/[0.04] rounded animate-pulse" />
          ) : (
            // Non-crypto — price lives on the TradingView chart below.
            <span className="text-sm text-neutral-500 font-medium">Live price on chart ↓</span>
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

        {/* Actions — secondary links as ghost buttons (icon-prominent on
            narrow viewports, full text on wide), Trade button as primary
            CTA with subtle glow so the eye lands on it first. */}
        <div className="flex items-center gap-1 shrink-0 border-l border-white/[0.08] pl-3">
          <Link
            href={`/liquidation-map?symbol=${symbolLabel}`}
            title="Liq Map"
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-white/[0.04] transition-colors"
          >
            <Map className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">Liq Map</span>
          </Link>
          <Link
            href={`/funding?symbol=${symbolLabel}`}
            title="Funding"
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-white/[0.04] transition-colors"
          >
            <Percent className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">Funding</span>
          </Link>
          <Link
            href={`/compare?symbols=${symbolLabel},${symbolLabel === 'BTC' ? 'ETH' : 'BTC'}`}
            title="Compare"
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-white/[0.04] transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">Compare</span>
          </Link>
          <a
            href={tradeUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center gap-1.5 text-[11px] font-bold text-black bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 rounded-md transition-all ml-1 shadow-[0_0_12px_rgba(34,211,238,0.25)] hover:shadow-[0_0_16px_rgba(34,211,238,0.4)]"
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
    // Lighter backdrop (60% black) so the chart stays partially visible —
    // less "modal blocking everything" feel, more "lookup overlay".
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm"
         onClick={onClose}>
      <div
        // Wider (3xl, 768 px) + denser grid so most users see their
        // target without scrolling. Each row is compact: icon + label
        // on one line, no per-row "/USDT-PERP" suffix (implied for
        // crypto, shown in the header instead).
        className="bg-neutral-950 border border-white/[0.08] rounded-xl shadow-2xl w-full max-w-3xl max-h-[70vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-neutral-500" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${tab.label} symbols…`}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none"
          />
          <span className="text-[9px] text-neutral-600 uppercase tracking-wider">
            {assetClass === 'crypto' ? '/USDT-PERP · ESC to close' : 'ESC to close'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2.5">
          {Object.entries(byCat).map(([cat, list]) => (
            <div key={cat} className="mb-2">
              <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold mb-1 px-1">{cat}</div>
              <div className="grid grid-cols-5 gap-1">
                {list.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => onPick(s.label)}
                    className={`flex items-center gap-1.5 text-left px-2 py-1 rounded transition-colors ${
                      s.label === activeLabel
                        ? 'bg-cyan-400/10 text-cyan-300 border border-cyan-400/30'
                        : 'bg-white/[0.03] text-neutral-300 hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <TokenIconSimple symbol={s.label} size={14} />
                    <span className="text-xs font-semibold truncate">{s.label}</span>
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
