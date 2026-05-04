'use client';
import { useEffect, useState } from 'react';
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

interface ExchangeStripProps { compact?: boolean; flashInterval?: number; className?: string; }

export default function ExchangeStrip({ compact = false, flashInterval = 380, className }: ExchangeStripProps) {
  const [flashIdx, setFlashIdx] = useState(-1);
  useEffect(() => {
    const id = setInterval(() => setFlashIdx(Math.floor(Math.random() * EXCHANGES.length)), flashInterval);
    return () => clearInterval(id);
  }, [flashInterval]);
  const sz = compact ? 16 : 20;
  const gap = compact ? 5 : 7;
  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap, padding: compact ? '3px 8px' : '5px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--hub-border-subtle)', borderRadius: compact ? 5 : 7 }}>
      {EXCHANGES.map((name, i) => {
        const flash = i === flashIdx;
        return (
          <span key={name} title={name} style={{ position: 'relative', width: sz, height: sz, borderRadius: 999, background: '#fff', overflow: 'hidden', flexShrink: 0, animation: flash ? 'exch-pop 420ms ease-out' : undefined, boxShadow: flash ? '0 0 8px rgba(74,222,128,0.7)' : '0 0 0 1px rgba(255,255,255,0.05)', transition: 'box-shadow 220ms' }}>
            <Image src={`/exchanges/${name}.png`} alt={name} width={sz} height={sz} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} unoptimized />
          </span>
        );
      })}
    </div>
  );
}
