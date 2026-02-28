import { RawBookData, OrderbookLevel } from '../types';

export async function fetchEdgexBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const metaRes = await fetchFn('https://pro.edgex.exchange/api/v1/public/contract/list', { signal: AbortSignal.timeout(5000) });
    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();

    const contracts = metaData.data || metaData;
    const contract = (Array.isArray(contracts) ? contracts : []).find((c: any) => {
      const sym = (c.contractName || c.symbol || '').replace(/USD.*/, '').toUpperCase();
      return sym === asset;
    });
    if (!contract) return null;
    const contractId = contract.contractId || contract.id;

    const depthRes = await fetchFn(`https://pro.edgex.exchange/api/v1/public/quote/depth?contractId=${contractId}`, { signal: AbortSignal.timeout(5000) });
    if (!depthRes.ok) return null;
    const depthData = await depthRes.json();

    const rawBids = depthData.data?.bids || depthData.bids || [];
    const rawAsks = depthData.data?.asks || depthData.asks || [];

    const bids: OrderbookLevel[] = rawBids.map((b: any) => ({ price: parseFloat(b.price || b[0]), size: parseFloat(b.qty || b.size || b[1]) }));
    const asks: OrderbookLevel[] = rawAsks.map((a: any) => ({ price: parseFloat(a.price || a[0]), size: parseFloat(a.qty || a.size || a[1]) }));
    const midPrice = ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'edgeX', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
