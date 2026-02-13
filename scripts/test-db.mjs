import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL);

async function test() {
  // Test cache write/read
  console.log('Testing api_cache...');
  await sql`INSERT INTO api_cache (key, data, expires_at)
    VALUES ('test', '{"hello":"world"}'::jsonb, NOW() + '1 hour'::interval)
    ON CONFLICT (key) DO UPDATE SET data = '{"hello":"world"}'::jsonb, expires_at = NOW() + '1 hour'::interval`;

  const cached = await sql`SELECT data FROM api_cache WHERE key = 'test' AND expires_at > NOW()`;
  console.log('  Cache read:', JSON.stringify(cached[0]?.data));

  // Test funding snapshot
  console.log('Testing funding_snapshots...');
  await sql`INSERT INTO funding_snapshots (symbol, exchange, rate) VALUES ('BTC', 'Binance', 0.0045)`;
  await sql`INSERT INTO funding_snapshots (symbol, exchange, rate) VALUES ('ETH', 'Bybit', -0.0012)`;

  const funding = await sql`SELECT symbol, exchange, rate FROM funding_snapshots ORDER BY ts DESC LIMIT 5`;
  console.log('  Funding rows:', funding.length);
  funding.forEach(r => console.log(`    ${r.symbol} ${r.exchange}: ${r.rate}%`));

  // Test OI snapshot
  console.log('Testing oi_snapshots...');
  await sql`INSERT INTO oi_snapshots (symbol, exchange, oi_usd) VALUES ('BTC', 'Binance', 5200000000)`;

  const oi = await sql`SELECT symbol, exchange, oi_usd FROM oi_snapshots ORDER BY ts DESC LIMIT 5`;
  console.log('  OI rows:', oi.length);
  oi.forEach(r => console.log(`    ${r.symbol} ${r.exchange}: $${(r.oi_usd/1e9).toFixed(2)}B`));

  // Clean up test data
  await sql`DELETE FROM api_cache WHERE key = 'test'`;
  await sql`DELETE FROM funding_snapshots WHERE symbol IN ('BTC','ETH') AND rate IN (0.0045, -0.0012)`;
  await sql`DELETE FROM oi_snapshots WHERE symbol = 'BTC' AND oi_usd = 5200000000`;
  console.log('\nCleanup done. DB is working!');
}

test().catch(e => { console.error('FAILED:', e); process.exit(1); });
