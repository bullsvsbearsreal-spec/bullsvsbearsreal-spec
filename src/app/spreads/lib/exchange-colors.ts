// ─── Exchange Colors ──────────────────────────────────────────────────────────
// Maximally distinct colors — no two should look similar on dark bg

export const EX_COLORS: Record<string, string> = {
  Binance: '#F0B90B',
  Bybit: '#FF4040',
  OKX: '#00FF00',
  Bitget: '#00BFFF',
  MEXC: '#FF00FF',
  HTX: '#FF8C00',
  Hyperliquid: '#00FFFF',
  dYdX: '#9D4EDD',
  Kraken: '#FFFF00',
  'Gate.io': '#7FFF00',
  Coinbase: '#4169E1',
  KuCoin: '#00FA9A',
  BingX: '#FF69B4',
  Phemex: '#D2691E',
  CoinEx: '#48D1CC',
  Deribit: '#BA55D3',
  WhiteBIT: '#ADFF2F',
  gTrade: '#E8590C',
  Bitunix: '#FFD700',
  Lighter: '#1E90FF',
  Variational: '#32CD32',
  Aster: '#FF6347',
  Aevo: '#DDA0DD',
  Drift: '#20B2AA',
  GMX: '#4682B4',
  Extended: '#CD853F',
  edgeX: '#8B008B',
  Nado: '#B22222',
  Backpack: '#DAA520',
  Orderly: '#5F9EA0',
  Paradex: '#C71585',
  Bitfinex: '#97C900',
};

const PALETTE = [
  '#F0B90B', '#FF4040', '#00FF00', '#00BFFF', '#FF00FF', '#FF8C00',
  '#00FFFF', '#9D4EDD', '#FFD700', '#1E90FF', '#32CD32', '#FF6347',
  '#DDA0DD', '#20B2AA',
];

export function getExchangeColor(exchange: string, index: number): string {
  return EX_COLORS[exchange] || PALETTE[index % PALETTE.length];
}
