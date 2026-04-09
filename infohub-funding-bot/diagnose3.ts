import 'dotenv/config';
import postgres from 'postgres';
import { fundingFetchers } from '../src/app/api/funding/exchanges';
import { fetchAllExchangesWithHealth } from '../src/app/api/_shared/exchange-fetchers';
import { fetchWithTimeout } from '../src/app/api/_shared/fetch';

const sql = postgres(process.env.DATABASE_URL!, { max: 5, idle_timeout: 20, connect_timeout: 10, ssl: 'require' });
const BATCH_SIZE = 100;

async function main() {
  // Phase 1: Fetch
  console.log('Phase 1: Fetching exchanges...');
  let start = Date.now();
  const { data, health } = await fetchAllExchangesWithHealth(fundingFetchers, fetchWithTimeout);
  console.log(`  Fetched ${data.length} entries in ${Date.now() - start}ms`);

  // Phase 2: Filter
  console.log('Phase 2: Filtering valid entries...');
  start = Date.now();
  const validEntries = data.filter((e: any) => e.symbol && e.exchange && e.fundingRate != null);
  console.log(`  ${validEntries.length} valid entries in ${Date.now() - start}ms`);

  // Phase 3: Batch upsert
  console.log(`Phase 3: Batch upserting (${Math.ceil(validEntries.length / BATCH_SIZE)} batches of ${BATCH_SIZE})...`);
  start = Date.now();
  let upserted = 0;
  let batchNum = 0;

  for (let i = 0; i < validEntries.length; i += BATCH_SIZE) {
    batchNum++;
    const chunk = validEntries.slice(i, i + BATCH_SIZE);
    const batchStart = Date.now();
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
      if (batchNum % 10 === 0) {
        console.log(`  Batch ${batchNum}: ${upserted} rows (${Date.now() - batchStart}ms this batch)`);
      }
    } catch (err: any) {
      console.log(`  Batch ${batchNum} FAILED: ${err.message} (${Date.now() - batchStart}ms)`);
    }
  }

  console.log(`  Total upserted: ${upserted} in ${Date.now() - start}ms`);

  await sql.end();
  console.log('Done!');
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
