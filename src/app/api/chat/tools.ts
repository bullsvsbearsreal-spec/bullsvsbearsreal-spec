import type Anthropic from '@anthropic-ai/sdk';

type Tool = Anthropic.Tool;

export const CHAT_TOOLS: Tool[] = [
  {
    name: 'get_funding_rates',
    description:
      'Get current funding rates across all exchanges. USE WHEN: user asks about funding rates, market bias, carry trades, whether longs or shorts are dominant, or any question about a specific coin (always check funding). Returns rate, exchange, predicted rate, and interval.',
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
      'Get current open interest in USD by symbol and exchange. USE WHEN: user asks about positioning, conviction, whether new money is entering, or any coin-specific question (always pair with funding). Rising OI = new positions opening. Falling OI = positions closing.',
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
      'Get current Fear & Greed Index (0-100) with 7-day history. USE WHEN: user asks about market sentiment, mood, whether to buy/sell, or any broad market question. Extreme Fear (<20) = contrarian buy signal. Extreme Greed (>80) = caution.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_top_movers',
    description:
      "Get today's top gainers and losers by 24h price change. USE WHEN: user asks what's moving, what's hot, what to watch, or for a market overview.",
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_long_short_ratio',
    description:
      'Get Binance global long/short account ratio. USE WHEN: user asks about retail positioning, crowd sentiment for a specific pair, or whether traders are leaning long/short. High long ratio = crowded long (contrarian short signal).',
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
      'Get positions of top Hyperliquid whale traders with account value, leverage, PnL. USE WHEN: user asks about smart money, whale activity, institutional positioning, or what big players are doing. Can filter by coin to see which whales hold a specific asset.',
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
      'Get upcoming token unlock events with dates, amounts, and supply %. USE WHEN: user asks about upcoming supply events, potential sell pressure, or vesting schedules. Large unlocks (>5% supply) often cause selling pressure.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_tickers',
    description:
      'Get real-time prices, 24h changes, and volumes across exchanges. USE WHEN: user asks about current price of any coin, volume, or needs price data for analysis.',
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
      'Get historical funding rates for a symbol over N days (max 90). USE WHEN: user asks about funding trends, whether current rate is normal, or for historical comparison. Shows average, min, max, and recent trend direction.',
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
      'Get upcoming economic events (FOMC, CPI, NFP, etc.). USE WHEN: user asks about macro events, catalysts, or what could move markets this week. High-impact events like FOMC often cause volatility.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'analyze_portfolio',
    description:
      "Analyze user's portfolio vs current prices. Calculates PnL, allocation, and exposure. USE WHEN: user asks about their portfolio, holdings, or how their positions are doing. Requires portfolio configured on Portfolio page.",
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'find_arbitrage_opportunities',
    description:
      'Find best funding rate arbitrage opportunities across exchanges. USE WHEN: user asks about trading opportunities, free money, arb, carry trades, or spreads. Shows specific exchanges to go long/short and estimated annualized return.',
    input_schema: {
      type: 'object' as const,
      properties: {
        minSpread: {
          type: 'number',
          description: 'Minimum funding rate spread in % (default: 0.01)',
        },
      },
    },
  },
  {
    name: 'get_liquidations',
    description:
      'Get large underwater positions from whale traders (liquidation proxy). USE WHEN: user asks about liquidations, market stress, who is getting rekt, or potential forced selling. Shows positions with biggest negative PnL.',
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
      'Get historical OI for a symbol over N days (max 90). USE WHEN: analyzing OI trends — is OI building (new conviction) or declining (positions closing)? Combine with price direction for divergence analysis.',
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
      'Get cross-exchange price correlation data for a symbol. USE WHEN: user asks about price discrepancies between exchanges, or wants to verify if price action is consistent. Useful for spotting exchange-specific anomalies or manipulation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Optional symbol (e.g., BTC, ETH). If omitted, returns top 20 by volume.',
        },
      },
    },
  },
];
