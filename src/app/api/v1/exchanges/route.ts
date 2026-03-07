import { NextRequest, NextResponse } from 'next/server';
import { ALL_EXCHANGES, EXCHANGE_FEES, isExchangeDex, getExchangeTradeUrl } from '@/lib/constants/exchanges';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';

/**
 * GET /api/v1/exchanges
 *
 * Returns metadata for all supported exchanges including fees,
 * funding intervals, and trade URLs.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;
  const FUNDING_INTERVALS: Record<string, string> = {
    'Binance': '8h', 'Bybit': '8h', 'OKX': '8h', 'Bitget': '8h',
    'MEXC': '8h', 'BingX': '8h', 'Phemex': '8h', 'KuCoin': '8h',
    'Deribit': '8h', 'HTX': '8h', 'Bitfinex': '8h', 'WhiteBIT': '8h',
    'CoinEx': '8h', 'Aster': '8h', 'gTrade': '8h', 'Bitunix': '8h',
    'Kraken': '4h',
    'Hyperliquid': '1h', 'dYdX': '1h', 'Aevo': '1h', 'Coinbase': '1h',
    'Drift': '1h', 'GMX': '1h', 'Extended': '1h', 'Lighter': '1h',
    'Variational': '1h',
  };

  const exchanges = ALL_EXCHANGES.map(name => {
    const fees = EXCHANGE_FEES[name];
    const isDex = isExchangeDex(name);
    const tradeUrl = getExchangeTradeUrl(name, 'BTC');

    return {
      name,
      type: isDex ? 'dex' : 'cex',
      fees: fees ? {
        takerPct: fees.taker,
        makerPct: fees.maker,
        roundTripPct: fees.taker * 2,
      } : null,
      fundingInterval: FUNDING_INTERVALS[name] || 'unknown',
      tradeUrlPattern: tradeUrl ? tradeUrl.replace('BTC', '{SYMBOL}') : null,
    };
  });

  return NextResponse.json({
    success: true,
    data: exchanges,
    meta: {
      total: exchanges.length,
      cex: exchanges.filter(e => e.type === 'cex').length,
      dex: exchanges.filter(e => e.type === 'dex').length,
      timestamp: Date.now(),
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  });
}
