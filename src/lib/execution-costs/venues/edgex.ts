import { RawBookData, OrderbookLevel } from '../types';

export async function fetchEdgexBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    // edgeX: contracts come from `getMetaData` (top-level `data.contractList`).
    // The old `/contract/list` path 404s. Depth uses `getDepth?contractId=`.
    const metaRes = await fetchFn('https://pro.edgex.exchange/api/v1/public/meta/getMetaData', { signal: AbortSignal.timeout(5000) });
    if (!metaRes.ok) return null;
    const metaJson = await metaRes.json();

    const contracts = metaJson?.data?.contractList ?? [];
    const contract = (Array.isArray(contracts) ? contracts : []).find((c: any) => {
      const sym = (c.contractName || c.symbol || '').replace(/USD.*/, '').toUpperCase();
      return sym === asset;
    });
    if (!contract) return null;
    const contractId = contract.contractId || contract.id;

    const depthRes = await fetchFn(`https://pro.edgex.exchange/api/v1/public/quote/getDepth?contractId=${contractId}&level=15`, { signal: AbortSignal.timeout(5000) });
    if (!depthRes.ok) return null;
    const depthJson = await depthRes.json();

    // edgeX depth shape: `{ data: [{ bids: [{price,size}], asks: [...] }] }`
    const depthEntry = Array.isArray(depthJson?.data) ? depthJson.data[0] : depthJson?.data;
    const rawBids = depthEntry?.bids ?? [];
    const rawAsks = depthEntry?.asks ?? [];
    if (rawBids.length === 0 && rawAsks.length === 0) return null;

    const bids: OrderbookLevel[] = rawBids.map((b: any) => ({ price: parseFloat(b.price ?? b[0]), size: parseFloat(b.size ?? b.qty ?? b[1]) }));
    const asks: OrderbookLevel[] = rawAsks.map((a: any) => ({ price: parseFloat(a.price ?? a[0]), size: parseFloat(a.size ?? a.qty ?? a[1]) }));
    const midPrice = ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'edgeX', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
