import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { colors, fullScreen, formatOI, getCoinIconFallback } from './styles';
import { Background } from './Background';
import type { OIEntry } from '../data/types';

interface Props {
  totalOI: string;
  topOI: OIEntry[];
}

export const OIScene: React.FC<Props> = ({ totalOI, topOI }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const totalOp = interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const totalScale = spring({ frame: frame - 10, fps, config: { damping: 10, stiffness: 80 } });

  // Find max for bar proportions
  const maxOI = topOI.length > 0 ? topOI[0].totalOI : 1;

  return (
    <div style={fullScreen}>
      <Background />
      <div style={{ position: 'relative', zIndex: 1, padding: '80px 48px', height: '100%' }}>

        <div style={{ opacity: titleOp, marginTop: 60 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: colors.accent, letterSpacing: 3, marginBottom: 8 }}>
            OPEN INTEREST
          </div>
          <h2 style={{ fontSize: 52, fontWeight: 800, margin: 0 }}>
            Where the Money Is
          </h2>
        </div>

        {/* Total OI hero number */}
        <div style={{
          textAlign: 'center', marginTop: 60,
          opacity: totalOp,
          transform: `scale(${totalScale})`,
        }}>
          <div style={{ fontSize: 22, color: colors.textMuted, marginBottom: 8 }}>TOTAL OPEN INTEREST</div>
          <div style={{
            fontSize: 84, fontWeight: 800, lineHeight: 1,
            background: `linear-gradient(135deg, ${colors.cyan}, ${colors.blue})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {totalOI}
          </div>
        </div>

        {/* Top 5 OI bars */}
        <div style={{ marginTop: 60 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: colors.textSecondary, marginBottom: 20 }}>
            Top Assets by Open Interest
          </div>
          {topOI.map((entry, i) => (
            <OIBar key={entry.symbol} entry={entry} index={i} maxOI={maxOI} delay={25 + i * 7} />
          ))}
        </div>
      </div>
    </div>
  );
};

const BAR_COLORS = [colors.accent, colors.blue, colors.cyan, colors.purple, colors.green];

const OIBar: React.FC<{
  entry: OIEntry; index: number; maxOI: number; delay: number;
}> = ({ entry, index, maxOI, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 80 } });
  const barPct = interpolate(enter, [0, 1], [0, (entry.totalOI / maxOI) * 100]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const color = BAR_COLORS[index % BAR_COLORS.length];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      marginBottom: 20, opacity,
    }}>
      {/* Coin Icon + Symbol */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 130 }}>
        <img
          src={getCoinIconFallback(entry.symbol)}
          width={32} height={32}
          style={{ borderRadius: 16, objectFit: 'cover' }}
        />
        <span style={{ fontSize: 28, fontWeight: 700, color: colors.textPrimary }}>
          {entry.symbol}
        </span>
      </div>

      {/* Bar */}
      <div style={{ flex: 1, height: 36, borderRadius: 10, background: `${color}15`, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 10,
          background: `linear-gradient(90deg, ${color}, ${color}AA)`,
          width: `${barPct}%`,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          paddingRight: 12,
        }}>
          {barPct > 20 && (
            <span style={{ fontSize: 16, fontWeight: 700, color: '#000' }}>
              {formatOI(entry.totalOI)}
            </span>
          )}
        </div>
      </div>

      {/* Value (shown if bar is small) */}
      {barPct <= 20 && (
        <div style={{ fontSize: 22, fontWeight: 600, color, minWidth: 90 }}>
          {formatOI(entry.totalOI)}
        </div>
      )}
    </div>
  );
};
