import { RawBookData, OrderbookLevel } from '../types';

export async function fetchVariationalQuotes(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const res = await fetchFn('https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();

    const listings = data.listings || data;
    const listing = (Array.isArray(listings) ? listings : Object.values(listings)).find((l: any) => {
      const sym = (l.symbol || l.underlying || '').replace(/-.*/, '').toUpperCase();
      return sym === asset;
    });
    if (!listing) return null;

    const markPrice = parseFloat(listing.markPrice || listing.mark_price || '0');
    if (markPrice <= 0) return null;

    // Tiers are cumulative quotes: bid100k is the fill price for a $100K order
    // (not incremental depth). Convert to incremental levels for the book walker.
    const tiers = [
      { size: 1000, bid: listing.bid1k || listing.bidPrice, ask: listing.ask1k || listing.askPrice },
      { size: 100000, bid: listing.bid100k, ask: listing.ask100k },
      { size: 1000000, bid: listing.bid1m, ask: listing.ask1m },
    ];

    const bids: OrderbookLevel[] = [];
    const asks: OrderbookLevel[] = [];
    let prevBidUsd = 0;
    let prevAskUsd = 0;
    for (const tier of tiers) {
      const bidPrice = parseFloat(tier.bid || '0');
      const askPrice = parseFloat(tier.ask || '0');
      const incrBidUsd = tier.size - prevBidUsd;
      const incrAskUsd = tier.size - prevAskUsd;
      if (bidPrice > 0 && incrBidUsd > 0) {
        const bidSize = incrBidUsd / bidPrice;
        if (isFinite(bidSize)) { bids.push({ price: bidPrice, size: bidSize }); prevBidUsd = tier.size; }
      }
      if (askPrice > 0 && incrAskUsd > 0) {
        const askSize = incrAskUsd / askPrice;
        if (isFinite(askSize)) { asks.push({ price: askPrice, size: askSize }); prevAskUsd = tier.size; }
      }
    }

    return { exchange: 'Variational', bids, asks, midPrice: markPrice, symbol: asset, method: 'quote' };
  } catch { return null; }
}
