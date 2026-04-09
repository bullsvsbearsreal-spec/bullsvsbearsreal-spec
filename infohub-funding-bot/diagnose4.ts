import 'dotenv/config';
import postgres from 'postgres';
import { fundingFetchers } from '../src/app/api/funding/exchanges';
import { fetchAllExchangesWithHealth } from '../src/app/api/_shared/exchange-fetchers';
import { fetchWithTimeout } from '../src/app/api/_shared/fetch';

const sql = postgres(process.env.DATABASE_URL!, { max: 5, idle_timeout: 20, connect_timeout: 10, ssl: 'require' });
const BATCH_SIZE = 100;

const UPSERT_COLUMNS = [
  'symbol', 'exchange', 'funding_rate', 'funding_rate_long', 'funding_rate_short',
  'borrowing_rate', 'predicted_rate', 'mark_price', 'index_price',
  'next_funding_time', 'funding_interval', 'type', 'asset_class', 'margin_type', 'updated_at',
] as const;

function toDbRow(e: any) {
  return {
    symbol: e.symbol,
    exchange: e.exchange,
    funding_rate: e.fundingRate,
    funding_rate_long: e.fundingRateLong ?? null,
    funding_rate_short: e.fundingRateShort ?? null,
    borrowing_rate: e.borrowingRate ?? null,
    predicted_rate: e.predictedRate ?? null,
    mark_price: e.markPrice ?? 0,
    index_price: e.indexPrice ?? 0,
    next_funding_time: e.nextFundingTime ?? null,
    funding_interval: e.fundingInterval ?? '8h',
    type: e.type ?? 'cex',
    asset_class: e.assetClass ?? 'crypto',
    margin_type: e.marginType ?? null,
    updated_at: new Date(),
  };
}

async function main() {
  // Phase 1: Fetch
  console.log('Phase 1: Fetching...');
  let start = Date.now();
  const { data } = await fetchAllExchangesWithHealth(fundingFetchers, fetchWithTimeout);
  console.log(`  ${data.length} entries in ${Date.now() - start}ms`);

  const valid = data.filter((e: any) => e.symbol && e.exchange && e.fundingRate != null);
  console.log(`  ${valid.length} valid entries`);

  // Phase 2: Multi-row batch upsert
  console.log(`Phase 2: Multi-row batch upsert (${Math.ceil(valid.length / BATCH_SIZE)} batches)...`);
  start = Date.now();
  let upserted = 0;
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const chunk = valid.slice(i, i + BATCH_SIZE).map(toDbRow);
    const batchStart = Date.now();
    try {
      await sql`
        INSERT INTO funding_latest ${sql(chunk, ...UPSERT_COLUMNS)}
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
      upserted += chunk.length;
    } catch (err: any) {
      console.log(`  Batch ${Math.ceil(i/BATCH_SIZE)+1} FAILED: ${err.message} (${Date.now()-batchStart}ms)`);
    }
  }
  console.log(`  Upserted ${upserted} rows in ${Date.now() - start}ms`);

  await sql.end();
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
