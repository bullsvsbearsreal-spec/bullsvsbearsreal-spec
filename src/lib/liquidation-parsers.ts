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
  'WTI', 'BRENT', 'NATGAS', 'UKOIL', 'USOIL',
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
    .replace(/USDT$/, '').replace(/USDC$/, '').replace(/USD$/, '')
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

// Top symbols for BingX (per-symbol subscription required)
export const BINGX_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT'];

// Top symbols for HTX linear swap liquidation feed
export const HTX_LIQ_SYMBOLS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT',
  'BNB-USDT', 'ADA-USDT', 'AVAX-USDT', 'LINK-USDT', 'DOT-USDT',
  'LTC-USDT', 'UNI-USDT', 'APT-USDT', 'ARB-USDT', 'OP-USDT',
  'SUI-USDT', 'PEPE-USDT', 'WIF-USDT', 'INJ-USDT', 'NEAR-USDT',
];

// WebSocket URLs for each exchange
export const EXCHANGE_WS_URLS: Record<string, string> = {
  Binance: 'wss://fstream.binance.com/ws/!forceOrder@arr',
  Bybit: 'wss://stream.bybit.com/v5/public/linear',
  OKX: 'wss://ws.okx.com:8443/ws/v5/public',
  Bitget: 'wss://ws.bitget.com/v2/ws/public',
  Deribit: 'wss://www.deribit.com/ws/api/v2',
  MEXC: 'wss://contract.mexc.com/edge',
  BingX: 'wss://open-api-ws.bingx.com/market',
  HTX: 'wss://api.hbdm.com/linear-swap-ws',
  gTrade: 'wss://backend-arbitrum.gains.trade',
};

// Returns the JSON-stringified subscription messages to send after connecting
export function getSubscriptionMessages(exchange: string): string[] {
  switch (exchange) {
    case 'Bybit': {
      const args = BYBIT_SYMBOLS.map(s => `liquidation.${s}`);
      return [JSON.stringify({ op: 'subscribe', args })];
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
      return [
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'public/subscribe',
          params: { channels: ['liquidations.BTC-PERPETUAL.raw', 'liquidations.ETH-PERPETUAL.raw', 'liquidations.SOL-PERPETUAL.raw'] },
        }),
      ];
    case 'MEXC':
      return [JSON.stringify({ method: 'sub.liquidation.order', param: {} })];
    case 'BingX':
      return BINGX_SYMBOLS.map((sym, i) => JSON.stringify({
        id: `bingx-${i}`,
        reqType: 'sub',
        dataType: `${sym}@forceOrder`,
      }));
    case 'HTX':
      return HTX_LIQ_SYMBOLS.map((sym, i) => JSON.stringify({
        sub: `public.${sym}.liquidation_orders`,
        id: `htx-${i}`,
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
  return {
    id: `bin-${o.s}-${o.T}`,
    symbol: o.s.replace(/USD[_]?UM$/, '').replace(/\d{6}$/, '').replace(/USDT$/, '').replace(/USDC$/, '').replace(/USD$/, '').replace(/^1000/, ''),
    side: o.S === 'BUY' ? 'short' : 'long',
    price,
    quantity: qty,
    value: price * qty,
    exchange: 'Binance',
    timestamp: o.T,
  };
}

export function parseBybitLiq(data: any): Liquidation | null {
  if (!data.topic?.startsWith('liquidation.')) return null;
  const d = data.data;
  if (!d) return null;
  const price = parseFloat(d.price);
  const size = parseFloat(d.size);
  return {
    id: `byb-${d.symbol}-${d.updatedTime}`,
    symbol: d.symbol.replace('USDT', '').replace('USDC', ''),
    side: d.side === 'Buy' ? 'short' : 'long',
    price,
    quantity: size,
    value: price * size,
    exchange: 'Bybit',
    timestamp: d.updatedTime,
  };
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
    timestamp: parseInt(detail.ts, 10),
  };
}

export function parseBitgetLiq(data: any): Liquidation | null {
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) return null;
  const d = data.data[0];
  const price = parseFloat(d.bkPx || d.fillPx || '0');
  const size = parseFloat(d.sz || d.fillSz || '0');
  const instId = d.instId || d.symbol || '';
  const symbol = instId.replace('USDT', '').replace('USDC', '').replace('_UMCBL', '');
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
    return {
      id: `drb-${instrument}-${d.timestamp || Date.now()}`,
      symbol,
      side: d.direction === 'buy' ? 'short' : 'long',
      price, quantity,
      value: price * quantity,
      exchange: 'Deribit',
      timestamp: d.timestamp || Date.now(),
    };
  }

  // Handle trades channel — only keep liquidation trades
  if (channel.startsWith('trades.') && rawData) {
    const trades = Array.isArray(rawData) ? rawData : [rawData];
    for (const d of trades) {
      if (!d.liquidation) continue; // skip non-liquidation trades
      const instrument = d.instrument_name || '';
      const symbol = instrument.split('-')[0];
      if (!symbol) return null;
      const price = parseFloat(d.price || '0');
      const quantity = parseFloat(d.quantity || d.amount || '0');
      return {
        id: `drb-${instrument}-${d.timestamp || Date.now()}`,
        symbol,
        side: d.direction === 'buy' ? 'short' : 'long',
        price, quantity,
        value: price * quantity,
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
  const positionSize = parseFloat(trade.positionSizeStable || trade.positionSizeDai || '0');
  const collateral = parseFloat(trade.collateralAmount || trade.initialPosToken || '0');
  const leverage = parseFloat(trade.leverage || '1');
  const value = positionSize > 0 ? positionSize : collateral * leverage;
  const price = parseFloat(trade.closePrice || trade.currentPrice || trade.openPrice || '0');
  const quantity = price > 0 ? value / price : 0;

  return {
    id: `gt-${symbol}-${trade.tradeId || trade.orderId || Date.now()}-${Date.now()}`,
    symbol,
    side,
    price,
    quantity,
    value,
    exchange: 'gTrade',
    timestamp: trade.closeTimestamp ? parseInt(trade.closeTimestamp, 10) : Date.now(),
  };
}
