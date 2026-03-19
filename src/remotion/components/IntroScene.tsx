import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { colors, fullScreen, formatPrice, formatPct, formatRate, getCoinIconFallback } from './styles';
import { Background } from './Background';
import { InfoHubLogo } from './Logo';
import type { MarketRecapData } from '../data/types';

export const IntroScene: React.FC<{ data: MarketRecapData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
  const titleY = interpolate(frame, [8, 25], [60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleOp = interpolate(frame, [8, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dateOp = interpolate(frame, [18, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cardsOp = interpolate(frame, [28, 42], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cardsY = interpolate(frame, [28, 42], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const statsOp = interpolate(frame, [45, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={fullScreen}>
      <Background />
      <div style={{ position: 'relative', zIndex: 1, padding: '80px 48px', height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginTop: 100 }}>
          <div style={{
            transform: `scale(${logoScale})`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
          }}>
            <InfoHubLogo size={72} />
          </div>

          <div style={{
            opacity: titleOp,
            transform: `translateY(${titleY}px)`,
          }}>
            <h1 style={{
              fontSize: 72, fontWeight: 800, margin: 0, lineHeight: 1.1,
              background: `linear-gradient(135deg, ${colors.textPrimary} 30%, ${colors.accent})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Market Recap
            </h1>
          </div>

          <p style={{
            opacity: dateOp,
            fontSize: 28, color: colors.textSecondary, marginTop: 12, fontWeight: 400,
          }}>
            {data.date}
          </p>
        </div>

        {/* BTC / ETH Price Cards */}
        <div style={{
          display: 'flex', gap: 20, marginTop: 70,
          opacity: cardsOp,
          transform: `translateY(${cardsY}px)`,
        }}>
          <PriceCard symbol="BTC" price={data.btcPrice} change={data.btcChange} color={colors.accent} />
          <PriceCard symbol="ETH" price={data.ethPrice} change={data.ethChange} color={colors.blue} />
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', justifyContent: 'space-around', marginTop: 56,
          opacity: statsOp,
        }}>
          <StatPill label="Exchanges" value={String(data.totalExchanges)} />
          <StatPill label="Pairs" value={data.totalPairs.toLocaleString()} />
          <StatPill label="Total OI" value={data.totalOI} />
        </div>

        {/* Avg funding indicator */}
        <div style={{
          textAlign: 'center', marginTop: 56, opacity: statsOp,
          background: colors.bgCard, borderRadius: 20,
          border: `1px solid ${colors.border}`, padding: '28px 32px',
        }}>
          <div style={{
            fontSize: 18, fontWeight: 600, color: colors.textMuted,
            letterSpacing: 2, marginBottom: 12,
          }}>
            AVERAGE FUNDING RATE
          </div>
          <div style={{
            fontSize: 64, fontWeight: 800, lineHeight: 1,
            color: data.avgFundingRate >= 0 ? colors.green : colors.red,
          }}>
            {formatRate(data.avgFundingRate)}
          </div>
          <div style={{
            fontSize: 20, color: colors.textMuted, marginTop: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: data.avgFundingRate >= 0 ? colors.green : colors.red,
            }} />
            {data.avgFundingRate >= 0 ? 'Longs paying shorts' : 'Shorts paying longs'}
          </div>
        </div>
      </div>
    </div>
  );
};

const PriceCard: React.FC<{
  symbol: string; price: number; change: number; color: string;
}> = ({ symbol, price, change, color }) => (
  <div style={{
    flex: 1, background: colors.bgCard, borderRadius: 20,
    border: `1px solid ${colors.border}`, padding: '28px 24px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <img
        src={getCoinIconFallback(symbol)}
        width={44} height={44}
        style={{ borderRadius: 12, objectFit: 'cover' }}
      />
      <span style={{ fontSize: 26, fontWeight: 600, color: colors.textSecondary }}>{symbol}</span>
    </div>
    <div style={{ fontSize: 44, fontWeight: 700 }}>{formatPrice(price)}</div>
    <div style={{
      fontSize: 24, fontWeight: 600, marginTop: 4,
      color: change >= 0 ? colors.green : colors.red,
    }}>
      {formatPct(change)}
    </div>
  </div>
);

const StatPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 36, fontWeight: 700, color: colors.textPrimary }}>{value}</div>
    <div style={{ fontSize: 18, color: colors.textMuted, marginTop: 4 }}>{label}</div>
  </div>
);
