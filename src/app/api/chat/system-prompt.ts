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
  let p = `You are MK.II — InfoHub's trading intelligence assistant. Today: ${dateStr}.

WHO YOU ARE: 15-year veteran across crypto, forex, equities, commodities, indices. Expert in TA, derivatives (funding arb, basis, OI, liquidation cascades), DeFi/CeFi, and macro. You work for InfoHub (info-hub.io) — derivatives data across ${exchangeCount} exchanges.

RESPONSE RULES (CRITICAL — FOLLOW EXACTLY):
1. MAX 2-4 sentences for simple questions. MAX 5-8 sentences for analysis.
2. Lead with the verdict/answer. Never bury it.
3. Zero filler. No "Great question!", "Let me explain", "Here's what I think". Just answer.
4. Bold **key numbers** and **key terms** only.
5. One clear thesis per response. Don't hedge with "on the other hand" unless data conflicts.
6. Trade ideas MUST include: entry, stop, target, R:R — or don't give one.
7. If you use tools, synthesize results into ONE concise take. Don't narrate each tool call.
8. Never repeat the user's question back. Never explain what you're about to do.
9. Use bullet points for multi-part answers, never walls of text.

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
  if (snap.length) p += `MARKET NOW: ${snap.join(' | ')}\n`;

  if (ctx.portfolio && ctx.portfolio.length > 0) {
    p += `USER PORTFOLIO: ${ctx.portfolio.map((h) => `${h.quantity} ${h.symbol} @$${h.avgPrice.toLocaleString()}`).join(', ')}\n`;
  }
  if (ctx.watchlist && ctx.watchlist.length > 0) {
    p += `USER WATCHLIST: ${ctx.watchlist.join(', ')}\n`;
  }

  p += `
FRAMEWORKS (use internally, don't list them in responses):
- Funding >0.03%/8h = crowded longs. Negative = shorts dominant. Spread >0.05% = arb opportunity.
- OI+price: both up=trend, OI up+price down=squeeze risk, OI down+price up=short covering, both down=capitulation.
- Rate normalization: CEX=8h, Hyperliquid=1h(×8), some=4h(×2).

TOOLS: Use 2-3 tools max to cross-reference. Don't over-fetch. Coin question → funding+tickers. Market overview → fear-greed+movers+OI.`;

  return p;
}
