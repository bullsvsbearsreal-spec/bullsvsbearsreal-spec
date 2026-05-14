import type Anthropic from '@anthropic-ai/sdk';
import { ALL_EXCHANGES } from '@/lib/constants';

type Tool = Anthropic.Tool;

export const CHAT_TOOLS: Tool[] = [
  {
    name: 'get_funding_rates',
    description: `Current funding rates across ${ALL_EXCHANGES.length} exchanges. Shows rate + predicted rate per exchange for a symbol, or top rates by magnitude. Use ONLY for funding rate questions, carry trade analysis, or market directional bias. NOT for prices — use get_tickers instead.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH, SOL. Omit for top 12 by magnitude.' },
        assetClass: { type: 'string', enum: ['crypto', 'stocks', 'forex', 'commodities', 'all'], description: 'Asset class filter. Default: crypto' },
      },
    },
  },
  {
    name: 'get_open_interest',
    description: 'Aggregate open interest in USD across 26+ exchanges, broken down by exchange. Use for: positioning size, conviction level, whether new money is entering a trade.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH. Omit for top 15 by total OI.' },
      },
    },
  },
  {
    name: 'get_fear_greed_index',
    description: 'Crypto Fear & Greed Index (0=extreme fear, 100=extreme greed) with 7-day history. Use for: overall market sentiment, crowd mood.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_top_movers',
    description: 'Top 10 gainers and top 10 losers by 24h price change across perps. Use for: what moved today, market scan, momentum plays.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_long_short_ratio',
    description: 'OKX long/short ratio (retail trader positioning). Shows ratio over time for a specific symbol. Use for: retail sentiment, crowd positioning, contrarian signals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'UPPERCASE with USDT suffix e.g. BTCUSDT, ETHUSDT. Default: BTCUSDT' },
        period: { type: 'string', enum: ['5m', '15m', '30m', '1h', '4h', '1d'], description: 'Candle interval. Default: 1h' },
      },
    },
  },
  {
    name: 'get_whale_positions',
    description: 'Top Hyperliquid whale trader positions — shows account value, leverage, PnL, ROE. Hyperliquid-only (does not cover CEX whales). Use for: smart money positioning, whale trades, large trader activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        coin: { type: 'string', description: 'Filter by coin e.g. BTC, ETH, SOL. Omit for top whales overview.' },
      },
    },
  },
  {
    name: 'get_token_unlocks',
    description: 'Next 15 upcoming token unlock events — date, USD value, % of circulating supply, vesting type. Use for: upcoming supply pressure, sell risk, event-driven trades.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_tickers',
    description: 'Real-time perp prices, 24h change %, and 24h volume across 29+ exchanges. Use for: current price, price comparison across venues, volume ranking. This is the primary price tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH. Omit for top 15 by volume.' },
      },
    },
  },
  {
    name: 'get_funding_history',
    description: 'Historical funding rate data over 1-90 days. Returns avg, min, max, 7d trend. Use for: is current funding rate normal, funding regime changes, mean reversion signals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH' },
        exchange: { type: 'string', description: 'Specific exchange e.g. Binance, Bybit. Omit for aggregate.' },
        days: { type: 'number', description: 'Lookback period 1-90 days. Default: 30' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_economic_calendar',
    description: 'Upcoming macro events: FOMC, CPI, NFP, GDP, etc. with dates, impact level, and country. Use for: macro catalysts, event risk, scheduling around news.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'analyze_portfolio',
    description: 'Analyze the user\'s saved portfolio holdings against live prices. Shows per-asset PnL, allocation %, and 24h change. Only works if user has portfolio configured on the Portfolio page.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'find_arbitrage_opportunities',
    description: 'Find funding rate arbitrage: go long on lowest-funding exchange, short on highest-funding exchange for same symbol. Shows spread, APR, and specific exchange pair. All rates normalized to 8h equivalent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        minSpread: { type: 'number', description: 'Minimum 8h-normalized spread % to show. Default: 0.01' },
      },
    },
  },
  {
    name: 'get_liquidations',
    description: 'Large underwater positions from Hyperliquid whales (liquidation risk proxy). Shows positions with significant unrealized losses. NOT real-time liquidation events — use get_real_liquidations for actual liqs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH. Omit for all underwater positions.' },
      },
    },
  },
  {
    name: 'get_oi_history',
    description: 'Historical aggregate OI over 1-90 days. Returns current OI, period change %, high/low, trend direction. Use for: OI trend, price-OI divergence, building/declining conviction.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH' },
        days: { type: 'number', description: 'Lookback period 1-90 days. Default: 7' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_correlation',
    description: 'Cross-exchange price comparison: same symbol\'s 24h change on each exchange, average price, volume, exchange count. Use for: price discrepancies between venues, exchange-specific anomalies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH. Omit for market overview.' },
      },
    },
  },
  {
    name: 'get_news',
    description: 'Latest 10 crypto news headlines with source, date, and title. Use for: recent catalysts, why price moved, current narrative.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_market_dominance',
    description: 'BTC dominance %, ETH dominance %, total crypto market cap, 24h volume, market cap 24h change. Use for: rotation signals, alt season detection, macro market structure.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_real_liquidations',
    description: 'Actual liquidation events from OKX (7-day rolling window). Shows individual liq events with side, amount, price, timestamp. Summarizes total long vs short liquidations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH (required)' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_etf_flows',
    description: 'US spot BTC/ETH ETF data: per-fund AUM, daily net flow, price. Shows institutional capital movement. Use for: TradFi inflow/outflow, institutional sentiment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['btc', 'eth'], description: 'ETF type. Default: btc' },
      },
    },
  },
  {
    name: 'get_options_data',
    description: 'Options data from 4 exchanges (Binance, Bybit, Deribit, OKX): max pain, put/call ratio, total OI by exchange, top expiry dates. BTC, ETH, or SOL. Use for: options sentiment, max pain pin, hedging activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        currency: { type: 'string', enum: ['BTC', 'ETH', 'SOL'], description: 'Currency. Default: BTC' },
      },
    },
  },
  {
    name: 'get_onchain_metrics',
    description: 'BTC-only on-chain data: hash rate, MVRV + Z-score, Puell Multiple, difficulty adjustment, miner revenue, mempool stats, supply mined %. Use for: BTC fundamental analysis, miner health, network state.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_market_cycle',
    description: 'BTC-only long-term cycle indicators: Pi Cycle Top/Bottom, Rainbow Chart band, 200-week MA, Stock-to-Flow ratio + deviation. Use for: where are we in the cycle, macro top/bottom signals.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_prediction_markets',
    description: 'Polymarket + Kalshi prediction markets with cross-platform arbitrage opportunities. Shows event questions, yes/no prices per platform, spread %. Use for: event probability, political/economic odds, prediction arb.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_oi_delta',
    description: 'OI momentum for all tracked symbols: 1h, 4h, 24h percentage change in open interest. Sorted by biggest 1h move. Use for: where is new money flowing RIGHT NOW, real-time positioning shifts.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_stablecoin_flows',
    description: 'Top 8 stablecoins by market cap with 7d and 30d supply changes. Includes overall flow signal (risk-on/risk-off). Use for: dry powder, capital entering/leaving crypto, risk appetite.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_rsi_data',
    description: 'RSI-14 on 1h/4h/1d timeframes. Per-symbol or scan for overbought (>70) / oversold (<30) extremes. Use for: momentum, mean reversion setups, divergence analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH. Omit to scan for RSI extremes across all symbols.' },
      },
    },
  },
  {
    name: 'get_execution_costs',
    description: 'Estimated slippage and execution cost for a $100K position across exchanges. Shows per-venue slippage % and dollar cost. Use for: best venue to execute, liquidity depth comparison.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Uppercase symbol e.g. BTC, ETH. Default: BTC' },
      },
    },
  },
];
