// Shared selectors — prefer data-testid for stability
export const SEL = {
  // Arbitrage
  arbTable: '[data-testid="arb-table"]',
  arbRow: (symbol: string) => `[data-testid="arb-row-${symbol}"]`,
  gradeBadge: (symbol: string) => `[data-testid="grade-badge-${symbol}"]`,
  profitCalc: '[data-testid="profit-calculator"]',
  compDrawer: '[data-testid="comparison-drawer"]',

  // Spreads
  arbCalc: '[data-testid="arb-calculator"]',
  spreadChart: '[data-testid="spread-chart"]',
  exchangeTable: '[data-testid="exchange-table"]',
  symbolPicker: '[data-testid="symbol-picker"]',

  // Dashboard
  dashGrid: '[data-testid="dashboard-grid"]',
  widgetArb: '[data-testid="widget-arbitrage"]',

  // Generic
  loading: '[data-testid="loading"]',
  staleIndicator: '[data-testid="stale-indicator"]',
} as const;
