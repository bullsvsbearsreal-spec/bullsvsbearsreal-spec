/**
 * Tests for the shared edgeX helper. Covers the symbol parser (used
 * by all three callers) and one end-to-end fetch shape via mocked
 * fetch, so we lock in the contract that:
 *   · meta failure returns []
 *   · empty contract list returns []
 *   · per-ticker failures don't blow up the whole fetch — they just
 *     show up as `ticker: null` in the result
 *   · result rows are 1:1 with the limited contract list
 */
import { describe, it, expect, vi } from 'vitest';
import { fetchEdgeXTickers, edgeXBaseSymbol } from '../edgex';

describe('edgeXBaseSymbol', () => {
  it('strips USD/USDT/USDC suffix', () => {
    expect(edgeXBaseSymbol('BTCUSD')).toBe('BTC');
    expect(edgeXBaseSymbol('ETHUSDT')).toBe('ETH');
    expect(edgeXBaseSymbol('SOLUSDC')).toBe('SOL');
  });
  it('uppercases the result', () => {
    expect(edgeXBaseSymbol('btcusd')).toBe('BTC');
  });
  it('returns empty for empty / undefined input', () => {
    expect(edgeXBaseSymbol('')).toBe('');
    expect(edgeXBaseSymbol(undefined)).toBe('');
  });
  it('returns unchanged when no USD suffix is present', () => {
    // edgeX contract names always have USD/USDT — but be defensive.
    expect(edgeXBaseSymbol('BTC')).toBe('BTC');
  });
});

/** Tiny helper: build a Response-shaped object the fetch wrapper
 *  returns. Matches the contract `fetchWithTimeout` produces. */
function mockJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => body,
  } as unknown as Response;
}

describe('fetchEdgeXTickers — meta failure', () => {
  it('returns [] and warns when meta fetch is not ok', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchFn = vi.fn().mockResolvedValue(mockJsonResponse({}, false, 403));
    const result = await fetchEdgeXTickers(fetchFn as never, 'funding');
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[funding/edgeX] meta fetch failed: 403'));
    warn.mockRestore();
  });

  it('returns [] when contract list is empty', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      mockJsonResponse({ code: 'SUCCESS', data: { contractList: [] } }),
    );
    const result = await fetchEdgeXTickers(fetchFn as never, 'tickers');
    expect(result).toEqual([]);
    // Only meta call was made — no per-ticker calls
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('skips stock contracts by default', async () => {
    const fetchFn = vi.fn()
      // First call: meta
      .mockResolvedValueOnce(mockJsonResponse({
        code: 'SUCCESS',
        data: {
          contractList: [
            { contractId: '1', contractName: 'BTCUSD', enableTrade: true, isStock: false },
            { contractId: '2', contractName: 'AAPLUSD', enableTrade: true, isStock: true },
          ],
        },
      }))
      // Subsequent calls: per-ticker fetches
      .mockResolvedValue(mockJsonResponse({ code: 'SUCCESS', data: [{ contractId: '1', contractName: 'BTCUSD', lastPrice: '50000' }] }));

    const result = await fetchEdgeXTickers(fetchFn as never, 'funding');
    expect(result).toHaveLength(1);
    expect(result[0].contract.contractName).toBe('BTCUSD');
  });

  it('includes stock contracts when includeStocks=true', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({
        code: 'SUCCESS',
        data: {
          contractList: [
            { contractId: '1', contractName: 'BTCUSD', enableTrade: true, isStock: false },
            { contractId: '2', contractName: 'AAPLUSD', enableTrade: true, isStock: true },
          ],
        },
      }))
      .mockResolvedValue(mockJsonResponse({ code: 'SUCCESS', data: [{ contractId: '1', contractName: 'BTCUSD', lastPrice: '50000' }] }));

    const result = await fetchEdgeXTickers(fetchFn as never, 'tickers', { includeStocks: true });
    expect(result).toHaveLength(2);
  });
});

describe('fetchEdgeXTickers — per-ticker failures are tolerated', () => {
  it('null ticker rows pass through (does not crash the whole fetch)', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({
        code: 'SUCCESS',
        data: {
          contractList: [
            { contractId: '1', contractName: 'BTCUSD', enableTrade: true },
            { contractId: '2', contractName: 'ETHUSD', enableTrade: true },
            { contractId: '3', contractName: 'SOLUSD', enableTrade: true },
          ],
        },
      }))
      // First per-ticker call: ok
      .mockResolvedValueOnce(mockJsonResponse({ code: 'SUCCESS', data: [{ contractId: '1', contractName: 'BTCUSD', lastPrice: '50000' }] }))
      // Second: upstream 502 — null
      .mockResolvedValueOnce(mockJsonResponse({}, false, 502))
      // Third: throws → caught as null
      .mockRejectedValueOnce(new Error('network error'));

    const result = await fetchEdgeXTickers(fetchFn as never, 'oi');
    expect(result).toHaveLength(3);
    expect(result[0].ticker).not.toBeNull();
    expect(result[1].ticker).toBeNull();
    expect(result[2].ticker).toBeNull();
  });
});

describe('fetchEdgeXTickers — limit', () => {
  it('truncates contract list to first 30', async () => {
    const big = Array.from({ length: 50 }, (_, i) => ({
      contractId: String(i + 1),
      contractName: `T${i}USD`,
      enableTrade: true,
    }));
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({ code: 'SUCCESS', data: { contractList: big } }))
      .mockResolvedValue(mockJsonResponse({ code: 'SUCCESS', data: [{ lastPrice: '1' }] }));

    const result = await fetchEdgeXTickers(fetchFn as never, 'funding');
    expect(result).toHaveLength(30);
    // 1 meta call + 30 per-ticker calls = 31
    expect(fetchFn).toHaveBeenCalledTimes(31);
  });
});
