import type Anthropic from '@anthropic-ai/sdk';

type Tool = Anthropic.Tool;

export const CHAT_TOOLS: Tool[] = [
  {
    name: 'get_funding_rates',
    description:
      'Get current funding rates across all exchanges. Can filter by symbol. Returns rate, exchange, predicted rate, mark price, and funding interval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Optional symbol to filter (e.g., BTC, ETH, SOL). If omitted, returns top rates by absolute value.',
        },
        assetClass: {
          type: 'string',
          enum: ['crypto', 'stocks', 'forex', 'commodities', 'all'],
          description: 'Asset class filter. Default: crypto',
        },
      },
    },
  },
  {
    name: 'get_open_interest',
    description:
      'Get current open interest data across all exchanges. Returns OI in USD by symbol and exchange. Useful for gauging market positioning.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Optional symbol to filter (e.g., BTC, ETH)',
        },
      },
    },
  },
  {
    name: 'get_fear_greed_index',
    description:
      'Get the current Crypto Fear & Greed Index (0-100 scale). Classifications: Extreme Fear (0-24), Fear (25-44), Neutral (45-55), Greed (56-74), Extreme Greed (75-100).',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_top_movers',
    description: "Get today's top gainers and losers by 24h price change percentage.",
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_long_short_ratio',
    description:
      'Get the Binance global long/short account ratio for a symbol. Shows the percentage of accounts that are long vs short.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair (e.g., BTCUSDT). Default: BTCUSDT',
        },
        period: {
          type: 'string',
          enum: ['5m', '15m', '30m', '1h', '4h', '1d'],
          description: 'Time period. Default: 1h',
        },
      },
    },
  },
  {
    name: 'get_whale_positions',
    description:
      'Get current positions of top Hyperliquid whale traders. Shows account value, open positions with size/leverage/PnL, and performance metrics. Can filter by a specific coin to see which whales are trading it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        coin: {
          type: 'string',
          description: 'Optional coin to filter positions by (e.g., BTC, ETH, SOL). Shows only whales with positions in this coin.',
        },
      },
    },
  },
  {
    name: 'get_token_unlocks',
    description:
      'Get upcoming token unlock events. Shows token name, unlock date, amount, percentage of supply, and whether it is cliff or linear vesting.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_tickers',
    description:
      'Get real-time prices, 24h price changes, and volumes for symbols across exchanges. Use this when the user asks about current prices.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Optional symbol to filter (e.g., BTC, ETH). If omitted returns top 20 by volume.',
        },
      },
    },
  },
  {
    name: 'get_funding_history',
    description:
      'Get historical funding rate data for a symbol over the past N days (max 90). Shows average rates over time for trend analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol (e.g., BTC, ETH)',
        },
        exchange: {
          type: 'string',
          description: 'Optional exchange filter (e.g., Binance, Bybit)',
        },
        days: {
          type: 'number',
          description: 'Number of days of history (1-90). Default: 30',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_economic_calendar',
    description:
      'Get upcoming economic events (FOMC meetings, CPI releases, NFP, etc.) that may impact crypto markets. Includes impact rating and dates.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'analyze_portfolio',
    description:
      "Analyze the user's portfolio holdings against current market prices. Calculates unrealized P&L, portfolio allocation, and risk exposure. Only works if user has configured holdings in the Portfolio page.",
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'find_arbitrage_opportunities',
    description:
      'Find the best funding rate arbitrage opportunities by comparing rates across exchanges for the same symbol. Shows the spread, exchanges involved, and estimated annualized carry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        minSpread: {
          type: 'number',
          description: 'Minimum funding rate spread to show in percentage (default: 0.01)',
        },
      },
    },
  },
  {
    name: 'get_liquidations',
    description:
      'Get recent large liquidations across exchanges. Shows which positions got liquidated, the size, price, and exchange. Useful for gauging market stress and forced selling/buying.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Optional symbol to filter (e.g., BTC, ETH)',
        },
      },
    },
  },
  {
    name: 'get_oi_history',
    description:
      'Get historical open interest data for a symbol over the past N days (max 90). Shows whether OI is building (bullish conviction) or declining (positions closing).',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol (e.g., BTC, ETH)',
        },
        days: {
          type: 'number',
          description: 'Number of days of history (1-90). Default: 7',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_correlation',
    description:
      'Get cross-exchange price correlation data. Shows how a symbol performs across different exchanges and its 24h price change consistency. Useful for spotting exchange-specific anomalies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Optional symbol to focus on (e.g., BTC, ETH). If omitted, returns top 20 by volume.',
        },
      },
    },
  },
];
