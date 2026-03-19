import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { colors, fullScreen, formatPrice, formatPct, getCoinIconFallback } from './styles';
import { Background } from './Background';
import type { TopMover } from '../data/types';

interface Props {
  gainers: TopMover[];
  losers: TopMover[];
}

export const MoversScene: React.FC<Props> = ({ gainers, losers }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={fullScreen}>
      <Background />
      <div style={{ position: 'relative', zIndex: 1, padding: '80px 48px', height: '100%' }}>

        <div style={{ opacity: titleOp, marginTop: 60 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: colors.accent, letterSpacing: 3, marginBottom: 8 }}>
            TOP MOVERS
          </div>
          <h2 style={{ fontSize: 52, fontWeight: 800, margin: 0 }}>
            24h Price Action
          </h2>
        </div>

        {/* Gainers */}
        <div style={{ marginTop: 50 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: colors.green, marginBottom: 16 }}>
            🚀 Biggest Gainers
          </div>
          {gainers.map((m, i) => (
            <MoverRow key={`g-${i}`} mover={m} rank={i + 1} isGainer delay={12 + i * 6} />
          ))}
        </div>

        {/* Losers */}
        <div style={{ marginTop: 48 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: colors.red, marginBottom: 16 }}>
            📉 Biggest Losers
          </div>
          {losers.map((m, i) => (
            <MoverRow key={`l-${i}`} mover={m} rank={i + 1} isGainer={false} delay={42 + i * 6} />
          ))}
        </div>
      </div>
    </div>
  );
};

const MoverRow: React.FC<{
  mover: TopMover; rank: number; isGainer: boolean; delay: number;
}> = ({ mover, rank, isGainer, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 90 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const x = interpolate(enter, [0, 1], [60, 0]);

  const color = isGainer ? colors.green : colors.red;
  const barWidth = Math.min(Math.abs(mover.change24h) * 8, 100);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '16px 20px', marginBottom: 8,
      background: colors.bgCard, borderRadius: 14,
      border: `1px solid ${colors.border}`,
      opacity,
      transform: `translateX(${x}px)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color,
        }}>
          {rank}
        </div>
        <img
          src={getCoinIconFallback(mover.symbol)}
          width={36} height={36}
          style={{ borderRadius: 18, objectFit: 'cover' }}
        />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{mover.symbol}</div>
        <div style={{ fontSize: 18, color: colors.textMuted }}>{formatPrice(mover.price)}</div>
      </div>

      {/* Mini bar */}
      <div style={{ width: 120 }}>
        <div style={{
          height: 8, borderRadius: 4, background: `${color}15`,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 4, background: color,
            width: `${barWidth}%`,
          }} />
        </div>
      </div>

      <div style={{
        fontSize: 28, fontWeight: 700, color,
        minWidth: 110, textAlign: 'right',
      }}>
        {formatPct(mover.change24h)}
      </div>
    </div>
  );
};
