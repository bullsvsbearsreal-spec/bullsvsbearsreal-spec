const data = require('./gmx_test.json');

// GMX rates are per-second funding rates in 1e30 precision
// To get 8h rate: (rate / 1e30) * 8 * 3600 = rate / 1e30 * 28800

console.log('=== GMX 8h Funding Rates ===');

const btc = data.markets.find(x => x.name.startsWith('BTC/'));
const eth = data.markets.find(x => x.name.startsWith('ETH/'));
const sol = data.markets.find(x => x.name.startsWith('SOL/'));

[btc, eth, sol].forEach(m => {
  if (!m) return;
  const symbol = m.name.split('/')[0];
  
  // These are per-second rates, we want 8h equivalent
  // Per-second rate * seconds in 8h = 8h rate
  const rateLongPerSec = parseFloat(m.fundingRateLong) / 1e30;
  const rateShortPerSec = parseFloat(m.fundingRateShort) / 1e30;
  
  const rate8hLong = rateLongPerSec * 28800 * 100; // 8h in seconds, * 100 for %
  const rate8hShort = rateShortPerSec * 28800 * 100;
  
  console.log(`${symbol}: Long=${rate8hLong.toFixed(4)}%, Short=${rate8hShort.toFixed(4)}%`);
});

// Actually, let me check if maybe these are already hourly rates
console.log('\n=== If these are already 8h rates (just / 1e30) ===');
[btc, eth, sol].forEach(m => {
  if (!m) return;
  const symbol = m.name.split('/')[0];
  const rateLong = parseFloat(m.fundingRateLong) / 1e30 * 100;
  const rateShort = parseFloat(m.fundingRateShort) / 1e30 * 100;
  console.log(`${symbol}: Long=${rateLong.toFixed(4)}%, Short=${rateShort.toFixed(4)}%`);
});

// Check if maybe it's per hour rate
console.log('\n=== If per-hour rate (x8 for 8h) ===');
[btc, eth, sol].forEach(m => {
  if (!m) return;
  const symbol = m.name.split('/')[0];
  const rateLongPerHour = parseFloat(m.fundingRateLong) / 1e30;
  const rate8hLong = rateLongPerHour * 8 * 100;
  console.log(`${symbol}: Long=${rate8hLong.toFixed(4)}%`);
});
