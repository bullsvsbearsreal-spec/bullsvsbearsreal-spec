export interface WidgetLayout {
  id: string;       // unique instance id
  type: WidgetType; // widget kind
  w: number;        // width in columns (1 or 2)
  h: number;        // height in rows (always 1 for now)
  settings?: Record<string, any>; // per-widget config
}

export type WidgetType =
  | 'watchlist'
  | 'portfolio'
  | 'alerts'
  | 'wallets'
  | 'btc-price'
  | 'fear-greed'
  | 'top-movers'
  | 'liquidations'
  | 'btc-chart'
  | 'funding-heatmap'
  | 'oi-chart'
  | 'dominance'
  | 'market-overview'
  | 'news'
  | 'long-short'
  | 'trending'
  | 'token-unlocks'
  | 'arbitrage'
  | 'exchange-status'
  | 'fear-greed-chart'
  | 'altseason'
  | 'stablecoin-flows';

export type WidgetCategory = 'market' | 'trading' | 'portfolio' | 'sentiment' | 'events';

export interface WidgetMeta {
  type: WidgetType;
  name: string;
  description: string;
  defaultW: number;
  icon: string; // lucide icon name
  category: WidgetCategory;
}

export const WIDGET_CATEGORIES: Record<WidgetCategory, { label: string; color: string }> = {
  market:    { label: 'Market',    color: 'rgb(34,197,94)' },    // green-500
  trading:   { label: 'Trading',   color: 'rgb(59,130,246)' },   // blue-500
  portfolio: { label: 'Portfolio', color: 'rgb(168,85,247)' },   // purple-500
  sentiment: { label: 'Sentiment', color: 'rgb(249,115,22)' },   // orange-500
  events:    { label: 'Events',    color: 'rgb(245,158,11)' },   // amber-500
};

export const WIDGET_CATALOG: WidgetMeta[] = [
  // Market
  { type: 'btc-price',       name: 'BTC Price',        description: 'Live Bitcoin price & 24h change',        defaultW: 1, icon: 'Bitcoin',       category: 'market' },
  { type: 'market-overview',  name: 'Market Overview',   description: 'Market cap, volume & dominance',         defaultW: 1, icon: 'Globe',         category: 'market' },
  { type: 'top-movers',      name: 'Top Movers',       description: 'Biggest gainers & losers',               defaultW: 1, icon: 'TrendingUp',    category: 'market' },
  { type: 'dominance',       name: 'Dominance',        description: 'Market dominance breakdown',              defaultW: 2, icon: 'PieChart',      category: 'market' },
  { type: 'trending',        name: 'Trending',         description: 'Most mentioned coins in crypto news',     defaultW: 1, icon: 'Zap',           category: 'market' },
  // Trading
  { type: 'funding-heatmap', name: 'Funding Heatmap',  description: 'Exchange funding rates at a glance',     defaultW: 2, icon: 'Grid3X3',       category: 'trading' },
  { type: 'oi-chart',        name: 'OI Chart',         description: 'Open interest by symbol',                defaultW: 2, icon: 'BarChart3',     category: 'trading' },
  { type: 'liquidations',    name: 'Liquidations',     description: 'Recent BTC liquidation events',          defaultW: 1, icon: 'Flame',         category: 'trading' },
  { type: 'long-short',      name: 'Long/Short',       description: 'BTC long vs short ratio',                defaultW: 1, icon: 'ArrowLeftRight', category: 'trading' },
  // Portfolio
  { type: 'watchlist',       name: 'Watchlist',        description: 'Your tracked symbols with live prices',  defaultW: 1, icon: 'Star',          category: 'portfolio' },
  { type: 'portfolio',       name: 'Portfolio',        description: 'Holdings value & P&L',                   defaultW: 1, icon: 'Briefcase',     category: 'portfolio' },
  { type: 'alerts',          name: 'Active Alerts',    description: 'Price alerts with proximity bars',       defaultW: 1, icon: 'Bell',          category: 'portfolio' },
  { type: 'wallets',         name: 'Saved Wallets',    description: 'Quick-access wallet address book',       defaultW: 1, icon: 'Wallet',        category: 'portfolio' },
  // Sentiment
  { type: 'fear-greed',      name: 'Fear & Greed',     description: 'Crypto market sentiment index',          defaultW: 1, icon: 'Gauge',         category: 'sentiment' },
  { type: 'news',            name: 'News',             description: 'Latest crypto headlines',                defaultW: 1, icon: 'Newspaper',     category: 'sentiment' },
  // Events
  { type: 'btc-chart',       name: 'BTC Chart',        description: '7-day Bitcoin price chart',              defaultW: 2, icon: 'LineChart',     category: 'market' },
  { type: 'token-unlocks',   name: 'Token Unlocks',    description: 'Upcoming vesting unlock events',         defaultW: 1, icon: 'Unlock',        category: 'events' },
  // New widgets
  { type: 'arbitrage',        name: 'Arbitrage',          description: 'Top funding rate arbitrage opportunities', defaultW: 2, icon: 'ArrowLeftRight', category: 'trading' },
  { type: 'exchange-status',  name: 'Exchange Status',    description: 'Exchange health & data freshness',         defaultW: 1, icon: 'Activity',       category: 'market' },
  { type: 'fear-greed-chart', name: 'Fear & Greed Chart', description: '30-day Fear & Greed history',              defaultW: 2, icon: 'Gauge',          category: 'sentiment' },
  { type: 'altseason',        name: 'Altseason Index',    description: 'Altcoin vs Bitcoin performance (90d)',      defaultW: 1, icon: 'Zap',            category: 'sentiment' },
  { type: 'stablecoin-flows', name: 'Stablecoin Flows',   description: 'Net stablecoin mint/burn indicator',        defaultW: 1, icon: 'Coins',          category: 'market' },
];

export const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: 'w1', type: 'btc-price', w: 1, h: 1 },
  { id: 'w2', type: 'fear-greed', w: 1, h: 1 },
  { id: 'w3', type: 'top-movers', w: 1, h: 1 },
  { id: 'w4', type: 'watchlist', w: 1, h: 1 },
  { id: 'w5', type: 'portfolio', w: 1, h: 1 },
  { id: 'w6', type: 'alerts', w: 1, h: 1 },
  { id: 'w7', type: 'btc-chart', w: 2, h: 1 },
  { id: 'w8', type: 'liquidations', w: 1, h: 1 },
];
