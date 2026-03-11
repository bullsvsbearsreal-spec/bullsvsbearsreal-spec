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
  type?: string;
  currency?: string;
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
      case 'get_news':
        return await getNews(ctx);
      case 'get_market_dominance':
        return await getMarketDominance(ctx);
      case 'get_real_liquidations':
        return await getRealLiquidations(input, ctx);
      case 'get_etf_flows':
        return await getEtfFlows(input, ctx);
      case 'get_options_data':
        return await getOptionsData(input, ctx);
      case 'get_onchain_metrics':
        return await getOnchainMetrics(ctx);
      case 'get_market_cycle':
        return await getMarketCycle(ctx);
      case 'get_prediction_markets':
        return await getPredictionMarkets(ctx);
      case 'get_oi_delta':
        return await getOIDelta(ctx);
      case 'get_stablecoin_flows':
        return await getStablecoinFlows(ctx);
      case 'get_rsi_data':
        return await getRsiData(input, ctx);
      case 'get_execution_costs':
        return await getExecutionCosts(input, ctx);
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
    signal: AbortSignal.timeout(15_000), // 15s timeout — prevent hung requests
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

    const total = filtered.reduce((sum: number, r: any) => sum + (r.openInterestValue || 0), 0);
    const rows = filtered
      .sort((a: any, b: any) => (b.openInterestValue || 0) - (a.openInterestValue || 0))
      .map((r: any) => `${r.exchange}: $${formatNum(r.openInterestValue)}`);
    return `Open interest for ${sym}:\nTotal: $${formatNum(total)}\n${rows.join('\n')}`;
  }

  // Aggregate by symbol, top 20
  const bySymbol = new Map<string, number>();
  entries.forEach((r: any) => {
    const cur = bySymbol.get(r.symbol) || 0;
    bySymbol.set(r.symbol, cur + (r.openInterestValue || 0));
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
    (t: any) => `${t.symbol}: +${(t.change24h ?? t.priceChangePercent24h ?? 0).toFixed(2)}% ($${formatNum(t.price ?? t.lastPrice ?? 0)})`,
  );
  const lRows = losers.map(
    (t: any) => `${t.symbol}: ${(t.change24h ?? t.priceChangePercent24h ?? 0).toFixed(2)}% ($${formatNum(t.price ?? t.lastPrice ?? 0)})`,
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
    const change = filtered[0]?.priceChangePercent24h ?? 0;
    const totalVol = filtered.reduce((s: number, t: any) => s + (t.quoteVolume24h || 0), 0);
    const exchanges = filtered.map((t: any) => `${t.exchange}: $${formatNum(t.lastPrice)}`);

    return `${sym} Price: $${formatNum(avgPrice)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}% 24h)\n24h Volume: $${formatNum(totalVol)}\n\nBy exchange:\n${exchanges.join('\n')}`;
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
  const entries: any[] = data.points || data.data || [];

  if (entries.length === 0) return `No historical funding data for ${sym} over ${days} days.`;

  // Summarize: average, min, max, recent trend
  const rates = entries.map((e: any) => e.rate || e.avgRate || e.fundingRate || 0);
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

  // Normalize all rates to 8h equivalent for apples-to-apples comparison
  const intervalMultiplier: Record<string, number> = { '1h': 8, '4h': 2, '8h': 1 };
  function to8h(rate: number, interval: string): number {
    return rate * (intervalMultiplier[interval] || 1);
  }

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
    long: { exchange: string; rate: number; interval: string };
    short: { exchange: string; rate: number; interval: string };
    annualized: number;
  }> = [];

  bySymbol.forEach((symbolRates, symbol) => {
    if (symbolRates.length < 2) return;
    // Sort by normalized 8h-equivalent rate
    const sorted = symbolRates.sort((a: any, b: any) =>
      to8h(a.fundingRate, a.fundingInterval || '8h') - to8h(b.fundingRate, b.fundingInterval || '8h'),
    );
    const lowest = sorted[0]; // Most negative = pay this side to go short (or collect to go long)
    const highest = sorted[sorted.length - 1]; // Most positive

    const normLow = to8h(lowest.fundingRate, lowest.fundingInterval || '8h');
    const normHigh = to8h(highest.fundingRate, highest.fundingInterval || '8h');
    const spread = normHigh - normLow;
    if (spread < minSpread) return;

    // Annualized: 8h-normalized spread * 3 per day * 365
    const annualized = spread * 3 * 365;

    opportunities.push({
      symbol,
      spread,
      long: { exchange: lowest.exchange, rate: lowest.fundingRate, interval: lowest.fundingInterval || '8h' },
      short: { exchange: highest.exchange, rate: highest.fundingRate, interval: highest.fundingInterval || '8h' },
      annualized,
    });
  });

  opportunities.sort((a, b) => b.spread - a.spread);
  const top = opportunities.slice(0, 10);

  if (top.length === 0) return `No arbitrage opportunities with spread > ${minSpread}%.`;

  const rows = top.map(
    (o) =>
      `${o.symbol}: Spread ${o.spread.toFixed(4)}% (${o.annualized.toFixed(0)}% APR)\n  Long on ${o.long.exchange} (${o.long.rate.toFixed(4)}%/${o.long.interval}) / Short on ${o.short.exchange} (${o.short.rate.toFixed(4)}%/${o.short.interval})`,
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
    const total = filtered.reduce((s: number, r: any) => s + (r.openInterestValue || r.openInterest || 0), 0);
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

// ---- New Tools: News, Dominance, Real Liquidations, ETF Flows ----

async function getNews(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/news');
  const articles: any[] = (data.articles || data.data || []).slice(0, 10);

  if (articles.length === 0) return 'No recent crypto news available.';

  const rows = articles.map((a: any) => {
    const date = new Date(a.publishedAt || a.published_on * 1000 || a.date).toLocaleDateString();
    return `${date} | ${a.source || 'Unknown'} | ${a.title}`;
  });
  return `Latest Crypto News:\n${rows.join('\n')}`;
}

async function getMarketDominance(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/dominance');
  const d = data.data || data;

  if (!d) return 'Market dominance data unavailable.';

  const lines: string[] = ['Market Overview:'];
  if (d.btcDominance !== undefined) lines.push(`BTC Dominance: ${d.btcDominance.toFixed(1)}%`);
  if (d.ethDominance !== undefined) lines.push(`ETH Dominance: ${d.ethDominance.toFixed(1)}%`);
  if (d.totalMarketCap !== undefined) lines.push(`Total Market Cap: $${formatNum(d.totalMarketCap)}`);
  if (d.totalVolume !== undefined) lines.push(`24h Volume: $${formatNum(d.totalVolume)}`);
  if (d.activeCryptocurrencies !== undefined) lines.push(`Active Cryptos: ${d.activeCryptocurrencies.toLocaleString()}`);
  if (d.marketCapChangePercentage24h !== undefined) {
    lines.push(`Market Cap 24h Change: ${d.marketCapChangePercentage24h >= 0 ? '+' : ''}${d.marketCapChangePercentage24h.toFixed(2)}%`);
  }

  return lines.join('\n');
}

async function getRealLiquidations(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const sym = input.symbol?.toUpperCase();
  if (!sym) return 'Symbol is required for liquidation data.';

  const data = await fetchApi(ctx, `/api/liquidations?symbol=${sym}&limit=50`);
  const liqs: any[] = data.data || [];

  if (liqs.length === 0) return `No recent liquidation data for ${sym}. Data available from OKX (7-day window).`;

  // Summarize
  let totalLong = 0;
  let totalShort = 0;
  let longCount = 0;
  let shortCount = 0;

  liqs.forEach((l: any) => {
    const val = l.value || l.size || l.amount || 0;
    if (l.side === 'long' || l.posSide === 'long') {
      totalLong += val;
      longCount++;
    } else {
      totalShort += val;
      shortCount++;
    }
  });

  const recent = liqs.slice(0, 10).map((l: any) => {
    const time = new Date(l.timestamp || l.ts).toLocaleTimeString();
    const side = l.side || l.posSide || 'unknown';
    const val = l.value || l.size || l.amount || 0;
    return `${time} | ${side.toUpperCase()} $${formatNum(val)} @ $${formatNum(l.price || l.bkPx)}`;
  });

  return `${sym} Recent Liquidations (OKX):\nLong liquidations: ${longCount} totaling $${formatNum(totalLong)}\nShort liquidations: ${shortCount} totaling $${formatNum(totalShort)}\n\nRecent events:\n${recent.join('\n')}`;
}

async function getEtfFlows(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const etfType = input.type || 'btc';
  const data = await fetchApi(ctx, `/api/etf?type=${etfType}`);
  const funds: any[] = data.funds || data.data || [];

  if (funds.length === 0) return `No ${etfType.toUpperCase()} ETF data available.`;

  const rows = funds.slice(0, 10).map((f: any) => {
    const flow = f.dailyFlow !== undefined ? ` | Flow: ${f.dailyFlow >= 0 ? '+' : ''}$${formatNum(f.dailyFlow)}` : '';
    const aum = f.aum !== undefined ? ` | AUM: $${formatNum(f.aum)}` : '';
    const price = f.price !== undefined ? ` | $${f.price.toFixed(2)}` : '';
    return `${f.ticker || f.symbol}: ${f.name || f.issuer || ''}${price}${aum}${flow}`;
  });

  const totalAum = funds.reduce((s: number, f: any) => s + (f.aum || 0), 0);
  const totalFlow = funds.reduce((s: number, f: any) => s + (f.dailyFlow || 0), 0);

  let summary = `${etfType.toUpperCase()} Spot ETFs:\n`;
  if (totalAum > 0) summary += `Total AUM: $${formatNum(totalAum)}\n`;
  if (totalFlow !== 0) summary += `Total Daily Flow: ${totalFlow >= 0 ? '+' : ''}$${formatNum(totalFlow)}\n`;
  summary += `\n${rows.join('\n')}`;

  return summary;
}

// ---- New Tools: Options, On-chain, Cycle, Predictions, OI Delta, Stablecoins, RSI, Execution ----

async function getOptionsData(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const currency = (input.currency || 'BTC').toUpperCase();
  const data = await fetchApi(ctx, `/api/options?currency=${currency}`);

  if (!data || !data.underlyingPrice) return `No options data available for ${currency}.`;

  const lines = [
    `${currency} Options Summary:`,
    `Price: $${formatNum(data.underlyingPrice)} | Max Pain: $${formatNum(data.maxPain)}`,
    `Put/Call Ratio: ${data.putCallRatio?.toFixed(2) || 'N/A'} (${data.putCallRatio != null && data.putCallRatio < 0.7 ? 'bullish — call-heavy' : data.putCallRatio != null && data.putCallRatio > 1.3 ? 'bearish — put-heavy' : 'neutral'})`,
    `Total Options OI: $${formatNum(data.totalOI)} (Call: $${formatNum(data.totalCallOI)}, Put: $${formatNum(data.totalPutOI)})`,
    `Instruments: ${data.instrumentCount}`,
  ];

  // Exchange breakdown
  const exchanges: any[] = data.exchangeBreakdown || [];
  if (exchanges.length > 0) {
    lines.push('', 'By Exchange:');
    exchanges.slice(0, 5).forEach((e: any) => {
      lines.push(`  ${e.exchange}: $${formatNum(e.totalOI)} (${e.share?.toFixed(1)}%)`);
    });
  }

  // Top expiry dates
  const expiries: any[] = data.expiryBreakdown || [];
  if (expiries.length > 0) {
    lines.push('', 'Top Expiries:');
    expiries.slice(0, 5).forEach((e: any) => {
      lines.push(`  ${new Date(e.date).toLocaleDateString()}: $${formatNum(e.totalOI)} (PCR: ${e.putOI > 0 ? (e.putOI / (e.callOI || 1)).toFixed(2) : 'N/A'})`);
    });
  }

  return lines.join('\n');
}

async function getOnchainMetrics(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/onchain');
  if (!data) return 'On-chain metrics unavailable.';

  const lines = ['BTC On-Chain Metrics:'];

  if (data.hashRate) {
    const change = data.hashRate.change30d != null ? ` (${data.hashRate.change30d >= 0 ? '+' : ''}${data.hashRate.change30d.toFixed(1)}% 30d)` : '';
    lines.push(`Hash Rate: ${formatNum(data.hashRate.current)} ${data.hashRate.unit || 'TH/s'}${change}`);
  }
  if (data.difficulty?.nextAdjustment) {
    lines.push(`Next Difficulty Adj: ${data.difficulty.nextAdjustment.estimatedPercent >= 0 ? '+' : ''}${data.difficulty.nextAdjustment.estimatedPercent.toFixed(1)}% in ${data.difficulty.nextAdjustment.remainingBlocks} blocks`);
  }
  if (data.puellMultiple) {
    lines.push(`Puell Multiple: ${data.puellMultiple.current?.toFixed(2) || 'N/A'} (${data.puellMultiple.signal})`);
  }
  if (data.mvrv) {
    const zStr = data.mvrv.zScore != null ? ` | Z-Score: ${data.mvrv.zScore.toFixed(2)}` : '';
    lines.push(`MVRV: ${data.mvrv.current?.toFixed(2) || 'N/A'} (${data.mvrv.signal})${zStr}`);
  }
  if (data.minerRevenue) {
    lines.push(`Miner Revenue: $${formatNum(data.minerRevenue.current)}/day`);
  }
  if (data.mempool) {
    const fees = data.mempool.recommendedFees;
    lines.push(`Mempool: ${data.mempool.pendingTxCount?.toLocaleString() || '?'} pending tx`);
    if (fees) lines.push(`Fees: ${fees.fastest} sat/vB (fast) | ${fees.economy} sat/vB (econ)`);
  }
  if (data.supply) {
    lines.push(`Supply: ${formatNum(data.supply.current)} BTC (${data.supply.percentMined?.toFixed(1)}% mined)`);
  }

  return lines.join('\n');
}

async function getMarketCycle(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/market-cycle');
  if (!data) return 'Market cycle data unavailable.';

  const lines = ['BTC Market Cycle Indicators:'];

  if (data.piCycle) {
    const signalMap: Record<string, string> = {
      'neutral': 'No signal',
      'approaching_top': 'WARNING: Approaching cycle top',
      'approaching_bottom': 'Signal: Approaching cycle bottom',
    };
    lines.push(`Pi Cycle: ${signalMap[data.piCycle.signal] || data.piCycle.signal}`);
  }
  if (data.rainbow) {
    lines.push(`Rainbow Band: "${data.rainbow.currentBand}"`);
  }
  if (data.stockToFlow) {
    const s2f = data.stockToFlow;
    const devDir = s2f.deviation >= 0 ? 'above' : 'below';
    lines.push(`Stock-to-Flow: Ratio ${s2f.ratio?.toFixed(1)} | Model: $${formatNum(s2f.modelPrice)} | Actual: $${formatNum(s2f.actualPrice)}`);
    lines.push(`  ${Math.abs(s2f.deviation).toFixed(0)}% ${devDir} S2F model`);
  }
  if (data.weeklyMA200?.ma?.length > 0) {
    const latestMA = data.weeklyMA200.ma[data.weeklyMA200.ma.length - 1];
    lines.push(`200W MA: $${formatNum(latestMA.value)}`);
  }

  return lines.join('\n');
}

async function getPredictionMarkets(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/prediction-markets');
  if (!data) return 'Prediction market data unavailable.';

  const arbs: any[] = data.arbitrage || [];
  const meta = data.meta || {};

  const lines = [`Prediction Markets (${meta.counts?.polymarket || 0} Polymarket, ${meta.counts?.kalshi || 0} Kalshi):`];

  if (arbs.length === 0) {
    lines.push('No cross-platform arbitrage opportunities found.');
  } else {
    lines.push('', 'Top Arb Opportunities:');
    arbs.slice(0, 7).forEach((a: any, i: number) => {
      lines.push(`${i + 1}. ${a.question}`);
      lines.push(`   ${a.platformA?.platform || '?'}: ${((a.platformA?.yesPrice ?? 0) * 100).toFixed(0)}% Yes | ${a.platformB?.platform || '?'}: ${((a.platformB?.yesPrice ?? 0) * 100).toFixed(0)}% Yes`);
      lines.push(`   Spread: ${a.spreadPercent?.toFixed(1)}% | Category: ${a.category || 'Other'}`);
    });
  }

  return lines.join('\n');
}

async function getOIDelta(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/oi-delta');
  const entries: any[] = data?.data || [];

  if (entries.length === 0) return 'OI delta data unavailable.';

  // Sort by absolute 1h change
  const sorted = entries
    .filter((e: any) => e.delta1h != null)
    .sort((a: any, b: any) => Math.abs(b.delta1h) - Math.abs(a.delta1h));

  const top = sorted.slice(0, 15);
  const lines = ['OI Momentum (% change):'];
  lines.push('Symbol    1h      4h      24h');
  top.forEach((e: any) => {
    const d1h = e.delta1h != null ? `${e.delta1h >= 0 ? '+' : ''}${e.delta1h.toFixed(1)}%` : '  N/A';
    const d4h = e.delta4h != null ? `${e.delta4h >= 0 ? '+' : ''}${e.delta4h.toFixed(1)}%` : '  N/A';
    const d24h = e.delta24h != null ? `${e.delta24h >= 0 ? '+' : ''}${e.delta24h.toFixed(1)}%` : '  N/A';
    lines.push(`${e.symbol.padEnd(10)}${d1h.padStart(7)} ${d4h.padStart(7)} ${d24h.padStart(7)}`);
  });

  return lines.join('\n');
}

async function getStablecoinFlows(ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/stablecoins');
  const coins: any[] = data?.stablecoins || [];
  const totalMcap = data?.totalMcap || 0;

  if (coins.length === 0) return 'Stablecoin data unavailable.';

  const lines = [`Stablecoin Supply: $${formatNum(totalMcap)} total`];
  lines.push('');
  coins.slice(0, 8).forEach((c: any) => {
    const change7d = c.change7d != null ? `${c.change7d >= 0 ? '+' : ''}${c.change7d.toFixed(2)}% 7d` : '';
    const change30d = c.change30d != null ? ` | ${c.change30d >= 0 ? '+' : ''}${c.change30d.toFixed(2)}% 30d` : '';
    lines.push(`${c.symbol}: $${formatNum(c.mcap)} ${change7d}${change30d}`);
  });

  // Overall signal
  const topByMcap = coins[0]; // USDT likely
  if (topByMcap?.change7d != null) {
    const signal = topByMcap.change7d > 1 ? 'Strong inflow (risk-on)' : topByMcap.change7d > 0 ? 'Mild inflow' : topByMcap.change7d > -1 ? 'Mild outflow' : 'Strong outflow (risk-off)';
    lines.push(`\nSignal: ${signal} (${topByMcap.symbol} 7d: ${topByMcap.change7d >= 0 ? '+' : ''}${topByMcap.change7d.toFixed(2)}%)`);
  }

  return lines.join('\n');
}

async function getRsiData(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const data = await fetchApi(ctx, '/api/rsi');
  const entries: any[] = data?.data || [];

  if (entries.length === 0) return 'RSI data unavailable.';

  if (input.symbol) {
    const sym = input.symbol.toUpperCase();
    const found = entries.find((e: any) => e.symbol === sym);
    if (!found) return `No RSI data for ${sym}.`;

    const label = (rsi: number | null) => {
      if (rsi == null) return 'N/A';
      if (rsi >= 70) return `${rsi.toFixed(0)} (overbought)`;
      if (rsi <= 30) return `${rsi.toFixed(0)} (oversold)`;
      return `${rsi.toFixed(0)}`;
    };
    return `${sym} RSI-14:\n1h: ${label(found.rsi1h)}\n4h: ${label(found.rsi4h)}\n1d: ${label(found.rsi1d)}\nPrice: $${formatNum(found.price)} (${found.change24h >= 0 ? '+' : ''}${found.change24h?.toFixed(2)}% 24h)`;
  }

  // Top oversold and overbought
  const withRsi = entries.filter((e: any) => e.rsi1d != null);
  const overbought = withRsi.filter((e: any) => e.rsi1d >= 70).sort((a: any, b: any) => b.rsi1d - a.rsi1d).slice(0, 5);
  const oversold = withRsi.filter((e: any) => e.rsi1d <= 30).sort((a: any, b: any) => a.rsi1d - b.rsi1d).slice(0, 5);

  const lines = ['RSI-14 Extremes (1D):'];
  if (overbought.length > 0) {
    lines.push('', 'Overbought (>70):');
    overbought.forEach((e: any) => lines.push(`  ${e.symbol}: 1h=${e.rsi1h?.toFixed(0) || '?'} 4h=${e.rsi4h?.toFixed(0) || '?'} 1d=${e.rsi1d.toFixed(0)}`));
  }
  if (oversold.length > 0) {
    lines.push('', 'Oversold (<30):');
    oversold.forEach((e: any) => lines.push(`  ${e.symbol}: 1h=${e.rsi1h?.toFixed(0) || '?'} 4h=${e.rsi4h?.toFixed(0) || '?'} 1d=${e.rsi1d.toFixed(0)}`));
  }
  if (overbought.length === 0 && oversold.length === 0) {
    lines.push('No extremes found — all symbols in 30-70 range.');
  }

  return lines.join('\n');
}

async function getExecutionCosts(input: ToolInput, ctx: ExecuteContext): Promise<string> {
  const sym = (input.symbol || 'BTC').toUpperCase();
  const data = await fetchApi(ctx, `/api/execution-costs?asset=${sym}&size=100000&direction=long`);

  if (!data || !data.venues || data.venues.length === 0) return `No execution cost data for ${sym}.`;

  const venues: any[] = data.venues;
  const lines = [`Execution Costs for $100K ${sym} Long:`];
  venues.slice(0, 10).forEach((v: any) => {
    const slippage = v.slippage != null ? `${v.slippage.toFixed(3)}%` : 'N/A';
    const cost = v.estimatedCost != null ? `$${formatNum(v.estimatedCost)}` : 'N/A';
    lines.push(`  ${v.name}: Slippage ${slippage} | Est. cost: ${cost}`);
  });

  return lines.join('\n');
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
