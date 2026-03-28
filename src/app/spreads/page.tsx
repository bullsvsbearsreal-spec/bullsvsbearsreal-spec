'use client';

import React, { useEffect } from 'react';
import { ArrowLeftRight, ChevronDown, RefreshCw, Calculator, Info, Wifi, WifiOff, X, Activity } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import DataFreshness from '@/components/DataFreshness';
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
import { SpreadChart } from './components/Chart/SpreadChart';
import { SymbolPicker } from './components/SymbolPicker/SymbolPicker';
import { ExchangePicker } from './components/ExchangePicker/ExchangePicker';
import { TimeframeBar } from './components/Controls/TimeframeBar';
import { ViewModeToggle } from './components/Controls/ViewModeToggle';
import { AlertConfig } from './components/Controls/AlertConfig';
import { SpreadStatsBar } from './components/Stats/SpreadStatsBar';
import { ArbCalculator } from './components/Stats/ArbCalculator';
import { TickerStrip } from './components/Table/TickerStrip';
import { ExchangeTable } from './components/Table/ExchangeTable';
import { ExportCSV } from './components/Toolbar/ExportCSV';
import { AlertToast } from './components/Alerts/AlertToast';

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
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (state.showSymPicker && !t.closest('[data-sym-picker]')) actions.closeSymPicker();
      if (state.showExPicker && !t.closest('[data-ex-picker]')) actions.closeExPicker();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [state.showSymPicker, state.showExPicker, actions]);

  // ── Data orchestration ──
  const {
    wsPrices, wsCount, wsSpread, wsHistory,
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
    <div className="min-h-screen bg-background text-white flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-6 relative">

        {/* Toast */}
        {state.toast && <AlertToast message={state.toast} onDismiss={() => actions.setToast(null)} />}

        {/* ── Title ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <ArrowLeftRight className="w-7 h-7 text-hub-yellow" />
              Exchange <span className="text-gradient">Spreads</span>
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Cross-exchange price comparison across <span className="text-neutral-400 font-medium">{ALL_EXCHANGES.length} exchanges</span> ({CEX_EXCHANGES.length} CEX + {DEX_EXCHANGES.length} DEX)
            </p>
          </div>
          <div className="flex items-center gap-3">
            {state.chartLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-neutral-600"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading...</span>
            ) : (
              <DataFreshness
                exchangeCount={exs.length}
                lastUpdated={wsHistory.length > 0 ? wsHistory[wsHistory.length - 1].t : null}
                sources={exs.slice(0, 5)}
              />
            )}
            <button onClick={actions.toggleCalc}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white transition flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Arb Calc
            </button>
            <ExportCSV data={data} exchanges={exs} symbol={state.sym} />
            {/* WS toggle */}
            <button onClick={actions.toggleWs}
              className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                state.wsEnabled && wsCount > 0
                  ? 'bg-green-500/[0.06] border-green-500/20 text-green-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-neutral-500'
              }`}>
              {state.wsEnabled ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {state.wsEnabled ? `Live ${wsCount}/${state.sel.length}` : 'Paused'}
            </button>
            <AlertConfig
              active={state.alertActive}
              threshold={state.alertThreshold}
              onToggle={actions.toggleAlert}
              onThresholdChange={actions.setAlertThreshold}
            />
          </div>
        </div>

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
                {state.tf !== 'live' && !hasChart && <span className="text-[7px] text-neutral-600 px-1 py-[0.5px] rounded bg-white/[0.03]">table</span>}
                <button onClick={() => actions.toggleExchange(e)} className="text-neutral-600 hover:text-white"><X className="w-3 h-3" /></button>
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
              />
            )}
          </div>
        </div>

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
          <div className="flex items-center justify-between mb-4">
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
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <ViewModeToggle
                current={state.viewMode}
                onChange={actions.setViewMode}
                showHint={!!showOverlapHint}
                onHintClick={() => actions.setViewMode('pct')}
              />
              {exs.map((e, i) => (
                <span key={e} className="flex items-center gap-1 text-[10px]">
                  <span className="w-3 h-[2px] rounded-full" style={{ background: getExchangeColor(e, i) }} />
                  <ExchangeLogo exchange={e} size={12} />
                  <span className="text-neutral-400">{e}</span>
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
                  <p className="text-sm">Loading live prices...</p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    {wsCount > 0 ? `${wsCount} exchanges reporting. Chart builds every 1.5 seconds.` : 'Fetching prices from exchanges...'}
                  </p>
                  {wsHistory.length > 0 && <p className="text-[10px] text-neutral-600 mt-1">{wsHistory.length} snapshots collected, need 2+ to render</p>}
                </>
              ) : available && available.length > 0 ? (
                <>
                  <p className="text-sm">Selected exchanges don&apos;t list {state.sym}</p>
                  <p className="text-[10px] text-neutral-500 mt-2">Available on: {available.join(', ')}</p>
                  <button onClick={() => actions.setExchanges(available.slice(0, 5))}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20 text-hub-yellow text-xs hover:bg-hub-yellow/20 transition">
                    Switch to available exchanges
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm">No price data for {state.sym}</p>
                  <p className="text-[10px] text-neutral-700 mt-1">Try a different symbol or timeframe</p>
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
              />
            </div>
          </div>
        )}

        {/* ── Info Footer ── */}
        <div className="p-4 rounded-2xl bg-hub-yellow/5 border border-hub-yellow/10 border-l-2 border-l-hub-yellow/40">
          <p className="text-neutral-300 text-xs leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
            <span>
              <span className="text-hub-yellow font-medium">Chart</span>: historical candle close prices from exchange APIs (5-min cache).{' '}
              <span className="text-hub-yellow font-medium">Table</span>: live prices, bid/ask, funding rates, OI, and volume from /api/tickers, /api/funding, /api/openinterest (15s refresh).{' '}
              <span className="text-hub-yellow font-medium">Spread</span> = highest minus lowest price across selected exchanges.{' '}
              Chart data from: {exs.length > 0 ? exs.join(', ') : 'no exchanges selected'}.{' '}
              <span className="text-neutral-500">Keyboard: 1-4 timeframes · / search · C calc · W live toggle · Esc close</span>
            </span>
          </p>
        </div>

      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}
