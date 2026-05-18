import { describe, it, expect } from 'vitest';
import {
  detectChain,
  formatTradeValue,
  formatTradeMessage,
} from '../whale-trades';
import type { DetectedTrade } from '../whale-trades';

function trade(o: Partial<DetectedTrade>): DetectedTrade {
  return {
    chain: 'ethereum',
    blockNumber: 1,
    timestamp: 0,
    txHash: '0xabc',
    logIndex: 0,
    address: '0x1234567890123456789012345678901234567890',
    dex: 'Uniswap',
    action: 'swap',
    tokenIn: '0xa', tokenInSymbol: 'USDC',
    tokenOut: '0xb', tokenOutSymbol: 'ETH',
    amountIn: 1000,
    amountOut: 0.5,
    valueUsd: 1000,
    ...o,
  } as DetectedTrade;
}

describe('detectChain', () => {
  it('identifies a valid EVM address as ethereum', () => {
    expect(detectChain('0x1234567890123456789012345678901234567890')).toBe('ethereum');
  });

  it('identifies a valid Solana base58 address as solana', () => {
    expect(detectChain('7Snt3kc9rfMqHnsuMo9N5DNz3pHQk5Bz8FAh54fz8nMz')).toBe('solana');
  });

  it('defaults to ethereum for ambiguous / invalid input', () => {
    expect(detectChain('not-an-address')).toBe('ethereum');
    expect(detectChain('')).toBe('ethereum');
  });

  it('rejects EVM-shape addresses with wrong length', () => {
    // Wrong length → falls through to Solana regex → likely fails → default 'ethereum'
    expect(detectChain('0x123')).toBe('ethereum');
  });
});

describe('formatTradeValue', () => {
  it('formats millions with M suffix', () => {
    expect(formatTradeValue(2_500_000)).toBe('$2.50M');
    expect(formatTradeValue(1_000_000)).toBe('$1.00M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatTradeValue(50_000)).toBe('$50.0K');
    expect(formatTradeValue(1_500)).toBe('$1.5K');
  });

  it('formats sub-thousand with full dollars', () => {
    expect(formatTradeValue(500)).toBe('$500.00');
    expect(formatTradeValue(42.5)).toBe('$42.50');
  });

  it('returns empty string for null / undefined / 0 / negative', () => {
    expect(formatTradeValue(null)).toBe('');
    expect(formatTradeValue(undefined)).toBe('');
    expect(formatTradeValue(0)).toBe('');
    expect(formatTradeValue(-100)).toBe('');
  });

  it('handles edge: exactly $1000 → $1.0K', () => {
    expect(formatTradeValue(1000)).toBe('$1.0K');
  });

  it('handles edge: exactly $1,000,000 → $1.00M', () => {
    expect(formatTradeValue(1_000_000)).toBe('$1.00M');
  });
});

describe('formatTradeMessage', () => {
  it('uses the provided label if given', () => {
    const msg = formatTradeMessage(trade({}), 'Vitalik');
    expect(msg).toContain('Vitalik');
    expect(msg).not.toContain('0x1234');
  });

  it('falls back to truncated address if no label', () => {
    const msg = formatTradeMessage(trade({}));
    expect(msg).toContain('0x1234');
    expect(msg).toContain('7890'); // last 4 chars
  });

  it('uses "longed" for perp-DEX buy actions on Hyperliquid', () => {
    const msg = formatTradeMessage(trade({
      dex: 'Hyperliquid', action: 'buy',
      tokenInSymbol: 'BTC', tokenOutSymbol: 'USDC',
    }));
    expect(msg).toContain('longed BTC');
    expect(msg).toContain('Hyperliquid');
  });

  it('uses "shorted" for perp-DEX sell actions', () => {
    const msg = formatTradeMessage(trade({
      dex: 'dYdX', action: 'sell',
      tokenInSymbol: 'USDC', tokenOutSymbol: 'ETH',
    }));
    expect(msg).toContain('shorted ETH');
    expect(msg).toContain('dYdX');
  });

  it('formats swap with token symbols + amounts for AMM trades', () => {
    const msg = formatTradeMessage(trade({
      dex: 'Uniswap', action: 'swap',
      tokenInSymbol: 'USDC', tokenOutSymbol: 'ETH',
      amountIn: 1000, amountOut: 0.5,
    }));
    expect(msg).toContain('swapped');
    expect(msg).toContain('USDC');
    expect(msg).toContain('ETH');
  });

  it('appends $ value when valueUsd is set', () => {
    const msg = formatTradeMessage(trade({ valueUsd: 1_500_000 }));
    expect(msg).toContain('$1.50M');
  });

  it('omits $ value when valueUsd is null / 0', () => {
    const msg = formatTradeMessage(trade({ valueUsd: 0 }));
    expect(msg).not.toContain('$');
  });

  it('uses ??? placeholder for missing token symbols', () => {
    const msg = formatTradeMessage(trade({
      tokenInSymbol: null as unknown as string,
      tokenOutSymbol: null as unknown as string,
    }));
    expect(msg).toContain('???');
  });
});
