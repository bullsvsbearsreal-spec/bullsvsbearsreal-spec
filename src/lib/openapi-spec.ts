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
        // Was: only documented {symbol, exchange, fundingRate, fundingInterval,
        // markPrice, type}. The actual /api/v1/funding response uses `rate`
        // (not fundingRate), and includes rate8h, predictedRate, indexPrice,
        // nextFundingTime, and assetClass. Partners codegenning types from
        // this spec (openapi-typescript) had a broken contract.
        properties: {
          symbol: { type: 'string', example: 'BTC' },
          exchange: { type: 'string', example: 'Binance' },
          rate: { type: 'number', description: 'Percent per native funding interval' },
          rate8h: { type: 'number', description: '8h-normalised percent (rate × 8 / 2 / 1 for 1h / 4h / 8h venues)' },
          predictedRate: {
            type: 'number',
            nullable: true,
            description: 'Predicted next-window rate as percent. Binance USDT-M / COIN-M / Bybit / Bitget derive via clamp((mark-index)/index, ±0.05%) + 0.01%. OKX uses its native nextFundingRate. Other venues null.',
          },
          markPrice: { type: 'number', nullable: true },
          indexPrice: { type: 'number', nullable: true },
          fundingInterval: { type: 'string', enum: ['1h', '4h', '8h'] },
          nextFundingTime: { type: 'integer', nullable: true, description: 'ms-epoch of next settlement' },
          type: { type: 'string', enum: ['cex', 'dex'] },
          assetClass: { type: 'string', enum: ['crypto', 'stocks', 'forex', 'commodities'] },
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
      ArbitrageResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/ArbitrageOpportunity' } },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'integer', description: 'Unix ms' },
              totalPairs: { type: 'integer', description: 'Unfiltered count' },
              filtered: { type: 'integer', description: 'Count returned after filters' },
              grades: {
                type: 'object',
                properties: {
                  A: { type: 'integer' }, B: { type: 'integer' },
                  C: { type: 'integer' }, D: { type: 'integer' },
                },
              },
              feeModel: { $ref: '#/components/schemas/FeeModel' },
            },
          },
        },
      },
      ArbitrageOpportunity: {
        type: 'object',
        properties: {
          symbol: { type: 'string', example: 'BTC' },
          shortExchange: { type: 'string', example: 'Bybit' },
          longExchange: { type: 'string', example: 'Hyperliquid' },
          shortRate8h: { type: 'number', description: '8h-normalised funding on the short leg (%)' },
          longRate8h: { type: 'number', description: '8h-normalised funding on the long leg (%)' },
          grossSpread8h: { type: 'number', description: 'shortRate8h - longRate8h, before fees (%)' },
          netSpread8h: { type: 'number', description: 'grossSpread8h - roundTripFee (%)' },
          annualizedPct: { type: 'number', description: 'netSpread8h × 365 × 3 (%)' },
          dailyPnlPer10k: { type: 'number', description: 'USD/day on $10k notional, assuming netSpread8h holds' },
          fees: {
            type: 'object',
            description: 'Fee assumptions baked into netSpread8h. All values percent per trade.',
            properties: {
              roundTrip: { type: 'number', description: 'Total round-trip fee (taker × 4)' },
              shortExchangeTaker: { type: 'number', nullable: true, description: 'Taker rate on the short leg' },
              shortExchangeMaker: { type: 'number', nullable: true, description: 'Maker rate on the short leg (may be negative = rebate)' },
              longExchangeTaker:  { type: 'number', nullable: true, description: 'Taker rate on the long leg' },
              longExchangeMaker:  { type: 'number', nullable: true, description: 'Maker rate on the long leg' },
              shortExchangeFee: { type: 'number', description: 'Legacy alias for shortExchangeTaker — kept for compatibility' },
              longExchangeFee:  { type: 'number', description: 'Legacy alias for longExchangeTaker — kept for compatibility' },
            },
          },
          oi: {
            type: 'object',
            properties: {
              short: { type: 'integer' }, long: { type: 'integer' },
              total: { type: 'integer' }, minSide: { type: 'integer' },
            },
          },
          grade: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          stability: { type: 'string', enum: ['stable', 'volatile', 'new'] },
          exchangeCount: { type: 'integer' },
          allExchanges: {
            type: 'array',
            description: 'Every venue trading this symbol with its own funding rate + fees.',
            items: {
              type: 'object',
              properties: {
                exchange: { type: 'string' },
                rate8h: { type: 'number' },
                type: { type: 'string', enum: ['cex', 'dex'] },
                makerFee: { type: 'number', nullable: true, description: 'Maker fee (%, negative = rebate)' },
                takerFee: { type: 'number', nullable: true, description: 'Taker fee (%)' },
              },
            },
          },
        },
      },
      KlinesResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              pair: { type: 'string', example: 'BTCUSDT' },
              interval: { type: 'string', example: '1h' },
              source: { type: 'string', enum: ['binance', 'bybit', 'okx'], description: 'Which venue served this response' },
              count: { type: 'integer' },
              candles: { type: 'array', items: { $ref: '#/components/schemas/Kline' } },
            },
          },
          meta: {
            type: 'object',
            properties: { timestamp: { type: 'integer', description: 'Unix ms' } },
          },
        },
      },
      Kline: {
        type: 'object',
        properties: {
          time: { type: 'integer', description: 'Open time, Unix ms' },
          open: { type: 'number' },
          high: { type: 'number' },
          low: { type: 'number' },
          close: { type: 'number' },
          volume: { type: 'number', description: 'Base-asset volume' },
          closeTime: { type: 'integer', description: 'Close time, Unix ms' },
        },
      },
      SpreadsResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/SpreadRow' } },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'integer', description: 'Unix ms' },
              entries: { type: 'integer' },
              totalSymbols: { type: 'integer' },
              feeModel: { $ref: '#/components/schemas/FeeModel' },
            },
          },
        },
      },
      SpreadRow: {
        type: 'object',
        properties: {
          symbol: { type: 'string', example: 'BTC' },
          spreadPct: { type: 'number', description: 'Gross spread % (highPrice - lowPrice) / lowPrice × 100' },
          spreadUsd: { type: 'number', description: 'Gross spread in USD' },
          netSpreadPct: { type: 'number', description: 'spreadPct - roundTripFee, in %' },
          highExchange: { type: 'string' },
          highPrice: { type: 'number' },
          lowExchange: { type: 'string' },
          lowPrice: { type: 'number' },
          exchangeCount: { type: 'integer' },
          fees: {
            type: 'object',
            description: 'Fee assumptions baked into netSpreadPct (% per trade)',
            properties: {
              roundTrip: { type: 'number', description: 'High-leg taker + low-leg taker' },
              highExchangeTaker: { type: 'number', nullable: true },
              highExchangeMaker: { type: 'number', nullable: true },
              lowExchangeTaker:  { type: 'number', nullable: true },
              lowExchangeMaker:  { type: 'number', nullable: true },
            },
          },
        },
      },
      FeeModel: {
        type: 'object',
        description: 'Fee schedule snapshot. Bump-detect on `version` to know when to refresh cached calcs.',
        properties: {
          version: { type: 'string', example: 'v1.0-2026-02-01', description: 'Bumps on every value change' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-02-01T00:00:00Z' },
          unit: { type: 'string', enum: ['percent'], description: 'All fee values are percent-per-trade' },
          schedule: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                maker: { type: 'number', description: 'Maker fee (%, negative = rebate)' },
                taker: { type: 'number', description: 'Taker fee (%)' },
              },
            },
            description: 'Map of exchange name → { maker, taker } in percent per trade',
          },
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
        description: 'Returns the latest funding rate for every (symbol, exchange) pair we ingest. Per-exchange rows by default; pass aggregate=1 to collapse to one row per symbol with avg / min / max 8h-normalised rate + which venues hit the extremes (useful for spotting spreads at a glance).',
        parameters: [
          { name: 'symbols', in: 'query', schema: { type: 'string' }, example: 'BTC,ETH', description: 'Comma-separated symbol filter' },
          { name: 'exchanges', in: 'query', schema: { type: 'string' }, example: 'binance,bybit', description: 'Comma-separated exchange filter' },
          { name: 'assetClass', in: 'query', schema: { type: 'string', enum: ['crypto', 'stocks', 'forex', 'commodities', 'all'], default: 'crypto' } },
          { name: 'aggregate', in: 'query', schema: { type: 'integer', enum: [0, 1] }, description: '1 = one row per symbol with avg/min/max rate8h' },
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
        summary: 'Open interest data across exchanges',
        description: 'Per-exchange rows by default; pass aggregate=1 to collapse to one row per symbol with summed openInterestUsd + per-venue breakdown. Pass changes=1 to include 1h/4h/24h % deltas computed server-side from 5-min OI snapshots.',
        parameters: [
          { name: 'symbols', in: 'query', schema: { type: 'string' }, description: 'Comma-separated symbol filter (e.g. BTC,ETH)' },
          { name: 'exchanges', in: 'query', schema: { type: 'string' }, description: 'Comma-separated exchange filter (case-insensitive)' },
          { name: 'aggregate', in: 'query', schema: { type: 'integer', enum: [0, 1] }, description: '1 = sum per symbol, one row each; 0 = per-venue (default)' },
          { name: 'changes', in: 'query', schema: { type: 'integer', enum: [0, 1] }, description: '1 = include {pct1h, pct4h, pct24h} on each row' },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/liquidations': {
      get: {
        summary: 'Recent liquidation feed (or summary)',
        description: 'Default: returns the recent liquidation feed from the last N hours. Pass summary=1 + symbol=X to get aggregated stats (total + long/short volume + largest single hit) over the window instead — avoids paging through hundreds of events client-side just to compute counts.',
        parameters: [
          { name: 'symbol', in: 'query', schema: { type: 'string' }, description: 'Filter by symbol (required for summary mode)' },
          { name: 'exchange', in: 'query', schema: { type: 'string' }, description: 'Filter by exchange (feed mode only)' },
          { name: 'side', in: 'query', schema: { type: 'string', enum: ['long', 'short'] }, description: 'Filter by side (feed mode only)' },
          { name: 'hours', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 24, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
          { name: 'summary', in: 'query', schema: { type: 'integer', enum: [0, 1] }, description: '1 = return aggregated summary instead of feed' },
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
        summary: 'Cross-exchange price spreads with fee-aware net spread',
        description: [
          'Returns the high venue, low venue, gross spread (%) and net spread (% after',
          'round-trip taker fees on both legs) per symbol. Each row includes maker + taker',
          'fees per leg, and the top-level `meta.feeModel` exposes the same version /',
          'updatedAt / schedule surface as `/arbitrage` so callers can detect fee-schedule',
          'bumps with one cache key.',
        ].join(' '),
        parameters: [
          { name: 'symbols', in: 'query', schema: { type: 'string' }, description: 'Comma-separated symbol filter (e.g. BTC,ETH)' },
          { name: 'minSpread', in: 'query', schema: { type: 'number', default: 0 }, description: 'Minimum gross spread (%) to include' },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
        ],
        responses: {
          200: {
            description: 'OK',
            headers: {
              'X-Fee-Model-Version': { description: 'Identifier for the fee schedule used', schema: { type: 'string' } },
              'X-Fee-Model-Updated-At': { description: 'ISO timestamp of last fee schedule revision', schema: { type: 'string', format: 'date-time' } },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SpreadsResponse' },
              },
            },
          },
        },
      },
    },
    '/arbitrage': {
      get: {
        summary: 'Cross-venue funding-rate arbitrage opportunities',
        description: [
          'Returns ranked arbitrage opportunities computed from funding-rate spreads',
          'between exchanges, with feasibility grading (A-D), OI sanity checks, stability',
          'analysis from 7-day spread history, and full fee accounting.',
          '',
          'Each row includes the per-exchange maker + taker fees the calculation assumed',
          'so callers can verify or back the spread out under their own fill model. The',
          'top-level `meta.feeModel` block exposes the same schedule plus a `version`',
          'identifier and `updatedAt` ISO timestamp — bump-detect this to know when to',
          'invalidate any cached fee assumptions on your side.',
          '',
          'The same version is mirrored on the response headers as `X-Fee-Model-Version`',
          'and `X-Fee-Model-Updated-At` so HEAD-request consumers can cheaply check.',
        ].join('\n'),
        parameters: [
          { name: 'minSpread', in: 'query', schema: { type: 'number', default: 0 }, description: 'Minimum 8h gross spread (%) to include' },
          { name: 'minOI', in: 'query', schema: { type: 'number', default: 0 }, description: 'Minimum OI in USD on the smaller side' },
          { name: 'grade', in: 'query', schema: { type: 'string' }, description: 'Comma-separated grades to keep (A,B,C,D)' },
          { name: 'symbols', in: 'query', schema: { type: 'string' }, description: 'Comma-separated symbol filter (e.g. BTC,ETH)' },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
          { name: 'assetClass', in: 'query', schema: { type: 'string', enum: ['crypto', 'stocks', 'forex', 'commodities', 'all'], default: 'crypto' } },
        ],
        responses: {
          200: {
            description: 'OK',
            headers: {
              'X-Fee-Model-Version': { description: 'Identifier for the fee schedule used (e.g. v1.0-2026-02-01)', schema: { type: 'string' } },
              'X-Fee-Model-Updated-At': { description: 'ISO timestamp of the last fee schedule revision', schema: { type: 'string', format: 'date-time' } },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ArbitrageResponse' },
              },
            },
          },
        },
      },
    },
    '/tickers': {
      get: {
        summary: 'Current ticker / mark prices across exchanges',
        description: 'Per-exchange rows by default; pass aggregate=1 to collapse to one row per symbol with median price + max H/L + cross-venue deduped volume (\$100B per-entry sanity cap).',
        parameters: [
          { name: 'symbols', in: 'query', schema: { type: 'string' }, description: 'Comma-separated symbol filter (e.g. BTC,ETH)' },
          { name: 'exchanges', in: 'query', schema: { type: 'string' }, description: 'Comma-separated exchange filter (case-insensitive)' },
          { name: 'aggregate', in: 'query', schema: { type: 'integer', enum: [0, 1] }, description: '1 = one row per symbol, summed volume + median price' },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/klines': {
      get: {
        summary: 'OHLCV candle data for a symbol on a given timeframe',
        description: 'Backed by a multi-venue fallback chain (Binance perp → Bybit → OKX → Binance spot) so a single venue outage does not break the response. Returns up to 500 candles per call.',
        parameters: [
          { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, example: 'BTC' },
          { name: 'interval', in: 'query', schema: { type: 'string', enum: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'], default: '1h' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KlinesResponse' },
              },
            },
          },
        },
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
        summary: 'Supported exchanges metadata',
        description: 'Returns one row per supported exchange with type (cex/dex), maker + taker fees (% per trade), round-trip fee (taker × 2), funding interval, and trade URL pattern. The top-level meta.feeModel block emits the same { version, updatedAt, unit } the other fee-aware endpoints emit — use this endpoint as the canonical fee-schedule source and cache by version.',
        responses: {
          200: {
            description: 'OK',
            headers: {
              'X-Fee-Model-Version': { description: 'Identifier for the fee schedule', schema: { type: 'string' } },
              'X-Fee-Model-Updated-At': { description: 'ISO timestamp of last revision', schema: { type: 'string', format: 'date-time' } },
            },
          },
        },
      },
    },
    '/listing-radar': {
      get: {
        summary: 'CEX listing announcement tracker (pre-listing leak detector)',
        description: 'Real-time feed of Binance listing announcements (new + delistings), classified by type, with tickers extracted. Listings historically pump 30-200% in the first 24h.',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['spot', 'perp', 'futures', 'option', 'delisting', 'other'] } },
          { name: 'hot', in: 'query', schema: { type: 'integer', enum: [0, 1] }, description: '1 = only return announcements <6h old' },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
        ],
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
