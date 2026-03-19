import React from 'react';
import { Composition } from 'remotion';
import { MarketRecap } from './MarketRecap';
import { VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS } from './components/styles';
import type { MarketRecapData } from './data/types';

// Default/preview data — used when previewing in the Remotion Studio
const PREVIEW_DATA: MarketRecapData = {
  date: 'Saturday, March 15, 2026',
  btcPrice: 84230,
  btcChange: 2.4,
  ethPrice: 2180,
  ethChange: -0.8,
  totalExchanges: 33, // ALL_EXCHANGES count
  topFunding: [
    { symbol: 'FARTCOIN', exchange: 'Bybit', fundingRate: 0.1852, fundingInterval: '8h', type: 'cex' },
    { symbol: 'XTI', exchange: 'Gate.io', fundingRate: 0.1495, fundingInterval: '8h', type: 'cex' },
    { symbol: 'PENGU', exchange: 'Binance', fundingRate: 0.0831, fundingInterval: '8h', type: 'cex' },
    { symbol: 'PNUT', exchange: 'OKX', fundingRate: 0.0654, fundingInterval: '8h', type: 'cex' },
    { symbol: 'DOGE', exchange: 'Bybit', fundingRate: 0.0412, fundingInterval: '8h', type: 'cex' },
    { symbol: 'SUI', exchange: 'Binance', fundingRate: 0.0380, fundingInterval: '8h', type: 'cex' },
  ],
  bottomFunding: [
    { symbol: 'ICP', exchange: 'gTrade', fundingRate: -2.5039, fundingInterval: '1h', type: 'dex' },
    { symbol: 'REZ', exchange: 'Bybit', fundingRate: -1.9297, fundingInterval: '8h', type: 'cex' },
    { symbol: 'REZ', exchange: 'Phemex', fundingRate: -1.9097, fundingInterval: '8h', type: 'cex' },
    { symbol: 'LAYER', exchange: 'BingX', fundingRate: -0.8420, fundingInterval: '8h', type: 'cex' },
    { symbol: 'IP', exchange: 'Bybit', fundingRate: -0.5310, fundingInterval: '8h', type: 'cex' },
    { symbol: 'KAITO', exchange: 'MEXC', fundingRate: -0.3200, fundingInterval: '8h', type: 'cex' },
  ],
  topGainers: [
    { symbol: 'FARTCOIN', price: 0.72, change24h: 28.5 },
    { symbol: 'PENGU', price: 0.0089, change24h: 18.2 },
    { symbol: 'PNUT', price: 0.31, change24h: 15.7 },
    { symbol: 'DOGE', price: 0.175, change24h: 8.9 },
    { symbol: 'SUI', price: 2.45, change24h: 6.3 },
  ],
  topLosers: [
    { symbol: 'REZ', price: 0.024, change24h: -22.1 },
    { symbol: 'LAYER', price: 1.82, change24h: -14.5 },
    { symbol: 'IP', price: 3.10, change24h: -11.2 },
    { symbol: 'KAITO', price: 1.15, change24h: -8.7 },
    { symbol: 'ICP', price: 8.42, change24h: -5.6 },
  ],
  totalOI: '$65.2B',
  topOI: [
    { symbol: 'BTC', totalOI: 31200000000 },
    { symbol: 'ETH', totalOI: 12400000000 },
    { symbol: 'SOL', totalOI: 3800000000 },
    { symbol: 'XRP', totalOI: 1900000000 },
    { symbol: 'DOGE', totalOI: 1200000000 },
  ],
  totalPairs: 8483,
  avgFundingRate: 0.0042,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MarketRecap"
        component={MarketRecap}
        durationInFrames={900}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{ data: PREVIEW_DATA }}
      />
    </>
  );
};
