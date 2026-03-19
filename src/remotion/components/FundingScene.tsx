import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { colors, fullScreen, formatRate, getCoinIconFallback } from './styles';
import { Background } from './Background';
import type { FundingEntry } from '../data/types';

interface Props {
  topFunding: FundingEntry[];
  bottomFunding: FundingEntry[];
}

export const FundingScene: React.FC<Props> = ({ topFunding, bottomFunding }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={fullScreen}>
      <Background />
      <div style={{ position: 'relative', zIndex: 1, padding: '80px 48px', height: '100%' }}>

        {/* Section title */}
        <div style={{
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          marginTop: 60,
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: colors.accent, letterSpacing: 3, marginBottom: 8 }}>
            FUNDING RATES
          </div>
          <h2 style={{ fontSize: 52, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
            Who's Paying Whom
          </h2>
        </div>

        {/* Highest rates (longs paying) */}
        <div style={{ marginTop: 50 }}>
          <div style={{
            fontSize: 20, fontWeight: 600, color: colors.green,
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>▲</span> HIGHEST RATES — Longs Paying
          </div>
          {topFunding.map((f, i) => (
            <FundingRow key={`top-${i}`} entry={f} index={i} isPositive delay={10 + i * 5} />
          ))}
        </div>

        {/* Lowest rates (shorts paying) */}
        <div style={{ marginTop: 48 }}>
          <div style={{
            fontSize: 20, fontWeight: 600, color: colors.red,
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>▼</span> MOST NEGATIVE — Shorts Paying
          </div>
          {bottomFunding.map((f, i) => (
            <FundingRow key={`bot-${i}`} entry={f} index={i} isPositive={false} delay={40 + i * 5} />
          ))}
        </div>
      </div>
    </div>
  );
};

const FundingRow: React.FC<{
  entry: FundingEntry; index: number; isPositive: boolean; delay: number;
}> = ({ entry, index, isPositive, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 100 } });
  const x = interpolate(slideIn, [0, 1], [80, 0]);
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);

  const barColor = isPositive ? colors.green : colors.red;
  const barWidth = Math.min(Math.abs(entry.fundingRate) * 300, 400);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 20px', marginBottom: 8,
      background: colors.bgCard, borderRadius: 14,
      border: `1px solid ${colors.border}`,
      opacity,
      transform: `translateX(${x}px)`,
    }}>
      {/* Rank + Coin Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${barColor}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: barColor,
        }}>
          {index + 1}
        </div>
        <img
          src={getCoinIconFallback(entry.symbol)}
          width={36} height={36}
          style={{ borderRadius: 18, objectFit: 'cover' }}
        />
      </div>

      {/* Symbol + Exchange */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{entry.symbol}</div>
        <div style={{ fontSize: 16, color: colors.textMuted }}>{entry.exchange}</div>
      </div>

      {/* Rate bar */}
      <div style={{ width: 200, position: 'relative' }}>
        <div style={{
          height: 8, borderRadius: 4, background: `${barColor}15`,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: barColor,
            width: `${Math.min((barWidth / 400) * 100, 100)}%`,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Rate value */}
      <div style={{
        fontSize: 26, fontWeight: 700, color: barColor,
        minWidth: 120, textAlign: 'right',
      }}>
        {formatRate(entry.fundingRate)}
      </div>
    </div>
  );
};
