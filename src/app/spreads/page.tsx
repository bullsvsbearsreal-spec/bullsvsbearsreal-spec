'use client';

import React, { useEffect } from 'react';
import { ArrowLeftRight, ChevronDown, RefreshCw, Calculator, Info, Wifi, WifiOff, X, Activity } from 'lucide-react';
import FeatureHint from '@/components/FeatureHint';
import RelatedPages from '@/components/RelatedPages';
import { getCoinIcon } from '@/lib/coinIcons';
import { ExchangeLogo } from '@/components/ExchangeLogos';

// ── Lib ──
import { getExchangeColor } from './lib/exchange-colors';
import { ALL_EXCHANGES, CEX_EXCHANGES, DEX_EXCHANGES } from './lib/symbols';

// ── Hooks ──
import { useSpreadState } from './hooks/useSpreadState';
import { useURLSync } from './hooks/useURLSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSpreadData } from './hooks/useSpreadData';
import { useAlertSystem } from './hooks/useAlertSystem';

// ── Components ──
import dynamic from 'next/dynamic';

const SpreadChart = dynamic(() => import('./components/Chart/SpreadChart').then(m => m.SpreadChart), { ssr: false });
import { SymbolPicker } from './components/SymbolPicker/SymbolPicker';
import { ExchangePicker } from './components/ExchangePicker/ExchangePicker';
import { TimeframeBar } from './components/Controls/TimeframeBar';
import { ViewModeToggle } from './components/Controls/ViewModeToggle';
import { AlertConfig } from './components/Controls/AlertConfig';
import { SpreadStatsBar } from './components/Stats/SpreadStatsBar';
import { ArbCalculator } from './components/Stats/ArbCalculator';
import { TickerStrip } from './components/Table/TickerStrip';
import { ExchangeTable } from './components/Table/ExchangeTable';
import { ExportActions } from './components/Toolbar/ExportActions';
import { AlertToast } from './components/Alerts/AlertToast';
import { ConnectionBanner } from './components/Alerts/ConnectionBanner';
import { StickySpreadBar } from './components/Stats/StickySpreadBar';

export default function SpreadsPage() {
  const { state, actions } = useSpreadState();

  // ── URL sync ──
  useURLSync(state.sym, state.sel, state.tf);

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts({
    onTimeframe: actions.setTimeframe,
    onToggleSymPicker: actions.toggleSymPicker,
    onCloseAll: actions.closeAllPickers,
    onToggleCalc: actions.toggleCalc,
    onToggleWs: actions.toggleWs,
  });

  // ── Close dropdowns on outside click ──
  const { closeSymPicker, closeExPicker } = actions;
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (state.showSymPicker && !t.closest('[data-sym-picker]')) closeSymPicker();
      if (state.showExPicker && !t.closest('[data-ex-picker]')) closeExPicker();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [state.showSymPicker, state.showExPicker, closeSymPicker, closeExPicker]);

  // ── Data orchestration ──
  const {
    wsPrices, wsCount, wsSpread, wsHistory, wsStatus,
    data, exs, available, stats,
  } = useSpreadData({
    sym: state.sym,
    sel: state.sel,
    tf: state.tf,
    wsEnabled: state.wsEnabled,
    klineData: state.klineData,
    onSetKlineData: actions.setKlineData,
    onMergeKlineData: actions.mergeKlineData,
    onSetChartLoading: actions.setChartLoading,
    onSetDynamicSymbols: actions.setDynamicSymbols,
  });

  // ── Auto-select available exchanges when current selection has no data ──
  useEffect(() => {
    if (
      !state.chartLoading &&
      data.length === 0 &&
      available && available.length > 0 &&
      state.tf !== 'live' &&
      exs.length === 0
    ) {
      // Auto-switch to top 5 available exchanges after a short delay
      const timer = setTimeout(() => {
        actions.setExchanges(available.slice(0, 5));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data.length, available, state.chartLoading, state.tf, exs.length, actions]);

  // ── Alert system ──
  useAlertSystem({
    wsSpread,
    alertActive: state.alertActive,
    alertThreshold: state.alertThreshold,
    sym: state.sym,
    lastAlert: state.lastAlert,
    onAlert: actions.setLastAlert,
    onToast: actions.setToast,
  });

  // ── Spread hint (lines overlap in $ mode) ──
  const showOverlapHint = state.viewMode === 'price' && stats && stats.pct < 0.05 && exs.length >= 2;

  return (
    <div className="text-white flex flex-col w-full">
      <div id="main-content" className="flex-1 w-full px-4 sm:px-6 py-5 relative">
        <FeatureHint page="/spreads" />

        {/* Toast */}
        {state.toast && <AlertToast message={state.toast} onDismiss={() => actions.setToast(null)} />}

        {/* Connection status banner */}
        {state.wsEnabled && <ConnectionBanner status={wsStatus} wsCount={wsCount} selCount={state.sel.length} />}

        {/* Hero — same vocabulary as the rest of the workflow pages. */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-hub-yellow/20 to-hub-yellow/[0.04] border border-hub-yellow/20 flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-hub-yellow" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">Scanner</span>
            </div>
            <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white leading-[1.05]">
              Exchange <span className="text-hub-yellow">spreads</span>
            </h1>
            <p className="text-[13px] text-neutral-400 mt-2 max-w-xl leading-relaxed">
              Cross-exchange price comparison across{' '}
              <span className="text-white font-medium">{ALL_EXCHANGES.length} venues</span>
              <span className="text-neutral-600"> · {CEX_EXCHANGES.length} CEX + {DEX_EXCHANGES.length} DEX</span>.
              WebSocket-driven live updates when streaming, REST fallback when paused.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {state.chartLoading && (
              <span className="flex items-center gap-1.5 text-xs text-neutral-600"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading...</span>
            )}
            {/* WS status — most important, shown first */}
            <button onClick={actions.toggleWs}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition ${
                state.wsEnabled && wsStatus === 'connected'
                  ? 'bg-green-500/[0.08] border-green-500/20 text-green-400 hover:bg-green-500/[0.12]'
                  : state.wsEnabled && wsStatus === 'degraded'
                  ? 'bg-yellow-500/[0.08] border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/[0.12]'
                  : state.wsEnabled && wsStatus === 'disconnected'
                  ? 'bg-red-500/[0.08] border-red-500/20 text-red-400 hover:bg-red-500/[0.12]'
                  : 'bg-white/[0.04] border-white/[0.08] text-neutral-500 hover:text-white'
              }`}>
              {state.wsEnabled && wsStatus !== 'disconnected' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {state.wsEnabled ? <><span className="tabular-nums">{wsCount}/{state.sel.length}</span> {wsStatus === 'connected' ? 'Live' : wsStatus === 'degraded' ? 'Polling' : 'Offline'}</> : 'Paused'}
            </button>
            <div className="w-px h-5 bg-white/[0.06]" />
            <button onClick={actions.toggleCalc}
              className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                state.showCalc
                  ? 'bg-hub-yellow/10 border-hub-yellow/20 text-hub-yellow'
                  : 'bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.15]'
              }`}>
              <Calculator className="w-3.5 h-3.5" /> Arb
            </button>
            <ExportActions data={data} exchanges={exs} symbol={state.sym} stats={stats} tf={state.tf} />
            <AlertConfig
              active={state.alertActive}
              threshold={state.alertThreshold}
              onToggle={actions.toggleAlert}
              onThresholdChange={actions.setAlertThreshold}
            />
          </div>
        </header>

        {/* Arb Calculator (collapsible) */}
        {state.showCalc && (
          <ArbCalculator
            stats={stats}
            calcAmt={state.calcAmt}
            calcFee={state.calcFee}
            calcMode={state.calcMode}
            onAmtChange={actions.setCalcAmt}
            onFeeChange={actions.setCalcFee}
            onModeChange={actions.setCalcMode}
            onClose={actions.toggleCalc}
          />
        )}

        {/* ── Controls ── */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Symbol Picker */}
          <div className="relative" data-sym-picker>
            <button onClick={actions.toggleSymPicker} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-hub-yellow/30 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getCoinIcon(state.sym)} alt={`${state.sym} icon`} className="w-5 h-5 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-lg font-bold">{state.sym}</span>
              <span className="text-neutral-500 text-sm"> Perp</span>
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            </button>
            {state.showSymPicker && (
              <SymbolPicker
                current={state.sym}
                query={state.symQuery}
                dynamicSymbols={state.dynamicSymbols}
                onSelect={actions.setSymbol}
                onQueryChange={actions.setSymQuery}
                onClose={actions.closeSymPicker}
              />
            )}
          </div>

          {/* Timeframe */}
          <TimeframeBar current={state.tf} onChange={actions.setTimeframe} />
        </div>

        {/* Exchange Pills */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          {state.sel.map(e => {
            const hasChart = state.klineData ? !!state.klineData[e] : false;
            const isInChart = exs.includes(e);
            return (
              <span key={e} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${
                isInChart ? 'bg-white/[0.06] border-white/[0.1]' : 'bg-white/[0.02] border-white/[0.04] opacity-60'
              }`}>
                <ExchangeLogo exchange={e} size={14} />
                {e}
                {state.tf !== 'live' && !hasChart && <span className="w-1.5 h-1.5 rounded-full bg-neutral-700 shrink-0" title="No chart data — table only" />}
                <button
                  onClick={() => actions.toggleExchange(e)}
                  aria-label={`Remove ${e} from comparison`}
                  className="text-neutral-600 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <div className="relative" data-ex-picker>
            <button onClick={actions.toggleExPicker} className="px-2.5 py-1 rounded-full text-[11px] text-neutral-500 bg-white/[0.03] border border-white/[0.06] hover:border-hub-yellow/30 transition">
              + Exchange
            </button>
            {state.showExPicker && (
              <ExchangePicker
                selected={state.sel}
                klineData={state.klineData}
                tf={state.tf}
                onToggle={actions.toggleExchange}
                onSetExchanges={actions.setExchanges}
              />
            )}
          </div>
        </div>

        {/* ── Sticky Summary Bar (appears on scroll) ── */}
        {stats && (
          <StickySpreadBar
            stats={stats}
            sym={state.sym}
            tf={state.tf}
            wsPrices={wsPrices}
            wsCount={wsCount}
            selCount={state.sel.length}
            status={wsStatus}
          />
        )}

        {/* ── Stats Cards ── */}
        {stats && (
          <SpreadStatsBar
            stats={stats}
            tf={state.tf}
            exs={exs}
            wsPrices={wsPrices}
            sel={state.sel}
          />
        )}

        {/* ── Bloomberg Ticker Strip ── */}
        {stats && (
          <TickerStrip
            stats={stats}
            exs={exs}
            wsPrices={wsPrices}
            wsSpread={wsSpread}
            wsCount={wsCount}
            sym={state.sym}
          />
        )}

        {/* ── Price Chart ── */}
        <div className="rounded-2xl bg-[#0c0e14] border border-white/[0.06] p-4 sm:p-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getCoinIcon(state.sym)} alt={`${state.sym} icon`} className="w-6 h-6 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <h2 className="text-sm font-semibold">{state.sym} Perp Price by Exchange</h2>
                <p className="text-[11px] text-neutral-500">
                  {state.tf === 'live'
                    ? `Live prices · ${wsHistory.length} snapshots · updates every 1s`
                    : `${data.length} data points · ${state.tf === '1d' ? '1h' : '4h'} resolution · ${exs.length} venues`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-start sm:justify-end">
              <ViewModeToggle
                current={state.viewMode}
                onChange={actions.setViewMode}
                showHint={!!showOverlapHint}
                onHintClick={() => actions.setViewMode('pct')}
              />
              {exs.map((e, i) => (
                <span key={e} className="flex items-center gap-1 text-[10px]" title={e}>
                  <span className="w-3 h-[2px] rounded-full" style={{ background: getExchangeColor(e, i) }} />
                  <ExchangeLogo exchange={e} size={12} />
                  <span className="text-neutral-400 hidden sm:inline">{e}</span>
                </span>
              ))}
            </div>
          </div>

          {state.chartLoading ? (
            <div className="h-[420px] flex flex-col gap-3 p-4">
              <div className="flex gap-4 mb-2">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-3 rounded bg-white/[0.03] animate-pulse" style={{ width: 60 + i * 10 }} />)}
              </div>
              <div className="flex-1 rounded-lg bg-white/[0.02] animate-pulse" />
              <div className="flex justify-between">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-2 w-12 rounded bg-white/[0.03] animate-pulse" />)}
              </div>
            </div>
          ) : data.length > 0 ? (
            <SpreadChart
              data={data}
              exchanges={exs}
              viewMode={state.viewMode}
              height={420}
            />
          ) : (
            <div className="h-[420px] flex flex-col items-center justify-center text-neutral-600">
              <Activity className="w-8 h-8 mb-2 text-neutral-700" />
              {state.tf === 'live' ? (
                <>
                  <p className="text-sm text-neutral-400">Loading live prices...</p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    {wsCount > 0 ? `${wsCount} exchanges reporting. Chart builds every 1.5 seconds.` : 'Connecting to exchanges...'}
                  </p>
                  {wsHistory.length > 0 && <p className="text-[10px] text-neutral-600 mt-1">{wsHistory.length} snapshot{wsHistory.length !== 1 ? 's' : ''} collected, need 2+ to render</p>}
                  {wsCount === 0 && (
                    <div className="mt-3 flex gap-1">
                      {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />)}
                    </div>
                  )}
                </>
              ) : available && available.length > 0 ? (
                <>
                  <p className="text-sm text-neutral-400">Selected exchanges don&apos;t list {state.sym}</p>
                  <p className="text-[10px] text-neutral-500 mt-2">Available on: {available.join(', ')}</p>
                  <button onClick={() => actions.setExchanges(available.slice(0, 5))}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20 text-hub-yellow text-xs hover:bg-hub-yellow/20 transition">
                    Switch to available exchanges
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-neutral-400">No chart data for {state.sym} ({state.tf.toUpperCase()})</p>
                  <p className="text-[10px] text-neutral-600 mt-1.5 max-w-xs text-center">
                    Historical kline data is limited for some exchanges. Try switching to Live mode for real-time prices.
                  </p>
                  <button onClick={() => actions.setTimeframe('live')}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20 text-hub-yellow text-xs hover:bg-hub-yellow/20 transition">
                    Switch to Live
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Exchange Table + Arb Calc ── */}
        {stats && stats.prices.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            <ExchangeTable
              sym={state.sym}
              stats={stats}
              wsPrices={wsPrices}
              klineData={state.klineData}
            />

            {/* Sidebar Arb Calculator (always visible) */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 sm:p-5">
              <ArbCalculator
                stats={stats}
                calcAmt={state.calcAmt}
                calcFee={state.calcFee}
                calcMode={state.calcMode}
                onAmtChange={actions.setCalcAmt}
                onFeeChange={actions.setCalcFee}
                onModeChange={actions.setCalcMode}
                onClose={() => {}}
                variant="sidebar"
                tf={state.tf}
                data={data}
              />
            </div>
          </div>
        )}

        {/* ── Info Footer ── */}
        <div className="px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-neutral-600" /> <span className="text-neutral-400 font-medium">Chart</span> candle close prices (5m cache)</span>
            <span><span className="text-neutral-400 font-medium">Table</span> live prices, funding, OI (15s)</span>
            <span><span className="text-neutral-400 font-medium">Spread</span> = max - min price</span>
            <span className="text-neutral-600">{exs.length} exchanges active</span>
            <span className="ml-auto text-neutral-600 hidden sm:block">
              <kbd className="px-1 py-0.5 bg-white/[0.04] rounded text-[9px]">1-4</kbd> timeframes
              {' '}<kbd className="px-1 py-0.5 bg-white/[0.04] rounded text-[9px]">/</kbd> search
              {' '}<kbd className="px-1 py-0.5 bg-white/[0.04] rounded text-[9px]">C</kbd> calc
              {' '}<kbd className="px-1 py-0.5 bg-white/[0.04] rounded text-[9px]">W</kbd> live
            </span>
          </div>
        </div>

      </div>
      <RelatedPages />
    </div>
  );
}
