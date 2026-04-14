'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { TokenIconSimple } from './TokenIcon';
import { useTickers } from '@/hooks/useSWRApi';
import type { TickerData } from '@/lib/api/types';
import { formatPrice, safeNumber } from '@/lib/utils/format';

/**
 * Bloomberg-style slim live-tape strip. Horizontal row of the 8 largest
 * majors — symbol, price, 24h change — meant to sit sticky beneath the
 * TopStatsBar so trading-critical prices stay visible while scrolling.
 */

const MAJORS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX'] as const;

interface TileData {
  symbol: string;
  price: number;
  change: number;
}

function pickBestPerSymbol(tickers: TickerData[] | null | undefined): Map<string, TileData> {
  const best = new Map<string, TileData>();
  if (!tickers) return best;

  for (const t of tickers) {
    const rawSym = (t.symbol || '').toUpperCase();
    const clean = rawSym.replace(/(USDT|USD|USDC|BUSD|PERP|SWAP|-|_|\/)/g, '');
    if (!MAJORS.includes(clean as (typeof MAJORS)[number])) continue;

    const price = safeNumber(t.lastPrice);
    const change = safeNumber(t.priceChangePercent24h);
    if (!price || change == null) continue;
    // Prefer Binance as the canonical source if available, otherwise first seen
    const existing = best.get(clean);
    if (!existing || t.exchange === 'Binance') {
      best.set(clean, { symbol: clean, price, change });
    }
  }
  return best;
}

export default function MarketTiles() {
  const { data: tickers, isLoading } = useTickers();

  const byMajor = useMemo(() => pickBestPerSymbol(tickers), [tickers]);

  const renderItem = (symbol: (typeof MAJORS)[number], keyPrefix: string) => {
    const tile = byMajor.get(symbol);
    const isUp = (tile?.change ?? 0) >= 0;
    return (
      <Link
        key={`${keyPrefix}-${symbol}`}
        href={`/coin/${symbol.toLowerCase()}`}
        className="tape-item group"
        aria-hidden={keyPrefix === 'clone' ? 'true' : undefined}
        tabIndex={keyPrefix === 'clone' ? -1 : undefined}
      >
        <TokenIconSimple symbol={symbol} size={16} />
        <span className="tape-sym">{symbol}</span>
        {tile ? (
          <>
            <span className="tape-price">{formatPrice(tile.price)}</span>
            <span className={`tape-chg ${isUp ? 'tape-chg-up' : 'tape-chg-down'}`}>
              {isUp ? '▲' : '▼'}
              {Math.abs(tile.change).toFixed(2)}%
            </span>
          </>
        ) : isLoading ? (
          <span className="tape-skeleton" />
        ) : (
          <span className="tape-price tape-price-empty">—</span>
        )}
      </Link>
    );
  };

  return (
    <div className="market-tape">
      <div className="market-tape-track">
        {/* Two copies of the same content — second one is aria-hidden. Animated
            -50% translate loops seamlessly because both halves are identical. */}
        <div className="market-tape-run">
          {MAJORS.map((s) => renderItem(s, 'a'))}
        </div>
        <div className="market-tape-run" aria-hidden="true">
          {MAJORS.map((s) => renderItem(s, 'clone'))}
        </div>
      </div>
    </div>
  );
}
