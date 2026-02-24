/**
 * Database client for DigitalOcean Managed PostgreSQL.
 * Uses 'postgres' (Postgres.js) — lightweight, modern, Edge-compatible driver.
 *
 * Connection string from env: DATABASE_URL
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || '';

let sql: ReturnType<typeof postgres> | null = null;

function getSQL() {
  if (!DATABASE_URL) {
    throw new Error('No database URL configured. Set DATABASE_URL env var.');
  }
  if (!sql) {
    sql = postgres(DATABASE_URL, {
      max: 10,               // connection pool size
      idle_timeout: 20,      // close idle connections after 20s
      connect_timeout: 10,   // 10s connection timeout
      ssl: 'require',
    });
  }
  return sql;
}

// ─── Schema initialization ──────────────────────────────────────────────────

let initialized = false;

export async function initDB(): Promise<void> {
  if (initialized) return;
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS api_cache (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS funding_snapshots (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      rate REAL NOT NULL,
      predicted REAL,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_funding_sym_ts ON funding_snapshots(symbol, ts DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS oi_snapshots (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      oi_usd REAL NOT NULL,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_oi_sym_ts ON oi_snapshots(symbol, ts DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS watchlists (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, symbol)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_prefs (
      user_id TEXT PRIMARY KEY,
      prefs JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await initTelegramTables();

  initialized = true;
}

// ─── API Cache (L2 — survives Edge cold starts) ────────────────────────────

export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT data FROM api_cache
      WHERE key = ${key} AND expires_at > NOW()
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    return rows[0].data as T;
  } catch (e) {
    console.error('DB getCache error:', e);
    return null;
  }
}

export async function setCache(key: string, data: any, ttlSeconds: number): Promise<void> {
  try {
    const sql = getSQL();
    const jsonData = JSON.stringify(data);
    await sql`
      INSERT INTO api_cache (key, data, expires_at, updated_at)
      VALUES (${key}, ${jsonData}::jsonb, NOW() + ${`${ttlSeconds} seconds`}::interval, NOW())
      ON CONFLICT (key) DO UPDATE
      SET data = ${jsonData}::jsonb,
          expires_at = NOW() + ${`${ttlSeconds} seconds`}::interval,
          updated_at = NOW()
    `;
  } catch (e) {
    console.error('DB setCache error:', e);
  }
}

// ─── Funding Rate Snapshots ─────────────────────────────────────────────────

interface FundingSnapshotEntry {
  symbol: string;
  exchange: string;
  rate: number;
  predicted?: number;
}

export async function saveFundingSnapshot(entries: FundingSnapshotEntry[]): Promise<number> {
  if (entries.length === 0) return 0;
  const sql = getSQL();

  let inserted = 0;
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    const promises = chunk.map(e =>
      sql`INSERT INTO funding_snapshots (symbol, exchange, rate, predicted)
          VALUES (${e.symbol}, ${e.exchange}, ${e.rate}, ${e.predicted ?? null})`
    );
    await Promise.all(promises);
    inserted += chunk.length;
  }

  return inserted;
}

// ─── Open Interest Snapshots ────────────────────────────────────────────────

interface OISnapshotEntry {
  symbol: string;
  exchange: string;
  oiUsd: number;
}

export async function saveOISnapshot(entries: OISnapshotEntry[]): Promise<number> {
  if (entries.length === 0) return 0;
  const sql = getSQL();

  let inserted = 0;
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    const promises = chunk.map(e =>
      sql`INSERT INTO oi_snapshots (symbol, exchange, oi_usd)
          VALUES (${e.symbol}, ${e.exchange}, ${e.oiUsd})`
    );
    await Promise.all(promises);
    inserted += chunk.length;
  }

  return inserted;
}

// ─── Historical Data Queries ────────────────────────────────────────────────

export interface HistoryPoint {
  t: number;
  rate: number;
}

export interface OIHistoryPoint {
  t: number;
  oi: number;
}

export async function getFundingHistory(
  symbol: string,
  exchange?: string,
  days: number = 30
): Promise<HistoryPoint[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    let rows;
    if (exchange) {
      rows = await sql`
        SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, rate
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND exchange = ${exchange}
          AND ts > NOW() - ${intervalStr}::interval
        ORDER BY ts ASC
      `;
    } else {
      rows = await sql`
        SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, AVG(rate) AS rate
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        GROUP BY ts
        ORDER BY ts ASC
      `;
    }
    return rows.map((r: any) => ({ t: Number(r.t), rate: Number(r.rate) }));
  } catch (e) {
    console.error('DB getFundingHistory error:', e);
    return [];
  }
}

/**
 * Bulk fetch daily-average funding rates for multiple symbols over N days.
 * Returns Map<symbol, Array<{ day: string (YYYY-MM-DD), rate: number }>>
 */
export async function getBulkFundingHistory(
  symbols: string[],
  days: number = 7,
): Promise<Map<string, Array<{ day: string; rate: number }>>> {
  const result = new Map<string, Array<{ day: string; rate: number }>>();
  if (symbols.length === 0) return result;

  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT symbol,
             DATE(ts) AS day,
             AVG(rate) AS rate
      FROM funding_snapshots
      WHERE symbol = ANY(${symbols})
        AND ts > NOW() - ${intervalStr}::interval
      GROUP BY symbol, DATE(ts)
      ORDER BY symbol, day
    `;

    rows.forEach((r: any) => {
      const sym = r.symbol as string;
      if (!result.has(sym)) result.set(sym, []);
      result.get(sym)!.push({
        day: String(r.day).slice(0, 10),
        rate: Number(r.rate),
      });
    });
  } catch (e) {
    console.error('DB getBulkFundingHistory error:', e);
  }
  return result;
}

export async function getOIHistory(
  symbol: string,
  days: number = 7
): Promise<OIHistoryPoint[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, SUM(oi_usd) AS oi
      FROM oi_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      GROUP BY ts
      ORDER BY ts ASC
    `;
    return rows.map((r: any) => ({ t: Number(r.t), oi: Number(r.oi) }));
  } catch (e) {
    console.error('DB getOIHistory error:', e);
    return [];
  }
}

// ─── OI Delta Queries ──────────────────────────────────────────────────────

export interface OIDelta {
  symbol: string;
  currentOI: number;
  change1h: number | null;
  change4h: number | null;
  change24h: number | null;
}

/**
 * Get OI deltas by comparing latest snapshot with past snapshots.
 * Returns per-symbol aggregated OI with 1h/4h/24h percentage changes.
 */
export async function getOIDeltas(): Promise<OIDelta[]> {
  try {
    const sql = getSQL();

    const rows = await sql`
      WITH latest AS (
        SELECT MAX(ts) AS max_ts FROM oi_snapshots WHERE ts > NOW() - INTERVAL '30 minutes'
      ),
      current_oi AS (
        SELECT symbol, SUM(oi_usd) AS oi
        FROM oi_snapshots, latest
        WHERE ts >= latest.max_ts - INTERVAL '2 minutes'
        GROUP BY symbol
      ),
      oi_1h AS (
        SELECT symbol, SUM(oi_usd) AS oi
        FROM oi_snapshots
        WHERE ts BETWEEN NOW() - INTERVAL '70 minutes' AND NOW() - INTERVAL '50 minutes'
        GROUP BY symbol
      ),
      oi_4h AS (
        SELECT symbol, SUM(oi_usd) AS oi
        FROM oi_snapshots
        WHERE ts BETWEEN NOW() - INTERVAL '250 minutes' AND NOW() - INTERVAL '230 minutes'
        GROUP BY symbol
      ),
      oi_24h AS (
        SELECT symbol, SUM(oi_usd) AS oi
        FROM oi_snapshots
        WHERE ts BETWEEN NOW() - INTERVAL '1450 minutes' AND NOW() - INTERVAL '1430 minutes'
        GROUP BY symbol
      )
      SELECT
        c.symbol,
        c.oi AS current_oi,
        CASE WHEN h1.oi > 0 THEN ((c.oi - h1.oi) / h1.oi * 100) ELSE NULL END AS change_1h,
        CASE WHEN h4.oi > 0 THEN ((c.oi - h4.oi) / h4.oi * 100) ELSE NULL END AS change_4h,
        CASE WHEN h24.oi > 0 THEN ((c.oi - h24.oi) / h24.oi * 100) ELSE NULL END AS change_24h
      FROM current_oi c
      LEFT JOIN oi_1h h1 ON c.symbol = h1.symbol
      LEFT JOIN oi_4h h4 ON c.symbol = h4.symbol
      LEFT JOIN oi_24h h24 ON c.symbol = h24.symbol
      ORDER BY c.oi DESC
    `;

    return rows.map((r: any) => ({
      symbol: r.symbol,
      currentOI: Number(r.current_oi),
      change1h: r.change_1h != null ? Number(r.change_1h) : null,
      change4h: r.change_4h != null ? Number(r.change_4h) : null,
      change24h: r.change_24h != null ? Number(r.change_24h) : null,
    }));
  } catch (e) {
    console.error('DB getOIDeltas error:', e);
    return [];
  }
}

// ─── Data Pruning ───────────────────────────────────────────────────────────

export async function pruneOldData(keepDays: number = 90): Promise<{ funding: number; oi: number }> {
  try {
    const sql = getSQL();
    const intervalStr = `${keepDays} days`;

    const fr = await sql`
      DELETE FROM funding_snapshots WHERE ts < NOW() - ${intervalStr}::interval
    `;
    const oi = await sql`
      DELETE FROM oi_snapshots WHERE ts < NOW() - ${intervalStr}::interval
    `;

    // Also clean expired cache entries
    await sql`DELETE FROM api_cache WHERE expires_at < NOW()`;

    return {
      funding: fr.count ?? 0,
      oi: oi.count ?? 0,
    };
  } catch (e) {
    console.error('DB pruneOldData error:', e);
    return { funding: 0, oi: 0 };
  }
}

// ─── User Data (synced localStorage data) ──────────────────────────────────

export interface UserData {
  watchlist?: string[];
  portfolio?: any[];
  alerts?: any[];
  screenerPresets?: any[];
  wallets?: any[];
}

export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT prefs FROM user_prefs WHERE user_id = ${userId}
    `;
    if (rows.length === 0) return null;
    return rows[0].prefs as UserData;
  } catch (e) {
    console.error('DB getUserData error:', e);
    return null;
  }
}

export async function setUserData(userId: string, data: UserData): Promise<void> {
  try {
    const sql = getSQL();
    const jsonData = JSON.stringify(data);
    await sql`
      INSERT INTO user_prefs (user_id, prefs, updated_at)
      VALUES (${userId}, ${jsonData}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET prefs = ${jsonData}::jsonb,
          updated_at = NOW()
    `;
  } catch (e) {
    console.error('DB setUserData error:', e);
  }
}

// ─── Telegram Bot Tables ────────────────────────────────────────────────────

async function initTelegramTables(): Promise<void> {
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS telegram_users (
      chat_id BIGINT PRIMARY KEY,
      active BOOLEAN DEFAULT true,
      price_threshold REAL DEFAULT 0.5,
      funding_threshold REAL DEFAULT 0.02,
      watchlist TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS arb_cooldowns (
      key TEXT PRIMARY KEY,
      alerted_at TIMESTAMPTZ DEFAULT NOW(),
      spread REAL DEFAULT 0
    )
  `;
}

export interface TelegramUser {
  chat_id: number;
  active: boolean;
  price_threshold: number;
  funding_threshold: number;
  watchlist: string;
}

export async function getTelegramUser(chatId: number): Promise<TelegramUser | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT chat_id, active, price_threshold, funding_threshold, watchlist
      FROM telegram_users WHERE chat_id = ${chatId}
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      chat_id: Number(r.chat_id),
      active: Boolean(r.active),
      price_threshold: Number(r.price_threshold),
      funding_threshold: Number(r.funding_threshold),
      watchlist: r.watchlist ?? '',
    };
  } catch (e) {
    console.error('DB getTelegramUser error:', e);
    return null;
  }
}

export async function upsertTelegramUser(
  chatId: number,
  fields?: Partial<Omit<TelegramUser, 'chat_id'>>,
): Promise<void> {
  try {
    const sql = getSQL();
    const active = fields?.active ?? null;
    const priceThreshold = fields?.price_threshold ?? null;
    const fundingThreshold = fields?.funding_threshold ?? null;
    const watchlist = fields?.watchlist ?? null;

    await sql`
      INSERT INTO telegram_users (chat_id, active, price_threshold, funding_threshold, watchlist, updated_at)
      VALUES (
        ${chatId},
        COALESCE(${active}, true),
        COALESCE(${priceThreshold}, 0.5),
        COALESCE(${fundingThreshold}, 0.02),
        COALESCE(${watchlist}, ''),
        NOW()
      )
      ON CONFLICT (chat_id) DO UPDATE SET
        active = COALESCE(${active}, telegram_users.active),
        price_threshold = COALESCE(${priceThreshold}, telegram_users.price_threshold),
        funding_threshold = COALESCE(${fundingThreshold}, telegram_users.funding_threshold),
        watchlist = COALESCE(${watchlist}, telegram_users.watchlist),
        updated_at = NOW()
    `;
  } catch (e) {
    console.error('DB upsertTelegramUser error:', e);
  }
}

export async function getActiveTelegramUsers(): Promise<TelegramUser[]> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT chat_id, active, price_threshold, funding_threshold, watchlist
      FROM telegram_users WHERE active = true
    `;
    return rows.map((r: any) => ({
      chat_id: Number(r.chat_id),
      active: true,
      price_threshold: Number(r.price_threshold),
      funding_threshold: Number(r.funding_threshold),
      watchlist: r.watchlist ?? '',
    }));
  } catch (e) {
    console.error('DB getActiveTelegramUsers error:', e);
    return [];
  }
}

export async function getCooldown(key: string): Promise<{ alertedAt: Date; spread: number } | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT alerted_at, spread FROM arb_cooldowns
      WHERE key = ${key} AND alerted_at > NOW() - INTERVAL '15 minutes'
    `;
    if (rows.length === 0) return null;
    return {
      alertedAt: new Date(rows[0].alerted_at),
      spread: Number(rows[0].spread),
    };
  } catch (e) {
    console.error('DB getCooldown error:', e);
    return null;
  }
}

export async function setCooldown(key: string, spread: number): Promise<void> {
  try {
    const sql = getSQL();
    await sql`
      INSERT INTO arb_cooldowns (key, alerted_at, spread)
      VALUES (${key}, NOW(), ${spread})
      ON CONFLICT (key) DO UPDATE SET
        alerted_at = NOW(),
        spread = ${spread}
    `;
  } catch (e) {
    console.error('DB setCooldown error:', e);
  }
}

export async function cleanupCooldowns(): Promise<void> {
  try {
    const sql = getSQL();
    await sql`
      DELETE FROM arb_cooldowns WHERE alerted_at < NOW() - INTERVAL '1 hour'
    `;
  } catch (e) {
    console.error('DB cleanupCooldowns error:', e);
  }
}

// ─── Check if DB is available ───────────────────────────────────────────────

export function isDBConfigured(): boolean {
  return Boolean(DATABASE_URL);
}
