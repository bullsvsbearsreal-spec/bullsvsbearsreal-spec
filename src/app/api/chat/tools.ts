import type Anthropic from '@anthropic-ai/sdk';

type Tool = Anthropic.Tool;

export const CHAT_TOOLS: Tool[] = [
  {
    name: 'get_funding_rates',
    description: 'Current funding rates across exchanges. Use for: funding, market bias, carry trades, any coin query.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH. Omit for top rates.' },
        assetClass: { type: 'string', enum: ['crypto', 'stocks', 'forex', 'commodities', 'all'], description: 'Default: crypto' },
      },
    },
  },
  {
    name: 'get_open_interest',
    description: 'OI in USD by symbol/exchange. Use for: positioning, conviction, new money entering.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH' },
      },
    },
  },
  {
    name: 'get_fear_greed_index',
    description: 'Fear & Greed Index (0-100) with 7d history. Use for: sentiment, mood.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_top_movers',
    description: 'Top gainers/losers by 24h change. Use for: what\'s moving, market overview.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_long_short_ratio',
    description: 'Binance long/short ratio. Use for: retail positioning, crowd sentiment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTCUSDT' },
        period: { type: 'string', enum: ['5m', '15m', '30m', '1h', '4h', '1d'], description: 'Default: 1h' },
      },
    },
  },
  {
    name: 'get_whale_positions',
    description: 'Top Hyperliquid whale positions with leverage, PnL. Use for: smart money, whale activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        coin: { type: 'string', description: 'Filter by coin e.g. BTC' },
      },
    },
  },
  {
    name: 'get_token_unlocks',
    description: 'Upcoming token unlocks with dates, amounts, supply %. Use for: supply events, sell pressure.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_tickers',
    description: 'Real-time prices, 24h changes, volumes. Use for: price queries.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH. Omit for top 20.' },
      },
    },
  },
  {
    name: 'get_funding_history',
    description: 'Historical funding rates for N days (max 90). Use for: funding trends, is current rate normal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH' },
        exchange: { type: 'string', description: 'e.g. Binance, Bybit' },
        days: { type: 'number', description: '1-90. Default: 30' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_economic_calendar',
    description: 'Upcoming economic events (FOMC, CPI, NFP). Use for: macro catalysts.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'analyze_portfolio',
    description: 'Analyze user portfolio vs current prices. PnL, allocation, exposure.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'find_arbitrage_opportunities',
    description: 'Best funding rate arb opportunities across exchanges.',
    input_schema: {
      type: 'object' as const,
      properties: {
        minSpread: { type: 'number', description: 'Min spread % (default: 0.01)' },
      },
    },
  },
  {
    name: 'get_liquidations',
    description: 'Large underwater whale positions (liquidation proxy). Use for: market stress, forced selling risk.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH' },
      },
    },
  },
  {
    name: 'get_oi_history',
    description: 'Historical OI for N days (max 90). Use for: OI trends, divergence analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH' },
        days: { type: 'number', description: '1-90. Default: 7' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_correlation',
    description: 'Cross-exchange price correlation. Use for: price discrepancies, anomalies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH. Omit for top 20.' },
      },
    },
  },
  {
    name: 'get_news',
    description: 'Latest crypto news headlines. Use for: catalysts, why something moved.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_market_dominance',
    description: 'BTC/ETH dominance, total market cap, 24h volume. Use for: market structure, alt season signals.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_real_liquidations',
    description: 'Recent actual liquidation events with amounts, side, timestamp.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_etf_flows',
    description: 'BTC/ETH spot ETF holdings, daily flows, prices. Use for: institutional flows.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['btc', 'eth'], description: 'Default: btc' },
      },
    },
  },
  {
    name: 'get_options_data',
    description: 'BTC/ETH/SOL options: max pain, put/call ratio, IV, OI by strike/exchange. Use for: options sentiment, hedging, pin risk.',
    input_schema: {
      type: 'object' as const,
      properties: {
        currency: { type: 'string', enum: ['BTC', 'ETH', 'SOL'], description: 'Default: BTC' },
      },
    },
  },
  {
    name: 'get_onchain_metrics',
    description: 'BTC on-chain: hash rate, MVRV, Puell Multiple, mempool fees, difficulty, supply. Use for: fundamental analysis, miner health, network activity.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_market_cycle',
    description: 'Pi Cycle, Rainbow Chart band, 200W MA, Stock-to-Flow model. Use for: macro cycle position, long-term valuation.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_prediction_markets',
    description: 'Polymarket/Kalshi markets + cross-platform arb opportunities. Use for: event odds, political/economic event pricing.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_oi_delta',
    description: 'OI momentum: 1h/4h/24h % changes per symbol. Use for: new money flows, positioning shifts, trend confirmation.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_stablecoin_flows',
    description: 'Stablecoin market caps, 7d changes, total supply. Use for: capital flows, dry powder, risk-on/off signal.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_rsi_data',
    description: 'RSI-14 across 1h/4h/1d for top symbols. Use for: overbought/oversold, momentum, divergence.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH. Omit for top symbols.' },
      },
    },
  },
  {
    name: 'get_execution_costs',
    description: 'Venue-specific slippage estimates by trade size. Use for: best execution, liquidity comparison.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTC, ETH' },
      },
    },
  },
];
