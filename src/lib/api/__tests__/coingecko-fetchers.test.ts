import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('getCoinData', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed coin data on a successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }), { status: 200 }),
    );
    const { getCoinData } = await import('../coingecko');
    const result = await getCoinData('bitcoin');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('bitcoin');
  });

  it('returns null when the proxy returns non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream down', { status: 503 }),
    );
    const { getCoinData } = await import('../coingecko');
    const result = await getCoinData('bitcoin');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ENOTFOUND'));
    const { getCoinData } = await import('../coingecko');
    const result = await getCoinData('bitcoin');
    expect(result).toBeNull();
  });

  it('caches the result — second call within TTL does not refetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'ethereum' }), { status: 200 }),
    );
    const { getCoinData } = await import('../coingecko');
    await getCoinData('ethereum');
    await getCoinData('ethereum');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('passes the slug as a URL-encoded query param', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'wrapped-bitcoin' }), { status: 200 }),
    );
    const { getCoinData } = await import('../coingecko');
    await getCoinData('wrapped-bitcoin');
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('slug=wrapped-bitcoin');
  });
});

describe('getGlobalData', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed global stats on success', async () => {
    const stats = {
      total_market_cap: { usd: 2_500_000_000_000 },
      market_cap_percentage: { btc: 52.3 },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(stats), { status: 200 }),
    );
    const { getGlobalData } = await import('../coingecko');
    const result = await getGlobalData();
    expect(result.total_market_cap.usd).toBe(2_500_000_000_000);
  });

  it('returns null on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('down', { status: 503 }),
    );
    const { getGlobalData } = await import('../coingecko');
    const result = await getGlobalData();
    expect(result).toBeNull();
  });

  it('returns the "unavailable" sentinel verbatim (caller distinguishes)', async () => {
    const unavailable = { unavailable: true, total_market_cap: { usd: 0 } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(unavailable), { status: 200 }),
    );
    const { getGlobalData } = await import('../coingecko');
    const result = await getGlobalData();
    expect(result.unavailable).toBe(true);
  });

  it('does NOT cache the unavailable sentinel — second call refetches', async () => {
    // Bug-fix lock: previously the cache pinned `unavailable=true` for 10
    // min, leaving the homepage showing "$0 mcap" as authoritative even
    // after upstream recovered. Source comment in coingecko.ts documents
    // this behaviour.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ unavailable: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ total_market_cap: { usd: 1e12 } }), { status: 200 }));
    const { getGlobalData } = await import('../coingecko');
    const first = await getGlobalData();
    const second = await getGlobalData();
    expect(first.unavailable).toBe(true);
    expect(second.total_market_cap.usd).toBe(1e12);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    const { getGlobalData } = await import('../coingecko');
    const result = await getGlobalData();
    expect(result).toBeNull();
  });
});
