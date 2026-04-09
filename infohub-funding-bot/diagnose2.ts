import 'dotenv/config';
import { fundingFetchers } from '../src/app/api/funding/exchanges';
import { fetchAllExchangesWithHealth } from '../src/app/api/_shared/exchange-fetchers';
import { fetchWithTimeout } from '../src/app/api/_shared/fetch';

async function main() {
  console.log('Testing fetchAllExchangesWithHealth...');
  console.log(`Time: ${new Date().toISOString()}`);

  const start = Date.now();

  // Add a hard timeout
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('HARD_TIMEOUT_60s')), 60000)
  );

  try {
    const { data, health } = await Promise.race([
      fetchAllExchangesWithHealth(fundingFetchers, fetchWithTimeout),
      timeout,
    ]);

    const ms = Date.now() - start;
    console.log(`\nCompleted in ${ms}ms`);
    console.log(`Data entries: ${data.length}`);
    console.log(`\nHealth:`);
    for (const h of health) {
      console.log(`  ${h.name.padEnd(20)} ${h.status.padEnd(15)} count=${h.count} ${h.latencyMs}ms${h.error ? ' ' + h.error : ''}`);
    }
  } catch (err: any) {
    const ms = Date.now() - start;
    console.log(`\nFAILED after ${ms}ms: ${err.message}`);
  }

  process.exit(0);
}

main();
