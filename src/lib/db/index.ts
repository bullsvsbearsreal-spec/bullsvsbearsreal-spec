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

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_prt_email ON password_reset_tokens(email)`;

  await sql`
    CREATE TABLE IF NOT EXISTS alert_notifications (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      alert_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      metric TEXT NOT NULL,
      threshold REAL NOT NULL,
      actual_value REAL NOT NULL,
      channel TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_alert_notif_user ON alert_notifications(user_id, alert_id, sent_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      total_value REAL NOT NULL,
      total_pnl REAL NOT NULL,
      holdings JSONB,
      ts TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_portfolio_user_ts ON portfolio_snapshots(user_id, ts DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS liquidation_snapshots (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      side TEXT NOT NULL,
      price REAL NOT NULL,
      quantity REAL NOT NULL,
      value_usd REAL NOT NULL,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_liq_sym_ts ON liquidation_snapshots(symbol, ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_liq_sym_ex_ts ON liquidation_snapshots(symbol, exchange, ts DESC)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_liq_dedup ON liquidation_snapshots(symbol, exchange, side, price, ts)`;

  // Compound indexes for faster history queries
  await sql`CREATE INDEX IF NOT EXISTS idx_funding_sym_ex_ts ON funding_snapshots(symbol, exchange, ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_oi_sym_ex_ts ON oi_snapshots(symbol, exchange, ts DESC)`;

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

// ─── Liquidation Snapshots ──────────────────────────────────────────────────

interface LiquidationSnapshotEntry {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  timestamp?: number; // unix ms — defaults to NOW()
}

export async function saveLiquidationSnapshot(entries: LiquidationSnapshotEntry[]): Promise<number> {
  if (entries.length === 0) return 0;
  const sql = getSQL();

  let inserted = 0;
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    const promises = chunk.map(e => {
      const ts = e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString();
      return sql`INSERT INTO liquidation_snapshots (symbol, exchange, side, price, quantity, value_usd, ts)
          VALUES (${e.symbol}, ${e.exchange}, ${e.side}, ${e.price}, ${e.quantity}, ${e.valueUsd}, ${ts})
          ON CONFLICT (symbol, exchange, side, price, ts) DO NOTHING`;
    });
    await Promise.all(promises);
    inserted += chunk.length;
  }

  return inserted;
}

// ─── Liquidation Heatmap Queries ────────────────────────────────────────────

export interface LiquidationRawEvent {
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  ts: number; // unix ms
}

/**
 * Get raw liquidation events for heatmap rendering.
 * <=24h: individual events. >24h: pre-aggregated 30-min buckets.
 */
export async function getLiquidationHeatmapData(
  symbol: string,
  hours: number,
): Promise<LiquidationRawEvent[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;

    if (hours <= 24) {
      const rows = await sql`
        SELECT exchange, side, price, quantity, value_usd,
               EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
        FROM liquidation_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        ORDER BY ts ASC
      `;
      return rows.map((r: any) => ({
        exchange: r.exchange,
        side: r.side as 'long' | 'short',
        price: Number(r.price),
        quantity: Number(r.quantity),
        valueUsd: Number(r.value_usd),
        ts: Number(r.ts_ms),
      }));
    } else {
      // 7d+: aggregate into 30-min buckets to limit row count
      const rows = await sql`
        SELECT
          exchange, side,
          AVG(price) AS price,
          SUM(quantity) AS quantity,
          SUM(value_usd) AS value_usd,
          (FLOOR(EXTRACT(EPOCH FROM ts) / 1800) * 1800 * 1000) AS ts_ms
        FROM liquidation_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        GROUP BY exchange, side, FLOOR(EXTRACT(EPOCH FROM ts) / 1800)
        ORDER BY ts_ms ASC
      `;
      return rows.map((r: any) => ({
        exchange: r.exchange,
        side: r.side as 'long' | 'short',
        price: Number(r.price),
        quantity: Number(r.quantity),
        valueUsd: Number(r.value_usd),
        ts: Number(r.ts_ms),
      }));
    }
  } catch (e) {
    console.error('DB getLiquidationHeatmapData error:', e);
    return [];
  }
}

export interface LiquidationSummaryDB {
  totalCount: number;
  totalVolume: number;
  longVolume: number;
  shortVolume: number;
  largestPrice: number;
  largestVolume: number;
  largestSide: 'long' | 'short';
  largestExchange: string;
  largestTime: number;
}

/**
 * Get aggregate summary statistics for liquidation events in a time window.
 */
export async function getLiquidationSummary(
  symbol: string,
  hours: number,
): Promise<LiquidationSummaryDB | null> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;

    const [stats, largest] = await Promise.all([
      sql`
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(value_usd), 0) AS total_volume,
          COALESCE(SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END), 0) AS long_volume,
          COALESCE(SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END), 0) AS short_volume
        FROM liquidation_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
      `,
      sql`
        SELECT price, value_usd, side, exchange,
               EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
        FROM liquidation_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        ORDER BY value_usd DESC
        LIMIT 1
      `,
    ]);

    if (stats.length === 0) return null;
    const r = stats[0];
    const lg = largest[0];

    return {
      totalCount: Number(r.total_count),
      totalVolume: Number(r.total_volume),
      longVolume: Number(r.long_volume),
      shortVolume: Number(r.short_volume),
      largestPrice: lg ? Number(lg.price) : 0,
      largestVolume: lg ? Number(lg.value_usd) : 0,
      largestSide: lg ? (lg.side as 'long' | 'short') : 'long',
      largestExchange: lg ? lg.exchange : '',
      largestTime: lg ? Number(lg.ts_ms) : 0,
    };
  } catch (e) {
    console.error('DB getLiquidationSummary error:', e);
    return null;
  }
}

/**
 * Get recent liquidation events for the events table.
 */
export async function getRecentLiquidations(
  symbol: string,
  hours: number,
  limit: number = 50,
): Promise<LiquidationRawEvent[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;
    const rows = await sql`
      SELECT exchange, side, price, quantity, value_usd,
             EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
      FROM liquidation_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      ORDER BY ts DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      exchange: r.exchange,
      side: r.side as 'long' | 'short',
      price: Number(r.price),
      quantity: Number(r.quantity),
      valueUsd: Number(r.value_usd),
      ts: Number(r.ts_ms),
    }));
  } catch (e) {
    console.error('DB getRecentLiquidations error:', e);
    return [];
  }
}

export interface LiquidationHistoryPoint {
  t: number;
  value: number;
  count: number;
  longValue: number;
  shortValue: number;
}

/**
 * Get aggregated liquidation history bucketed by hour.
 * Returns total value, count, long/short breakdown per bucket.
 */
export async function getLiquidationHistory(
  symbol: string,
  days: number = 7,
): Promise<LiquidationHistoryPoint[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT
        EXTRACT(EPOCH FROM date_trunc('hour', ts)) * 1000 AS t,
        SUM(value_usd) AS value,
        COUNT(*) AS count,
        SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END) AS long_value,
        SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END) AS short_value
      FROM liquidation_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      GROUP BY date_trunc('hour', ts)
      ORDER BY t ASC
    `;
    return rows.map((r: any) => ({
      t: Number(r.t),
      value: Number(r.value),
      count: Number(r.count),
      longValue: Number(r.long_value),
      shortValue: Number(r.short_value),
    }));
  } catch (e) {
    console.error('DB getLiquidationHistory error:', e);
    return [];
  }
}

/**
 * Get aggregated liquidation stats per exchange for a symbol.
 */
export async function getLiquidationsByExchange(
  symbol: string,
  days: number = 7,
): Promise<Array<{ exchange: string; value: number; count: number; longValue: number; shortValue: number }>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT
        exchange,
        SUM(value_usd) AS value,
        COUNT(*) AS count,
        SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END) AS long_value,
        SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END) AS short_value
      FROM liquidation_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      GROUP BY exchange
      ORDER BY value DESC
    `;
    return rows.map((r: any) => ({
      exchange: r.exchange,
      value: Number(r.value),
      count: Number(r.count),
      longValue: Number(r.long_value),
      shortValue: Number(r.short_value),
    }));
  } catch (e) {
    console.error('DB getLiquidationsByExchange error:', e);
    return [];
  }
}

/**
 * Get top liquidated symbols by total value.
 */
export async function getTopLiquidatedSymbols(
  days: number = 1,
  limit: number = 20,
): Promise<Array<{ symbol: string; value: number; count: number; longValue: number; shortValue: number }>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT
        symbol,
        SUM(value_usd) AS value,
        COUNT(*) AS count,
        SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END) AS long_value,
        SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END) AS short_value
      FROM liquidation_snapshots
      WHERE ts > NOW() - ${intervalStr}::interval
      GROUP BY symbol
      ORDER BY value DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      symbol: r.symbol,
      value: Number(r.value),
      count: Number(r.count),
      longValue: Number(r.long_value),
      shortValue: Number(r.short_value),
    }));
  } catch (e) {
    console.error('DB getTopLiquidatedSymbols error:', e);
    return [];
  }
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

export async function pruneOldData(keepDays: number = 90): Promise<{ funding: number; oi: number; liquidations: number }> {
  try {
    const sql = getSQL();
    const intervalStr = `${keepDays} days`;

    const fr = await sql`
      DELETE FROM funding_snapshots WHERE ts < NOW() - ${intervalStr}::interval
    `;
    const oi = await sql`
      DELETE FROM oi_snapshots WHERE ts < NOW() - ${intervalStr}::interval
    `;
    const liq = await sql`
      DELETE FROM liquidation_snapshots WHERE ts < NOW() - ${intervalStr}::interval
    `;

    // Also clean expired cache entries
    await sql`DELETE FROM api_cache WHERE expires_at < NOW()`;

    return {
      funding: fr.count ?? 0,
      oi: oi.count ?? 0,
      liquidations: liq.count ?? 0,
    };
  } catch (e) {
    console.error('DB pruneOldData error:', e);
    return { funding: 0, oi: 0, liquidations: 0 };
  }
}

// ─── User Data (synced localStorage data) ──────────────────────────────────

export interface NotificationPrefs {
  email: boolean;
  cooldownMinutes: number;
}

export interface UserData {
  watchlist?: string[];
  portfolio?: any[];
  alerts?: any[];
  screenerPresets?: any[];
  wallets?: any[];
  notificationPrefs?: NotificationPrefs;
  theme?: string;
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

// ─── Alert Notification Functions ────────────────────────────────────────────

export interface AlertUserRow {
  userId: string;
  email: string;
  alerts: any[];
  notificationPrefs?: NotificationPrefs;
}

/**
 * Get all users who have enabled alerts in their prefs JSONB.
 */
export async function getAllUsersWithAlerts(): Promise<AlertUserRow[]> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT
        up.user_id,
        u.email,
        up.prefs->'alerts' AS alerts,
        up.prefs->'notificationPrefs' AS notification_prefs
      FROM user_prefs up
      JOIN users u ON up.user_id = u.id
      WHERE jsonb_array_length(COALESCE(up.prefs->'alerts', '[]'::jsonb)) > 0
    `;
    return rows.map((r: any) => ({
      userId: r.user_id,
      email: r.email,
      alerts: (r.alerts ?? []) as any[],
      notificationPrefs: r.notification_prefs as NotificationPrefs | undefined,
    }));
  } catch (e) {
    console.error('DB getAllUsersWithAlerts error:', e);
    return [];
  }
}

/**
 * Check if an alert notification was sent within the cooldown window.
 */
export async function getAlertCooldown(
  userId: string,
  alertId: string,
  cooldownMinutes: number = 60,
): Promise<boolean> {
  try {
    const sql = getSQL();
    const intervalStr = `${cooldownMinutes} minutes`;
    const rows = await sql`
      SELECT 1 FROM alert_notifications
      WHERE user_id = ${userId}
        AND alert_id = ${alertId}
        AND sent_at > NOW() - ${intervalStr}::interval
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (e) {
    console.error('DB getAlertCooldown error:', e);
    return true; // fail closed — assume in cooldown
  }
}

/**
 * Log a sent alert notification.
 */
export async function logAlertNotification(
  userId: string,
  alertId: string,
  symbol: string,
  metric: string,
  threshold: number,
  actualValue: number,
  channel: string,
): Promise<void> {
  try {
    const sql = getSQL();
    await sql`
      INSERT INTO alert_notifications (user_id, alert_id, symbol, metric, threshold, actual_value, channel)
      VALUES (${userId}, ${alertId}, ${symbol}, ${metric}, ${threshold}, ${actualValue}, ${channel})
    `;
  } catch (e) {
    console.error('DB logAlertNotification error:', e);
  }
}

/**
 * Clean up old alert notifications (keep 30 days).
 */
export async function pruneAlertNotifications(): Promise<number> {
  try {
    const sql = getSQL();
    const result = await sql`
      DELETE FROM alert_notifications WHERE sent_at < NOW() - INTERVAL '30 days'
    `;
    return result.count ?? 0;
  } catch (e) {
    console.error('DB pruneAlertNotifications error:', e);
    return 0;
  }
}

// ─── Multi-Exchange Funding History ─────────────────────────────────────────

export interface ExchangeHistoryPoint {
  t: number;
  rate: number;
}

/**
 * Get funding history for all exchanges that traded a symbol.
 * For >7 days, buckets into hourly averages to reduce data points.
 */
export async function getFundingHistoryMulti(
  symbol: string,
  days: number = 7,
): Promise<Record<string, ExchangeHistoryPoint[]>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    let rows;

    if (days > 7) {
      rows = await sql`
        SELECT exchange,
               EXTRACT(EPOCH FROM date_trunc('hour', ts)) * 1000 AS t,
               AVG(rate) AS rate
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        GROUP BY exchange, date_trunc('hour', ts)
        ORDER BY exchange, t ASC
      `;
    } else {
      rows = await sql`
        SELECT exchange,
               EXTRACT(EPOCH FROM ts) * 1000 AS t,
               rate
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        ORDER BY exchange, ts ASC
      `;
    }

    const result: Record<string, ExchangeHistoryPoint[]> = {};
    rows.forEach((r: any) => {
      const ex = r.exchange as string;
      if (!result[ex]) result[ex] = [];
      result[ex].push({ t: Number(r.t), rate: Number(r.rate) });
    });
    return result;
  } catch (e) {
    console.error('DB getFundingHistoryMulti error:', e);
    return {};
  }
}

/**
 * Get OI history per exchange for a symbol.
 */
export async function getOIHistoryMulti(
  symbol: string,
  days: number = 7,
): Promise<Record<string, Array<{ t: number; oi: number }>>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT exchange,
             EXTRACT(EPOCH FROM ts) * 1000 AS t,
             oi_usd AS oi
      FROM oi_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      ORDER BY exchange, ts ASC
    `;
    const result: Record<string, Array<{ t: number; oi: number }>> = {};
    rows.forEach((r: any) => {
      const ex = r.exchange as string;
      if (!result[ex]) result[ex] = [];
      result[ex].push({ t: Number(r.t), oi: Number(r.oi) });
    });
    return result;
  } catch (e) {
    console.error('DB getOIHistoryMulti error:', e);
    return {};
  }
}

// ─── Portfolio Snapshots ────────────────────────────────────────────────────

export async function savePortfolioSnapshot(
  userId: string,
  totalValue: number,
  totalPnl: number,
  holdings: any[],
): Promise<void> {
  try {
    const sql = getSQL();
    const holdingsJson = JSON.stringify(holdings);
    await sql`
      INSERT INTO portfolio_snapshots (user_id, total_value, total_pnl, holdings)
      VALUES (${userId}, ${totalValue}, ${totalPnl}, ${holdingsJson}::jsonb)
    `;
  } catch (e) {
    console.error('DB savePortfolioSnapshot error:', e);
  }
}

export async function getPortfolioHistory(
  userId: string,
  days: number = 30,
): Promise<Array<{ t: number; value: number; pnl: number }>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, total_value, total_pnl
      FROM portfolio_snapshots
      WHERE user_id = ${userId}
        AND ts > NOW() - ${intervalStr}::interval
      ORDER BY ts ASC
    `;
    return rows.map((r: any) => ({
      t: Number(r.t),
      value: Number(r.total_value),
      pnl: Number(r.total_pnl),
    }));
  } catch (e) {
    console.error('DB getPortfolioHistory error:', e);
    return [];
  }
}

/**
 * Get all users with portfolio holdings for snapshotting.
 */
export async function getUsersWithPortfolios(): Promise<Array<{ userId: string; portfolio: any[] }>> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT user_id, prefs->'portfolio' AS portfolio
      FROM user_prefs
      WHERE jsonb_array_length(COALESCE(prefs->'portfolio', '[]'::jsonb)) > 0
    `;
    return rows.map((r: any) => ({
      userId: r.user_id,
      portfolio: (r.portfolio ?? []) as any[],
    }));
  } catch (e) {
    console.error('DB getUsersWithPortfolios error:', e);
    return [];
  }
}

// ─── Check if DB is available ───────────────────────────────────────────────

export function isDBConfigured(): boolean {
  return Boolean(DATABASE_URL);
}
