export interface WidgetLayout {
  id: string;       // unique instance id
  type: WidgetType; // widget kind
  w: number;        // width in columns (1 or 2)
  h: number;        // height in rows (always 1 for now)
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
  | 'dominance';

export interface WidgetMeta {
  type: WidgetType;
  name: string;
  defaultW: number;
  icon: string; // lucide icon name
}

export const WIDGET_CATALOG: WidgetMeta[] = [
  { type: 'watchlist', name: 'Watchlist', defaultW: 1, icon: 'Star' },
  { type: 'portfolio', name: 'Portfolio', defaultW: 1, icon: 'Briefcase' },
  { type: 'alerts', name: 'Active Alerts', defaultW: 1, icon: 'Bell' },
  { type: 'wallets', name: 'Tracked Wallets', defaultW: 1, icon: 'Wallet' },
  { type: 'btc-price', name: 'BTC Price', defaultW: 1, icon: 'Bitcoin' },
  { type: 'fear-greed', name: 'Fear & Greed', defaultW: 1, icon: 'Gauge' },
  { type: 'top-movers', name: 'Top Movers', defaultW: 1, icon: 'TrendingUp' },
  { type: 'liquidations', name: 'Liquidations', defaultW: 1, icon: 'Flame' },
  { type: 'btc-chart', name: 'BTC Chart', defaultW: 2, icon: 'LineChart' },
  { type: 'funding-heatmap', name: 'Funding Heatmap', defaultW: 2, icon: 'Grid3X3' },
  { type: 'oi-chart', name: 'OI Chart', defaultW: 2, icon: 'BarChart3' },
  { type: 'dominance', name: 'Dominance', defaultW: 2, icon: 'PieChart' },
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
