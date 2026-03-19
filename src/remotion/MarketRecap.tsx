import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { IntroScene } from './components/IntroScene';
import { FundingScene } from './components/FundingScene';
import { MoversScene } from './components/MoversScene';
import { OIScene } from './components/OIScene';
import { OutroScene } from './components/OutroScene';
import type { MarketRecapData } from './data/types';

/**
 * Main Market Recap composition.
 * ~30 seconds total at 30fps = 900 frames
 *
 * Scene breakdown:
 *   0–210   (0–7s)    Intro — BTC/ETH prices, stats
 *   210–420 (7–14s)   Funding Rates — top & bottom
 *   420–630 (14–21s)  Top Movers — gainers & losers
 *   630–810 (21–27s)  Open Interest — total + top 5
 *   810–900 (27–30s)  Outro — branding + CTA
 */
export const MarketRecap: React.FC<{ data: MarketRecapData }> = ({ data }) => {
  return (
    <AbsoluteFill>
      {/* Background music — ambient electronic, fades in/out built into the WAV */}
      <Audio
        src={staticFile('audio/recap-bg.wav')}
        volume={0.6}
      />

      <Sequence from={0} durationInFrames={210} name="Intro">
        <IntroScene data={data} />
      </Sequence>

      <Sequence from={210} durationInFrames={210} name="Funding Rates">
        <FundingScene
          topFunding={data.topFunding}
          bottomFunding={data.bottomFunding}
        />
      </Sequence>

      <Sequence from={420} durationInFrames={210} name="Top Movers">
        <MoversScene
          gainers={data.topGainers}
          losers={data.topLosers}
        />
      </Sequence>

      <Sequence from={630} durationInFrames={180} name="Open Interest">
        <OIScene
          totalOI={data.totalOI}
          topOI={data.topOI}
        />
      </Sequence>

      <Sequence from={810} durationInFrames={90} name="Outro">
        <OutroScene totalExchanges={data.totalExchanges} />
      </Sequence>
    </AbsoluteFill>
  );
};
