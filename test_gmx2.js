const data = require('./gmx_test.json');

// GMX rates are per-second rates in 1e30 precision
// Let's try different scaling factors

console.log('=== Testing different conversions for BTC ===');
const btc = data.markets.find(x => x.name.startsWith('BTC/'));
const rateLong = parseFloat(btc.fundingRateLong);
const rateShort = parseFloat(btc.fundingRateShort);

console.log('Raw fundingRateLong:', btc.fundingRateLong);
console.log('Raw fundingRateShort:', btc.fundingRateShort);

// Try dividing by different powers
const divisors = [1e18, 1e24, 1e27, 1e30, 1e33];
divisors.forEach(d => {
  const longNorm = (rateLong / d);
  const shortNorm = (rateShort / d);
  console.log(`\n1e${Math.log10(d)}:`);
  console.log(`  Long: ${longNorm} raw, ${(longNorm * 100).toFixed(6)}%`);
  console.log(`  Short: ${shortNorm} raw, ${(shortNorm * 100).toFixed(6)}%`);
});

// The "netRate" fields might be the actual funding rate
console.log('\n=== Checking netRate fields ===');
const withNet = data.markets.filter(m => m.netRateLong !== '0' || m.netRateShort !== '0');
console.log('Markets with netRate:', withNet.length);

if (withNet.length > 0) {
  const m = withNet.find(x => x.name.startsWith('BTC')) || withNet[0];
  console.log('Market:', m.name);
  console.log('netRateLong:', m.netRateLong);
  console.log('netRateShort:', m.netRateShort);
  
  // netRate might be the actual funding rate to display
  const netLong = parseFloat(m.netRateLong) / 1e30 * 100;
  const netShort = parseFloat(m.netRateShort) / 1e30 * 100;
  console.log(`Normalized: Long=${netLong.toFixed(6)}%, Short=${netShort.toFixed(6)}%`);
}
