'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Sparkles, ChevronRight, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { fetchAllTickers, fetchAllFundingRates, fetchAllOpenInterest } from '@/lib/api/aggregator';
import { TickerData, FundingRateData, OpenInterestData } from '@/lib/api/types';

interface CryptoAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
}

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

function formatPrice(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '$0.00';
  if (num >= 1000) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  return `$${num.toFixed(4)}`;
}

function safeNumber(num: number | undefined | null): number {
  return num ?? 0;
}

// Simulated mini sparkline data
const generateSparkline = (trend: number) => {
  const points = [];
  let value = 50;
  for (let i = 0; i < 20; i++) {
    value += (Math.random() - 0.5 + trend * 0.1) * 5;
    value = Math.max(10, Math.min(90, value));
    points.push(value);
  }
  return points;
};

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 60;

  const pathData = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${positive}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathData} L ${width} ${height} L 0 ${height} Z`}
        fill={`url(#gradient-${positive})`}
      />
      <path d={pathData} fill="none" stroke={positive ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
    </svg>
  );
}

// Map symbol to human-readable name
const symbolNames: Record<string, string> = {
  'BTC': 'Bitcoin',
  'ETH': 'Ethereum',
  'SOL': 'Solana',
  'BNB': 'BNB',
  'XRP': 'Ripple',
  'DOGE': 'Dogecoin',
  'ADA': 'Cardano',
  'AVAX': 'Avalanche',
  'DOT': 'Polkadot',
  'MATIC': 'Polygon',
  'LINK': 'Chainlink',
  'UNI': 'Uniswap',
  'ATOM': 'Cosmos',
  'LTC': 'Litecoin',
  'NEAR': 'NEAR Protocol',
  'ARB': 'Arbitrum',
  'OP': 'Optimism',
  'APT': 'Aptos',
  'SUI': 'Sui',
  'PEPE': 'Pepe',
  'WIF': 'dogwifhat',
  'SHIB': 'Shiba Inu',
  'FIL': 'Filecoin',
  'INJ': 'Injective',
  'TIA': 'Celestia',
};

export default function CryptoTable() {
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tickers, fundingRates, openInterest] = await Promise.all([
        fetchAllTickers(),
        fetchAllFundingRates(),
        fetchAllOpenInterest(),
      ]);

      // Create funding rate map
      const fundingMap = new Map<string, number>();
      fundingRates.forEach((fr: FundingRateData) => {
        const symbol = fr.symbol.replace('USDT', '').replace('USD', '');
        if (!fundingMap.has(symbol)) {
          fundingMap.set(symbol, fr.fundingRate);
        }
      });

      // Create OI map
      const oiMap = new Map<string, number>();
      openInterest.forEach((oi: OpenInterestData) => {
        const symbol = oi.symbol.replace('USDT', '').replace('USD', '');
        const current = oiMap.get(symbol) || 0;
        oiMap.set(symbol, current + oi.openInterestValue);
      });

      // Build crypto assets
      const cryptoAssets: CryptoAsset[] = tickers.slice(0, 15).map((ticker: TickerData) => {
        const symbol = (ticker.symbol || '').replace('USDT', '').replace('USD', '');
        return {
          symbol,
          name: symbolNames[symbol] || symbol,
          price: safeNumber(ticker.lastPrice),
          change24h: safeNumber(ticker.priceChangePercent24h),
          volume24h: safeNumber(ticker.quoteVolume24h),
          openInterest: oiMap.get(symbol) || 0,
          fundingRate: fundingMap.get(symbol) || 0,
        };
      });

      setAssets(cryptoAssets);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to fetch market data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60 * 1000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (isLoading && assets.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-hub-yellow animate-spin mb-3" />
        <p className="text-hub-gray-text text-sm">Loading market data...</p>
      </div>
    );
  }

  if (error && assets.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center">
        <AlertCircle className="w-8 h-8 text-danger mb-3" />
        <p className="text-danger text-sm">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-2 bg-hub-gray/30 text-white rounded-lg text-sm hover:bg-hub-gray/50 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-hub-gray/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-hub-yellow/20 to-hub-orange/10 rounded-xl">
              <Sparkles className="w-5 h-5 text-hub-yellow" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Top Assets</h2>
              <p className="text-hub-gray-text text-xs">By trading volume</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-hub-gray-text bg-hub-gray/30 px-2 py-1 rounded-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              Live
            </span>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 rounded-lg text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-hub-gray/20">
              <th className="text-left text-xs text-hub-gray-text font-medium px-5 py-3">Asset</th>
              <th className="text-right text-xs text-hub-gray-text font-medium px-5 py-3">Price</th>
              <th className="text-right text-xs text-hub-gray-text font-medium px-5 py-3">24h</th>
              <th className="text-center text-xs text-hub-gray-text font-medium px-5 py-3">Trend</th>
              <th className="text-right text-xs text-hub-gray-text font-medium px-5 py-3">Volume</th>
              <th className="text-right text-xs text-hub-gray-text font-medium px-5 py-3">Open Interest</th>
              <th className="text-right text-xs text-hub-gray-text font-medium px-5 py-3">Funding</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, index) => {
              const sparklineData = generateSparkline(asset.change24h);
              return (
                <tr
                  key={asset.symbol}
                  className="border-t border-hub-gray/20 hover:bg-hub-gray/10 transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-hub-yellow/30 to-hub-orange/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <span className="text-hub-yellow font-bold text-sm">{asset.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white group-hover:text-hub-yellow transition-colors">{asset.symbol}</p>
                        <p className="text-hub-gray-text text-xs">{asset.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-white font-semibold font-mono">{formatPrice(asset.price)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {asset.change24h >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-danger" />
                      )}
                      <span className={`font-semibold ${(asset.change24h ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(asset.change24h ?? 0) >= 0 ? '+' : ''}{(asset.change24h ?? 0).toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-center">
                      <MiniSparkline data={sparklineData} positive={asset.change24h >= 0} />
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-hub-gray-text-light">{formatNumber(asset.volume24h)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-hub-gray-text-light">{formatNumber(asset.openInterest)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`px-2 py-1 rounded-md text-sm font-mono ${
                      (asset.fundingRate ?? 0) >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                    }`}>
                      {(asset.fundingRate ?? 0) >= 0 ? '+' : ''}{(asset.fundingRate ?? 0).toFixed(4)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}