/**
 * OpenAPI 3.1 specification for the public InfoHub v1 API.
 *
 * Hand-maintained because:
 *   1. Next.js App Router doesn't expose a route-discovery API
 *   2. Auto-generation tools require decorators we'd rather not adopt
 *   3. The set of v1 routes is stable and small (<25)
 *
 * Update this file whenever you ship a new /api/v1/<name> route.
 *
 * Served by /api/v1/openapi (JSON) and rendered as docs at /api-docs.
 */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'InfoHub Derivatives API',
    version: '1.0.0',
    description: [
      'Real-time derivatives market data: funding rates, open interest,',
      'liquidations, options, longshort ratios, whales, and CME basis.',
      'Authenticate every request with `Authorization: Bearer ih_xxx`',
      'where `ih_xxx` is your API key from /api/v1/keys.',
    ].join(' '),
    contact: {
      name: 'InfoHub Support',
      url: 'https://info-hub.io',
      email: 'support@info-hub.io',
    },
    license: {
      name: 'Proprietary — see Terms of Service',
      url: 'https://info-hub.io/terms',
    },
  },
  servers: [
    { url: 'https://info-hub.io/api/v1', description: 'Production' },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key (ih_...)',
        description: 'API key prefixed with `ih_`. Obtain one from /account/api-keys.',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: { type: 'array', items: {} },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'integer', description: 'Unix milliseconds' },
            },
            additionalProperties: true,
          },
          error: { type: 'string', description: 'Present only when success=false' },
        },
      },
      FundingRow: {
        type: 'object',
        properties: {
          symbol: { type: 'string', example: 'BTC' },
          exchange: { type: 'string', example: 'Binance' },
          fundingRate: { type: 'number', description: 'Percent per native interval' },
          fundingInterval: { type: 'string', enum: ['1h', '4h', '8h'] },
          markPrice: { type: 'number' },
          type: { type: 'string', enum: ['cex', 'dex'] },
        },
      },
      LiquidationRow: {
        type: 'object',
        properties: {
          symbol: { type: 'string', example: 'BTC' },
          exchange: { type: 'string', example: 'binance' },
          side: { type: 'string', enum: ['long', 'short'] },
          price: { type: 'number' },
          quantity: { type: 'number' },
          valueUsd: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      WhaleTrade: {
        type: 'object',
        properties: {
          address: { type: 'string', example: '0x1234...' },
          chain: { type: 'string', enum: ['ethereum', 'bsc', 'arbitrum', 'base', 'polygon', 'optimism', 'solana'] },
          txHash: { type: 'string' },
          dex: { type: 'string', example: 'Uniswap V3' },
          action: { type: 'string', enum: ['buy', 'sell', 'swap'] },
          tokenInSymbol: { type: 'string' },
          amountIn: { type: 'number' },
          tokenOutSymbol: { type: 'string' },
          amountOut: { type: 'number' },
          valueUsd: { type: 'number' },
          blockTime: { type: 'string', format: 'date-time' },
        },
      },
      BasisRow: {
        type: 'object',
        properties: {
          asset: { type: 'string', enum: ['BTC', 'ETH'] },
          spot: { type: 'number' },
          cmeFront: { type: 'number' },
          daysToExpiry: { type: 'integer' },
          basisPct: { type: 'number', description: 'Raw basis (cme - spot) / spot' },
          annualizedPct: { type: 'number', description: 'basisPct × (365 / daysToExpiry)' },
        },
      },
      FundingArbOpportunity: {
        type: 'object',
        properties: {
          symbol: { type: 'string', example: 'BTC' },
          venueCount: { type: 'integer' },
          spread8h: { type: 'number', description: 'Max - min funding rate normalised to 8h' },
          annualized: { type: 'number', description: 'spread8h × 3 × 365' },
          min: { $ref: '#/components/schemas/VenueQuote' },
          max: { $ref: '#/components/schemas/VenueQuote' },
          venues: { type: 'array', items: { $ref: '#/components/schemas/VenueQuote' } },
          dexOnOneSide: { type: 'boolean' },
        },
      },
      VenueQuote: {
        type: 'object',
        properties: {
          exchange: { type: 'string' },
          rate: { type: 'number', description: 'Per-interval percent' },
          rate8h: { type: 'number', description: '8h-normalised percent' },
          interval: { type: 'string', enum: ['1h', '4h', '8h'] },
          markPrice: { type: 'number', nullable: true },
          type: { type: 'string', enum: ['cex', 'dex'] },
        },
      },
    },
  },
  paths: {
    '/funding': {
      get: {
        summary: 'Current funding rates across exchanges',
        description: 'Returns the latest funding rate for every (symbol, exchange) pair we ingest. Filter by symbol or exchange.',
        parameters: [
          { name: 'symbol', in: 'query', schema: { type: 'string' }, example: 'BTC', description: 'Filter to one symbol' },
          { name: 'exchange', in: 'query', schema: { type: 'string' }, example: 'binance', description: 'Filter to one exchange' },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          401: { description: 'Missing or invalid API key' },
          429: { description: 'Rate limit exceeded' },
        },
      },
    },
    '/funding/history': {
      get: {
        summary: 'Funding rate history',
        description: 'Returns time-series funding rate snapshots for a (symbol, exchange) pair.',
        parameters: [
          { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, example: 'BTC' },
          { name: 'exchange', in: 'query', required: true, schema: { type: 'string' }, example: 'binance' },
          { name: 'hours', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 720, default: 24 } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/funding-arb': {
      get: {
        summary: 'Cross-exchange funding-rate arbitrage scanner',
        description: 'Finds symbols where one venue\'s funding rate is materially different from another. Long the cheap leg, short the expensive leg.',
        parameters: [
          { name: 'min_venues', in: 'query', schema: { type: 'integer', minimum: 2, maximum: 40, default: 3 } },
          { name: 'min_spread', in: 'query', schema: { type: 'number', default: 0.01 }, description: '% per 8h' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['annualized', 'spread', 'venues'], default: 'annualized' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
        ],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/FundingArbOpportunity' } } } } } } } },
      },
    },
    '/openinterest': {
      get: {
        summary: 'Aggregated open interest per symbol',
        parameters: [
          { name: 'symbol', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 500, default: 100 } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/liquidations': {
      get: {
        summary: 'Recent liquidation feed',
        description: 'Returns liquidation events from the last N hours, optionally filtered by symbol/exchange/side.',
        parameters: [
          { name: 'symbol', in: 'query', schema: { type: 'string' } },
          { name: 'exchange', in: 'query', schema: { type: 'string' } },
          { name: 'side', in: 'query', schema: { type: 'string', enum: ['long', 'short'] } },
          { name: 'hours', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 24, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
        ],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/LiquidationRow' } } } } } } } },
      },
    },
    '/longshort': {
      get: {
        summary: 'Long/short ratio per exchange',
        parameters: [
          { name: 'symbol', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/options': {
      get: {
        summary: 'Options-market metrics (OI, IV, put/call ratio)',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/spreads': {
      get: {
        summary: 'Cross-exchange spreads on top symbols',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/arbitrage': {
      get: {
        summary: 'Spot/perp arbitrage opportunities',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/tickers': {
      get: {
        summary: 'Current ticker / mark prices across exchanges',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/top-movers': {
      get: {
        summary: 'Top gainers and losers in the last 24h',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/fear-greed': {
      get: {
        summary: 'Crypto fear and greed index (0–100)',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/global-stats': {
      get: {
        summary: 'Total market cap, BTC dominance, 24h volume',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/exchanges': {
      get: {
        summary: 'List of supported exchanges + their funding intervals',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/backtest': {
      post: {
        summary: 'Run a strategy backtest (DCA or funding-rate carry)',
        description: 'Pure historical-data simulation. Returns daily portfolio-value series, max drawdown, Sharpe-ish ratio. No fees / slippage modelled.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  strategy: { type: 'string', enum: ['dca', 'funding-carry'] },
                  config: {
                    type: 'object',
                    description: 'Strategy-specific parameters. DCA: { asset, amountUsd, intervalDays, lookbackDays }. Funding-carry: { notionalUsd, lookbackDays, symbol? }.',
                  },
                },
                required: ['strategy', 'config'],
              },
            },
          },
        },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/bridge-flows': {
      get: {
        summary: 'Cross-chain bridge flow tracker (Wormhole)',
        description: 'Volume, transfers, top assets, and top corridors across every Wormhole-supported chain. Strong leading indicator for chain rotation.',
        parameters: [
          { name: 'timeSpan', in: 'query', schema: { type: 'string', enum: ['1d', '7d', '30d'], default: '7d' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/smart-money-leaderboard': {
      get: {
        summary: 'Top Hyperliquid wallets ranked by realized PnL (90d)',
        description: 'For each top wallet pulls userFillsByTime via the public HL API, sums closing-trade PnL, computes win rate, biggest win/loss, top symbols, days since last trade. Heavy first call (~5–15s) cached 30 min.',
        parameters: [
          { name: 'topN', in: 'query', schema: { type: 'integer', minimum: 5, maximum: 200, default: 50 } },
          { name: 'lookbackDays', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 180, default: 90 } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/restaking': {
      get: {
        summary: 'Restaking yield aggregator (EigenLayer + Symbiotic + Karak + LRTs)',
        description: 'Cross-protocol restaking pools with APY, TVL, reward composition. Source: DeFi Llama yields.',
        parameters: [
          { name: 'protocol', in: 'query', schema: { type: 'string' }, description: 'Filter to one protocol (eigenlayer, symbiotic, karak, babylon, renzo, etc.)' },
          { name: 'chain', in: 'query', schema: { type: 'string' }, description: 'Filter to one chain' },
          { name: 'minTvl', in: 'query', schema: { type: 'number', default: 1000000 } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['tvl', 'apy'], default: 'tvl' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/earnings-calendar': {
      get: {
        summary: 'Aggregated upcoming protocol events (unlocks, TGEs, halvings, governance)',
        description: 'One unified timeline of every upcoming crypto event that historically moves price. Source-attributed.',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['unlock', 'tge', 'halving', 'governance', 'mainnet'] }, description: 'Filter to a single event type' },
          { name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 730, default: 90 }, description: 'Only return events within N days' },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000, default: 200 } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/whale-liq': {
      get: {
        summary: 'Whale Liquidation Roulette — positions sorted by proximity to liq',
        description: 'Hyperliquid whale positions across the leaderboard sorted by closest-to-liquidation. Useful for cascade prediction and alpha generation.',
        parameters: [
          { name: 'within', in: 'query', schema: { type: 'number', minimum: 0.001, maximum: 1, default: 0.20 }, description: 'Distance-to-liq threshold (0..1). 0.05 = within 5%.' },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/whales': {
      get: {
        summary: 'Recent on-chain DEX whale trades',
        description: 'Wallet-mode (?address=...) returns trades for one wallet; global mode returns recent whale trades across every tracked wallet.',
        parameters: [
          { name: 'address', in: 'query', schema: { type: 'string' }, description: 'EVM 0x... or Solana base58' },
          { name: 'chain', in: 'query', schema: { type: 'string' } },
          { name: 'minValueUsd', in: 'query', schema: { type: 'number' }, description: 'Global mode: only return trades >= this notional' },
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 200, default: 50 } },
        ],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/WhaleTrade' } } } } } } } },
      },
    },
    '/basis': {
      get: {
        summary: 'CME futures basis vs spot for BTC + ETH',
        description: 'Annualised cash-and-carry rate. Persistent positive basis = institutional risk-on.',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/BasisRow' } } } } } } } },
      },
    },
    '/status': {
      get: {
        summary: 'API health + rate-limit headers',
        responses: { 200: { description: 'OK' } },
      },
    },
  },
} as const;
