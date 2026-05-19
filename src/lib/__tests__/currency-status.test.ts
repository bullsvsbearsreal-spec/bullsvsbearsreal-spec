import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STATUS_EXCHANGES } from '../currency-status';

describe('STATUS_EXCHANGES', () => {
  it('contains the 4 exchanges with public status APIs', () => {
    expect(STATUS_EXCHANGES.has('OKX')).toBe(true);
    expect(STATUS_EXCHANGES.has('KuCoin')).toBe(true);
    expect(STATUS_EXCHANGES.has('Gate.io')).toBe(true);
    expect(STATUS_EXCHANGES.has('HTX')).toBe(true);
  });

  it('does NOT contain exchanges without public status APIs (Binance, Bybit)', () => {
    expect(STATUS_EXCHANGES.has('Binance')).toBe(false);
    expect(STATUS_EXCHANGES.has('Bybit')).toBe(false);
    expect(STATUS_EXCHANGES.has('MEXC')).toBe(false);
  });

  it('is a Set instance with the expected size', () => {
    expect(STATUS_EXCHANGES).toBeInstanceOf(Set);
    expect(STATUS_EXCHANGES.size).toBe(4);
  });
});

describe('fetchAllCurrencyStatus', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a Map (potentially empty if all upstreams fail)', async () => {
    // All 4 upstreams fail → empty Map
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream down', { status: 503 }),
    );
    const { fetchAllCurrencyStatus } = await import('../currency-status');
    const result = await fetchAllCurrencyStatus();
    expect(result).toBeInstanceOf(Map);
  });

  it('merges status from all reporting exchanges into one flat map', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const u = String(url);
      if (u.includes('okx')) {
        return Promise.resolve(new Response(JSON.stringify({
          code: '0',
          data: [{ ccy: 'BTC', canDep: true, canWd: true, chain: 'Bitcoin' }],
        }), { status: 200 }));
      }
      if (u.includes('kucoin')) {
        return Promise.resolve(new Response(JSON.stringify({
          code: '200000',
          data: [{ currency: 'BTC', isDepositEnabled: true, isWithdrawEnabled: false }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 503 }));
    });
    const { fetchAllCurrencyStatus } = await import('../currency-status');
    const result = await fetchAllCurrencyStatus();
    // Should contain both OKX:BTC and KuCoin:BTC (different entries)
    expect(result.has('OKX:BTC')).toBe(true);
    expect(result.has('KuCoin:BTC')).toBe(true);
    expect(result.get('KuCoin:BTC')?.canWithdraw).toBe(false);
  });
});
