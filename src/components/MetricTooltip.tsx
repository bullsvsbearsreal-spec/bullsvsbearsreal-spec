'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';

interface MetricTooltipProps {
  term: string;
  children: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Metric definitions — term → explanation + optional guide link      */
/* ------------------------------------------------------------------ */

const definitions: Record<string, { text: string; guide?: string }> = {
  'Funding Rate': {
    text: 'Periodic fee exchanged between longs and shorts on perpetual contracts. Positive = longs pay shorts (bullish positioning). Negative = shorts pay longs.',
    guide: '/guides/funding-rate-arbitrage',
  },
  'Open Interest': {
    text: 'Total value of outstanding derivative contracts that have not been settled. Rising OI + rising price = strong trend. Rising OI + falling price = aggressive shorting.',
  },
  'OI Delta': {
    text: 'Change in open interest over a time period. Positive delta = new positions being opened. Negative delta = positions closing.',
  },
  'Liquidation': {
    text: 'Forced closure of a leveraged position when margin is insufficient. Cascading liquidations can cause rapid price moves.',
  },
  'CVD': {
    text: 'Cumulative Volume Delta — net difference between aggressive buying and selling volume. Rising CVD = buy-side pressure dominates.',
  },
  'Long/Short Ratio': {
    text: 'Ratio of accounts holding long vs short positions. Values above 1 indicate more longs; below 1 more shorts. Extreme readings often precede reversals.',
  },
  'Basis': {
    text: 'Price difference between spot and futures. Positive basis (contango) = futures trade above spot. Negative basis (backwardation) = below spot.',
  },
  'Fear & Greed': {
    text: 'Composite sentiment index from 0 (extreme fear) to 100 (extreme greed). Based on volatility, momentum, social media, and market surveys.',
  },
  'Spread': {
    text: 'Price or rate difference between two exchanges for the same asset. Wider spreads = potential arbitrage opportunity.',
    guide: '/guides/funding-rate-arbitrage',
  },
  'RSI': {
    text: 'Relative Strength Index — momentum oscillator (0-100). Above 70 = overbought. Below 30 = oversold. Measures speed and change of price movements.',
  },
  'Dominance': {
    text: 'Percentage of total crypto market cap held by a single asset (typically BTC). Falling BTC dominance often signals altseason.',
  },
  'Annualized Rate': {
    text: 'Funding rate extrapolated to a yearly figure. Calculated as: (hourly rate) × 8760. Useful for comparing with traditional yield benchmarks.',
  },
  'Weighted Index': {
    text: 'Volume-weighted average funding rate across all exchanges. Larger exchanges contribute more to the index, reducing noise from low-volume venues.',
  },
  'Market Cycle': {
    text: 'Phase of the broader market trend — accumulation, markup, distribution, or markdown. Identified using a combination of on-chain and price indicators.',
  },
  'Token Unlocks': {
    text: 'Scheduled release of previously locked tokens (from vesting, team allocations, or staking). Large unlocks can create selling pressure.',
  },
  'Stablecoin Flows': {
    text: 'Movement of stablecoins between wallets and exchanges. Inflows to exchanges = potential buying pressure. Outflows = reduced trading activity.',
  },
  'Exchange Reserves': {
    text: 'Total crypto held on exchange wallets. Declining reserves = users self-custodying (bullish signal). Rising reserves = potential selling pressure.',
  },
  'Execution Cost': {
    text: 'Total cost to execute a trade on a DEX, including gas fees, price impact, and slippage. Varies by chain, liquidity depth, and trade size.',
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MetricTooltip({ term, children }: MetricTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const def = definitions[term];
  if (!def) return <>{children}</>;

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 1500);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-help"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <HelpCircle className="w-3 h-3 text-neutral-600 hover:text-neutral-400 transition-colors flex-shrink-0" />

      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-2 w-72 p-3 rounded-xl bg-[#141414] border border-white/[0.08] shadow-2xl shadow-black/60 animate-fade-in"
        >
          <p className="text-[12px] leading-relaxed text-neutral-300">{def.text}</p>
          {def.guide && (
            <Link
              href={def.guide}
              className="inline-flex items-center gap-1 mt-2 text-[11px] text-hub-yellow hover:text-hub-yellow/80 transition-colors"
            >
              Learn more →
            </Link>
          )}
        </div>
      )}
    </span>
  );
}
