/**
 * Spot withdrawal fee estimates for arbitrage calculations.
 *
 * Contains per-exchange spot taker fees (different from perp fees),
 * common withdrawal fees/networks, and transfer time estimates.
 */

// Spot taker fees (%) — CEX spot markets
// These differ from perp fees in EXCHANGE_FEES (which are futures fees)
export const SPOT_TAKER_FEES: Record<string, number> = {
  Binance:  0.10,
  Bybit:    0.10,
  OKX:      0.10,
  Bitget:   0.10,
  KuCoin:   0.10,
  Kraken:   0.25, // Kraken spot is higher than perps
  MEXC:     0.05, // Very low spot fees
  Coinbase: 0.08,
  HTX:      0.10,
  'Gate.io': 0.10,
  BingX:    0.10,
  CoinEx:   0.10,
  Phemex:   0.10,
  WhiteBIT: 0.10,
  Bitfinex: 0.10,
};

export function getSpotTakerFee(exchange: string): number {
  return SPOT_TAKER_FEES[exchange] ?? 0.10;
}

// Withdrawal networks with estimated fees and times
export interface WithdrawalInfo {
  network: string;
  feeUsd: number;       // Estimated fee in USD
  confirmMins: number;   // Estimated transfer time
}

// Common withdrawal networks ranked by cost (cheapest first)
// These are approximate — real fees vary by exchange and coin
const NETWORK_COSTS: Record<string, WithdrawalInfo> = {
  'SOL':     { network: 'Solana',    feeUsd: 0.10,  confirmMins: 1 },
  'TRC20':   { network: 'Tron',      feeUsd: 1.00,  confirmMins: 2 },
  'ARB':     { network: 'Arbitrum',  feeUsd: 0.20,  confirmMins: 2 },
  'BASE':    { network: 'Base',      feeUsd: 0.10,  confirmMins: 2 },
  'OP':      { network: 'Optimism',  feeUsd: 0.20,  confirmMins: 2 },
  'BSC':     { network: 'BSC',       feeUsd: 0.30,  confirmMins: 3 },
  'MATIC':   { network: 'Polygon',   feeUsd: 0.10,  confirmMins: 5 },
  'AVAX':    { network: 'Avalanche', feeUsd: 0.30,  confirmMins: 2 },
  'ETH':     { network: 'Ethereum',  feeUsd: 3.00,  confirmMins: 5 },
  'BTC':     { network: 'Bitcoin',   feeUsd: 5.00,  confirmMins: 30 },
};

// Per-coin best withdrawal network
// Maps coin symbol → best network for cheap/fast transfers
const COIN_NETWORKS: Record<string, string> = {
  BTC: 'BTC', ETH: 'ARB', SOL: 'SOL', XRP: 'XRP', DOGE: 'DOGE',
  ADA: 'ADA', AVAX: 'AVAX', DOT: 'DOT', LINK: 'ARB', MATIC: 'MATIC',
  UNI: 'ARB', AAVE: 'ARB', LTC: 'LTC', BCH: 'BCH', NEAR: 'NEAR',
  APT: 'APT', SUI: 'SUI', ARB: 'ARB', OP: 'OP', SEI: 'SEI',
  TIA: 'TIA', INJ: 'INJ', FTM: 'FTM', ATOM: 'ATOM', ALGO: 'ALGO',
  HBAR: 'HBAR', XLM: 'XLM', TRX: 'TRC20', FIL: 'FIL',
  PEPE: 'ARB', SHIB: 'ARB', WIF: 'SOL', BONK: 'SOL', FLOKI: 'BSC',
  RENDER: 'SOL', POL: 'MATIC', ETC: 'ETC', BERA: 'BERA',
};

// Default withdrawal cost if we don't know the coin
const DEFAULT_WITHDRAWAL: WithdrawalInfo = {
  network: 'Native',
  feeUsd: 2.00,
  confirmMins: 10,
};

// Special coin withdrawal costs (in USD equivalent)
const COIN_WITHDRAWAL_USD: Record<string, number> = {
  BTC: 8.00, ETH: 2.50, SOL: 0.15, XRP: 0.30, DOGE: 2.00,
  ADA: 0.50, AVAX: 0.20, DOT: 0.50, LINK: 0.30, NEAR: 0.05,
  APT: 0.05, SUI: 0.10, ARB: 0.20, OP: 0.20, LTC: 0.10,
  BCH: 0.10, ATOM: 0.05, TRX: 0.50, FIL: 0.10,
  PEPE: 0.30, SHIB: 0.30, WIF: 0.15, BONK: 0.15,
};

export function getWithdrawalInfo(symbol: string): WithdrawalInfo {
  const networkKey = COIN_NETWORKS[symbol];

  if (networkKey && NETWORK_COSTS[networkKey]) {
    const base = NETWORK_COSTS[networkKey];
    return {
      network: base.network,
      feeUsd: COIN_WITHDRAWAL_USD[symbol] ?? base.feeUsd,
      confirmMins: base.confirmMins,
    };
  }

  // Known coin with specific fee but no mapped network
  if (COIN_WITHDRAWAL_USD[symbol] !== undefined) {
    return {
      network: 'Native',
      feeUsd: COIN_WITHDRAWAL_USD[symbol],
      confirmMins: 5,
    };
  }

  return DEFAULT_WITHDRAWAL;
}

// Volume warning thresholds
export const VOLUME_THRESHOLDS = {
  DANGER: 50_000,    // < $50K avg vol — very risky
  WARNING: 250_000,  // < $250K avg vol — low liquidity
  CAUTION: 500_000,  // < $500K avg vol — moderate
} as const;

export type VolumeLevel = 'danger' | 'warning' | 'caution' | 'ok';

export function getVolumeLevel(avgVolume: number): VolumeLevel {
  if (avgVolume < VOLUME_THRESHOLDS.DANGER) return 'danger';
  if (avgVolume < VOLUME_THRESHOLDS.WARNING) return 'warning';
  if (avgVolume < VOLUME_THRESHOLDS.CAUTION) return 'caution';
  return 'ok';
}
