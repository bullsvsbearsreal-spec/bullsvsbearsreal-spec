import { fundingFetchers } from '../src/app/api/funding/exchanges';
import { fetchAllExchangesWithHealth } from '../src/app/api/_shared/exchange-fetchers';
import { fetchWithTimeout } from '../src/app/api/_shared/fetch';

console.log(`Testing ${fundingFetchers.length} exchange fetchers...`);

const { data, health } = await fetchAllExchangesWithHealth(fundingFetchers, fetchWithTimeout);
const ok = health.filter(h => h.status === 'ok');
const fail = health.filter(h => h.status !== 'ok');

console.log(`\nResults: ${data.length} entries from ${ok.length}/${health.length} exchanges`);
console.log(`OK: ${ok.map(h => `${h.name}(${h.count})`).join(', ')}`);
if (fail.length) console.log(`Failed: ${fail.map(h => `${h.name}:${h.status}`).join(', ')}`);

process.exit(0);
