import 'dotenv/config';
import cron from 'node-cron';
import postgres from 'postgres';
import { startHealthServer, updateHealth } from './health.mjs';

// ─── Config ─────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = process.env.INFOHUB_BASE_URL || 'https://info-hub.io';
const MAX_SYMBOLS = 200;
const BATCH_SIZE = 50;
const KEEP_DAYS = 14;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL env var');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: 'require',
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchJSON(path, timeoutMs = 25000) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function topSymbolsByExchangeCount(data, field = 'symbol') {
  const counts = {};
  for (const r of data) {
    counts[r[field]] = (counts[r[field]] || 0) + 1;
  }
  return new Set(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SYMBOLS)
      .map(([sym]) => sym)
  );
}

async function batchInsert(entries, insertFn) {
  let inserted = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map(insertFn));
    inserted += chunk.length;
  }
  return inserted;
}

// ─── Direct Liquidation Fetching (Binance + OKX REST APIs) ──────────────────

const LIQ_SYMBOLS = ['BTC', 'ETH', 'SOL'];
const BINANCE_PAIRS = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT' };
const OKX_PAIRS = { BTC: 'BTC-USDT-SWAP', ETH: 'ETH-USDT-SWAP', SOL: 'SOL-USDT-SWAP' };
const OKX_CONTRACT_MULT = { BTC: 0.01, ETH: 0.1, SOL: 1 };

async function fetchBinanceLiquidations(sym) {
  const pair = BINANCE_PAIRS[sym];
  if (!pair) return [];
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${pair}&limit=100`,
      { signal: AbortSignal.timeout(10000) }
    );
    // Binance returns 451/403 from some IPs (geo-restriction on datacenter IPs)
    if (res.status === 451 || res.status === 403 || !res.ok) return [];
    const data = await res.json();
    return data
      .map(o => {
        const price = parseFloat(o.averagePrice || o.price);
        const qty = parseFloat(o.origQty);
        if (!price || !qty || !isFinite(price) || !isFinite(qty)) return null;
        // side=SELL means a long was liquidated (forced sell)
        return {
          symbol: sym,
          exchange: 'Binance',
          side: o.side === 'SELL' ? 'long' : 'short',
          price,
          quantity: qty,
          valueUsd: price * qty,
          ts: new Date(o.time || Date.now()).toISOString(),
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error(`[liq] Binance fetch error (${sym}):`, err.message);
    return [];
  }
}

async function fetchOKXLiquidations(sym) {
  const instId = OKX_PAIRS[sym];
  const mult = OKX_CONTRACT_MULT[sym] || 1;
  if (!instId) return [];
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&instId=${instId}&state=filled&limit=100`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const entries = json?.data || [];
    const events = [];
    for (const entry of entries) {
      for (const d of (entry.details || [])) {
        const price = parseFloat(d.bkPx || d.price || '0');
        const sz = parseFloat(d.sz || '0');
        if (!price || !sz || !isFinite(price) || !isFinite(sz)) continue;
        const actualQty = sz * mult;
        // OKX: side "sell" = long was liquidated (forced sell)
        events.push({
          symbol: sym,
          exchange: 'OKX',
          side: d.side === 'sell' ? 'long' : 'short',
          price,
          quantity: actualQty,
          valueUsd: price * actualQty,
          ts: new Date(parseInt(d.ts, 10) || Date.now()).toISOString(),
        });
      }
    }
    return events;
  } catch (err) {
    console.error(`[liq] OKX fetch error (${sym}):`, err.message);
    return [];
  }
}

// ─── Snapshot Collection ────────────────────────────────────────────────────

async function collectSnapshots() {
  const startTime = Date.now();
  const result = { funding: 0, oi: 0, liq: 0, errors: [] };

  // Fetch funding + OI in parallel, liquidations separately
  const [fundingData, oiData] = await Promise.allSettled([
    fetchJSON('/api/funding'),
    fetchJSON('/api/openinterest'),
  ]);

  // ── Funding Rates ──
  if (fundingData.status === 'fulfilled') {
    try {
      const data = fundingData.value.data || [];
      const topSymbols = topSymbolsByExchangeCount(data);
      const entries = data
        .filter(r => topSymbols.has(r.symbol) && r.fundingRate != null)
        .map(r => ({
          symbol: r.symbol,
          exchange: r.exchange,
          rate: r.fundingRate,
          predicted: r.predictedRate ?? null,
        }));

      result.funding = await batchInsert(entries, e =>
        sql`INSERT INTO funding_snapshots (symbol, exchange, rate, predicted)
            VALUES (${e.symbol}, ${e.exchange}, ${e.rate}, ${e.predicted})`
      );
    } catch (err) {
      result.errors.push(`funding-process: ${err.message}`);
    }
  } else {
    result.errors.push(`funding-fetch: ${fundingData.reason?.message}`);
  }

  // ── Open Interest ──
  if (oiData.status === 'fulfilled') {
    try {
      const data = oiData.value.data || [];
      const topSymbols = topSymbolsByExchangeCount(data);
      const entries = data
        .filter(r => topSymbols.has(r.symbol) && r.openInterestValue > 0)
        .map(r => ({
          symbol: r.symbol,
          exchange: r.exchange,
          oiUsd: r.openInterestValue,
        }));

      result.oi = await batchInsert(entries, e =>
        sql`INSERT INTO oi_snapshots (symbol, exchange, oi_usd)
            VALUES (${e.symbol}, ${e.exchange}, ${e.oiUsd})`
      );
    } catch (err) {
      result.errors.push(`oi-process: ${err.message}`);
    }
  } else {
    result.errors.push(`oi-fetch: ${oiData.reason?.message}`);
  }

  // ── Liquidations (BTC, ETH, SOL) — direct from exchange REST APIs ──
  // Fetches directly from Binance + OKX instead of the heatmap API
  // (the heatmap API reads from this same DB, creating a circular dependency)
  for (const sym of LIQ_SYMBOLS) {
    try {
      const [binanceEvents, okxEvents] = await Promise.all([
        fetchBinanceLiquidations(sym),
        fetchOKXLiquidations(sym),
      ]);
      const entries = [...binanceEvents, ...okxEvents].filter(e => e.valueUsd > 0 && e.price > 0);

      result.liq += await batchInsert(entries, e =>
        sql`INSERT INTO liquidation_snapshots (symbol, exchange, side, price, quantity, value_usd, ts)
            VALUES (${e.symbol}, ${e.exchange}, ${e.side}, ${e.price}, ${e.quantity}, ${e.valueUsd}, ${e.ts})
            ON CONFLICT (symbol, exchange, side, price, ts) DO NOTHING`
      );
    } catch (err) {
      result.errors.push(`liq-${sym}: ${err.message}`);
    }
  }

  // ── Prune every run — 14-day retention keeps DB within 1GB ──
  let pruned = null;
  try {
    const intervalStr = `${KEEP_DAYS} days`;
    const fr = await sql`DELETE FROM funding_snapshots WHERE ts < NOW() - ${intervalStr}::interval`;
    const oi = await sql`DELETE FROM oi_snapshots WHERE ts < NOW() - ${intervalStr}::interval`;
    const lq = await sql`DELETE FROM liquidation_snapshots WHERE ts < NOW() - ${intervalStr}::interval`;
    await sql`DELETE FROM api_cache WHERE expires_at < NOW()`;
    const total = (fr.count ?? 0) + (oi.count ?? 0) + (lq.count ?? 0);
    if (total > 0) pruned = { funding: fr.count ?? 0, oi: oi.count ?? 0, liq: lq.count ?? 0 };
  } catch (err) {
    result.errors.push(`prune: ${err.message}`);
  }

  const elapsed = Date.now() - startTime;
  return { ...result, pruned, elapsedMs: elapsed };
}

// ─── Cron Schedule ──────────────────────────────────────────────────────────

console.log(`[infohub-collector] Starting — base URL: ${BASE_URL}`);
console.log(`[infohub-collector] Schedule: every 30 minutes`);

// Run immediately on start
(async () => {
  try {
    const r = await collectSnapshots();
    const ts = new Date().toISOString();
    console.log(`[${ts}] Initial run: funding=${r.funding} oi=${r.oi} liq=${r.liq} (${r.elapsedMs}ms)${r.errors.length ? ' errors=' + r.errors.join(', ') : ''}`);
    updateHealth(r);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Initial run failed:`, err.message);
  }
})();

// Schedule every 30 minutes (halves DB growth vs 15-min)
cron.schedule('*/30 * * * *', async () => {
  try {
    const r = await collectSnapshots();
    const ts = new Date().toISOString();
    console.log(`[${ts}] Snapshot: funding=${r.funding} oi=${r.oi} liq=${r.liq} (${r.elapsedMs}ms)${r.errors.length ? ' errors=' + r.errors.join(', ') : ''}${r.pruned ? ' pruned=' + JSON.stringify(r.pruned) : ''}`);
    updateHealth(r);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Snapshot failed:`, err.message);
    updateHealth({ funding: 0, oi: 0, liq: 0, errors: [err.message], elapsedMs: 0 });
  }
});

// Start health server
startHealthServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[infohub-collector] Shutting down...');
  await sql.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[infohub-collector] Interrupted');
  await sql.end();
  process.exit(0);
});
