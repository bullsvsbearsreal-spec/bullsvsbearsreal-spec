/**
 * Executes tool calls by fetching data from internal API routes.
 * Each tool returns a compressed result (max ~2000 tokens).
 */

interface ToolInput {
  symbol?: string;
  coin?: string;
  assetClass?: string;
  period?: string;
  exchange?: string;
  days?: number;
  minSpread?: number;
}

interface ExecuteContext {
  origin: string; // e.g., "https://info-hub.io"
  portfolio?: Array<{ symbol: string; quantity: number; avgPrice: number }>;
}

export async function executeTool(
  toolName: string,
  input: ToolInput,
  ctx: ExecuteContext,
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_funding_rates':
        return await getFundingRates(input, ctx);
      case 'get_open_interest':
        return await getOpenInterest(input, ctx);
      case 'get_fear_greed_index':
        return await getFearGreed(ctx);
      case 'get_top_movers':
        return await getTopMovers(ctx);
      case 'get_long_short_ratio':
        return await getLongShort(input, ctx);
      case 'get_whale_positions':
        return await getWhalePositions(input, ctx);
      case 'get_token_unlocks':
        return await getTokenUnlocks(ctx);
      case 'get_tickers':
        return await getTickers(input, ctx);
      case 'get_funding_history':
        return await getFundingHistory(input, ctx);
      case 'get_economic_calendar':
        return await getEconomicCalendar(ctx);
      case 'analyze_portfolio':
        return await analyzePortfolio(ctx);
      case 'find_arbitrage_opportunities':
        return await findArbitrage(input, ctx);
      case 'get_liquidations':
        return await getLiquidations(input, ctx);
      case 'get_oi_history':
        return await getOiHistory(input, ctx);
      case 'get_correlation':
        return await getCorrelation(input, ctx);
      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error) {
    return `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function fetchApi(ctx: ExecuteContext, path: string): Promise<any> {
  const res = await fetch(`${ctx.origin}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json();
}

// ---- Tool Implementations ----

async function getFundingRates(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const ac = input.assetClass || 'crypto';
  const data = await fetchApi(ctx, `/api/funding?assetClass=${ac}`);
  const rates: any[] = data.data || [];

  if (input.symbol) {
    const sym = input.symbol.toUpperCase();
    const filtered = rates.filter((r: any) => r.symbol === sym);
    if (filtered.length === 0) return `No funding rate data found for ${sym}.`;

    const rows = filtered
      .sort((a: any, b: any) => b.fundingRate - a.fundingRate)
      .map(
        (r: any) =>
          `${r.exchange}: ${r.fundingRate.toFixed(4)}% (${r.fundingInterval || '8h'})${r.predictedRate !== undefined ? ` | predicted: ${r.predictedRate.toFixed(4)}%` : ''}`,
      );
    return `Funding rates for ${sym}:\n${rows.join('\n')}`;
  }

  // Top 15 by absolute rate
  const sorted = rates
    .sort((a: any, b: any) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
    .slice(0, 15);
  const rows = sorted.map(
    (r: any) =>
      `${r.symbol} ${r.exchange}: ${r.fundingRate.toFixed(4)}% (${r.fundingInterval || '8h'})`,
  );
  return `Top 15 funding rates by magnitude:\n${rows.join('\n')}\n\nTotal entries: ${rates.length}`;
}

async function getOpenInterest(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/openinterest');
  const entries: any[] = data.data || [];

  if (input.symbol) {
    const sym = input.symbol.toUpperCase();
    const filtered = entries.filter((r: any) => r.symbol === sym);
    if (filtered.length === 0) return `No open interest data found for ${sym}.`;

    const total = filtered.reduce((sum: number, r: any) => sum + (r.openInterest || 0), 0);
    const rows = filtered
      .sort((a: any, b: any) => (b.openInterest || 0) - (a.openInterest || 0))
      .map((r: any) => `${r.exchange}: $${formatNum(r.openInterest)}`);
    return `Open interest for ${sym}:\nTotal: $${formatNum(total)}\n${rows.join('\n')}`;
  }

  // Aggregate by symbol, top 20
  const bySymbol = new Map<string, number>();
  entries.forEach((r: any) => {
    const cur = bySymbol.get(r.symbol) || 0;
    bySymbol.set(r.symbol, cur + (r.openInterest || 0));
  });
  const sorted = Array.from(bySymbol.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  const rows = sorted.map(([sym, oi]) => `${sym}: $${formatNum(oi)}`);
  const totalOI = sorted.reduce((s, [, oi]) => s + oi, 0);
  return `Top 20 by open interest (total shown: $${formatNum(totalOI)}):\n${rows.join('\n')}`;
}

async function getFearGreed(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/fear-greed?history=true&limit=7');
  const current = data.current || data;
  const value = current.value;
  const classification = current.classification;
  const history = data.history || [];

  let result = `Fear & Greed Index: ${value} (${classification})`;
  if (history.length > 0) {
    const recent = history.slice(0, 7).map(
      (h: any) => `${new Date(h.timestamp).toLocaleDateString()}: ${h.value} (${h.classification})`,
    );
    result += `\n\nLast 7 days:\n${recent.join('\n')}`;
  }
  return result;
}

async function getTopMovers(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/top-movers');
  const gainers: any[] = (data.gainers || []).slice(0, 10);
  const losers: any[] = (data.losers || []).slice(0, 10);

  const gRows = gainers.map(
    (t: any) => `${t.symbol}: +${(t.change24h ?? t.priceChangePercent24h)?.toFixed(2)}% ($${formatNum(t.price ?? t.lastPrice)})`,
  );
  const lRows = losers.map(
    (t: any) => `${t.symbol}: ${(t.change24h ?? t.priceChangePercent24h)?.toFixed(2)}% ($${formatNum(t.price ?? t.lastPrice)})`,
  );
  return `Top Gainers (24h):\n${gRows.join('\n')}\n\nTop Losers (24h):\n${lRows.join('\n')}`;
}

async function getLongShort(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const symbol = input.symbol || 'BTCUSDT';
  const period = input.period || '1h';
  const data = await fetchApi(ctx, `/api/longshort?symbol=${symbol}&period=${period}&limit=5`);
  const entries: any[] = data.data || [];

  if (entries.length === 0) return `No long/short data for ${symbol}.`;

  const rows = entries.map(
    (e: any) =>
      `${new Date(e.timestamp).toLocaleString()}: Long ${(e.longAccount * 100).toFixed(1)}% / Short ${(e.shortAccount * 100).toFixed(1)}% (ratio: ${e.longShortRatio?.toFixed(2)})`,
  );
  return `Long/Short Ratio for ${symbol} (${period} intervals):\n${rows.join('\n')}`;
}

async function getWhalePositions(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/hl-whales');
  const allWhales: any[] = data || [];
  const coinFilter = (input.coin || input.symbol)?.toUpperCase();

  if (allWhales.length === 0) return 'No whale data available.';

  if (coinFilter) {
    // Filter whales who have positions in this coin
    const relevant: Array<{ whale: any; position: any }> = [];
    allWhales.forEach((w: any) => {
      const pos = (w.positions || []).find((p: any) => p.coin?.toUpperCase() === coinFilter);
      if (pos) relevant.push({ whale: w, position: pos });
    });

    if (relevant.length === 0) return `No whales currently have ${coinFilter} positions on Hyperliquid.`;

    relevant.sort((a, b) => Math.abs(b.position.positionValue || 0) - Math.abs(a.position.positionValue || 0));
    const rows = relevant.slice(0, 15).map(({ whale, position }) => {
      const p = position;
      return `${whale.label || whale.address?.slice(0, 10)}... (AV: $${formatNum(whale.accountValue)}) | ${p.side} ${p.coin}: $${formatNum(Math.abs(p.positionValue || p.size * p.entryPrice))} @ ${p.leverage}x | PnL: $${formatNum(p.unrealizedPnl)} (${(p.roe * 100).toFixed(1)}%)`;
    });
    return `Whales with ${coinFilter} positions on Hyperliquid:\n${rows.join('\n')}`;
  }

  // Top 10 whales overview
  const whales = allWhales.slice(0, 10);
  const rows = whales.map((w: any) => {
    const positions = (w.positions || [])
      .slice(0, 3)
      .map(
        (p: any) =>
          `  ${p.coin} ${p.side}: $${formatNum(Math.abs(p.positionValue || p.size * p.entryPrice))} @ ${p.leverage}x (PnL: $${formatNum(p.unrealizedPnl)})`,
      )
      .join('\n');
    return `${w.label || w.address?.slice(0, 10)}... | AV: $${formatNum(w.accountValue)} | Positions: ${w.positionCount}\n${positions}`;
  });
  return `Top Hyperliquid Whales:\n${rows.join('\n\n')}`;
}

async function getTokenUnlocks(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/token-unlocks');
  const unlocks: any[] = (data.data || []).slice(0, 15);

  if (unlocks.length === 0) return 'No upcoming token unlock data available.';

  const rows = unlocks.map(
    (u: any) =>
      `${u.symbol || u.name}: ${new Date(u.unlockDate || u.date).toLocaleDateString()} | $${formatNum(u.valueUsd || u.value)} (${(u.percentOfSupply || u.pctSupply || 0).toFixed(2)}% of supply) | ${u.vestingType || 'unknown'}`,
  );
  return `Upcoming Token Unlocks:\n${rows.join('\n')}`;
}

async function getTickers(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/tickers');
  const tickers: any[] = data.data || [];

  if (input.symbol) {
    const sym = input.symbol.toUpperCase();
    const filtered = tickers.filter((t: any) => t.symbol === sym);
    if (filtered.length === 0) return `No price data found for ${sym}.`;

    // Average price across exchanges
    const avgPrice = filtered.reduce((s: number, t: any) => s + t.lastPrice, 0) / filtered.length;
    const change = filtered[0]?.priceChangePercent24h;
    const totalVol = filtered.reduce((s: number, t: any) => s + (t.quoteVolume24h || 0), 0);
    const exchanges = filtered.map((t: any) => `${t.exchange}: $${formatNum(t.lastPrice)}`);

    return `${sym} Price: $${formatNum(avgPrice)} (${change >= 0 ? '+' : ''}${change?.toFixed(2)}% 24h)\n24h Volume: $${formatNum(totalVol)}\n\nBy exchange:\n${exchanges.join('\n')}`;
  }

  // Top 20 by volume
  const bySymbol = new Map<string, { price: number; change: number; vol: number; count: number }>();
  tickers.forEach((t: any) => {
    const cur = bySymbol.get(t.symbol) || { price: 0, change: 0, vol: 0, count: 0 };
    cur.price += t.lastPrice;
    cur.change = t.priceChangePercent24h || cur.change;
    cur.vol += t.quoteVolume24h || 0;
    cur.count++;
    bySymbol.set(t.symbol, cur);
  });
  const sorted = Array.from(bySymbol.entries())
    .map(([sym, d]) => ({ sym, price: d.price / d.count, change: d.change, vol: d.vol }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, 20);
  const rows = sorted.map(
    (t) => `${t.sym}: $${formatNum(t.price)} (${t.change >= 0 ? '+' : ''}${t.change?.toFixed(2)}%) Vol: $${formatNum(t.vol)}`,
  );
  return `Top 20 by 24h volume:\n${rows.join('\n')}`;
}

async function getFundingHistory(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const sym = input.symbol?.toUpperCase();
  if (!sym) return 'Symbol is required for funding history.';
  const days = Math.min(input.days || 30, 90);
  const exParam = input.exchange ? `&exchange=${input.exchange}` : '';
  const data = await fetchApi(ctx, `/api/history/funding?symbol=${sym}&days=${days}${exParam}`);
  const entries: any[] = data.data || [];

  if (entries.length === 0) return `No historical funding data for ${sym} over ${days} days.`;

  // Summarize: average, min, max, recent trend
  const rates = entries.map((e: any) => e.avgRate || e.fundingRate || 0);
  const avg = rates.reduce((s: number, r: number) => s + r, 0) / rates.length;
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const recent = rates.slice(-7);
  const recentAvg = recent.reduce((s: number, r: number) => s + r, 0) / recent.length;

  return `${sym} Funding History (${days} days)${input.exchange ? ` on ${input.exchange}` : ''}:\nAverage: ${avg.toFixed(4)}%\nMin: ${min.toFixed(4)}% | Max: ${max.toFixed(4)}%\nLast 7 days avg: ${recentAvg.toFixed(4)}%\nTrend: ${recentAvg > avg ? 'Rising (recent > avg)' : recentAvg < avg ? 'Falling (recent < avg)' : 'Flat'}\nData points: ${entries.length}`;
}

async function getEconomicCalendar(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/economic-calendar');
  const events: any[] = (data.data || []).slice(0, 15);

  if (events.length === 0) return 'No upcoming economic events found.';

  const rows = events.map(
    (e: any) =>
      `${new Date(e.date || e.timestamp).toLocaleDateString()} | ${e.title || e.event} | Impact: ${e.impact || 'unknown'} | ${e.country || ''}`,
  );
  return `Upcoming Economic Events:\n${rows.join('\n')}`;
}

async function analyzePortfolio(ctx: ExecuteContext): Promise<string> {
  if (!ctx.portfolio || ctx.portfolio.length === 0) {
    return 'No portfolio holdings configured. The user can add holdings on the Portfolio page.';
  }

  const data = await fetchApi(ctx, '/api/tickers');
  const tickers: any[] = data.data || [];

  // Build price map (average across exchanges)
  const priceMap = new Map<string, { price: number; change: number; count: number }>();
  tickers.forEach((t: any) => {
    const cur = priceMap.get(t.symbol) || { price: 0, change: 0, count: 0 };
    cur.price += t.lastPrice;
    cur.change = t.priceChangePercent24h || cur.change;
    cur.count++;
    priceMap.set(t.symbol, cur);
  });

  let totalValue = 0;
  let totalCost = 0;
  const rows: string[] = [];

  for (const h of ctx.portfolio) {
    const sym = h.symbol.toUpperCase();
    const priceData = priceMap.get(sym);
    const currentPrice = priceData ? priceData.price / priceData.count : 0;
    const change24h = priceData?.change || 0;
    const value = h.quantity * currentPrice;
    const cost = h.quantity * h.avgPrice;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? ((pnl / cost) * 100) : 0;

    totalValue += value;
    totalCost += cost;

    rows.push(
      `${sym}: ${h.quantity} @ $${formatNum(h.avgPrice)} → $${formatNum(currentPrice)} | Value: $${formatNum(value)} | PnL: ${pnl >= 0 ? '+' : ''}$${formatNum(pnl)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%) | 24h: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`,
    );
  }

  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? ((totalPnl / totalCost) * 100) : 0;

  return `Portfolio Analysis:\n${rows.join('\n')}\n\nTotal Value: $${formatNum(totalValue)}\nTotal Cost: $${formatNum(totalCost)}\nTotal PnL: ${totalPnl >= 0 ? '+' : ''}$${formatNum(totalPnl)} (${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%)`;
}

async function findArbitrage(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/funding?assetClass=crypto');
  const rates: any[] = data.data || [];
  const minSpread = input.minSpread || 0.01;

  // Group by symbol
  const bySymbol = new Map<string, any[]>();
  rates.forEach((r: any) => {
    const list = bySymbol.get(r.symbol) || [];
    list.push(r);
    bySymbol.set(r.symbol, list);
  });

  // Find spreads
  const opportunities: Array<{
    symbol: string;
    spread: number;
    long: { exchange: string; rate: number };
    short: { exchange: string; rate: number };
    annualized: number;
  }> = [];

  bySymbol.forEach((symbolRates, symbol) => {
    if (symbolRates.length < 2) return;
    const sorted = symbolRates.sort((a: any, b: any) => a.fundingRate - b.fundingRate);
    const lowest = sorted[0]; // Most negative = pay this side to go short (or collect to go long)
    const highest = sorted[sorted.length - 1]; // Most positive

    const spread = highest.fundingRate - lowest.fundingRate;
    if (spread < minSpread) return;

    // Annualized: spread * 3 per day * 365 (for 8h intervals)
    const annualized = spread * 3 * 365;

    opportunities.push({
      symbol,
      spread,
      long: { exchange: lowest.exchange, rate: lowest.fundingRate },
      short: { exchange: highest.exchange, rate: highest.fundingRate },
      annualized,
    });
  });

  opportunities.sort((a, b) => b.spread - a.spread);
  const top = opportunities.slice(0, 10);

  if (top.length === 0) return `No arbitrage opportunities with spread > ${minSpread}%.`;

  const rows = top.map(
    (o) =>
      `${o.symbol}: Spread ${o.spread.toFixed(4)}% (${o.annualized.toFixed(0)}% APR)\n  Long on ${o.long.exchange} (${o.long.rate.toFixed(4)}%) / Short on ${o.short.exchange} (${o.short.rate.toFixed(4)}%)`,
  );
  return `Top Funding Arbitrage Opportunities:\n${rows.join('\n\n')}\n\nNote: Actual returns depend on exchange fees, withdrawal costs, and execution.`;
}

// ---- New Tools: Liquidations, OI History, Correlation ----

async function getLiquidations(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  // The correlation API has exchange-level data with volume; use tickers for liquidation proxy
  // InfoHub doesn't have a dedicated liquidation API endpoint yet, so approximate from whale data
  const data = await fetchApi(ctx, '/api/hl-whales');
  const whales: any[] = data || [];

  // Find positions with large negative PnL (recent liquidation-like events)
  const bigLosses: Array<{ whale: string; coin: string; side: string; pnl: number; value: number; leverage: number }> = [];
  whales.forEach((w: any) => {
    (w.positions || []).forEach((p: any) => {
      if (p.unrealizedPnl < -1000) {
        bigLosses.push({
          whale: w.label || w.address?.slice(0, 10) + '...',
          coin: p.coin,
          side: p.side,
          pnl: p.unrealizedPnl,
          value: Math.abs(p.positionValue || p.size * p.entryPrice),
          leverage: p.leverage,
        });
      }
    });
  });

  if (bigLosses.length === 0) return 'No significant underwater positions found among tracked whales.';

  bigLosses.sort((a, b) => a.pnl - b.pnl); // Most negative first
  const rows = bigLosses.slice(0, 15).map(
    (l) => `${l.whale} | ${l.coin} ${l.side} $${formatNum(l.value)} @ ${l.leverage}x | PnL: $${formatNum(l.pnl)}`,
  );

  if (input.symbol) {
    const sym = input.symbol.toUpperCase();
    const filtered = bigLosses.filter((l) => l.coin.toUpperCase() === sym);
    if (filtered.length === 0) return `No significant underwater ${sym} positions found.`;
    const fRows = filtered.slice(0, 10).map(
      (l) => `${l.whale} | ${l.side} $${formatNum(l.value)} @ ${l.leverage}x | PnL: $${formatNum(l.pnl)}`,
    );
    return `Underwater ${sym} positions (whale traders):\n${fRows.join('\n')}`;
  }

  return `Largest underwater whale positions:\n${rows.join('\n')}`;
}

async function getOiHistory(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const sym = input.symbol?.toUpperCase();
  if (!sym) return 'Symbol is required for OI history.';
  const days = Math.min(input.days || 7, 90);
  const data = await fetchApi(ctx, `/api/history/oi?symbol=${sym}&days=${days}`);
  const points: any[] = data.points || data.data || [];

  if (points.length === 0) {
    // Fallback: get current OI snapshot
    const oiData = await fetchApi(ctx, '/api/openinterest');
    const entries: any[] = oiData.data || [];
    const filtered = entries.filter((r: any) => r.symbol === sym);
    if (filtered.length === 0) return `No OI data for ${sym}.`;
    const total = filtered.reduce((s: number, r: any) => s + (r.openInterest || 0), 0);
    return `${sym} Current OI: $${formatNum(total)} across ${filtered.length} exchanges.\nHistorical OI data not available for this symbol.`;
  }

  const values = points.map((p: any) => p.totalOi || p.openInterest || 0);
  const first = values[0];
  const last = values[values.length - 1];
  const change = first > 0 ? ((last - first) / first * 100) : 0;
  const max = Math.max(...values);
  const min = Math.min(...values);

  return `${sym} OI over ${days} days:\nCurrent: $${formatNum(last)}\n${days}d change: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%\nHigh: $${formatNum(max)} | Low: $${formatNum(min)}\nTrend: ${change > 5 ? 'Building (bullish conviction)' : change < -5 ? 'Declining (positions closing)' : 'Flat'}\nData points: ${points.length}`;
}

async function getCorrelation(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/correlation');
  const symbols: any[] = data.symbols || [];

  if (symbols.length === 0) return 'No correlation data available.';

  if (input.symbol) {
    const sym = input.symbol.toUpperCase();
    const found = symbols.find((s: any) => s.symbol === sym);
    if (!found) return `No correlation data for ${sym}.`;

    const changes = (found.changes || [])
      .filter((c: any) => c.change24h !== 0)
      .sort((a: any, b: any) => b.change24h - a.change24h);
    const rows = changes.map(
      (c: any) => `${c.exchange}: ${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(2)}%`,
    );
    return `${sym} 24h change across exchanges (avg: ${found.avgChange >= 0 ? '+' : ''}${found.avgChange?.toFixed(2)}%):\n${rows.join('\n')}\nAvg price: $${formatNum(found.avgPrice)} | Volume: $${formatNum(found.totalVolume)} | Exchanges: ${found.exchangeCount}`;
  }

  // Top 20 overview
  const top = symbols.slice(0, 20);
  const rows = top.map(
    (s: any) => `${s.symbol}: ${s.avgChange >= 0 ? '+' : ''}${s.avgChange?.toFixed(2)}% | $${formatNum(s.avgPrice)} | Vol: $${formatNum(s.totalVolume)} | ${s.exchangeCount} exchanges`,
  );
  return `Market overview (24h changes):\n${rows.join('\n')}`;
}

// ---- Helpers ----

function formatNum(n: number): string {
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  if (Math.abs(n) < 0.01 && n !== 0) return n.toFixed(6);
  return n.toFixed(2);
}
