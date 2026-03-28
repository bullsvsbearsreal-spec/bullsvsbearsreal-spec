'use client';

import { createContext, useContext, useReducer, useCallback, useEffect, useRef, type ReactNode } from 'react';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface DashboardState {
  globalSymbol: string;
  globalTimeframe: number; // minutes: 60, 240, 1440, 10080
  lockedWidgets: Set<string>;
  widgetOverrides: Record<string, { symbol?: string; timeframe?: number }>;
}

export type DashboardAction =
  | { type: 'SET_SYMBOL'; symbol: string }
  | { type: 'SET_TIMEFRAME'; tf: number }
  | { type: 'LOCK_WIDGET'; widgetId: string; symbol?: string; timeframe?: number }
  | { type: 'UNLOCK_WIDGET'; widgetId: string }
  | { type: 'RESTORE'; partial: Partial<Pick<DashboardState, 'globalSymbol' | 'globalTimeframe'>> & { lockedWidgets?: string[] } };

export interface DashboardContextValue {
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
  /** Resolved symbol for a widget — respects lock/override */
  getWidgetSymbol: (widgetId: string) => string;
  /** Resolved timeframe for a widget — respects lock/override */
  getWidgetTimeframe: (widgetId: string) => number;
  /** Whether a widget is locked to its own symbol */
  isWidgetLocked: (widgetId: string) => boolean;
}

/* ─── Reducer ────────────────────────────────────────────────────────── */

const initialState: DashboardState = {
  globalSymbol: 'BTC',
  globalTimeframe: 60,
  lockedWidgets: new Set(),
  widgetOverrides: {},
};

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_SYMBOL':
      return { ...state, globalSymbol: action.symbol };
    case 'SET_TIMEFRAME':
      return { ...state, globalTimeframe: action.tf };
    case 'LOCK_WIDGET': {
      const next = new Set(state.lockedWidgets);
      next.add(action.widgetId);
      return {
        ...state,
        lockedWidgets: next,
        widgetOverrides: {
          ...state.widgetOverrides,
          [action.widgetId]: {
            symbol: action.symbol ?? state.globalSymbol,
            timeframe: action.timeframe ?? state.globalTimeframe,
          },
        },
      };
    }
    case 'UNLOCK_WIDGET': {
      const next = new Set(state.lockedWidgets);
      next.delete(action.widgetId);
      const overrides = { ...state.widgetOverrides };
      delete overrides[action.widgetId];
      return { ...state, lockedWidgets: next, widgetOverrides: overrides };
    }
    case 'RESTORE': {
      return {
        ...state,
        globalSymbol: action.partial.globalSymbol ?? state.globalSymbol,
        globalTimeframe: action.partial.globalTimeframe ?? state.globalTimeframe,
        lockedWidgets: action.partial.lockedWidgets
          ? new Set(action.partial.lockedWidgets)
          : state.lockedWidgets,
      };
    }
    default:
      return state;
  }
}

/* ─── Context ────────────────────────────────────────────────────────── */

const DashboardCtx = createContext<DashboardContextValue | null>(null);

const SYNC_STORAGE_KEY = 'infohub-dashboard-sync';

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const initialized = useRef(false);

  // Restore from localStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const stored = localStorage.getItem(SYNC_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        dispatch({
          type: 'RESTORE',
          partial: {
            globalSymbol: parsed.globalSymbol,
            globalTimeframe: parsed.globalTimeframe,
            lockedWidgets: parsed.lockedWidgets,
          },
        });
      }
    } catch {}
  }, []);

  // Persist to localStorage on change (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          SYNC_STORAGE_KEY,
          JSON.stringify({
            globalSymbol: state.globalSymbol,
            globalTimeframe: state.globalTimeframe,
            lockedWidgets: Array.from(state.lockedWidgets),
          }),
        );
      } catch {}
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state.globalSymbol, state.globalTimeframe, state.lockedWidgets]);

  const getWidgetSymbol = useCallback(
    (widgetId: string) => {
      if (state.lockedWidgets.has(widgetId)) {
        return state.widgetOverrides[widgetId]?.symbol ?? state.globalSymbol;
      }
      return state.globalSymbol;
    },
    [state.globalSymbol, state.lockedWidgets, state.widgetOverrides],
  );

  const getWidgetTimeframe = useCallback(
    (widgetId: string) => {
      if (state.lockedWidgets.has(widgetId)) {
        return state.widgetOverrides[widgetId]?.timeframe ?? state.globalTimeframe;
      }
      return state.globalTimeframe;
    },
    [state.globalTimeframe, state.lockedWidgets, state.widgetOverrides],
  );

  const isWidgetLocked = useCallback(
    (widgetId: string) => state.lockedWidgets.has(widgetId),
    [state.lockedWidgets],
  );

  return (
    <DashboardCtx.Provider value={{ state, dispatch, getWidgetSymbol, getWidgetTimeframe, isWidgetLocked }}>
      {children}
    </DashboardCtx.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}

/** Safe version that returns null outside of DashboardProvider (for widgets used outside dashboard) */
export function useDashboardOptional() {
  return useContext(DashboardCtx);
}
