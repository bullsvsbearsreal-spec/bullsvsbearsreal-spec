'use client';
import Image from 'next/image';

// 32 venues — must stay in sync with src/lib/constants/exchanges.ts ALL_EXCHANGES
const EXCHANGES = [
  'binance','bybit','okx','bitget','mexc',
  'kraken','bingx','phemex','bitunix','hyperliquid','dydx','aster','lighter',
  'aevo','gmx','kucoin','deribit','htx','bitfinex','whitebit',
  'coinbase','coinex','gtrade','extended','variational',
  'bitmex','gate','edgex','nado',
  'backpack','orderly','paradex',
];

interface ExchangeStripProps {
  compact?: boolean;
  className?: string;
}

/**
 * Static exchange logo strip. Previously animated a random "just lit up"
 * glow on a random exchange every 380ms — visually implied "this venue is
 * currently active" without tying to any real venue health signal.
 * Dropped the random pulse so the strip honestly says "we connect to
 * these 32 venues" without false-activity theatrics. Real venue health
 * lives on /admin-panel#exchanges and (compactly) in StatusBar's
 * venue-count chip via ThroughputCounter.
 *
 * If we later want per-venue health here, hook it to the aggregator's
 * /health response (CORS-enabled) and gray out / desaturate the
 * disconnected venues — that'd be both visually richer and honest.
 */
export default function ExchangeStrip({ compact = false, className }: ExchangeStripProps) {
  const sz = compact ? 16 : 20;
  const gap = compact ? 5 : 7;
  return (
    <div className={className} style={{
      display: 'inline-flex', alignItems: 'center', gap,
      padding: compact ? '3px 8px' : '5px 10px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: compact ? 5 : 7,
    }}>
      {EXCHANGES.map(name => (
        <span key={name} title={name} style={{
          position: 'relative',
          width: sz, height: sz,
          borderRadius: 999,
          background: '#fff',
          overflow: 'hidden',
          flexShrink: 0,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05)',
        }}>
          <Image
            src={`/exchanges/${name}.png`}
            alt={name}
            width={sz} height={sz}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            unoptimized
          />
        </span>
      ))}
    </div>
  );
}
