import 'dotenv/config';
import { fundingFetchers } from '../src/app/api/funding/exchanges';
import { fetchWithTimeout } from '../src/app/api/_shared/fetch';

// Test each exchange fetcher individually with a 30s hard timeout
async function main() {
  console.log(`Testing ${fundingFetchers.length} exchange fetchers individually...\n`);

  const results: { name: string; status: string; count: number; ms: number }[] = [];

  for (const { name, fetcher } of fundingFetchers) {
    const start = Date.now();
    process.stdout.write(`[${name}] fetching... `);

    try {
      const result = await Promise.race([
        fetcher(fetchWithTimeout),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('HARD_TIMEOUT_30s')), 30000)
        ),
      ]);
      const ms = Date.now() - start;
      console.log(`OK (${result.length} entries, ${ms}ms)`);
      results.push({ name, status: 'ok', count: result.length, ms });
    } catch (err: any) {
      const ms = Date.now() - start;
      console.log(`FAILED: ${err.message} (${ms}ms)`);
      results.push({ name, status: err.message, count: 0, ms });
    }
  }

  console.log('\n=== Summary ===');
  console.log('Exchange'.padEnd(20), 'Status'.padEnd(20), 'Count'.padEnd(8), 'Time');
  for (const r of results.sort((a, b) => b.ms - a.ms)) {
    console.log(
      r.name.padEnd(20),
      r.status.slice(0, 18).padEnd(20),
      String(r.count).padEnd(8),
      `${r.ms}ms`
    );
  }

  const total = results.reduce((s, r) => s + r.ms, 0);
  console.log(`\nTotal sequential time: ${total}ms (${(total/1000).toFixed(1)}s)`);
  console.log(`Parallel time (max): ${Math.max(...results.map(r => r.ms))}ms`);

  process.exit(0);
}

main();
