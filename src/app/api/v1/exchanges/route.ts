import { NextRequest, NextResponse } from 'next/server';
import {
  ALL_EXCHANGES, EXCHANGE_FEES, isExchangeDex, getExchangeTradeUrl,
  FEE_MODEL_VERSION, FEE_MODEL_UPDATED_AT,
} from '@/lib/constants/exchanges';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { intervalHoursFor } from '@/lib/funding-intervals';

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
  // Derive from the canonical map in lib/funding-intervals.ts so adding
  // a new exchange (Blofin = 8h in May 2026) automatically surfaces here
  // without a separate update. Previously hardcoded and drifted: Blofin /
  // BitMEX / Backpack / Orderly / Paradex / edgeX / Nado were all missing
  // and showed "unknown" to partners hitting /api/v1/exchanges.
  const intervalHToBucket = (h: number): string => {
    if (h === 1) return '1h';
    if (h === 2) return '2h';
    if (h === 4) return '4h';
    if (h === 8) return '8h';
    if (h === 24) return '24h';
    return `${h}h`;
  };

  // Whether /api/v1/funding emits a populated `predictedRate` field for
  // pairs on this venue. Saves partners the trial-and-error of hitting
  // /funding and counting populated vs null. Added after AB-Samurai
  // reported the discovery process (May 2026 coverage push).
  //
  // `source` describes how the value is derived:
  //   - 'native'           — venue exposes a real next-window prediction
  //                          field (CoinEx, OKX, Orderly, dYdX, HL).
  //   - 'binance-formula'  — we compute clamp((mark-index)/index, ±0.05%)
  //                          + 0.01% from the venue's own mark + index.
  //   - 'continuous'       — venue uses a continuous velocity model;
  //                          current rate IS the next-window expectation
  //                          (gTrade).
  //   - null               — venue doesn't expose mark + index in a way
  //                          we can use; predictedRate is null on
  //                          /funding rows for this venue.
  const PREDICTED_RATE: Record<string, 'native' | 'binance-formula' | 'continuous' | null> = {
    'Binance': 'binance-formula', 'Bybit': 'binance-formula', 'Bitget': 'binance-formula',
    'BingX': 'binance-formula', 'Aster': 'binance-formula', 'Aevo': 'binance-formula',
    'Coinbase': 'binance-formula', 'Phemex': 'binance-formula', 'MEXC': 'binance-formula',
    'Deribit': 'binance-formula', 'Extended': 'binance-formula', 'WhiteBIT': 'binance-formula',
    'Backpack': 'binance-formula', 'Paradex': 'binance-formula', 'edgeX': 'binance-formula',
    'KuCoin': 'binance-formula', 'Bitfinex': 'binance-formula',
    // Gate.io: contracts endpoint exposes mark_price + index_price.
    // Bitunix: uses lastPrice as index (approximation for thin pairs).
    'Gate.io': 'binance-formula', 'Bitunix': 'binance-formula',
    'OKX': 'native', 'CoinEx': 'native', 'Hyperliquid': 'native', 'Orderly': 'native',
    'Kraken': 'native', 'dYdX': 'native',
    // BitMEX: prefers their native indicativeFundingRate, falls back to
    // Binance formula on (markPrice, indicativeSettlePrice).
    'BitMEX': 'native',
    'gTrade': 'continuous',
    'HTX': null, 'GMX': null, 'Variational': null, 'Nado': null, 'Lighter': null,
  };

  const exchanges = ALL_EXCHANGES.map(name => {
    const fees = EXCHANGE_FEES[name];
    const isDex = isExchangeDex(name);
    const tradeUrl = getExchangeTradeUrl(name, 'BTC');
    const predictedSource = PREDICTED_RATE[name] ?? null;

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
      fundingInterval: intervalHToBucket(intervalHoursFor(name)),
      // Partner discoverability for the predictedRate coverage matrix.
      // `true` means /api/v1/funding rows for this venue will have a
      // non-null `predictedRate` field. `false` means it's intentionally
      // null because the venue doesn't expose the needed inputs.
      supportsPredictedRate: predictedSource !== null,
      predictedRateSource: predictedSource,
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
