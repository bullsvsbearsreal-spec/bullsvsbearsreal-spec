/**
 * Classify a ticker symbol into an asset class.
 *
 * Crypto perp venues (Bybit, OKX, MEXC, Gate, Bitget, …) list a growing
 * set of *tokenized equities* (AAPL, DELL, TSLA, …), a handful of FX pairs
 * and a couple of tokenized metals alongside real crypto. `/api/tickers`
 * returns them all flattened, so consumers that mean "crypto market" (e.g.
 * the chart's Top Movers) end up surfacing DELL / DELLSTOCK / AAPL as
 * "crypto gainers". This tags each ticker so they can filter.
 *
 * Design rule: **never misclassify a real coin as non-crypto.** A false
 * positive removes a coin from the crypto views (the bug, inverted); a
 * false negative just leaves a tokenized stock in the list (the original,
 * milder wart). So every rule below is conservative and crypto is the
 * default.
 *
 * The equity set + suffix rules were derived from the live `/api/tickers`
 * feed (~1,370 distinct symbols): the `*STOCK` suffix family gives an
 * authoritative list of which bases are tokenized equities, cross-checked
 * against a hand-curated mega-cap list. Collisions with well-known coins
 * (QNT=Quant, T=Threshold, CAT=meme cats, plus GMX/MUX/VRTX via the X
 * suffix) are deliberately excluded. The set will drift as venues add
 * names; the `*STOCK` / `*X` suffix rules auto-cover most new listings,
 * and the bare set covers today's majors.
 */

export type TickerAssetClass = 'crypto' | 'stocks' | 'forex' | 'commodities';

/**
 * Bare tokenized-equity tickers seen across crypto perp venues. Crypto
 * collisions (QNT, T, CAT) are intentionally omitted — see file header.
 */
export const EQUITY_TICKERS: ReadonlySet<string> = new Set([
  'AAOI', 'AAPL', 'ABBV', 'ABNB', 'ADBE', 'AMAT', 'AMC', 'AMD', 'AMZN', 'APLD',
  'APP', 'ARM', 'ASML', 'ASTS', 'AVGO', 'BA', 'BABA', 'BAC', 'BE', 'BMNR',
  'BRK', 'BRKB', 'C', 'CBRS', 'COHR', 'COIN', 'COP', 'COST', 'CRCL', 'CRM',
  'CRWD', 'CRWV', 'CSCO', 'CVNA', 'CVX', 'DDOG', 'DE', 'DELL', 'DIS', 'F',
  'FDX', 'FIG', 'FLNC', 'FUTU', 'GE', 'GEV', 'GLW', 'GM', 'GME', 'GOOG',
  'GOOGL', 'GS', 'HD', 'HIMS', 'HON', 'HOOD', 'HPQ', 'IBM', 'INFQ', 'INTC',
  'INTU', 'IONQ', 'IREN', 'JD', 'JNJ', 'JPM', 'KLAC', 'KO', 'LITE', 'LLY',
  'LMT', 'LOW', 'LRCX', 'MA', 'MARA', 'MCD', 'META', 'MRK', 'MRVL', 'MS',
  'MSFT', 'MSTR', 'MU', 'NBIS', 'NET', 'NFLX', 'NIO', 'NKE', 'NOK', 'NOW',
  'NVDA', 'ON', 'ONDS', 'ORCL', 'OXY', 'PANW', 'PAYP', 'PDD', 'PEP', 'PFE',
  'PG', 'PLTR', 'PYPL', 'QCOM', 'QQQ', 'RDDT', 'RDW', 'RIOT', 'RKLB', 'RTX',
  'SAMSUNG', 'SBUX', 'SHOP', 'SKHYNIX', 'SMCI', 'SNDK', 'SNOW', 'SOFI', 'SPCX',
  'SPOT', 'SPY', 'STX', 'TMO', 'TSLA', 'TSM', 'TXN', 'UBER', 'UNH', 'UPS',
  'USAR', 'V', 'VRT', 'VZ', 'WDC', 'WFC', 'WMT', 'XOM',
]);

/** Major FX pairs that show up on some perp venues. No crypto collisions. */
export const FOREX_SYMBOLS: ReadonlySet<string> = new Set([
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY',
]);

/**
 * Tokenized metals. Deliberately bare XAU/XAG only — XAUT (Tether Gold)
 * and PAXG (Pax Gold) are crypto tokens and must stay 'crypto'.
 */
export const COMMODITY_SYMBOLS: ReadonlySet<string> = new Set(['XAU', 'XAG']);

/**
 * Classify a (base) ticker symbol. Case-insensitive. Unknown → 'crypto'.
 */
export function classifyAssetClass(rawSymbol: string | null | undefined): TickerAssetClass {
  const s = (rawSymbol ?? '').toUpperCase().trim();
  if (!s) return 'crypto';

  // 1. `*STOCK` suffix — unambiguous tokenized equity (AAPLSTOCK, DELLSTOCK).
  //    No real coin ends in "STOCK".
  if (s.length > 5 && s.endsWith('STOCK')) return 'stocks';

  // 2. xStocks naming (AAPLX, TSLAX). Only when the X-stripped base is a
  //    known equity AND ≥4 chars — otherwise we'd swallow real coins like
  //    GMX (GM+X), MUX (MU+X), VRTX (VRT+X), AVAX, DYDX, FLUX, FRAX.
  if (s.length >= 5 && s.endsWith('X')) {
    const base = s.slice(0, -1);
    if (base.length >= 4 && EQUITY_TICKERS.has(base)) return 'stocks';
  }

  // 3/4. Exact-match FX + metals.
  if (FOREX_SYMBOLS.has(s)) return 'forex';
  if (COMMODITY_SYMBOLS.has(s)) return 'commodities';

  // 5. Bare tokenized equity.
  if (EQUITY_TICKERS.has(s)) return 'stocks';

  // 6. Default: real crypto.
  return 'crypto';
}
