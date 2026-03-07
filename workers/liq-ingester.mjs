/**
 * Standalone WebSocket liquidation ingester (ESM, no TypeScript).
 * Connects to 9 exchange WS feeds, buffers events, batch-inserts to PostgreSQL.
 * Run with PM2: pm2 start liq-ingester.mjs
 */
import WebSocket from 'ws';
import postgres from 'postgres';
import { gunzipSync } from 'zlib';

// ─── Config ────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || '';
const FLUSH_INTERVAL_MS = 2000;
const RECONNECT_DELAY_MS = 3000;
const HEALTH_LOG_INTERVAL_MS = 60000;

if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: 'require',
});

// ─── Non-crypto filter ─────────────────────────────
const NON_CRYPTO = new Set([
  'AAPL','AMZN','GOOGL','GOOG','META','MSFT','NFLX','NVDA','TSLA',
  'COIN','HOOD','MSTR','SQ','PYPL','RIOT','MARA','CLSK','CIFR',
  'AMD','INTC','ARM','AVGO','QCOM','TSM','MRVL','MU',
  'PLTR','UBER','ABNB','SNOW','CRM','ORCL','SHOP','NET','BA',
  'DIS','JPM','V','MA','WMT','KO','PEP','JNJ','PFE','LLY',
  'UNH','BRK','XOM','CVX','PG','NKE','MCD','HD','COST',
  'CSCO','ACN','ASML','RDDT','APP','IBM','GME','GE','RACE','CRCL','WDC',
  'SAMSUNG','SKHYNIX','HYUNDAI','HANMI','SNDK','KRCOMP',
  'SPY','SPX','QQQ','IWM','DIA','ARKK','NAS100','SPX500','URNM','SIREN',
  'XAU','XAG','XPT','XPD','GOLD','SILVER','COPPER','XCU','HG',
  'WTI','BRENT','NATGAS','UKOIL','USOIL',
  'EUR','GBP','JPY','CHF','AUD','CAD','NZD',
  'SEK','NOK','PLN','CZK','HUF','TRY','ZAR',
  'SGD','HKD','KRW','MXN','BRL','TWD','INR',
]);

function isCrypto(sym) {
  if (!sym || !/^[A-Za-z0-9]+$/.test(sym)) return false;
  return !NON_CRYPTO.has(sym.toUpperCase());
}

// ─── Symbol lists ──────────────────────────────────
const BYBIT_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','DOGEUSDT',
  'BNBUSDT','ADAUSDT','AVAXUSDT','DOTUSDT','LINKUSDT',
  'MATICUSDT','LTCUSDT','UNIUSDT','APTUSDT','ARBUSDT',
  'OPUSDT','NEARUSDT','FILUSDT','ATOMUSDT','INJUSDT',
  'SUIUSDT','PEPEUSDT','WIFUSDT','SEIUSDT','TIAUSDT',
];
const BINGX_SYMBOLS = ['BTC-USDT','ETH-USDT','SOL-USDT','XRP-USDT','DOGE-USDT'];
const HTX_LIQ_SYMBOLS = [
  'BTC-USDT','ETH-USDT','SOL-USDT','XRP-USDT','DOGE-USDT',
  'BNB-USDT','ADA-USDT','AVAX-USDT','LINK-USDT','DOT-USDT',
  'LTC-USDT','UNI-USDT','APT-USDT','ARB-USDT','OP-USDT',
  'SUI-USDT','PEPE-USDT','WIF-USDT','INJ-USDT','NEAR-USDT',
];

// ─── WS URLs ───────────────────────────────────────
const WS_URLS = {
  Binance: 'wss://fstream.binance.com/ws/!forceOrder@arr',
  Bybit: 'wss://stream.bybit.com/v5/public/linear',
  OKX: 'wss://ws.okx.com:8443/ws/v5/public',
  Bitget: 'wss://ws.bitget.com/v2/ws/public',
  Deribit: 'wss://www.deribit.com/ws/api/v2',
  MEXC: 'wss://contract.mexc.com/edge',
  BingX: 'wss://open-api-ws.bingx.com/market',
  HTX: 'wss://api.hbdm.com/linear-swap-ws',
};

const EXCHANGES = Object.keys(WS_URLS);

// ─── Subscription messages ─────────────────────────
function getSubMsgs(exchange) {
  switch (exchange) {
    case 'Bybit':
      return [JSON.stringify({ op: 'subscribe', args: BYBIT_SYMBOLS.map(s => `liquidation.${s}`) })];
    case 'OKX':
      return [JSON.stringify({ op: 'subscribe', args: [{ channel: 'liquidation-orders', instType: 'SWAP' }] })];
    case 'Bitget':
      return [JSON.stringify({ op: 'subscribe', args: [{ instType: 'USDT-FUTURES', channel: 'liquidation', instId: 'default' }] })];
    case 'Deribit':
      return [
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'public/subscribe', params: { channels: ['liquidations.BTC-PERPETUAL.raw', 'liquidations.ETH-PERPETUAL.raw', 'liquidations.SOL-PERPETUAL.raw'] } }),
      ];
    case 'MEXC':
      return [JSON.stringify({ method: 'sub.liquidation.order', param: {} })];
    case 'BingX':
      return BINGX_SYMBOLS.map((sym, i) => JSON.stringify({ id: `bx-${i}`, reqType: 'sub', dataType: `${sym}@forceOrder` }));
    case 'HTX':
      return HTX_LIQ_SYMBOLS.map((sym, i) => JSON.stringify({ sub: `public.${sym}.liquidation_orders`, id: `htx-${i}` }));
    default:
      return [];
  }
}

// ─── Parsers ───────────────────────────────────────
function stripSymbol(s) {
  return s
    .replace(/USD[_]?UM$/, '').replace(/\d{6}$/, '')
    .replace(/-USDT-SWAP$/, '').replace(/-USDC-SWAP$/, '').replace(/-USD-SWAP$/, '').replace(/-SWAP$/, '')
    .replace(/-PERPETUAL$/, '')
    .replace(/-USDT$/, '').replace(/-USDC$/, '').replace(/-USD$/, '')
    .replace(/USDT$/, '').replace(/USDC$/, '').replace(/USD$/, '')
    .replace(/_UMCBL$/, '').replace(/_USDT$/, '').replace(/_USDC$/, '')
    .replace(/^1000/, '').replace(/-/g, '');
}

function parseBinance(data) {
  if (data.e !== 'forceOrder') return null;
  const o = data.o;
  const price = parseFloat(o.p), qty = parseFloat(o.q);
  return {
    symbol: stripSymbol(o.s || ''),
    exchange: 'Binance',
    side: o.S === 'BUY' ? 'short' : 'long',
    price, quantity: qty, value: price * qty,
    timestamp: o.T,
  };
}

function parseBybit(data) {
  if (!data.topic?.startsWith('liquidation.')) return null;
  const d = data.data; if (!d) return null;
  const price = parseFloat(d.price), size = parseFloat(d.size);
  return {
    symbol: stripSymbol(d.symbol || ''),
    exchange: 'Bybit',
    side: d.side === 'Buy' ? 'short' : 'long',
    price, quantity: size, value: price * size,
    timestamp: d.updatedTime,
  };
}

function parseOKX(data) {
  if (!data.arg || data.arg.channel !== 'liquidation-orders') return null;
  const items = data.data; if (!items?.length) return null;
  const d = items[0], details = d.details; if (!details?.length) return null;
  const det = details[0];
  const price = parseFloat(det.bkPx), size = parseFloat(det.sz);
  return {
    symbol: stripSymbol(d.instId || ''),
    exchange: 'OKX',
    side: det.side === 'buy' ? 'short' : 'long',
    price, quantity: size, value: price * size,
    timestamp: parseInt(det.ts, 10),
  };
}

function parseBitget(data) {
  if (!data.data?.length) return null;
  const d = data.data[0];
  const price = parseFloat(d.bkPx || d.fillPx || '0');
  const size = parseFloat(d.sz || d.fillSz || '0');
  return {
    symbol: stripSymbol(d.instId || d.symbol || ''),
    exchange: 'Bitget',
    side: d.side === 'buy' ? 'short' : 'long',
    price, quantity: size, value: price * size,
    timestamp: parseInt(d.uTime || d.ts || String(Date.now()), 10),
  };
}

function parseDeribit(data) {
  if (data.method !== 'subscription' || !data.params) return null;
  const channel = data.params.channel || '';
  const rawData = data.params.data;

  // liquidations channel sends array of liquidation objects
  if (channel.startsWith('liquidations.') && Array.isArray(rawData) && rawData.length > 0) {
    const d = rawData[0];
    const inst = d.instrument_name || '';
    const symbol = inst.split('-')[0]; if (!symbol) return null;
    const price = parseFloat(d.price || '0'), qty = parseFloat(d.quantity || d.amount || '0');
    return {
      symbol, exchange: 'Deribit',
      side: d.direction === 'buy' ? 'short' : 'long',
      price, quantity: qty, value: price * qty,
      timestamp: d.timestamp || Date.now(),
    };
  }

  return null;
}

function parseMEXC(data) {
  if (data.channel !== 'push.liquidation.order' || !data.data) return null;
  const d = data.data;
  const price = parseFloat(d.price || d.liquidationPrice || '0');
  const qty = parseFloat(d.vol || d.quantity || '0');
  return {
    symbol: stripSymbol(d.symbol || ''),
    exchange: 'MEXC',
    side: (d.side === 1 || d.side === 'Buy' || d.side === 'buy') ? 'short' : 'long',
    price, quantity: qty, value: price * qty,
    timestamp: d.createTime || Date.now(),
  };
}

function parseBingX(data) {
  if (!data.dataType?.includes('forceOrder') || !data.data) return null;
  const d = data.data;
  const price = parseFloat(d.p || d.price || '0');
  const qty = parseFloat(d.q || d.quantity || '0');
  return {
    symbol: stripSymbol(d.s || d.symbol || ''),
    exchange: 'BingX',
    side: (d.S === 'BUY' || d.S === 'Buy') ? 'short' : 'long',
    price, quantity: qty, value: price * qty,
    timestamp: d.T || d.timestamp || Date.now(),
  };
}

function parseHTX(data) {
  if (!data.ch || !data.data?.length) return null;
  const d = data.data[0];
  const symbol = stripSymbol(d.contract_code || '');
  if (!symbol) return null;
  const price = parseFloat(d.price || '0');
  const amount = parseFloat(d.amount || '0');
  const dir = d.direction, offset = d.offset;
  let side;
  if (dir === 'sell' && offset === 'close') side = 'long';
  else if (dir === 'buy' && offset === 'close') side = 'short';
  else return null;
  return {
    symbol, exchange: 'HTX', side,
    price, quantity: amount, value: price * amount,
    timestamp: d.created_at || data.ts || Date.now(),
  };
}

// ─── Buffer ────────────────────────────────────────
const MAX_BUFFER = 10000;
let buffer = [];
let totalIngested = 0;
let totalFlushed = 0;
let totalDropped = 0;

async function flushBuffer() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0);
  try {
    for (let i = 0; i < batch.length; i += 50) {
      const chunk = batch.slice(i, i + 50);
      await sql`
        INSERT INTO liquidation_snapshots ${sql(
          chunk.map(liq => ({
            symbol: liq.symbol,
            exchange: liq.exchange,
            side: liq.side,
            price: liq.price,
            quantity: liq.quantity,
            value_usd: liq.value,
            ts: new Date(liq.timestamp),
          })),
          'symbol', 'exchange', 'side', 'price', 'quantity', 'value_usd', 'ts'
        )}
        ON CONFLICT (symbol, exchange, side, price, ts) DO NOTHING
      `;
    }
    totalFlushed += batch.length;
  } catch (e) {
    console.error(`[FLUSH] Error writing ${batch.length} events:`, e);
    // Cap retry buffer to prevent OOM
    if (buffer.length < MAX_BUFFER) {
      buffer.push(...batch.slice(0, MAX_BUFFER - buffer.length));
    } else {
      totalDropped += batch.length;
      console.warn(`[FLUSH] Buffer full (${MAX_BUFFER}), dropped ${batch.length} events`);
    }
  }
}

setInterval(flushBuffer, FLUSH_INTERVAL_MS);

// ─── WebSocket Connections ─────────────────────────
const connectionStatus = {};

function handleLiq(liq) {
  if (liq.value <= 0 || liq.price <= 0) return;
  if (!isCrypto(liq.symbol)) return;
  if (buffer.length >= MAX_BUFFER) { totalDropped++; return; }
  buffer.push(liq);
  totalIngested++;
}

function connectExchange(exchange) {
  const url = WS_URLS[exchange];
  if (!url) return;
  let destroyed = false;
  let pingTimer = null;

  const connect = () => {
    if (destroyed) return;
    const ws = new WebSocket(url);

    ws.on('open', () => {
      connectionStatus[exchange] = true;
      console.log(`[WS] ${exchange} connected`);
      getSubMsgs(exchange).forEach(msg => ws.send(msg));

      // Ping timers
      if (['Bybit', 'MEXC', 'BingX'].includes(exchange)) {
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const msg = exchange === 'Bybit' ? JSON.stringify({ op: 'ping' })
              : exchange === 'MEXC' ? JSON.stringify({ method: 'ping' })
              : 'Ping';
            ws.send(msg);
          }
        }, 20000);
      } else if (['OKX', 'Bitget'].includes(exchange)) {
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping');
        }, 25000);
      } else if (exchange === 'Deribit') {
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ jsonrpc: '2.0', id: 9999, method: 'public/test', params: {} }));
          }
        }, 25000);
      }
    });

    ws.on('message', (raw) => {
      try {
        // HTX: binary gzip
        if (exchange === 'HTX') {
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          const text = gunzipSync(buf).toString('utf-8');
          const data = JSON.parse(text);
          if (data.ping) { ws.send(JSON.stringify({ pong: data.ping })); return; }
          if (data.subbed || data.status === 'ok') return;
          const liq = parseHTX(data);
          if (liq && liq.value > 0) handleLiq(liq);
          return;
        }

        const str = raw.toString();
        if (str === 'pong' || str === '{"event":"pong"}' || str === 'Pong') return;
        const data = JSON.parse(str);
        if (data.event === 'subscribe' || data.op === 'pong' || data.ret_msg === 'pong' || data.success !== undefined) return;
        if (data.id !== undefined && data.result !== undefined) return;
        if (data.channel === 'pong' || data.data === 'pong') return;

        let liq = null;
        switch (exchange) {
          case 'Binance': liq = parseBinance(data); break;
          case 'Bybit': liq = parseBybit(data); break;
          case 'OKX': liq = parseOKX(data); break;
          case 'Bitget': liq = parseBitget(data); break;
          case 'Deribit': liq = parseDeribit(data); break;
          case 'MEXC': liq = parseMEXC(data); break;
          case 'BingX': liq = parseBingX(data); break;
        }
        if (liq && liq.value > 0) handleLiq(liq);
      } catch {}
    });

    ws.on('error', () => { connectionStatus[exchange] = false; });

    ws.on('close', () => {
      connectionStatus[exchange] = false;
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (!destroyed) {
        console.log(`[WS] ${exchange} disconnected, reconnecting in ${RECONNECT_DELAY_MS}ms`);
        setTimeout(connect, RECONNECT_DELAY_MS);
      }
    });
  };

  connect();
  return { stop: () => { destroyed = true; } };
}

// ─── Start ─────────────────────────────────────────
console.log(`[INGESTER] Starting liquidation ingester for ${EXCHANGES.length} exchanges`);
console.log(`[INGESTER] Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

EXCHANGES.forEach(connectExchange);

// Health log
setInterval(() => {
  const connected = Object.entries(connectionStatus).filter(([, v]) => v).map(([k]) => k);
  console.log(`[HEALTH] Connected: ${connected.length}/${EXCHANGES.length} (${connected.join(', ')}) | Buffer: ${buffer.length} | Ingested: ${totalIngested} | Flushed: ${totalFlushed}${totalDropped ? ` | Dropped: ${totalDropped}` : ''}`);
}, HEALTH_LOG_INTERVAL_MS);

// Graceful shutdown
async function shutdown(sig) {
  console.log(`[INGESTER] ${sig} received, flushing buffer...`);
  await flushBuffer();
  await sql.end();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
