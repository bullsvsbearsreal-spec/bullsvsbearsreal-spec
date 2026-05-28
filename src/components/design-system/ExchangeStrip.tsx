'use client';
import Image from 'next/image';

// 33 venues — must stay in sync with src/lib/constants/exchanges.ts ALL_EXCHANGES.
// Was 32 — missing Blofin. Caused the logo strip to show one fewer logo
// than the "33 venues" tag (and Blofin support shipped May 2026 so its
// users would have noticed it missing from the brand strip).
const EXCHANGES = [
  'binance','bybit','okx','bitget','mexc','blofin',
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
 * these 33 venues" without false-activity theatrics. Real venue health
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
            // `contain` instead of `cover` — several source PNGs
            // (blofin, bitunix, gate, edgex, backpack, orderly,
            // paradex, lighter, etc.) have the actual logo centered
            // in a wide white canvas. With `cover` the small centered
            // logo got cropped out and the circle appeared empty
            // white. `contain` shows the logo even if it has padding.
            // Re-cropping the source PNGs is a follow-up cleanup,
            // but this lets every venue show some glyph today.
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            unoptimized
          />
        </span>
      ))}
    </div>
  );
}
