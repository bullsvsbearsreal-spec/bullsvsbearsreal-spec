/**
 * GET /api/options?currency=BTC
 *
 * Proxies Deribit public API for options data.
 * Returns max pain, put/call ratio, open interest by strike, and IV data.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

interface DeribitInstrument {
  instrument_name: string;
  option_type: string;
  strike: number;
  expiration_timestamp: number;
  open_interest: number;
  mark_iv: number;
  underlying_price: number;
  bid_price: number;
  ask_price: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const currency = (searchParams.get('currency') || 'BTC').toUpperCase();

  if (!['BTC', 'ETH'].includes(currency)) {
    return NextResponse.json({ error: 'Only BTC and ETH options supported' }, { status: 400 });
  }

  try {
    // Fetch all option instruments with their book summaries
    const res = await fetch(
      `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`,
      { next: { revalidate: 60 } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Deribit returned ${res.status}` }, { status: 502 });
    }

    const json = await res.json();
    const instruments: any[] = json.result || [];

    if (instruments.length === 0) {
      return NextResponse.json({ error: 'No options data available' }, { status: 404 });
    }

    // Get underlying price
    const underlyingPrice = instruments[0]?.underlying_price || 0;

    // Parse instruments
    const options: DeribitInstrument[] = instruments.map((inst: any) => {
      // Parse instrument name: BTC-28FEB25-95000-C
      const parts = inst.instrument_name.split('-');
      const strike = parseFloat(parts[2]) || 0;
      const optionType = parts[3] === 'C' ? 'call' : 'put';
      const expiryStr = parts[1];

      return {
        instrument_name: inst.instrument_name,
        option_type: optionType,
        strike,
        expiration_timestamp: inst.creation_timestamp, // approximate
        open_interest: (inst.open_interest || 0) * underlyingPrice, // Convert from coins to USD
        mark_iv: inst.mark_iv || 0,
        underlying_price: underlyingPrice,
        bid_price: inst.bid_price || 0,
        ask_price: inst.ask_price || 0,
      };
    });

    // Calculate per-strike OI
    const strikeOI = new Map<number, { callOI: number; putOI: number }>();
    options.forEach((opt) => {
      const entry = strikeOI.get(opt.strike) || { callOI: 0, putOI: 0 };
      if (opt.option_type === 'call') entry.callOI += opt.open_interest;
      else entry.putOI += opt.open_interest;
      strikeOI.set(opt.strike, entry);
    });

    // Calculate max pain (strike where total loss is minimized)
    const strikes: number[] = [];
    strikeOI.forEach((_, k) => strikes.push(k));
    strikes.sort((a, b) => a - b);

    let maxPainStrike = underlyingPrice;
    let minTotalLoss = Infinity;

    strikes.forEach((testPrice) => {
      let totalLoss = 0;
      strikeOI.forEach((oi, strike) => {
        // Call loss at test price
        if (testPrice > strike) {
          totalLoss += oi.callOI * (testPrice - strike) / underlyingPrice;
        }
        // Put loss at test price
        if (testPrice < strike) {
          totalLoss += oi.putOI * (strike - testPrice) / underlyingPrice;
        }
      });
      if (totalLoss < minTotalLoss) {
        minTotalLoss = totalLoss;
        maxPainStrike = testPrice;
      }
    });

    // Put/call ratio
    let totalCallOI = 0;
    let totalPutOI = 0;
    strikeOI.forEach((oi) => {
      totalCallOI += oi.callOI;
      totalPutOI += oi.putOI;
    });
    const putCallRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

    // Build strike data for chart (filter to relevant range around spot)
    const relevantStrikes: Array<{
      strike: number;
      callOI: number;
      putOI: number;
    }> = [];
    const lowerBound = underlyingPrice * 0.7;
    const upperBound = underlyingPrice * 1.3;
    strikeOI.forEach((oi, strike) => {
      if (strike >= lowerBound && strike <= upperBound) {
        relevantStrikes.push({ strike, ...oi });
      }
    });
    relevantStrikes.sort((a, b) => a.strike - b.strike);

    // IV by strike (smile)
    const ivSmile: Array<{ strike: number; callIV: number; putIV: number }> = [];
    const ivByStrike = new Map<number, { callIVs: number[]; putIVs: number[] }>();
    options.forEach((opt) => {
      if (opt.strike >= lowerBound && opt.strike <= upperBound && opt.mark_iv > 0) {
        const entry = ivByStrike.get(opt.strike) || { callIVs: [], putIVs: [] };
        if (opt.option_type === 'call') entry.callIVs.push(opt.mark_iv);
        else entry.putIVs.push(opt.mark_iv);
        ivByStrike.set(opt.strike, entry);
      }
    });
    ivByStrike.forEach((ivs, strike) => {
      const avgCallIV = ivs.callIVs.length > 0 ? ivs.callIVs.reduce((s, v) => s + v, 0) / ivs.callIVs.length : 0;
      const avgPutIV = ivs.putIVs.length > 0 ? ivs.putIVs.reduce((s, v) => s + v, 0) / ivs.putIVs.length : 0;
      ivSmile.push({ strike, callIV: avgCallIV, putIV: avgPutIV });
    });
    ivSmile.sort((a, b) => a.strike - b.strike);

    return NextResponse.json({
      currency,
      underlyingPrice,
      maxPain: maxPainStrike,
      putCallRatio,
      totalCallOI,
      totalPutOI,
      totalOI: totalCallOI + totalPutOI,
      instrumentCount: instruments.length,
      strikeData: relevantStrikes,
      ivSmile,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch options data' },
      { status: 500 },
    );
  }
}
