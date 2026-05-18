import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Math.random BEFORE importing the module so the picked cache stays
// deterministic across each test. We re-import inside each `it` via
// `vi.resetModules()` so the per-module-singleton `picked` cache restarts.
describe('getExchangeReferralUrl', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(Math, 'random').mockReturnValue(0);  // always pick index 0
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a URL for known exchanges', async () => {
    const { getExchangeReferralUrl } = await import('../referralLinks');
    expect(getExchangeReferralUrl('Bybit')).toContain('bybit.com');
    expect(getExchangeReferralUrl('Bitget')).toContain('bitget.com');
    expect(getExchangeReferralUrl('MEXC')).toContain('mexc.com');
    expect(getExchangeReferralUrl('Hyperliquid')).toContain('hyperliquid.xyz');
  });

  it('returns null for unknown exchanges', async () => {
    const { getExchangeReferralUrl } = await import('../referralLinks');
    expect(getExchangeReferralUrl('NotARealExchange')).toBeNull();
    expect(getExchangeReferralUrl('')).toBeNull();
    expect(getExchangeReferralUrl('Binance')).toBeNull();  // Binance has no referral link configured
  });

  it('returns the SAME URL across multiple calls within a session (sticky pick)', async () => {
    const { getExchangeReferralUrl } = await import('../referralLinks');
    // MEXC has 2 links → first call picks one, subsequent calls return same
    const first = getExchangeReferralUrl('MEXC');
    const second = getExchangeReferralUrl('MEXC');
    const third = getExchangeReferralUrl('MEXC');
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('picks the first link when Math.random returns 0', async () => {
    // Math.random is mocked to 0 → Math.floor(0 * len) = 0 → index 0
    const { getExchangeReferralUrl } = await import('../referralLinks');
    const url = getExchangeReferralUrl('MEXC');
    // First MEXC entry per the source ('promote.mexc.com/r/7zeuU9AdFM')
    expect(url).toContain('7zeuU9AdFM');
  });

  it('picks a later link when Math.random returns close to 1', async () => {
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.resetModules();
    const { getExchangeReferralUrl } = await import('../referralLinks');
    const url = getExchangeReferralUrl('MEXC');
    // Math.floor(0.99 * 2) = 1 → second entry ('promote.mexc.com/r/i98MMJzX')
    expect(url).toContain('i98MMJzX');
  });

  it('always returns a string (not undefined) for known exchanges', async () => {
    const { getExchangeReferralUrl } = await import('../referralLinks');
    const exchanges = ['Bybit', 'Bitget', 'MEXC', 'KuCoin', 'Bitunix', 'Hyperliquid', 'GMX', 'Aster', 'Lighter', 'gTrade'];
    for (const ex of exchanges) {
      const url = getExchangeReferralUrl(ex);
      expect(typeof url).toBe('string');
      expect(url).toMatch(/^https?:\/\//);
    }
  });

  it('returned URLs are valid http/https URLs', async () => {
    const { getExchangeReferralUrl } = await import('../referralLinks');
    const url = getExchangeReferralUrl('GMX');
    expect(() => new URL(url!)).not.toThrow();
  });

  it('referral codes appear in the URL (not just stripped query params)', async () => {
    const { getExchangeReferralUrl } = await import('../referralLinks');
    // Hyperliquid has ?join=CODE — confirm the code survives
    const hl = getExchangeReferralUrl('Hyperliquid');
    expect(hl).toContain('SNAKETHER');
  });
});
