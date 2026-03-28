// Test: run one full collection cycle with actual DB inserts
import 'dotenv/config';
import postgres from 'postgres';

const BASE_URL = process.env.INFOHUB_BASE_URL || 'https://info-hub.io';

// Fall back to main project's .env.prod
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const { readFileSync } = await import('fs');
  try {
    const envProd = readFileSync('../.env.prod', 'utf8');
    const match = envProd.match(/DATABASE_URL="?([^"\n]+)"?/);
    if (match) dbUrl = match[1];
  } catch {}
}
if (!dbUrl) { console.error('No DATABASE_URL'); process.exit(1); }

const sql = postgres(dbUrl, { max: 5, idle_timeout: 20, ssl: 'require' });
const MAX_SYMBOLS = 300;
const BATCH_SIZE = 50;

async function fetchJSON(path, timeoutMs = 25000) {
  const res = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function topSymbols(data) {
  const counts = {};
  for (const r of data) counts[r.symbol] = (counts[r.symbol] || 0) + 1;
  return new Set(
    Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, MAX_SYMBOLS).map(([s]) => s)
  );
}

async function batchInsert(entries, fn) {
  let n = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map(fn));
    n += chunk.length;
  }
  return n;
}

try {
  console.log('=== Full Collection Test ===\n');
  const start = Date.now();

  // Funding
  console.log('Collecting funding...');
  const { data: fData } = await fetchJSON('/api/funding');
  const fTop = topSymbols(fData);
  const fEntries = fData.filter(r => fTop.has(r.symbol) && r.fundingRate != null)
    .map(r => ({ symbol: r.symbol, exchange: r.exchange, rate: r.fundingRate, predicted: r.predictedRate ?? null }));
  const fInserted = await batchInsert(fEntries, e =>
    sql`INSERT INTO funding_snapshots (symbol, exchange, rate, predicted) VALUES (${e.symbol}, ${e.exchange}, ${e.rate}, ${e.predicted})`
  );
  console.log(`  Inserted ${fInserted} funding rows`);

  // OI
  console.log('Collecting OI...');
  const { data: oiData } = await fetchJSON('/api/openinterest');
  const oiTop = topSymbols(oiData);
  const oiEntries = oiData.filter(r => oiTop.has(r.symbol) && r.openInterestValue > 0)
    .map(r => ({ symbol: r.symbol, exchange: r.exchange, oiUsd: r.openInterestValue }));
  const oiInserted = await batchInsert(oiEntries, e =>
    sql`INSERT INTO oi_snapshots (symbol, exchange, oi_usd) VALUES (${e.symbol}, ${e.exchange}, ${e.oiUsd})`
  );
  console.log(`  Inserted ${oiInserted} OI rows`);

  // Liquidations
  let liqTotal = 0;
  for (const sym of ['BTC', 'ETH', 'SOL']) {
    try {
      const json = await fetchJSON(`/api/liquidation-heatmap?symbol=${sym}&timeframe=24h`, 15000);
      const events = json?.summary?.recentEvents || [];
      const entries = events.filter(e => e.volume > 0 && e.price > 0).map(e => ({
        symbol: sym, exchange: e.exchange || 'Unknown', side: e.side || 'long',
        price: e.price, quantity: e.volume / e.price, valueUsd: e.volume,
        ts: e.time ? new Date(e.time).toISOString() : new Date().toISOString(),
      }));
      const n = await batchInsert(entries, e =>
        sql`INSERT INTO liquidation_snapshots (symbol, exchange, side, price, quantity, value_usd, ts)
            VALUES (${e.symbol}, ${e.exchange}, ${e.side}, ${e.price}, ${e.quantity}, ${e.valueUsd}, ${e.ts})
            ON CONFLICT (symbol, exchange, side, price, ts) DO NOTHING`
      );
      liqTotal += n;
      console.log(`  ${sym}: ${n} liquidation rows`);
    } catch (err) {
      console.log(`  ${sym}: ${err.message}`);
    }
  }

  const elapsed = Date.now() - start;
  console.log(`\n=== Done in ${elapsed}ms ===`);
  console.log(`Funding: ${fInserted}, OI: ${oiInserted}, Liquidations: ${liqTotal}`);

  // Verify
  const [fc] = await sql`SELECT count(*) as cnt FROM funding_snapshots`;
  const [oc] = await sql`SELECT count(*) as cnt FROM oi_snapshots`;
  const [lc] = await sql`SELECT count(*) as cnt FROM liquidation_snapshots`;
  console.log(`\nDB totals: funding=${fc.cnt}, oi=${oc.cnt}, liquidations=${lc.cnt}`);
} catch (err) {
  console.error('Error:', err);
} finally {
  await sql.end();
}
