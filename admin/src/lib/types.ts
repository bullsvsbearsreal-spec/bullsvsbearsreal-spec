export interface ExchangeHealth {
  name: string;
  status: 'ok' | 'error' | 'empty';
  count: number;
  latencyMs: number;
  error?: string;
}

export interface RouteHealth {
  health: ExchangeHealth[];
  cache: string;
  meta: {
    totalExchanges: number;
    activeExchanges: number;
    totalEntries: number;
    timestamp: number;
  };
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: number;
  routes: {
    funding: RouteHealth;
    openinterest: RouteHealth;
    tickers: RouteHealth;
  };
  errors: Array<{
    exchange: string;
    route: string;
    error: string;
    latencyMs: number;
  }>;
}
