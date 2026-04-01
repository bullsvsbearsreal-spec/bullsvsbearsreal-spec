// ─── Exchange Colors ──────────────────────────────────────────────────────────
// Maximally distinct colors on dark (#0c0e14) background.
// Tested for contrast: no two adjacent exchanges should look similar.
// Primary palette avoids similar hues — picks from opposite sides of the wheel.

export const EX_COLORS: Record<string, string> = {
  // CEX — warm/bright, high saturation
  Binance: '#F0B90B',     // gold
  Bybit: '#FF4040',       // red
  OKX: '#00E676',         // green (shifted from pure #00FF00 for readability)
  Bitget: '#2196F3',      // blue (shifted from sky blue for distinction from cyan)
  MEXC: '#E040FB',        // pink-magenta
  HTX: '#FF6D00',         // orange
  Kraken: '#7C4DFF',      // deep purple (was yellow — too close to Binance gold)
  Coinbase: '#448AFF',    // bright blue
  KuCoin: '#00E5FF',      // cyan
  BingX: '#FF4081',       // pink
  Phemex: '#FF9100',      // amber
  Bitunix: '#EEFF41',     // lime yellow
  BitMEX: '#F44336',      // material red
  'Gate.io': '#76FF03',   // light green
  CoinEx: '#18FFFF',      // light cyan
  Bitfinex: '#C6FF00',    // yellow-green
  WhiteBIT: '#B2FF59',    // light lime

  // DEX — cool/neon tones
  Hyperliquid: '#00BCD4',  // teal (was cyan, moved away from KuCoin)
  dYdX: '#CE93D8',        // light purple (brighter for visibility)
  Aster: '#FF5722',       // deep orange
  Lighter: '#40C4FF',     // light blue
  Aevo: '#EA80FC',        // light pink
  Drift: '#64FFDA',       // mint
  GMX: '#536DFE',         // indigo
  gTrade: '#FF6E40',      // deep orange accent
  Extended: '#FFD740',    // amber
  Variational: '#69F0AE', // mint green
  edgeX: '#B388FF',       // lavender
  Nado: '#FF8A80',        // soft red
  Backpack: '#FFD180',    // peach
  Orderly: '#80D8FF',     // sky
  Paradex: '#FF80AB',     // rose
};

// Fallback palette — maximum visual distinction
const PALETTE = [
  '#F0B90B', '#FF4040', '#00E676', '#2196F3', '#E040FB', '#FF6D00',
  '#7C4DFF', '#00BCD4', '#CE93D8', '#EEFF41', '#FF4081', '#64FFDA',
  '#536DFE', '#FF5722',
];

export function getExchangeColor(exchange: string, index: number): string {
  return EX_COLORS[exchange] || PALETTE[index % PALETTE.length];
}

/** Line style per index — alternates solid/dashed for extra differentiation when many lines overlap */
export function getLineStyle(index: number): 0 | 2 {
  // 0 = Solid, 2 = Dashed (lightweight-charts LineStyle enum)
  return index < 4 ? 0 : 2;
}
