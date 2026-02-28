import { RawBookData } from '../types';

export async function fetchExtendedBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const res = await fetchFn('https://api.starknet.extended.exchange/api/v1/info/markets', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();

    const markets = Array.isArray(data) ? data : data.markets || [];
    const market = markets.find((m: any) => {
      const sym = (m.symbol || m.name || '').replace(/-.*/, '').toUpperCase();
      return sym === asset;
    });
    if (!market || !market.markPrice) return null;

    // Extended has no public orderbook API — only mark price available.
    // Return null so the calculator marks it as unavailable rather than
    // showing it with zero slippage (which would misleadingly rank it #1).
    return null;
  } catch { return null; }
}
