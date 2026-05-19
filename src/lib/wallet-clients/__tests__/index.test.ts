import { describe, it, expect, vi } from 'vitest';
import {
  getWalletClient,
  getWalletClients,
  fetchAllPositionsForChain,
} from '../index';
import type { SupportedChain } from '@/lib/portfolio/supported-exchanges';

describe('getWalletClient', () => {
  it('returns the first registered client for hyperliquid', () => {
    const client = getWalletClient('hyperliquid');
    expect(client).not.toBeNull();
    expect(client?.displayName).toBe('Hyperliquid');
  });

  it('returns the first registered client for arbitrum (GMX)', () => {
    const client = getWalletClient('arbitrum');
    expect(client).not.toBeNull();
    // First entry is GMX, gTrade is second
    expect(client?.displayName).toBe('GMX');
  });

  it('returns the lighter client for ethereum', () => {
    const client = getWalletClient('ethereum');
    expect(client).not.toBeNull();
    expect(client?.displayName).toBe('Lighter');
  });

  it('returns null for unregistered chains (base, solana)', () => {
    expect(getWalletClient('base' as SupportedChain)).toBeNull();
    expect(getWalletClient('solana' as SupportedChain)).toBeNull();
  });
});

describe('getWalletClients', () => {
  it('returns an array with 1 entry for hyperliquid', () => {
    const clients = getWalletClients('hyperliquid');
    expect(clients.length).toBe(1);
  });

  it('returns 2 entries for arbitrum (GMX + gTrade)', () => {
    const clients = getWalletClients('arbitrum');
    expect(clients.length).toBe(2);
    const names = clients.map((c) => c.displayName);
    expect(names).toContain('GMX');
    expect(names).toContain('gTrade');
  });

  it('returns empty array for chains with no registered clients', () => {
    expect(getWalletClients('solana' as SupportedChain)).toEqual([]);
  });

  it('every returned client exposes a fetchPositions function', () => {
    const clients = getWalletClients('arbitrum');
    clients.forEach((c) => {
      expect(typeof c.fetchPositions).toBe('function');
      expect(c.displayName).toBeTruthy();
    });
  });
});

describe('fetchAllPositionsForChain', () => {
  it('returns empty array for chains with no registered clients', async () => {
    const out = await fetchAllPositionsForChain('solana' as SupportedChain, '0xanything');
    expect(out).toEqual([]);
  });

  it('tags every returned position with the client displayName', async () => {
    // Mock the underlying client methods so we don't hit a real wallet
    const { gmxWalletClient } = await import('../gmx');
    const { gtradeWalletClient } = await import('../gtrade');
    vi.spyOn(gmxWalletClient, 'fetchPositions').mockResolvedValue([
      {
        symbol: 'BTC', side: 'long', size: 1, entryPrice: 50000, markPrice: 51000,
        positionValue: 51000, unrealizedPnl: 1000, leverage: 5, marginUsed: 10200,
        liquidationPrice: 40000, tpPrice: null, slPrice: null, cumulativeFunding: 0,
      },
    ]);
    vi.spyOn(gtradeWalletClient, 'fetchPositions').mockResolvedValue([
      {
        symbol: 'ETH', side: 'short', size: 5, entryPrice: 3000, markPrice: 2900,
        positionValue: 14500, unrealizedPnl: 500, leverage: 3, marginUsed: 4833,
        liquidationPrice: 4000, tpPrice: null, slPrice: null, cumulativeFunding: 0,
      },
    ]);

    const out = await fetchAllPositionsForChain('arbitrum', '0xtest');
    expect(out.length).toBe(2);
    const exchanges = out.map((p) => p.exchange);
    expect(exchanges).toContain('GMX');
    expect(exchanges).toContain('gTrade');

    vi.restoreAllMocks();
  });

  it('one client failing does not block the other (Promise.allSettled)', async () => {
    const { gmxWalletClient } = await import('../gmx');
    const { gtradeWalletClient } = await import('../gtrade');
    vi.spyOn(gmxWalletClient, 'fetchPositions').mockRejectedValue(new Error('GMX down'));
    vi.spyOn(gtradeWalletClient, 'fetchPositions').mockResolvedValue([
      {
        symbol: 'ETH', side: 'short', size: 1, entryPrice: 3000, markPrice: 3100,
        positionValue: 3100, unrealizedPnl: -100, leverage: 2, marginUsed: 1550,
        liquidationPrice: 4500, tpPrice: null, slPrice: null, cumulativeFunding: 0,
      },
    ]);

    const out = await fetchAllPositionsForChain('arbitrum', '0xtest');
    // GMX failed, gTrade succeeded — should have 1 position
    expect(out.length).toBe(1);
    expect(out[0].exchange).toBe('gTrade');

    vi.restoreAllMocks();
  });

  it('returns empty when all clients fail', async () => {
    const { gmxWalletClient } = await import('../gmx');
    const { gtradeWalletClient } = await import('../gtrade');
    vi.spyOn(gmxWalletClient, 'fetchPositions').mockRejectedValue(new Error('GMX down'));
    vi.spyOn(gtradeWalletClient, 'fetchPositions').mockRejectedValue(new Error('gTrade down'));

    const out = await fetchAllPositionsForChain('arbitrum', '0xtest');
    expect(out).toEqual([]);

    vi.restoreAllMocks();
  });
});
