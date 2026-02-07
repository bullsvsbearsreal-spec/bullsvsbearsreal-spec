const data = require('./gmx_test.json');
console.log('Is array:', Array.isArray(data.markets));
console.log('Markets count:', data.markets.length);

const withFunding = data.markets.filter(m => m.fundingRateLong && m.fundingRateLong !== '0');
console.log('Markets with non-zero funding:', withFunding.length);

// Check a few markets
console.log('\n=== First 5 markets with funding ===');
withFunding.slice(0, 5).forEach(m => {
  const symbol = m.name.split('/')[0];
  const rateLong = parseFloat(m.fundingRateLong);
  const rateShort = parseFloat(m.fundingRateShort);

  // GMX uses 1e30 precision for rates
  // These are per-second rates that need conversion to 8h
  const normalizedLong = rateLong / 1e30;
  const normalizedShort = rateShort / 1e30;

  // Convert to 8h rate (8 * 3600 = 28800 seconds)
  const hourlyRateLong = normalizedLong * 3600 * 8 * 100;
  const hourlyRateShort = normalizedShort * 3600 * 8 * 100;

  console.log(`${symbol}: Long=${hourlyRateLong.toFixed(4)}%, Short=${hourlyRateShort.toFixed(4)}%`);
});

// Let's also check markets with small funding
console.log('\n=== Check BTC and ETH ===');
['BTC', 'ETH'].forEach(sym => {
  const m = data.markets.find(x => x.name.startsWith(sym + '/'));
  if (m) {
    const rateLong = parseFloat(m.fundingRateLong) / 1e30;
    const rateShort = parseFloat(m.fundingRateShort) / 1e30;
    const hourlyLong = rateLong * 3600 * 8 * 100;
    const hourlyShort = rateShort * 3600 * 8 * 100;
    console.log(`${sym}: Long=${hourlyLong.toFixed(4)}%, Short=${hourlyShort.toFixed(4)}% (from ${m.name})`);
  }
});
