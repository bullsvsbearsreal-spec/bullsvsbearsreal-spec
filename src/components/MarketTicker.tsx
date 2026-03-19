'use client';

import { useState, useMemo } from 'react';
import { TokenIconSimple } from './TokenIcon';
import { useTickers } from '@/hooks/useSWRApi';
import { TickerData } from '@/lib/api/types';
import { formatPrice, safeNumber } from '@/lib/utils/format';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}

export default function MarketTicker() {
  const [isPaused, setIsPaused] = useState(false);
  const { data: tickers, isLoading } = useTickers();

  const tickerData = useMemo<TickerItem[]>(() => {
    if (!tickers) return [];

    // Non-crypto symbols to exclude (stocks, forex, commodities from gTrade/DEX)
    const NON_CRYPTO = new Set([
      'XAU', 'XAG', 'XAUT', 'PAXG', 'GOLD', 'SILVER',
      'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'SEK', 'NOK', 'SGD', 'HKD', 'CNH', 'MXN', 'ZAR', 'TRY', 'INR', 'BRL',
      'AAPL', 'GOOG', 'GOOGL', 'MSFT', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD', 'NFLX', 'COIN', 'MSTR', 'GME', 'AMC', 'SPY', 'QQQ', 'DIA', 'IWM',
      'COPPER', 'NATGAS', 'OIL', 'BRENT', 'WTI', 'WHEAT', 'CORN', 'COFFEE', 'SUGAR', 'COTTON',
      'USOIL', 'UKOIL', 'CL',
    ]);
    // Also filter out Kraken EUR/GBP pairs and other non-USD denominated pairs
    const NON_USD_SUFFIXES = /(?:EUR|GBP|JPY|AUD|CAD|CHF)$/i;

    return tickers
      .filter((t: TickerData) => {
        if (t.priceChangePercent24h == null || t.priceChangePercent24h === 0) return false;
        const rawSym = (t.symbol || '').toUpperCase();
        const sym = rawSym.replace(/(USDT|USD|USDC|BUSD|PERP|SWAP|-|_|\/)/g, '');
        // Exclude non-crypto
        if (NON_CRYPTO.has(sym)) return false;
        // Exclude non-USD denominated pairs (XBTEUR, ETHGBP, etc.)
        if (NON_USD_SUFFIXES.test(rawSym)) return false;
        // Exclude obviously bad data (>200% daily change)
        if (Math.abs(safeNumber(t.priceChangePercent24h)) > 200) return false;
        // Exclude zero-price entries
        if (!t.lastPrice || safeNumber(t.lastPrice) <= 0) return false;
        return true;
      })
      .slice(0, 40)
      .map((t: TickerData) => ({
        symbol: (t.symbol || '').replace(/(USDT|USD|USDC|BUSD|PERP|SWAP)$/i, ''),
        price: safeNumber(t.lastPrice),
        change: safeNumber(t.priceChangePercent24h),
      }));
  }, [tickers]);

  const duplicatedTickers = [...tickerData, ...tickerData];

  if (isLoading) {
    return (
      <div className="border-b border-white/[0.04] bg-black overflow-hidden">
        <div className="py-2">
          <div className="flex items-center gap-8 animate-pulse px-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-white/[0.06]" />
                <div className="h-3 w-8 bg-white/[0.04] rounded" />
                <div className="h-3 w-14 bg-white/[0.04] rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-white/[0.04] bg-black overflow-hidden">
      <div
        className="relative py-2"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className="flex items-center gap-8 animate-ticker"
          style={{ width: 'fit-content', ...(isPaused ? { animationPlayState: 'paused' } : {}) }}
        >
          {duplicatedTickers.map((ticker, index) => {
            const isPositive = (ticker.change ?? 0) >= 0;
            const isExtreme = Math.abs(ticker.change ?? 0) >= 10;
            return (
              <div
                key={index}
                className="flex items-center gap-1.5 cursor-pointer group transition-opacity hover:opacity-70"
              >
                <TokenIconSimple symbol={ticker.symbol} size={16} />
                <span className="text-neutral-400 font-medium text-xs">{ticker.symbol}</span>
                <span className="text-neutral-500 font-mono text-xs">{formatPrice(ticker.price)}</span>
                <span className={`delta-badge text-[10px] ${
                  isExtreme
                    ? (isPositive ? 'delta-badge-extreme-up' : 'delta-badge-extreme-down')
                    : (isPositive ? 'delta-badge-up' : 'delta-badge-down')
                }`}>
                  {isPositive ? '+' : ''}{(ticker.change ?? 0).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
