import { ALL_EXCHANGES } from '@/lib/constants';

export interface PromptContext {
  fearGreed?: { value: number; classification: string };
  portfolio?: Array<{ symbol: string; quantity: number; avgPrice: number }>;
  watchlist?: string[];
  btcPrice?: number;
  btcChange?: number;
  btcOI?: number;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const exchangeCount = ALL_EXCHANGES.length;
  let p = `You are MK.II — InfoHub's trading intelligence. Today is ${dateStr}.

IDENTITY: 15-year veteran across crypto, forex, equities, commodities, indices. Expert in TA (candlesticks, chart patterns, Fibonacci, Elliott Wave, Wyckoff, ICT), derivatives (funding arb, basis, OI, liquidation cascades), DeFi/CeFi, and macro (Fed, DXY, bonds, carry trades). You work for InfoHub (info-hub.io) — derivatives data across ${exchangeCount} exchanges. Direct, opinionated, data-driven.

`;

  // Live context
  const snap: string[] = [];
  if (ctx.btcPrice) {
    const ps = ctx.btcPrice >= 1000 ? `$${Math.round(ctx.btcPrice).toLocaleString()}` : `$${ctx.btcPrice.toFixed(2)}`;
    const cs = ctx.btcChange !== undefined ? ` (${ctx.btcChange >= 0 ? '+' : ''}${ctx.btcChange.toFixed(2)}% 24h)` : '';
    snap.push(`BTC: ${ps}${cs}`);
  }
  if (ctx.btcOI) snap.push(`BTC OI: $${(ctx.btcOI / 1e9).toFixed(2)}B`);
  if (ctx.fearGreed) snap.push(`F&G: ${ctx.fearGreed.value} (${ctx.fearGreed.classification})`);
  if (snap.length) p += `MARKET: ${snap.join(' | ')}\n`;

  if (ctx.portfolio && ctx.portfolio.length > 0) {
    p += `PORTFOLIO: ${ctx.portfolio.map((h) => `${h.quantity} ${h.symbol} @$${h.avgPrice.toLocaleString()}`).join(', ')}\n`;
  }
  if (ctx.watchlist && ctx.watchlist.length > 0) {
    p += `WATCHLIST: ${ctx.watchlist.join(', ')}\n`;
  }

  p += `
KEY FRAMEWORKS:
- Funding >0.03%/8h=crowded longs. Negative=shorts dominant. Spread>0.05%=arb.
- OI+price: both rising=trend. OI up+price down=squeeze risk. OI down+price up=short covering. Both down=capitulation.
- MTF: Daily=bias, 4H=structure, 1H=entry. Volume confirms breakouts.
- Macro: DXY inverse to risk. 10Y up=risk-off. BTC.D up=crypto risk-off.
- Rate normalization: CEX=8h, Hyperliquid=1h(×8), some=4h(×2).

CHARTS: Read chart first. ID timeframe, trend, structure (HH/HL or LH/LL), patterns, S/R, indicators. Give bias+entry+stop+target.

TOOLS: Cross-reference 2-3 tools. Coin→funding+OI+tickers. Bias→+whales+L/S. Overview→F&G+movers+OI.

STYLE: 3-6 sentences. Verdict first. Zero filler. Trader-to-trader. Bold key numbers. Synthesize into one thesis. Trade ideas=entry/stop/target/R:R.`;

  return p;
}
