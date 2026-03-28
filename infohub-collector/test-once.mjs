// Quick test: run one collection cycle and report results
import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = process.env.INFOHUB_BASE_URL || 'https://info-hub.io';

if (!DATABASE_URL) {
  // Fall back to main project's .env.prod
  const { readFileSync } = await import('fs');
  try {
    const envProd = readFileSync('../.env.prod', 'utf8');
    const match = envProd.match(/DATABASE_URL="?([^"\n]+)"?/);
    if (match) process.env.DATABASE_URL = match[1];
  } catch {}
}

const dbUrl = process.env.DATABASE_URL || DATABASE_URL;
if (!dbUrl) { console.error('No DATABASE_URL'); process.exit(1); }

const sql = postgres(dbUrl, { max: 3, idle_timeout: 10, ssl: 'require' });

async function fetchJSON(path, timeoutMs = 25000) {
  const url = `${BASE_URL}${path}`;
  console.log(`  Fetching ${url}...`);
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

try {
  console.log('=== InfoHub Collector Test ===\n');

  // Test DB connection
  const [row] = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
  console.log(`DB connected: ${row.size}\n`);

  // Test funding fetch
  console.log('1. Funding rates:');
  const funding = await fetchJSON('/api/funding');
  const fData = funding.data || [];
  console.log(`   ${fData.length} entries from ${funding.meta?.activeExchanges || '?'} exchanges`);

  // Test OI fetch
  console.log('\n2. Open interest:');
  const oi = await fetchJSON('/api/openinterest');
  const oiData = oi.data || [];
  console.log(`   ${oiData.length} entries from ${oi.meta?.activeExchanges || '?'} exchanges`);

  // Test liquidations fetch
  console.log('\n3. Liquidations (BTC):');
  const liq = await fetchJSON('/api/liquidation-heatmap?symbol=BTC&timeframe=24h', 15000);
  const events = liq?.summary?.recentEvents || [];
  console.log(`   ${events.length} recent events`);

  // Check current snapshot counts
  console.log('\n4. Current DB snapshot counts:');
  const [fc] = await sql`SELECT count(*) as cnt FROM funding_snapshots`;
  const [oc] = await sql`SELECT count(*) as cnt FROM oi_snapshots`;
  const [lc] = await sql`SELECT count(*) as cnt FROM liquidation_snapshots`;
  console.log(`   funding: ${fc.cnt}, oi: ${oc.cnt}, liquidations: ${lc.cnt}`);

  console.log('\n=== All checks passed ===');
} catch (err) {
  console.error('Test failed:', err.message);
} finally {
  await sql.end();
}
