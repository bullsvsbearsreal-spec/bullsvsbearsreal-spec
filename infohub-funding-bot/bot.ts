import 'dotenv/config';
import cron from 'node-cron';
import postgres from 'postgres';
import { fundingFetchers } from '../src/app/api/funding/exchanges';
import { fetchAllExchangesWithHealth } from '../src/app/api/_shared/exchange-fetchers';
import { fetchWithTimeout } from '../src/app/api/_shared/fetch';

// ─── Config ─────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const CRON_INTERVAL = process.env.CRON_INTERVAL || '*/2 * * * *'; // every 2 min
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '3002');
const ANOMALY_THRESHOLD = parseFloat(process.env.ANOMALY_THRESHOLD || '50'); // flag if rate > 50%

if (!DATABASE_URL) {
  console.error('[funding-bot] Missing DATABASE_URL');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: 'require',
});

// ─── DB Schema (run once) ───────────────────────────────────────────────────

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS funding_latest (
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      funding_rate DOUBLE PRECISION NOT NULL,
      funding_rate_long DOUBLE PRECISION,
      funding_rate_short DOUBLE PRECISION,
      borrowing_rate DOUBLE PRECISION,
      predicted_rate DOUBLE PRECISION,
      mark_price DOUBLE PRECISION,
      index_price DOUBLE PRECISION,
      next_funding_time BIGINT,
      funding_interval TEXT,
      type TEXT DEFAULT 'cex',
      asset_class TEXT DEFAULT 'crypto',
      margin_type TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (symbol, exchange)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS funding_anomalies (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      old_rate DOUBLE PRECISION,
      new_rate DOUBLE PRECISION,
      reason TEXT,
      ts TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Index for fast lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_funding_latest_symbol ON funding_latest (symbol)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_funding_latest_exchange ON funding_latest (exchange)
  `;

  console.log('[funding-bot] Schema verified');
}

// ─── Anomaly Detection ──────────────────────────────────────────────────────

interface LastKnown {
  rate: number;
  updatedAt: number;
}

const lastKnownRates = new Map<string, LastKnown>();

function checkAnomaly(
  symbol: string,
  exchange: string,
  newRate: number,
): { isAnomaly: boolean; reason?: string; oldRate?: number } {
  const key = `${exchange}:${symbol}`;
  const last = lastKnownRates.get(key);

  // Cap: any rate beyond ±ANOMALY_THRESHOLD is suspicious
  if (Math.abs(newRate) > ANOMALY_THRESHOLD) {
    return {
      isAnomaly: true,
      reason: `rate ${newRate.toFixed(4)}% exceeds ±${ANOMALY_THRESHOLD}% cap`,
      oldRate: last?.rate,
    };
  }

  // Jump detection: if rate changed by more than 10x vs last known
  if (last && last.rate !== 0 && newRate !== 0) {
    const ratio = Math.abs(newRate / last.rate);
    if (ratio > 10 || ratio < 0.1) {
      return {
        isAnomaly: true,
        reason: `rate jumped ${ratio.toFixed(1)}x (${last.rate.toFixed(4)}% → ${newRate.toFixed(4)}%)`,
        oldRate: last.rate,
      };
    }
  }

  // Update last known
  lastKnownRates.set(key, { rate: newRate, updatedAt: Date.now() });
  return { isAnomaly: false };
}

// ─── Fetch & Store ──────────────────────────────────────────────────────────

interface RunResult {
  total: number;
  upserted: number;
  anomalies: number;
  exchangeCount: number;
  errors: string[];
  elapsedMs: number;
}

// Batch upsert rows in chunks using a single transaction per chunk.
// This reduces ~6500 individual round trips to ~65 batched transactions.
const BATCH_SIZE = 100;

async function batchUpsert(rows: any[]) {
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    try {
      await sql.begin(async (tx) => {
        for (const entry of chunk) {
          const e = entry as any;
          await tx`
            INSERT INTO funding_latest (
              symbol, exchange, funding_rate, funding_rate_long, funding_rate_short,
              borrowing_rate, predicted_rate, mark_price, index_price,
              next_funding_time, funding_interval, type, asset_class, margin_type, updated_at
            ) VALUES (
              ${e.symbol}, ${e.exchange}, ${e.fundingRate},
              ${e.fundingRateLong ?? null}, ${e.fundingRateShort ?? null},
              ${e.borrowingRate ?? null}, ${e.predictedRate ?? null},
              ${e.markPrice ?? 0}, ${e.indexPrice ?? 0},
              ${e.nextFundingTime ?? null}, ${e.fundingInterval ?? '8h'},
              ${e.type ?? 'cex'}, ${e.assetClass ?? 'crypto'},
              ${e.marginType ?? null}, ${new Date()}
            )
            ON CONFLICT (symbol, exchange) DO UPDATE SET
              funding_rate = EXCLUDED.funding_rate,
              funding_rate_long = EXCLUDED.funding_rate_long,
              funding_rate_short = EXCLUDED.funding_rate_short,
              borrowing_rate = EXCLUDED.borrowing_rate,
              predicted_rate = EXCLUDED.predicted_rate,
              mark_price = EXCLUDED.mark_price,
              index_price = EXCLUDED.index_price,
              next_funding_time = EXCLUDED.next_funding_time,
              funding_interval = EXCLUDED.funding_interval,
              type = EXCLUDED.type,
              asset_class = EXCLUDED.asset_class,
              margin_type = EXCLUDED.margin_type,
              updated_at = EXCLUDED.updated_at
          `;
        }
      });
      upserted += chunk.length;
    } catch (err: any) {
      // If a batch fails, try rows individually so one bad row doesn't kill the batch
      for (const entry of chunk) {
        try {
          const e = entry as any;
          await sql`
            INSERT INTO funding_latest (
              symbol, exchange, funding_rate, funding_rate_long, funding_rate_short,
              borrowing_rate, predicted_rate, mark_price, index_price,
              next_funding_time, funding_interval, type, asset_class, margin_type, updated_at
            ) VALUES (
              ${e.symbol}, ${e.exchange}, ${e.fundingRate},
              ${e.fundingRateLong ?? null}, ${e.fundingRateShort ?? null},
              ${e.borrowingRate ?? null}, ${e.predictedRate ?? null},
              ${e.markPrice ?? 0}, ${e.indexPrice ?? 0},
              ${e.nextFundingTime ?? null}, ${e.fundingInterval ?? '8h'},
              ${e.type ?? 'cex'}, ${e.assetClass ?? 'crypto'},
              ${e.marginType ?? null}, ${new Date()}
            )
            ON CONFLICT (symbol, exchange) DO UPDATE SET
              funding_rate = EXCLUDED.funding_rate,
              funding_rate_long = EXCLUDED.funding_rate_long,
              funding_rate_short = EXCLUDED.funding_rate_short,
              borrowing_rate = EXCLUDED.borrowing_rate,
              predicted_rate = EXCLUDED.predicted_rate,
              mark_price = EXCLUDED.mark_price,
              index_price = EXCLUDED.index_price,
              next_funding_time = EXCLUDED.next_funding_time,
              funding_interval = EXCLUDED.funding_interval,
              type = EXCLUDED.type,
              asset_class = EXCLUDED.asset_class,
              margin_type = EXCLUDED.margin_type,
              updated_at = EXCLUDED.updated_at
          `;
          upserted++;
        } catch { /* skip bad row */ }
      }
    }
  }
  return upserted;
}

async function batchInsertAnomalies(anomalies: { symbol: string; exchange: string; oldRate: number | undefined; newRate: number; reason: string }[]) {
  if (anomalies.length === 0) return;
  try {
    await sql.begin(async (tx) => {
      for (const a of anomalies) {
        await tx`
          INSERT INTO funding_anomalies (symbol, exchange, old_rate, new_rate, reason)
          VALUES (${a.symbol}, ${a.exchange}, ${a.oldRate ?? null}, ${a.newRate}, ${a.reason})
        `;
      }
    });
  } catch { /* don't fail on anomaly logging */ }
}

async function fetchAndStore(): Promise<RunResult> {
  const start = Date.now();
  const result: RunResult = {
    total: 0,
    upserted: 0,
    anomalies: 0,
    exchangeCount: 0,
    errors: [],
    elapsedMs: 0,
  };

  try {
    // Fetch from ALL exchanges directly using the same fetchers as Vercel
    const { data, health } = await fetchAllExchangesWithHealth(
      fundingFetchers,
      fetchWithTimeout,
    );

    result.total = data.length;
    result.exchangeCount = health.filter(h => h.status === 'ok').length;

    // Track zero-rate exchanges
    const exchangeZeros = new Map<string, number>();
    const exchangeTotals = new Map<string, number>();

    // Filter valid entries and run anomaly checks
    const validEntries: typeof data = [];
    const anomalyBatch: { symbol: string; exchange: string; oldRate: number | undefined; newRate: number; reason: string }[] = [];

    for (const entry of data) {
      if (!entry.symbol || !entry.exchange || entry.fundingRate == null) continue;

      exchangeTotals.set(entry.exchange, (exchangeTotals.get(entry.exchange) || 0) + 1);
      if (entry.fundingRate === 0) {
        exchangeZeros.set(entry.exchange, (exchangeZeros.get(entry.exchange) || 0) + 1);
      }

      const anomaly = checkAnomaly(entry.symbol, entry.exchange, entry.fundingRate);
      if (anomaly.isAnomaly) {
        result.anomalies++;
        anomalyBatch.push({
          symbol: entry.symbol,
          exchange: entry.exchange,
          oldRate: anomaly.oldRate,
          newRate: entry.fundingRate,
          reason: anomaly.reason ?? '',
        });
      }

      validEntries.push(entry);
    }

    // Batch DB writes — drastically reduces round trips
    const [upserted] = await Promise.all([
      batchUpsert(validEntries),
      batchInsertAnomalies(anomalyBatch),
    ]);
    result.upserted = upserted;

    // Flag exchanges where >80% of rates are zero
    exchangeZeros.forEach((zeros, exchange) => {
      const total = exchangeTotals.get(exchange) || 1;
      if (total >= 5 && zeros / total > 0.8) {
        const msg = `${exchange}: ${zeros}/${total} rates are zero — API may be broken`;
        console.warn(`[SANITY] ${msg}`);
        result.errors.push(msg);
      }
    });

    // Log health summary
    for (const h of health) {
      if (h.status !== 'ok') {
        result.errors.push(`${h.name}: ${h.status}${h.error ? ' — ' + h.error : ''}`);
      }
    }

  } catch (err: any) {
    result.errors.push(`fetch-all: ${err.message}`);
    console.error('[funding-bot] Fatal fetch error:', err.message);
  }

  result.elapsedMs = Date.now() - start;
  return result;
}

// ─── Also write to funding_snapshots for history ────────────────────────────
// (Same table the existing collector uses, so historical charts keep working)

async function writeSnapshots(data: any[]) {
  let count = 0;
  const BATCH = 50;
  for (let i = 0; i < data.length; i += BATCH) {
    const chunk = data.slice(i, i + BATCH);
    await Promise.all(chunk.map(async (e: any) => {
      try {
        await sql`
          INSERT INTO funding_snapshots (symbol, exchange, rate, predicted)
          VALUES (${e.symbol}, ${e.exchange}, ${e.fundingRate}, ${e.predictedRate ?? null})
        `;
        count++;
      } catch { /* ignore dupes */ }
    }));
  }
  return count;
}

// ─── Health Server ──────────────────────────────────────────────────────────

let lastResult: RunResult | null = null;
let lastRunAt: string | null = null;
let totalRuns = 0;

import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'infohub-funding-bot',
      lastRunAt,
      totalRuns,
      lastResult,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    }));
  } else if (req.url === '/funding') {
    // Quick endpoint: return latest rates from DB
    sql`SELECT * FROM funding_latest ORDER BY symbol, exchange`.then(rows => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: rows, count: rows.length }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// ─── Main ───────────────────────────────────────────────────────────────────

let isRunning = false;

async function run() {
  if (isRunning) {
    console.warn(`[${new Date().toISOString()}] Skipping — previous run still active`);
    return;
  }
  isRunning = true;
  try {
    const r = await fetchAndStore();
    lastResult = r;
    lastRunAt = new Date().toISOString();
    totalRuns++;
    const ts = new Date().toISOString();
    console.log(
      `[${ts}] exchanges=${r.exchangeCount} total=${r.total} upserted=${r.upserted} anomalies=${r.anomalies} (${r.elapsedMs}ms)` +
      (r.errors.length ? ` errors=[${r.errors.join(', ')}]` : '')
    );
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Run failed:`, err.message);
  } finally {
    isRunning = false;
  }
}

(async () => {
  console.log('[funding-bot] Starting...');
  console.log(`[funding-bot] Cron: ${CRON_INTERVAL}`);
  console.log(`[funding-bot] Exchanges: ${fundingFetchers.length}`);

  await ensureSchema();

  // Start health server
  server.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`[funding-bot] Health: http://0.0.0.0:${HEALTH_PORT}/health`);
    console.log(`[funding-bot] Funding: http://0.0.0.0:${HEALTH_PORT}/funding`);
  });

  // Initial run
  await run();

  // Schedule
  cron.schedule(CRON_INTERVAL, run);
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[funding-bot] Shutting down...');
  server.close();
  await sql.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[funding-bot] Interrupted');
  server.close();
  await sql.end();
  process.exit(0);
});
