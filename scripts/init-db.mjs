import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('No POSTGRES_URL or DATABASE_URL set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function init() {
  console.log('Connecting to:', DATABASE_URL.slice(0, 40) + '...');
  console.log('Creating tables...');

  await sql`CREATE TABLE IF NOT EXISTS api_cache (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log('  api_cache OK');

  await sql`CREATE TABLE IF NOT EXISTS funding_snapshots (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    rate REAL NOT NULL,
    predicted REAL,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_funding_sym_ts ON funding_snapshots(symbol, ts DESC)`;
  console.log('  funding_snapshots OK');

  await sql`CREATE TABLE IF NOT EXISTS oi_snapshots (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    oi_usd REAL NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_oi_sym_ts ON oi_snapshots(symbol, ts DESC)`;
  console.log('  oi_snapshots OK');

  await sql`CREATE TABLE IF NOT EXISTS watchlists (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, symbol)
  )`;
  console.log('  watchlists OK');

  await sql`CREATE TABLE IF NOT EXISTS user_prefs (
    user_id TEXT PRIMARY KEY,
    prefs JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log('  user_prefs OK');

  // Verify
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  console.log('\nTables in database:', tables.map(t => t.tablename).join(', '));
  console.log('Done!');
}

init().catch(e => { console.error('FAILED:', e); process.exit(1); });
