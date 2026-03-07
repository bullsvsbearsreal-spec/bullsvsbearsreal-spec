/**
 * Standalone WebSocket liquidation ingester.
 * Connects to 9 exchange WS feeds, buffers events, batch-inserts to PostgreSQL.
 * Run with PM2: pm2 start ecosystem.config.js
 */
import WebSocket from 'ws';
import postgres from 'postgres';
import { gunzipSync } from 'zlib';
import {
  type Liquidation,
  EXCHANGE_WS_URLS,
  isLiqCryptoSymbol,
  parseBinanceLiq,
  parseBybitLiq,
  parseOKXLiq,
  parseBitgetLiq,
  parseDeribitLiq,
  parseMexcLiq,
  parseBingxLiq,
  parseHTXLiq,
  parseGTradeLiq,
  getSubscriptionMessages,
} from '../src/lib/liquidation-parsers';

// ─── Config ────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || '';
const FLUSH_INTERVAL_MS = 2000;
const RECONNECT_DELAY_MS = 3000;
const HEALTH_LOG_INTERVAL_MS = 60000;
const EXCHANGES = Object.keys(EXCHANGE_WS_URLS);

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

// ─── Buffer ────────────────────────────────────────
let buffer: Liquidation[] = [];
let totalIngested = 0;
let totalFlushed = 0;

async function flushBuffer() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0); // take all
  try {
    // Batch insert using sql helper with VALUES list
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
    // Put failed items back at end of buffer for retry
    buffer.push(...batch);
  }
}

setInterval(flushBuffer, FLUSH_INTERVAL_MS);

// ─── WebSocket Connections ─────────────────────────
const connectionStatus: Record<string, boolean> = {};

function handleLiquidation(liq: Liquidation) {
  if (liq.value <= 0 || liq.price <= 0) return;
  if (!isLiqCryptoSymbol(liq.symbol)) return; // skip stocks/forex/commodities
  buffer.push(liq);
  totalIngested++;
}

function connectExchange(exchange: string) {
  const url = EXCHANGE_WS_URLS[exchange];
  if (!url) return;

  let destroyed = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const connect = () => {
    if (destroyed) return;
    const ws = new WebSocket(url);

    ws.on('open', () => {
      connectionStatus[exchange] = true;
      console.log(`[WS] ${exchange} connected`);

      // Send subscription messages
      const msgs = getSubscriptionMessages(exchange);
      msgs.forEach(msg => ws.send(msg));

      // Ping timers
      if (['Bybit', 'MEXC', 'BingX'].includes(exchange)) {
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const pingMsg = exchange === 'Bybit' ? JSON.stringify({ op: 'ping' })
              : exchange === 'MEXC' ? JSON.stringify({ method: 'ping' })
              : 'Ping';
            ws.send(pingMsg);
          }
        }, 20000);
      } else if (['OKX', 'Bitget', 'gTrade'].includes(exchange)) {
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
      // HTX ping handled in message handler
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        // HTX: binary gzip
        if (exchange === 'HTX') {
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
          const text = gunzipSync(buf).toString('utf-8');
          const data = JSON.parse(text);
          if (data.ping) { ws.send(JSON.stringify({ pong: data.ping })); return; }
          if (data.subbed || data.status === 'ok') return;
          const liq = parseHTXLiq(data);
          if (liq && liq.value > 0) handleLiquidation(liq);
          return;
        }

        // gTrade: Socket.IO framing
        if (exchange === 'gTrade') {
          const str = raw.toString();
          if (str === '2' || str === '3' || str.startsWith('0{')) return;
          if (str.startsWith('42')) {
            const arr = JSON.parse(str.slice(2));
            if (Array.isArray(arr) && arr.length >= 2 && arr[0] === 'unregisterTrade') {
              const liq = parseGTradeLiq({ name: 'unregisterTrade', value: arr[1] });
              if (liq && liq.value > 0) handleLiquidation(liq);
            }
            return;
          }
          try {
            const data = JSON.parse(str);
            const liq = parseGTradeLiq(data);
            if (liq && liq.value > 0) handleLiquidation(liq);
          } catch {}
          return;
        }

        // All others: plain JSON
        const str = raw.toString();
        if (str === 'pong' || str === '{"event":"pong"}' || str === 'Pong') return;
        const data = JSON.parse(str);
        if (data.event === 'subscribe' || data.op === 'pong' || data.ret_msg === 'pong' || data.success !== undefined) return;
        if (data.id !== undefined && data.result !== undefined) return;
        if (data.channel === 'pong' || data.data === 'pong') return;

        let liq: Liquidation | null = null;
        switch (exchange) {
          case 'Binance': liq = parseBinanceLiq(data); break;
          case 'Bybit': liq = parseBybitLiq(data); break;
          case 'OKX': liq = parseOKXLiq(data); break;
          case 'Bitget': liq = parseBitgetLiq(data); break;
          case 'Deribit': liq = parseDeribitLiq(data); break;
          case 'MEXC': liq = parseMexcLiq(data); break;
          case 'BingX': liq = parseBingxLiq(data); break;
        }
        if (liq && liq.value > 0) handleLiquidation(liq);
      } catch {}
    });

    ws.on('error', () => {
      connectionStatus[exchange] = false;
    });

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
  console.log(`[HEALTH] Connected: ${connected.length}/${EXCHANGES.length} (${connected.join(', ')}) | Buffer: ${buffer.length} | Ingested: ${totalIngested} | Flushed: ${totalFlushed}`);
}, HEALTH_LOG_INTERVAL_MS);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[INGESTER] SIGTERM received, flushing buffer...');
  await flushBuffer();
  await sql.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[INGESTER] SIGINT received, flushing buffer...');
  await flushBuffer();
  await sql.end();
  process.exit(0);
});
