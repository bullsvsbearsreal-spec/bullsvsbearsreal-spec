'use client';

import { useReducer, useCallback } from 'react';
import type { TfKey, ViewMode, SpreadUnit, Candle } from '../lib/types';
import { ALL_EXCHANGES, DEFAULT_SELECTED } from '../lib/symbols';

// ─── State ────────────────────────────────────────────────────────────────────

export interface SpreadState {
  sym: string;
  sel: string[];
  tf: TfKey;
  viewMode: ViewMode;
  spreadUnit: SpreadUnit;
  // UI toggles
  showSymPicker: boolean;
  showExPicker: boolean;
  showCalc: boolean;
  symQuery: string;
  // WS
  wsEnabled: boolean;
  // Alert
  alertActive: boolean;
  alertThreshold: string;
  lastAlert: string | null;
  toast: string | null;
  // Calc
  calcAmt: string;
  calcFee: string;
  calcMode: 'usd' | 'coin';
  // Data loading
  chartLoading: boolean;
  klineData: Record<string, Candle[]> | null;
  dynamicSymbols: string[];
}

function getInitialState(): SpreadState {
  let sym = 'BTC';
  let sel = DEFAULT_SELECTED;
  let tf: TfKey = 'live';

  if (typeof window !== 'undefined') {
    const p = new URLSearchParams(window.location.search);
    sym = p.get('s') || 'BTC';
    const exParam = p.get('ex');
    if (exParam) {
      sel = exParam.split(',').filter(e => e && ALL_EXCHANGES.includes(e));
      if (sel.length === 0) sel = DEFAULT_SELECTED;
    }
    tf = (p.get('tf') || 'live') as TfKey;
  }

  return {
    sym,
    sel,
    tf,
    viewMode: 'price',
    spreadUnit: 'usd',
    showSymPicker: false,
    showExPicker: false,
    showCalc: false,
    symQuery: '',
    wsEnabled: true,
    alertActive: false,
    alertThreshold: '',
    lastAlert: null,
    toast: null,
    calcAmt: '10000',
    calcFee: '0.1',
    calcMode: 'usd',
    chartLoading: false,
    klineData: null,
    dynamicSymbols: [],
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_SYMBOL'; sym: string }
  | { type: 'SET_TIMEFRAME'; tf: TfKey }
  | { type: 'TOGGLE_EXCHANGE'; exchange: string }
  | { type: 'SET_EXCHANGES'; exchanges: string[] }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'SET_SPREAD_UNIT'; unit: SpreadUnit }
  | { type: 'TOGGLE_SYM_PICKER' }
  | { type: 'CLOSE_SYM_PICKER' }
  | { type: 'TOGGLE_EX_PICKER' }
  | { type: 'CLOSE_EX_PICKER' }
  | { type: 'CLOSE_ALL_PICKERS' }
  | { type: 'SET_SYM_QUERY'; query: string }
  | { type: 'TOGGLE_WS' }
  | { type: 'TOGGLE_ALERT' }
  | { type: 'SET_ALERT_THRESHOLD'; threshold: string }
  | { type: 'SET_LAST_ALERT'; msg: string }
  | { type: 'SET_TOAST'; msg: string | null }
  | { type: 'TOGGLE_CALC' }
  | { type: 'SET_CALC_AMT'; amt: string }
  | { type: 'SET_CALC_FEE'; fee: string }
  | { type: 'SET_CALC_MODE'; mode: 'usd' | 'coin' }
  | { type: 'SET_CHART_LOADING'; loading: boolean }
  | { type: 'SET_KLINE_DATA'; data: Record<string, Candle[]> | null }
  | { type: 'MERGE_KLINE_DATA'; data: Record<string, Candle[]> }
  | { type: 'SET_DYNAMIC_SYMBOLS'; symbols: string[] };

function reducer(state: SpreadState, action: Action): SpreadState {
  switch (action.type) {
    case 'SET_SYMBOL':
      return { ...state, sym: action.sym, showSymPicker: false, symQuery: '', klineData: null };
    case 'SET_TIMEFRAME':
      return { ...state, tf: action.tf };
    case 'TOGGLE_EXCHANGE': {
      const sel = state.sel.includes(action.exchange)
        ? state.sel.filter(e => e !== action.exchange)
        : [...state.sel, action.exchange];
      return { ...state, sel };
    }
    case 'SET_EXCHANGES':
      return { ...state, sel: action.exchanges };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'SET_SPREAD_UNIT':
      return { ...state, spreadUnit: action.unit };
    case 'TOGGLE_SYM_PICKER':
      return { ...state, showSymPicker: !state.showSymPicker, showExPicker: false };
    case 'CLOSE_SYM_PICKER':
      return { ...state, showSymPicker: false, symQuery: '' };
    case 'TOGGLE_EX_PICKER':
      return { ...state, showExPicker: !state.showExPicker, showSymPicker: false };
    case 'CLOSE_EX_PICKER':
      return { ...state, showExPicker: false };
    case 'CLOSE_ALL_PICKERS':
      return { ...state, showSymPicker: false, showExPicker: false, symQuery: '' };
    case 'SET_SYM_QUERY':
      return { ...state, symQuery: action.query };
    case 'TOGGLE_WS':
      return { ...state, wsEnabled: !state.wsEnabled };
    case 'TOGGLE_ALERT':
      return { ...state, alertActive: !state.alertActive };
    case 'SET_ALERT_THRESHOLD':
      return { ...state, alertThreshold: action.threshold };
    case 'SET_LAST_ALERT':
      return { ...state, lastAlert: action.msg };
    case 'SET_TOAST':
      return { ...state, toast: action.msg };
    case 'TOGGLE_CALC':
      return { ...state, showCalc: !state.showCalc };
    case 'SET_CALC_AMT':
      return { ...state, calcAmt: action.amt };
    case 'SET_CALC_FEE':
      return { ...state, calcFee: action.fee };
    case 'SET_CALC_MODE':
      return { ...state, calcMode: action.mode };
    case 'SET_CHART_LOADING':
      return { ...state, chartLoading: action.loading };
    case 'SET_KLINE_DATA':
      return { ...state, klineData: action.data };
    case 'MERGE_KLINE_DATA':
      return { ...state, klineData: state.klineData ? { ...state.klineData, ...action.data } : action.data };
    case 'SET_DYNAMIC_SYMBOLS':
      return { ...state, dynamicSymbols: action.symbols };
    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpreadState() {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  const actions = {
    setSymbol: useCallback((sym: string) => dispatch({ type: 'SET_SYMBOL', sym }), []),
    setTimeframe: useCallback((tf: TfKey) => dispatch({ type: 'SET_TIMEFRAME', tf }), []),
    toggleExchange: useCallback((exchange: string) => dispatch({ type: 'TOGGLE_EXCHANGE', exchange }), []),
    setExchanges: useCallback((exchanges: string[]) => dispatch({ type: 'SET_EXCHANGES', exchanges }), []),
    setViewMode: useCallback((mode: ViewMode) => dispatch({ type: 'SET_VIEW_MODE', mode }), []),
    setSpreadUnit: useCallback((unit: SpreadUnit) => dispatch({ type: 'SET_SPREAD_UNIT', unit }), []),
    toggleSymPicker: useCallback(() => dispatch({ type: 'TOGGLE_SYM_PICKER' }), []),
    closeSymPicker: useCallback(() => dispatch({ type: 'CLOSE_SYM_PICKER' }), []),
    toggleExPicker: useCallback(() => dispatch({ type: 'TOGGLE_EX_PICKER' }), []),
    closeExPicker: useCallback(() => dispatch({ type: 'CLOSE_EX_PICKER' }), []),
    closeAllPickers: useCallback(() => dispatch({ type: 'CLOSE_ALL_PICKERS' }), []),
    setSymQuery: useCallback((query: string) => dispatch({ type: 'SET_SYM_QUERY', query }), []),
    toggleWs: useCallback(() => dispatch({ type: 'TOGGLE_WS' }), []),
    toggleAlert: useCallback(() => dispatch({ type: 'TOGGLE_ALERT' }), []),
    setAlertThreshold: useCallback((threshold: string) => dispatch({ type: 'SET_ALERT_THRESHOLD', threshold }), []),
    setLastAlert: useCallback((msg: string) => dispatch({ type: 'SET_LAST_ALERT', msg }), []),
    setToast: useCallback((msg: string | null) => dispatch({ type: 'SET_TOAST', msg }), []),
    toggleCalc: useCallback(() => dispatch({ type: 'TOGGLE_CALC' }), []),
    setCalcAmt: useCallback((amt: string) => dispatch({ type: 'SET_CALC_AMT', amt }), []),
    setCalcFee: useCallback((fee: string) => dispatch({ type: 'SET_CALC_FEE', fee }), []),
    setCalcMode: useCallback((mode: 'usd' | 'coin') => dispatch({ type: 'SET_CALC_MODE', mode }), []),
    setChartLoading: useCallback((loading: boolean) => dispatch({ type: 'SET_CHART_LOADING', loading }), []),
    setKlineData: useCallback((data: Record<string, Candle[]> | null) => dispatch({ type: 'SET_KLINE_DATA', data }), []),
    mergeKlineData: useCallback((data: Record<string, Candle[]>) => dispatch({ type: 'MERGE_KLINE_DATA', data }), []),
    setDynamicSymbols: useCallback((symbols: string[]) => dispatch({ type: 'SET_DYNAMIC_SYMBOLS', symbols }), []),
  };

  return { state, actions, dispatch };
}

export type SpreadActions = ReturnType<typeof useSpreadState>['actions'];
