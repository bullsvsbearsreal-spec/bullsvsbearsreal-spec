/**
 * Render script — fetches live data and renders the market recap video.
 *
 * Usage:
 *   npx tsx src/remotion/render.ts              # renders to out/market-recap.mp4
 *   npx tsx src/remotion/render.ts --preview    # just outputs the data (no render)
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { fetchMarketRecapData } from './data/fetch-recap';
import path from 'path';

async function main() {
  const isPreview = process.argv.includes('--preview');

  console.log('📊 Fetching live market data...');
  const data = await fetchMarketRecapData();

  console.log(`  BTC: $${data.btcPrice.toLocaleString()} (${data.btcChange > 0 ? '+' : ''}${data.btcChange.toFixed(2)}%)`);
  console.log(`  ETH: $${data.ethPrice.toLocaleString()} (${data.ethChange > 0 ? '+' : ''}${data.ethChange.toFixed(2)}%)`);
  console.log(`  ${data.totalExchanges} exchanges, ${data.totalPairs.toLocaleString()} pairs`);
  console.log(`  Total OI: ${data.totalOI}`);
  console.log(`  Avg funding: ${data.avgFundingRate >= 0 ? '+' : ''}${data.avgFundingRate.toFixed(4)}%`);

  if (isPreview) {
    console.log('\n📋 Preview data:');
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log('\n📦 Bundling Remotion project...');
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, 'index.ts'),
    webpackOverride: (config) => config,
  });

  console.log('🎬 Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'MarketRecap',
    inputProps: { data },
  });

  const outputPath = path.resolve(process.cwd(), 'out', 'market-recap.mp4');
  console.log(`🎥 Rendering video to ${outputPath}...`);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { data },
  });

  console.log(`\n✅ Video rendered: ${outputPath}`);
}

main().catch((err) => {
  console.error('❌ Render failed:', err);
  process.exit(1);
});
