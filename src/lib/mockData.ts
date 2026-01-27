import { Exchange, FundingRate, OpenInterest, LiquidationAggregate, MarketOverview, EconomicEvent, CryptoAsset } from '@/types';

export const exchanges: Exchange[] = [
  { id: 'binance', name: 'Binance', type: 'CEX' },
  { id: 'bybit', name: 'Bybit', type: 'CEX' },
  { id: 'okx', name: 'OKX', type: 'CEX' },
  { id: 'bitget', name: 'Bitget', type: 'CEX' },
  { id: 'deribit', name: 'Deribit', type: 'CEX' },
  { id: 'htx', name: 'HTX', type: 'CEX' },
  { id: 'gate', name: 'Gate.io', type: 'CEX' },
  { id: 'kucoin', name: 'KuCoin', type: 'CEX' },
  { id: 'mexc', name: 'MEXC', type: 'CEX' },
  { id: 'kraken', name: 'Kraken', type: 'CEX' },
  { id: 'hyperliquid', name: 'Hyperliquid', type: 'DEX' },
  { id: 'gmx', name: 'GMX', type: 'DEX' },
  { id: 'gtrade', name: 'gTrade', type: 'DEX' },
  { id: 'dydx', name: 'dYdX', type: 'DEX' },
  { id: 'lighter', name: 'Lighter', type: 'DEX' },
  { id: 'aster', name: 'Aster', type: 'DEX' },
  { id: 'ostium', name: 'Ostium', type: 'DEX' },
  { id: 'polynomial', name: 'Polynomial', type: 'DEX' },
  { id: 'vertex', name: 'Vertex', type: 'DEX' },
  { id: 'aevo', name: 'Aevo', type: 'DEX' },
  { id: 'rabbitx', name: 'RabbitX', type: 'DEX' },
  { id: 'drift', name: 'Drift', type: 'DEX' },
];

export const marketOverview: MarketOverview = {
  totalOpenInterest: 129070000000,
  totalVolume24h: 254049390410,
  totalLiquidations24h: 803599304,
  longShortRatio: 0.9406,
  btcDominance: 61.2,
  fearGreedIndex: 72,
};

export const fundingRates: FundingRate[] = [
  { symbol: 'BTC', exchange: 'Binance', rate: 0.0100, predictedRate: 0.0095, nextFundingTime: Date.now() + 3600000, annualizedRate: 10.95 },
  { symbol: 'BTC', exchange: 'Bybit', rate: 0.0098, predictedRate: 0.0092, nextFundingTime: Date.now() + 3600000, annualizedRate: 10.73 },
  { symbol: 'BTC', exchange: 'OKX', rate: 0.0102, predictedRate: 0.0098, nextFundingTime: Date.now() + 3600000, annualizedRate: 11.17 },
  { symbol: 'BTC', exchange: 'Hyperliquid', rate: 0.0085, predictedRate: 0.0080, nextFundingTime: Date.now() + 3600000, annualizedRate: 9.31 },
  { symbol: 'BTC', exchange: 'GMX', rate: 0.0078, predictedRate: 0.0075, nextFundingTime: Date.now() + 3600000, annualizedRate: 8.54 },
  { symbol: 'BTC', exchange: 'gTrade', rate: 0.0082, predictedRate: 0.0079, nextFundingTime: Date.now() + 3600000, annualizedRate: 8.98 },
  { symbol: 'ETH', exchange: 'Binance', rate: 0.0085, predictedRate: 0.0082, nextFundingTime: Date.now() + 3600000, annualizedRate: 9.31 },
  { symbol: 'ETH', exchange: 'Bybit', rate: 0.0088, predictedRate: 0.0085, nextFundingTime: Date.now() + 3600000, annualizedRate: 9.64 },
  { symbol: 'ETH', exchange: 'Hyperliquid', rate: 0.0072, predictedRate: 0.0070, nextFundingTime: Date.now() + 3600000, annualizedRate: 7.88 },
  { symbol: 'SOL', exchange: 'Binance', rate: 0.0120, predictedRate: 0.0115, nextFundingTime: Date.now() + 3600000, annualizedRate: 13.14 },
  { symbol: 'SOL', exchange: 'Hyperliquid', rate: 0.0095, predictedRate: 0.0090, nextFundingTime: Date.now() + 3600000, annualizedRate: 10.40 },
  { symbol: 'SOL', exchange: 'Lighter', rate: 0.0088, predictedRate: 0.0085, nextFundingTime: Date.now() + 3600000, annualizedRate: 9.64 },
];

export const openInterestData: OpenInterest[] = [
  { symbol: 'BTC', exchange: 'Binance', openInterest: 45200000000, change24h: -1.13 },
  { symbol: 'BTC', exchange: 'Bybit', openInterest: 18500000000, change24h: 2.34 },
  { symbol: 'BTC', exchange: 'OKX', openInterest: 12800000000, change24h: -0.89 },
  { symbol: 'BTC', exchange: 'Hyperliquid', openInterest: 8500000000, change24h: 5.67 },
  { symbol: 'BTC', exchange: 'GMX', openInterest: 1200000000, change24h: 3.21 },
  { symbol: 'ETH', exchange: 'Binance', openInterest: 18900000000, change24h: -2.45 },
  { symbol: 'ETH', exchange: 'Bybit', openInterest: 8200000000, change24h: 1.78 },
];


export const liquidationData: LiquidationAggregate[] = [
  { symbol: 'BTC', longLiquidations: 245000000, shortLiquidations: 189000000, totalLiquidations: 434000000, change24h: 355.85 },
  { symbol: 'ETH', longLiquidations: 98000000, shortLiquidations: 76000000, totalLiquidations: 174000000, change24h: 234.12 },
  { symbol: 'SOL', longLiquidations: 45000000, shortLiquidations: 38000000, totalLiquidations: 83000000, change24h: 189.45 },
  { symbol: 'XRP', longLiquidations: 22000000, shortLiquidations: 19000000, totalLiquidations: 41000000, change24h: 156.78 },
  { symbol: 'DOGE', longLiquidations: 18000000, shortLiquidations: 15000000, totalLiquidations: 33000000, change24h: 123.45 },
];

export const economicEvents: EconomicEvent[] = [
  { id: '1', date: '2026-01-27', time: '08:30', country: 'US', event: 'Core PCE Price Index m/m', impact: 'high', forecast: '0.2%', previous: '0.1%' },
  { id: '2', date: '2026-01-27', time: '10:00', country: 'US', event: 'Pending Home Sales m/m', impact: 'medium', forecast: '1.2%', previous: '-1.2%' },
  { id: '3', date: '2026-01-28', time: '10:00', country: 'US', event: 'CB Consumer Confidence', impact: 'high', forecast: '105.6', previous: '104.7' },
  { id: '4', date: '2026-01-28', time: '14:00', country: 'US', event: 'FOMC Statement', impact: 'high', forecast: '', previous: '' },
  { id: '5', date: '2026-01-28', time: '14:00', country: 'US', event: 'Federal Funds Rate', impact: 'high', forecast: '4.50%', previous: '4.50%' },
  { id: '6', date: '2026-01-29', time: '08:30', country: 'US', event: 'GDP q/q', impact: 'high', forecast: '2.5%', previous: '3.1%' },
  { id: '7', date: '2026-01-29', time: '08:30', country: 'US', event: 'Unemployment Claims', impact: 'medium', forecast: '220K', previous: '218K' },
  { id: '8', date: '2026-01-30', time: '08:30', country: 'US', event: 'Core PCE Price Index y/y', impact: 'high', forecast: '2.8%', previous: '2.9%' },
  { id: '9', date: '2026-01-31', time: '10:00', country: 'US', event: 'ISM Manufacturing PMI', impact: 'high', forecast: '49.2', previous: '48.4' },
  { id: '10', date: '2026-02-03', time: '09:45', country: 'EU', event: 'ECB President Lagarde Speaks', impact: 'high', forecast: '', previous: '' },
];

export const cryptoAssets: CryptoAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 104250, change24h: 2.34, volume24h: 45200000000, marketCap: 2050000000000, openInterest: 86000000000, fundingRate: 0.0100 },
  { symbol: 'ETH', name: 'Ethereum', price: 3320, change24h: 1.89, volume24h: 18500000000, marketCap: 399000000000, openInterest: 27100000000, fundingRate: 0.0085 },
  { symbol: 'SOL', name: 'Solana', price: 245, change24h: 4.56, volume24h: 8900000000, marketCap: 115000000000, openInterest: 8500000000, fundingRate: 0.0120 },
  { symbol: 'XRP', name: 'Ripple', price: 3.12, change24h: -1.23, volume24h: 12400000000, marketCap: 178000000000, openInterest: 3200000000, fundingRate: 0.0045 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.385, change24h: 3.78, volume24h: 4500000000, marketCap: 57000000000, openInterest: 1800000000, fundingRate: 0.0095 },
];
