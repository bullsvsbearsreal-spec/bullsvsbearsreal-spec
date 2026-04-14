// Non-crypto symbols that gTrade/DEXes trade but should NOT appear in liquidation feed
// Stocks, forex, commodities — we only want crypto liquidations
const NON_CRYPTO_SYMBOLS = new Set([
  // Stocks
  'AAPL', 'AMZN', 'GOOGL', 'GOOG', 'META', 'MSFT', 'NFLX', 'NVDA', 'TSLA',
  'COIN', 'HOOD', 'MSTR', 'SQ', 'PYPL', 'RIOT', 'MARA', 'CLSK', 'CIFR',
  'AMD', 'INTC', 'ARM', 'AVGO', 'QCOM', 'TSM', 'MRVL', 'MU',
  'PLTR', 'UBER', 'ABNB', 'SNOW', 'CRM', 'ORCL', 'SHOP', 'NET', 'BA',
  'DIS', 'JPM', 'V', 'MA', 'WMT', 'KO', 'PEP', 'JNJ', 'PFE', 'LLY',
  'UNH', 'BRK', 'XOM', 'CVX', 'PG', 'NKE', 'MCD', 'HD', 'COST',
  'CSCO', 'ACN', 'ASML', 'RDDT', 'APP', 'IBM', 'GME', 'GE', 'RACE', 'CRCL', 'WDC',
  'SAMSUNG', 'SKHYNIX', 'HYUNDAI', 'HANMI', 'SNDK', 'KRCOMP',
  'SPY', 'SPX', 'QQQ', 'IWM', 'DIA', 'ARKK', 'NAS100', 'SPX500', 'URNM', 'SIREN',
  // Commodities
  'XAU', 'XAG', 'XPT', 'XPD', 'GOLD', 'SILVER', 'COPPER', 'XCU', 'HG',
  'WTI', 'BRENT', 'NATGAS', 'UKOIL', 'USOIL', 'CL', 'NG', 'SI', 'GC',
  'WHEAT', 'CORN', 'COFFEE', 'SUGAR', 'COTTON', 'COCOA', 'SOYBEAN',
  // Forex bases (gTrade pair.from for forex)
  'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD',
  'SEK', 'NOK', 'PLN', 'CZK', 'HUF', 'TRY', 'ZAR',
  'SGD', 'HKD', 'KRW', 'MXN', 'BRL', 'TWD', 'INR',
]);

// Symbol aliases for rebranded tokens
const LIQ_SYMBOL_ALIASES: Record<string, string> = {
  'RNDR': 'RENDER',
  'MATIC': 'POL',
};

/**
 * Normalize raw instrument names to clean symbols for liquidations.
 * Handles exchange-specific suffixes (-USDT-SWAP, -PERPETUAL, etc.),
 * quantity prefixes (1000SHIB, 1MBONK), and token rebrands (RNDR→RENDER).
 */
export function normalizeLiqSymbol(sym: string): string {
  let s = sym
    .replace(/-USDT-SWAP$/, '').replace(/-USDC-SWAP$/, '').replace(/-USD-SWAP$/, '').replace(/-SWAP$/, '')
    .replace(/-PERPETUAL$/, '').replace(/_UMCBL$/, '')
    .replace(/USD[_]?UM$/, '')           // Binance UM futures (BTCUSDUM, BTCUSD_UM)
    .replace(/\d{6}$/, '')               // Quarterly expiry dates (BTC260327, ETH260626)
    .replace(/-USDT$/, '').replace(/-USDC$/, '').replace(/-USD$/, '')
    .replace(/(?:USDT|USDC|USD)$/, '')
    .replace(/^1000000/, '').replace(/^10000/, '').replace(/^1000/, '').replace(/^1M/, '')
    .replace(/-/g, '');
  return LIQ_SYMBOL_ALIASES[s] || s;
}

/** Returns true if symbol is a crypto token (not forex/stock/commodity) */
export function isLiqCryptoSymbol(symbol: string): boolean {
  if (!symbol) return false;
  // Must be ASCII letters/digits only (rejects Chinese chars, special chars, etc.)
  if (!/^[A-Za-z0-9]+$/.test(symbol)) return false;
  return !NON_CRYPTO_SYMBOLS.has(symbol.toUpperCase());
}

export interface Liquidation {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  value: number;
  exchange: string;
  timestamp: number;
}

// Top symbols to subscribe to on Bybit (subscribes per-symbol)
export const BYBIT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
  'BNBUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'APTUSDT', 'ARBUSDT',
  'OPUSDT', 'NEARUSDT', 'FILUSDT', 'ATOMUSDT', 'INJUSDT',
  'SUIUSDT', 'PEPEUSDT', 'WIFUSDT', 'SEIUSDT', 'TIAUSDT',
];

// Note: BingX, MEXC removed — no public liquidation WS streams available (verified Mar 2026)
// HTX has public liquidation_orders channel per-symbol (re-added Mar 2026)

// WebSocket URLs for each exchange
// Top dYdX v4 markets for per-market trade subscription (filter for type=Liquidated)
export const DYDX_LIQ_MARKETS = [
  'BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD',
  'AVAX-USD', 'LINK-USD', 'ADA-USD', 'DOT-USD', 'NEAR-USD',
  'ARB-USD', 'OP-USD', 'SUI-USD', 'APT-USD', 'INJ-USD',
  'PEPE-USD', 'WIF-USD', 'SEI-USD', 'TIA-USD', 'FIL-USD',
];

export const EXCHANGE_WS_URLS: Record<string, string> = {
  Binance: 'wss://fstream.binance.com/ws/!forceOrder@arr',
  Bybit: 'wss://stream.bybit.com/v5/public/linear',
  OKX: 'wss://ws.okx.com:8443/ws/v5/public',
  Bitget: 'wss://ws.bitget.com/v2/ws/public',
  Deribit: 'wss://www.deribit.com/ws/api/v2',
  HTX: 'wss://api.hbdm.com/linear-swap-notification',
  gTrade: 'wss://backend-arbitrum.gains.trade/socket.io/?EIO=4&transport=websocket',
  dYdX: 'wss://indexer.dydx.trade/v4/ws',
  Bitfinex: 'wss://api-pub.bitfinex.com/ws/2',
  Hyperliquid: 'wss://api.hyperliquid.xyz/ws',
};

// Returns the JSON-stringified subscription messages to send after connecting
export function getSubscriptionMessages(exchange: string): string[] {
  switch (exchange) {
    case 'Bybit': {
      // allLiquidation topic — Bybit limits to 10 topics per subscribe message
      const args = BYBIT_SYMBOLS.map(s => `allLiquidation.${s}`);
      const messages: string[] = [];
      for (let i = 0; i < args.length; i += 10) {
        messages.push(JSON.stringify({ op: 'subscribe', args: args.slice(i, i + 10) }));
      }
      return messages;
    }
    case 'OKX':
      return [JSON.stringify({
        op: 'subscribe',
        args: [{ channel: 'liquidation-orders', instType: 'SWAP' }],
      })];
    case 'Bitget':
      return [JSON.stringify({
        op: 'subscribe',
        args: [{ instType: 'USDT-FUTURES', channel: 'liquidation', instId: 'default' }],
      })];
    case 'Deribit':
      // .raw channels require auth; use trades.*.100ms and filter for liquidation in parser
      return [
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'public/subscribe',
          params: { channels: ['trades.BTC-PERPETUAL.100ms', 'trades.ETH-PERPETUAL.100ms', 'trades.SOL_USDC-PERPETUAL.100ms'] },
        }),
      ];
    case 'HTX': {
      // HTX per-symbol liquidation_orders channel (public, no auth)
      const htxSymbols = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT',
        'BNB-USDT', 'ADA-USDT', 'AVAX-USDT', 'DOT-USDT', 'LINK-USDT',
        'LTC-USDT', 'UNI-USDT', 'APT-USDT', 'ARB-USDT', 'OP-USDT'];
      return htxSymbols.map(sym => JSON.stringify({
        sub: `public.${sym}.liquidation_orders`,
        id: `htx-liq-${sym}`,
      }));
    }
    case 'dYdX':
      // Subscribe to trades for top markets, filter for type=Liquidated in parser
      return DYDX_LIQ_MARKETS.map(market => JSON.stringify({
        type: 'subscribe',
        channel: 'v4_trades',
        id: market,
        batched: false,
      }));
    case 'Bitfinex':
      return [JSON.stringify({
        event: 'subscribe',
        channel: 'status',
        key: 'liq:global',
      })];
    case 'Hyperliquid':
      // One subscribe message per coin — HL requires separate subs for trades
      return HYPERLIQUID_LIQ_COINS.map(coin => JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'trades', coin },
      }));
    default:
      // Binance, gTrade: no subscription needed
      return [];
  }
}

// --- Browser-native gzip decompression for HTX ---
export async function decompressGzip(data: ArrayBuffer): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(data));
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }
  return new TextDecoder().decode(merged);
}

export function parseBinanceLiq(data: any): Liquidation | null {
  if (data.e !== 'forceOrder') return null;
  const o = data.o;
  const price = parseFloat(o.p);
  const qty = parseFloat(o.q);
  if (!isFinite(price) || !isFinite(qty) || price <= 0 || qty <= 0) return null;
  return {
    id: `bin-${o.s}-${o.T}`,
    symbol: o.s.replace(/USD[_]?UM$/, '').replace(/\d{6}$/, '').replace(/(?:USDT|USDC|USD)$/, '').replace(/^1000/, ''),
    side: o.S === 'BUY' ? 'short' : 'long',
    price,
    quantity: qty,
    value: price * qty,
    exchange: 'Binance',
    timestamp: o.T,
  };
}

export function parseBybitLiq(data: any): Liquidation | null {
  const liqs = parseBybitLiqAll(data);
  return liqs.length > 0 ? liqs[0] : null;
}

/** Parse ALL liquidations from a Bybit allLiquidation message (can be batched) */
export function parseBybitLiqAll(data: any): Liquidation[] {
  if (!data.topic?.startsWith('allLiquidation.') && !data.topic?.startsWith('liquidation.')) return [];
  const raw = data.data;
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  const results: Liquidation[] = [];
  for (const d of items) {
    const price = parseFloat(d.price || d.p || '0');
    const size = parseFloat(d.size || d.v || '0');
    const symbol = (d.symbol || d.s || '').replace(/(?:USDT|USDC)$/, '');
    if (!symbol || !isFinite(price) || !isFinite(size) || price <= 0 || size <= 0) continue;
    results.push({
      id: `byb-${symbol}-${d.updatedTime || d.T || Date.now()}-${results.length}`,
      symbol,
      side: (d.side === 'Buy' || d.S === 'Buy') ? 'short' : 'long',
      price,
      quantity: size,
      value: price * size,
      exchange: 'Bybit',
      timestamp: d.updatedTime || d.T || Date.now(),
    });
  }
  return results;
}

export function parseOKXLiq(data: any): Liquidation | null {
  if (!data.arg || data.arg.channel !== 'liquidation-orders') return null;
  const items = data.data;
  if (!items || items.length === 0) return null;
  const d = items[0];
  // OKX details are nested in details array
  const details = d.details;
  if (!details || details.length === 0) return null;
  const detail = details[0];
  const price = parseFloat(detail.bkPx);
  const size = parseFloat(detail.sz);
  if (!isFinite(price) || !isFinite(size) || price <= 0 || size <= 0) return null;
  const instId = d.instId || '';
  // Handle all OKX swap formats: BTC-USDT-SWAP, BTC-USDC-SWAP, BTC-USD-SWAP
  const symbol = instId.replace(/-USDT-SWAP$/, '').replace(/-USDC-SWAP$/, '').replace(/-USD-SWAP$/, '').replace(/-SWAP$/, '').replace(/-/g, '');
  return {
    id: `okx-${instId}-${detail.ts}`,
    symbol,
    side: detail.side === 'buy' ? 'short' : 'long',
    price,
    quantity: size,
    value: price * size,
    exchange: 'OKX',
    timestamp: parseInt(detail.ts, 10) || Date.now(),
  };
}

export function parseBitgetLiq(data: any): Liquidation | null {
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) return null;
  const d = data.data[0];
  const price = parseFloat(d.bkPx || d.fillPx || '0');
  const size = parseFloat(d.sz || d.fillSz || '0');
  if (!isFinite(price) || !isFinite(size) || price <= 0 || size <= 0) return null;
  const instId = d.instId || d.symbol || '';
  const symbol = instId.replace('_UMCBL', '').replace(/(?:USDT|USDC)$/, '');
  return {
    id: `bg-${instId}-${d.uTime || d.ts || Date.now()}`,
    symbol,
    side: d.side === 'buy' ? 'short' : 'long',
    price,
    quantity: size,
    value: price * size,
    exchange: 'Bitget',
    timestamp: parseInt(d.uTime || d.ts || String(Date.now()), 10),
  };
}

export function parseDeribitLiq(data: any): Liquidation | null {
  if (data.method !== 'subscription' || !data.params) return null;
  const channel = data.params.channel || '';
  const rawData = data.params.data;

  // Handle liquidations channel (sends array of liquidation objects)
  if (channel.startsWith('liquidations.') && Array.isArray(rawData) && rawData.length > 0) {
    const d = rawData[0];
    const instrument = d.instrument_name || '';
    const symbol = instrument.split('-')[0];
    if (!symbol) return null;
    const price = parseFloat(d.price || '0');
    const quantity = parseFloat(d.quantity || d.amount || '0');
    if (!isFinite(price) || !isFinite(quantity) || price <= 0 || quantity <= 0) return null;
    // Inverse contracts (BTC-PERPETUAL): quantity is in USD, no multiplication needed.
    // Linear contracts (BTC-USDC-PERPETUAL): quantity is in base currency, multiply by price.
    const isLinear = instrument.includes('USDC') || instrument.includes('USDT');
    return {
      id: `drb-${instrument}-${d.timestamp || Date.now()}`,
      symbol,
      side: d.direction === 'buy' ? 'short' : 'long',
      price, quantity,
      value: isLinear ? price * quantity : quantity,
      exchange: 'Deribit',
      timestamp: d.timestamp || Date.now(),
    };
  }

  // Handle trades channel — only keep liquidation trades
  if (channel.startsWith('trades.') && rawData) {
    const trades = Array.isArray(rawData) ? rawData : [rawData];
    for (const d of trades) {
      if (!d.liquidation || d.liquidation === 'none') continue; // skip non-liquidation trades
      const instrument = d.instrument_name || '';
      const symbol = instrument.split('-')[0];
      if (!symbol) return null;
      const price = parseFloat(d.price || '0');
      const quantity = parseFloat(d.quantity || d.amount || '0');
      if (!isFinite(price) || !isFinite(quantity) || price <= 0 || quantity <= 0) continue;
      const isLinear = instrument.includes('USDC') || instrument.includes('USDT');
      return {
        id: `drb-${instrument}-${d.timestamp || Date.now()}`,
        symbol,
        side: d.direction === 'buy' ? 'short' : 'long',
        price, quantity,
        value: isLinear ? price * quantity : quantity,
        exchange: 'Deribit',
        timestamp: d.timestamp || Date.now(),
      };
    }
  }

  return null;
}

export function parseMexcLiq(data: any): Liquidation | null {
  if (data.channel !== 'push.liquidation.order' || !data.data) return null;
  const d = data.data;
  const rawSymbol = d.symbol || '';
  const symbol = rawSymbol.replace('_USDT', '').replace('_USDC', '');
  const price = parseFloat(d.price || d.liquidationPrice || '0');
  const quantity = parseFloat(d.vol || d.quantity || '0');
  if (!isFinite(price) || !isFinite(quantity) || price <= 0 || quantity <= 0) return null;
  return {
    id: `mexc-${rawSymbol}-${d.createTime || Date.now()}`,
    symbol,
    side: (d.side === 1 || d.side === 'Buy' || d.side === 'buy') ? 'short' : 'long',
    price,
    quantity,
    value: price * quantity,
    exchange: 'MEXC',
    timestamp: d.createTime || Date.now(),
  };
}

export function parseBingxLiq(data: any): Liquidation | null {
  if (!data.dataType?.includes('forceOrder') || !data.data) return null;
  const d = data.data;
  const rawSymbol = d.s || d.symbol || '';
  const symbol = rawSymbol.replace('-USDT', '').replace('-USDC', '');
  const price = parseFloat(d.p || d.price || '0');
  const quantity = parseFloat(d.q || d.quantity || '0');
  if (!isFinite(price) || !isFinite(quantity) || price <= 0 || quantity <= 0) return null;
  return {
    id: `bx-${rawSymbol}-${d.T || d.timestamp || Date.now()}`,
    symbol,
    side: (d.S === 'BUY' || d.S === 'Buy') ? 'short' : 'long',
    price,
    quantity,
    value: price * quantity,
    exchange: 'BingX',
    timestamp: d.T || d.timestamp || Date.now(),
  };
}

export function parseHTXLiq(data: any): Liquidation | null {
  // HTX sends data array inside a channel message
  // { "ch": "public.BTC-USDT.liquidation_orders", "ts": ..., "data": [...] }
  if (!data.ch || !data.data || !Array.isArray(data.data) || data.data.length === 0) return null;
  const d = data.data[0];
  const contractCode = d.contract_code || '';
  const symbol = contractCode.replace('-USDT', '').replace('-USDC', '');
  if (!symbol) return null;
  const price = parseFloat(d.price || '0');
  const amount = parseFloat(d.amount || '0'); // amount is in tokens
  if (!isFinite(price) || !isFinite(amount) || price <= 0 || amount <= 0) return null;
  const direction = d.direction; // 'sell' or 'buy'
  const offset = d.offset; // 'close' means liquidation
  // direction === 'sell' + offset === 'close' -> long liquidation (forced sell of long)
  // direction === 'buy' + offset === 'close' -> short liquidation (forced buy of short)
  let side: 'long' | 'short';
  if (direction === 'sell' && offset === 'close') {
    side = 'long';
  } else if (direction === 'buy' && offset === 'close') {
    side = 'short';
  } else {
    return null; // not a liquidation close
  }
  return {
    id: `htx-${contractCode}-${d.created_at || data.ts || Date.now()}`,
    symbol,
    side,
    price,
    quantity: amount,
    value: price * amount,
    exchange: 'HTX',
    timestamp: d.created_at || data.ts || Date.now(),
  };
}

export function parseGTradeLiq(data: any): Liquidation | null {
  // gTrade sends Socket.IO-style messages. We look for unregisterTrade with liq closeType.
  // The data may come as: { name: 'unregisterTrade', value: { ... } }
  // or already parsed from a Socket.IO frame.
  if (!data) return null;

  // Try to extract the trade data
  let trade: any = null;
  if (data.name === 'unregisterTrade' && data.value) {
    trade = data.value;
  } else if (data.closeType) {
    // Direct trade object
    trade = data;
  } else {
    return null;
  }

  // Only process liquidations
  const closeType = (trade.closeType || '').toLowerCase();
  if (closeType !== 'liq' && closeType !== 'liquidation' && closeType !== 'liquidated') return null;

  // Extract symbol from pair field: "BTC/USD" -> "BTC"
  const pair = trade.pair || trade.pairName || '';
  const symbol = pair.split('/')[0] || '';
  if (!symbol) return null;

  // Filter out non-crypto symbols (stocks, forex, commodities)
  if (!isLiqCryptoSymbol(symbol)) return null;

  // Determine side: if the liquidated trade was long, it's a long liquidation
  const isLong = trade.buy === true || trade.long === true || trade.side === 'long';
  const side: 'long' | 'short' = isLong ? 'long' : 'short';

  // Calculate value
  const positionSize = parseFloat(trade.positionSizeStable || trade.positionSizeDai || '0') || 0;
  const collateral = parseFloat(trade.collateralAmount || trade.initialPosToken || '0') || 0;
  const leverage = parseFloat(trade.leverage || '1') || 1;
  const value = positionSize > 0 ? positionSize : collateral * leverage;
  const price = parseFloat(trade.closePrice || trade.currentPrice || trade.openPrice || '0') || 0;
  if (!isFinite(value) || !isFinite(price) || value <= 0 || price <= 0) return null;
  const quantity = value / price;

  return {
    id: `gt-${symbol}-${trade.tradeId || trade.orderId || Date.now()}-${Date.now()}`,
    symbol,
    side,
    price,
    quantity,
    value,
    exchange: 'gTrade',
    timestamp: (trade.closeTimestamp ? parseInt(trade.closeTimestamp, 10) : NaN) || Date.now(),
  };
}

export function parseDydxLiq(data: any): Liquidation | null {
  // dYdX v4 trades channel: { type: "channel_data", channel: "v4_trades", id: "BTC-USD", contents: { trades: [...] } }
  if (data.type !== 'channel_data' || data.channel !== 'v4_trades') return null;
  const trades = data.contents?.trades;
  if (!Array.isArray(trades) || trades.length === 0) return null;

  // Only process liquidation trades
  for (const t of trades) {
    if (t.type !== 'Liquidated' && t.type !== 'Deleveraged') continue;
    const market = data.id || ''; // "BTC-USD"
    const symbol = market.split('-')[0];
    if (!symbol) continue;
    const price = parseFloat(t.price || '0');
    const size = parseFloat(t.size || '0');
    if (!isFinite(price) || !isFinite(size) || price <= 0 || size <= 0) continue;
    return {
      id: `dydx-${t.id || Date.now()}-${Date.now()}`,
      symbol,
      side: t.side === 'BUY' ? 'short' : 'long',
      price,
      quantity: size,
      value: price * size,
      exchange: 'dYdX',
      timestamp: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
    };
  }
  return null;
}

// Top Hyperliquid perp coins for trade subscription (one sub per coin).
// Note: HL uses lowercase `k` prefix for 1000-unit contracts (kPEPE, kSHIB, kBONK).
// Plain `PEPE` etc. do NOT exist on HL — subscriptions silently fail otherwise.
export const HYPERLIQUID_LIQ_COINS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE',
  'HYPE', 'kPEPE', 'BNB', 'ADA', 'AVAX',
  'LINK', 'SUI', 'APT', 'WIF', 'TIA',
  'INJ', 'SEI', 'ARB', 'OP', 'NEAR',
];

/**
 * Hyperliquid public trades channel.
 * Liquidations are marked by an all-zero hash (0x0000...) — confirmed Apr 2026.
 * HL side semantics: 'A' = Ask (seller), 'B' = Bid (buyer).
 * A forced sell (side='A' on liquidation) means a long was liquidated.
 * A forced buy  (side='B' on liquidation) means a short was liquidated.
 *
 * HL batches trades in a single message (initial snapshot ~30 trades + live updates
 * can be multi-trade), so we parse ALL zero-hash trades per message, not just the first.
 */
export function parseHyperliquidLiqAll(data: any): Liquidation[] {
  if (data.channel !== 'trades' || !Array.isArray(data.data) || data.data.length === 0) return [];
  const results: Liquidation[] = [];
  for (const t of data.data) {
    // Only keep zero-hash trades (= liquidations / ADL / forced closes)
    if (t.hash !== '0x0000000000000000000000000000000000000000000000000000000000000000') continue;
    let symbol = String(t.coin || '');
    if (!symbol) continue;
    // Strip HL's lowercase `k` prefix (1000-unit contracts: kPEPE → PEPE, kSHIB → SHIB)
    if (/^k[A-Z]/.test(symbol)) symbol = symbol.slice(1);
    const normalized = normalizeLiqSymbol(symbol);
    if (!isLiqCryptoSymbol(normalized)) continue;
    const price = parseFloat(t.px || '0');
    const sz = parseFloat(t.sz || '0');
    if (!isFinite(price) || !isFinite(sz) || price <= 0 || sz <= 0) continue;
    results.push({
      id: `hl-${t.tid || `${symbol}-${t.time}`}`,
      symbol: normalized,
      side: t.side === 'A' ? 'long' : 'short',
      price,
      quantity: sz,
      value: price * sz,
      exchange: 'Hyperliquid',
      timestamp: typeof t.time === 'number' ? t.time : Date.now(),
    });
  }
  return results;
}

export function parseBitfinexLiq(data: any): Liquidation | null {
  // Bitfinex status channel: [CHAN_ID, [[...], [...], ...]] or [CHAN_ID, [...]
  // Heartbeats: [CHAN_ID, "hb"]
  if (!Array.isArray(data) || data.length < 2) return null;
  if (data[1] === 'hb') return null; // heartbeat

  const payload = data[1];
  if (!Array.isArray(payload)) return null;

  // Can be a snapshot (array of arrays) or single update
  const items = Array.isArray(payload[0]) ? payload : [payload];

  for (const item of items) {
    // item format: ["pos", POS_ID, TIME_MS, null, SYMBOL, AMOUNT, BASE_PRICE, null, IS_MATCH, IS_MARKET_SOLD, null, LIQ_PRICE]
    if (item[0] !== 'pos') continue;
    const rawSymbol = String(item[4] || '');
    // Bitfinex uses "tBTCUSD" format — strip leading 't' and trailing 'USD'/'UST'
    const symbol = rawSymbol.replace(/^t/, '').replace(/USD$/, '').replace(/UST$/, '').replace(/F0$/, '');
    if (!symbol || !isLiqCryptoSymbol(symbol)) continue;

    const amount = parseFloat(item[5] || '0'); // negative = short position liquidated
    const price = parseFloat(item[11] || item[6] || '0'); // liq price or entry price
    if (!isFinite(price) || !isFinite(amount) || price <= 0 || amount === 0) continue;

    const absAmount = Math.abs(amount);
    return {
      id: `bfx-${item[1]}-${item[2] || Date.now()}`,
      symbol,
      side: amount > 0 ? 'long' : 'short',
      price,
      quantity: absAmount,
      value: price * absAmount,
      exchange: 'Bitfinex',
      timestamp: typeof item[2] === 'number' ? item[2] : Date.now(),
    };
  }
  return null;
}
