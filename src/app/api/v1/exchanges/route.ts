import { NextRequest, NextResponse } from 'next/server';
import {
  ALL_EXCHANGES, EXCHANGE_FEES, isExchangeDex, getExchangeTradeUrl,
  FEE_MODEL_VERSION, FEE_MODEL_UPDATED_AT,
} from '@/lib/constants/exchanges';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

/**
 * GET /api/v1/exchanges
 *
 * Returns metadata for all supported exchanges including fees,
 * funding intervals, and trade URLs.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  try {
  const FUNDING_INTERVALS: Record<string, string> = {
    'Binance': '8h', 'Bybit': '8h', 'OKX': '8h', 'Bitget': '8h',
    'MEXC': '8h', 'BingX': '8h', 'Phemex': '8h', 'KuCoin': '8h',
    'Deribit': '8h', 'HTX': '8h', 'Bitfinex': '8h', 'WhiteBIT': '8h',
    'CoinEx': '8h', 'Aster': '8h', 'gTrade': '8h', 'Bitunix': '8h',
    'Kraken': '4h',
    'Hyperliquid': '1h', 'dYdX': '1h', 'Aevo': '1h', 'Coinbase': '1h',
    'GMX': '1h', 'Extended': '1h', 'Lighter': '1h',
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
        // `roundTripPct` is the taker-on-both-sides round trip — the most
        // common assumption for partner fee modeling and matches the
        // legacy semantic of this field. Maker-on-both-sides + mixed
        // (taker open / maker close) are exposed separately so partners
        // who quote post-only fills can compute net spread under their
        // own fill model without having to multiply.
        roundTripPct:      fees.taker * 2,
        roundTripTakerPct: fees.taker * 2,
        roundTripMakerPct: fees.maker * 2,
        // For venues with negative maker (Nado / Hyperliquid VIP / etc.)
        // a maker-on-both-sides round trip is a rebate, not a cost —
        // `roundTripMakerPct` will be negative there.
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
      // Surface the same fee-model identifiers as /arbitrage + /spreads
      // so /exchanges callers can use this endpoint as their canonical
      // fee-schedule source and only refresh when version changes.
      feeModel: {
        version: FEE_MODEL_VERSION,
        updatedAt: FEE_MODEL_UPDATED_AT,
        unit: 'percent',
      },
    },
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      'X-Fee-Model-Version': FEE_MODEL_VERSION,
      'X-Fee-Model-Updated-At': FEE_MODEL_UPDATED_AT,
      ...auth.headers,
    },
  });
  } catch (e) {
    console.error('v1/exchanges error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      {
        status: 500,
        // Even on 500 we expose the fee-model version so partners doing
        // HEAD-based version polling can still detect schedule bumps
        // during a transient origin error.
        headers: {
          'X-Fee-Model-Version': FEE_MODEL_VERSION,
          'X-Fee-Model-Updated-At': FEE_MODEL_UPDATED_AT,
        },
      },
    );
  }
}
