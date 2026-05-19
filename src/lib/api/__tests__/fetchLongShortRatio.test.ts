import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('fetchLongShortRatio', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed { longRatio, shortRatio } on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ longRatio: 65, shortRatio: 35 }), { status: 200 }),
    );
    const { fetchLongShortRatio } = await import('../aggregator');
    const result = await fetchLongShortRatio('BTCUSDT');
    expect(result.longRatio).toBe(65);
    expect(result.shortRatio).toBe(35);
  });

  it('passes the symbol as a query param', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ longRatio: 50, shortRatio: 50 }), { status: 200 }),
    );
    const { fetchLongShortRatio } = await import('../aggregator');
    await fetchLongShortRatio('ETHUSDT');
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('symbol=ETHUSDT');
  });

  it('defaults to BTCUSDT when no symbol given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ longRatio: 50, shortRatio: 50 }), { status: 200 }),
    );
    const { fetchLongShortRatio } = await import('../aggregator');
    await fetchLongShortRatio();
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('symbol=BTCUSDT');
  });

  it('returns {50, 50} fallback on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('rate limited', { status: 429 }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fetchLongShortRatio } = await import('../aggregator');
    const result = await fetchLongShortRatio('BTCUSDT');
    expect(result).toEqual({ longRatio: 50, shortRatio: 50 });
  });

  it('returns {50, 50} fallback on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ETIMEDOUT'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fetchLongShortRatio } = await import('../aggregator');
    const result = await fetchLongShortRatio('BTCUSDT');
    expect(result).toEqual({ longRatio: 50, shortRatio: 50 });
  });

  it('caches per-symbol — same symbol does not refetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ longRatio: 60, shortRatio: 40 }), { status: 200 }))
    );
    const { fetchLongShortRatio } = await import('../aggregator');
    await fetchLongShortRatio('BTCUSDT');
    await fetchLongShortRatio('BTCUSDT');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Different symbol → fresh fetch
    await fetchLongShortRatio('ETHUSDT');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
