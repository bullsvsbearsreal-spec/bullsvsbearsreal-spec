/**
 * GET /api/account/positions
 *
 * Returns the calling user's open positions (from user_positions, refreshed
 * by the sync-positions cron every 60s) plus a summary roll-up:
 *   { equity, nominal, totalLong, totalShort, leverageLong, leverageShort }
 *
 * Mixes in 24h/48h funding-rate context per (exchange, symbol) by joining
 * with the existing funding_snapshots table (50 days of history). The
 * "current" funding rate column comes from the most-recent row, the 24h/48h
 * average over the matching window.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, isAdmin } from '@/lib/auth';
import { isDBConfigured, listUserPositions, listUserAccountBalances, getSQL } from '@/lib/db';
import { scorePositionHealth } from '@/lib/position-health';
import { dailyFundingCarryUsd } from '@/lib/funding-intervals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

interface FundingContext {
  /** Long-side rate ("longs pay" sign convention). */
  current: number | null;
  avg24h: number | null;
  avg48h: number | null;
  /** Short-side rate ("shorts pay" sign convention) — populated only on
   *  skew-based DEXes where long and short rates have different magnitudes
   *  (GMX V2, gTrade). Null on symmetric venues; caller falls back to `current`. */
  currentShort: number | null;
  avg24hShort: number | null;
  avg48hShort: number | null;
  /** Per-symbol settlement interval in hours from funding_snapshots.
   *  Populated by the snapshot cron when the fetcher reports it (Binance
   *  fundingInfo, MEXC collectCycle, Aster fundingInfo). Null when the
   *  venue is uniform across symbols — caller falls back to the per-
   *  exchange default in intervalHoursFor. */
  intervalH: number | null;
}

/**
 * Strip disambiguation suffixes from a position symbol so the
 * funding-snapshots join uses the canonical ticker.
 *
 * Two cases we strip:
 *   - Chain-disambiguation: GMX Avalanche positions are tagged `(Avax)`
 *     to distinguish from the Arbitrum entry of the same symbol.
 *   - Multi-market disambiguation: GMX returns a "(WBTC.b)" / "(USDC)" /
 *     "(#2)" suffix when the user has multiple isolated positions on the
 *     same symbol/side across different collateral pairs.
 *
 * Without stripping we'd never find a funding row for any disambiguated
 * row because funding_snapshots only stores the bare ticker.
 */
function canonicalSymbol(sym: string): string {
  // Strip any "(...)" suffix at the end of the symbol. Conservative —
  // catches Avax / Arbitrum / collateral-token / "#N" suffixes alike.
  return sym.replace(/\s*\([^()]*\)\s*$/i, '').trim();
}

async function loadFundingContext(
  pairs: { exchange: string; symbol: string }[],
): Promise<Map<string, FundingContext>> {
  const out = new Map<string, FundingContext>();
  if (pairs.length === 0) return out;

  const sql = getSQL();
  // Map (display symbol) → canonical for the SQL filter, but persist the
  // result back under the ORIGINAL display symbol so the upstream lookup
  // by `${exchange}|${symbol}` (which uses the display form) still hits.
  const canonical = pairs.map(p => ({
    ...p,
    canonicalSymbol: canonicalSymbol(p.symbol),
  }));
  const exchanges = canonical.map(p => p.exchange);
  const symbols = canonical.map(p => p.canonicalSymbol);

  // Single query: latest rate + 24h avg + 48h avg per (exchange, symbol).
  // Filter list keeps the working set small even when funding_snapshots
  // has tens of millions of rows. Now also pulls rate_short — the
  // side-specific rate stored by skew-DEXes (GMX V2 / gTrade) where longs
  // and shorts have asymmetric magnitudes due to OI weighting. We derive
  // 24h/48h shorts averages by inverting the long-side avg when no
  // explicit shorts data is available (an approximation that's exact on
  // symmetric venues).
  const rows = await sql`
    WITH wanted AS (
      SELECT * FROM UNNEST(
        ${sql.array(exchanges)}::text[],
        ${sql.array(symbols)}::text[]
      ) AS t(exchange, symbol)
    ),
    latest AS (
      -- Filter f.rate IS NOT NULL AND f.rate <> 0: snapshot cron writes
      -- price-only rows every minute with rate=null going forward (was
      -- rate=0 historically). Without this filter the once-per-minute
      -- placeholder rows out-vote the once-per-10-min real funding ticks
      -- and the displayed rate is always 0.
      -- interval_h is the per-symbol settlement interval (Binance/MEXC
      -- have moved some perps from 8h → 4h; without joining this column
      -- the /positions APR would assume 8h for every symbol).
      SELECT DISTINCT ON (f.exchange, f.symbol)
        f.exchange, f.symbol, f.rate, f.rate_short, f.interval_h
      FROM funding_snapshots f
      JOIN wanted w ON w.exchange = f.exchange AND w.symbol = f.symbol
      WHERE f.ts > NOW() - INTERVAL '6 hours'
        AND f.rate IS NOT NULL
        AND f.rate <> 0
      ORDER BY f.exchange, f.symbol, f.ts DESC
    ),
    avg24 AS (
      SELECT f.exchange, f.symbol,
             AVG(f.rate) AS rate,
             AVG(f.rate_short) FILTER (WHERE f.rate_short IS NOT NULL) AS rate_short
      FROM funding_snapshots f
      JOIN wanted w ON w.exchange = f.exchange AND w.symbol = f.symbol
      WHERE f.ts > NOW() - INTERVAL '24 hours'
        AND f.rate IS NOT NULL
        AND f.rate <> 0
      GROUP BY f.exchange, f.symbol
    ),
    avg48 AS (
      SELECT f.exchange, f.symbol,
             AVG(f.rate) AS rate,
             AVG(f.rate_short) FILTER (WHERE f.rate_short IS NOT NULL) AS rate_short
      FROM funding_snapshots f
      JOIN wanted w ON w.exchange = f.exchange AND w.symbol = f.symbol
      WHERE f.ts > NOW() - INTERVAL '48 hours'
        AND f.rate IS NOT NULL
        AND f.rate <> 0
      GROUP BY f.exchange, f.symbol
    )
    SELECT w.exchange, w.symbol,
           latest.rate         AS current,
           latest.rate_short   AS current_short,
           latest.interval_h   AS interval_h,
           avg24.rate          AS avg24h,
           avg24.rate_short    AS avg24h_short,
           avg48.rate          AS avg48h,
           avg48.rate_short    AS avg48h_short
    FROM wanted w
    LEFT JOIN latest ON latest.exchange = w.exchange AND latest.symbol = w.symbol
    LEFT JOIN avg24  ON avg24.exchange  = w.exchange AND avg24.symbol  = w.symbol
    LEFT JOIN avg48  ON avg48.exchange  = w.exchange AND avg48.symbol  = w.symbol
  `;

  // Build an intermediate map keyed by canonical symbol from the SQL rows…
  const byCanonical = new Map<string, FundingContext>();
  for (const r of rows as any[]) {
    byCanonical.set(`${r.exchange}|${r.symbol}`, {
      current: r.current === null ? null : Number(r.current),
      avg24h: r.avg24h === null ? null : Number(r.avg24h),
      avg48h: r.avg48h === null ? null : Number(r.avg48h),
      currentShort: r.current_short == null ? null : Number(r.current_short),
      avg24hShort: r.avg24h_short == null ? null : Number(r.avg24h_short),
      avg48hShort: r.avg48h_short == null ? null : Number(r.avg48h_short),
      intervalH: r.interval_h == null ? null : Number(r.interval_h),
    });
  }
  // …then re-index back to the ORIGINAL display symbol so callers that look
  // up `${exchange}|${displaySymbol}` (e.g. "GMX|AVAX (Avax)") still find
  // the funding context that came back keyed by "GMX|AVAX".
  for (const p of canonical) {
    const ctx = byCanonical.get(`${p.exchange}|${p.canonicalSymbol}`);
    if (ctx) out.set(`${p.exchange}|${p.symbol}`, ctx);
  }
  return out;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }

  try {
  const [positions, accountBalances] = await Promise.all([
    listUserPositions(session.user.id),
    // TRUE per-exchange equity (cash + uPnL + margin), populated by the
    // sync-positions cron via the optional fetchAccountBalance() helper
    // on each client. Missing rows fall back to margin-sum equity below
    // (preserves behaviour for venues without a balance impl).
    listUserAccountBalances(session.user.id),
  ]);

  // Pull funding context only when we have positions to look up.
  const fundingMap = await loadFundingContext(
    positions.map(p => ({ exchange: p.exchange, symbol: p.symbol })),
  );

  // Diagnostics: ?debug=1 returns which (exchange, symbol) pairs missed
  // the funding-snapshots join. Helps figure out whether the issue is
  // a stale label vs a missing cron ingestion vs a symbol case mismatch.
  // Admin-only — the debug payload includes raw funding_snapshots row
  // counts and timestamps that shouldn't be exposed to arbitrary users.
  const debug = request.nextUrl.searchParams.get('debug') === '1'
    && (await isAdmin(session.user.id));

  // ─── Summary roll-up (matches christian's mockup top row) ───────────
  let totalLong = 0;
  let totalShort = 0;
  let totalMargin = 0;
  let totalUnrealized = 0;
  for (const p of positions) {
    const value = p.positionValue ?? (p.markPrice ? p.size * p.markPrice : p.size * p.entryPrice);
    if (p.side === 'long') totalLong += value;
    else totalShort += value;
    // Use null-checks (not truthiness) — a position at exactly breakeven
    // (unrealizedPnl=0) or in cross-margin mode (marginUsed=0) is valid
    // data we want included in the summary.
    if (p.marginUsed != null) totalMargin += p.marginUsed;
    if (p.unrealizedPnl != null) totalUnrealized += p.unrealizedPnl;
  }
  const nominal = totalLong + totalShort;

  // TRUE equity = sum of per-source account balances (cash + uPnL +
  // margin). Falls back to margin-sum equity when no balance rows exist
  // (preserves old behaviour for sources whose client doesn't implement
  // fetchAccountBalance). This is what christian's MEXC/HL feedback
  // pointed at: previously we summed per-position margin which
  // understated cross-margin accounts by the value of free wallet cash.
  const trueEquityFromBalances = accountBalances.reduce((acc, b) => acc + b.equityUsd, 0);
  const equity = trueEquityFromBalances > 0
    ? trueEquityFromBalances
    : (totalMargin + totalUnrealized);
  const leverageLong = equity > 0 ? totalLong / equity : 0;
  const leverageShort = equity > 0 ? totalShort / equity : 0;

  // ─── Decorate each position with funding context + health score ─────
  let aggregateDailyCarry = 0;
  let dailyCarryHasData = false;
  const decorated = positions.map(p => {
    const fRaw = fundingMap.get(`${p.exchange}|${p.symbol}`) ?? {
      current: null, avg24h: null, avg48h: null,
      currentShort: null, avg24hShort: null, avg48hShort: null,
      intervalH: null,
    };
    // Pick the side-specific rate when the venue stored one. We keep the
    // unified "longs pay" sign convention everywhere (rate > 0 = longs pay,
    // rate < 0 = shorts pay) so the existing fundingTone() coloring logic
    // doesn't change. For a SHORT on a skew DEX where shortsPay magnitude
    // differs from -longsPay, we display -rateShort (= longs-pay equivalent
    // of what shorts actually pay) so the magnitude shown is correct.
    //
    // CEX (rateShort null): rate is already symmetric — show as-is for
    // both sides; fundingTone handles the color.
    const f = p.side === 'short'
      ? {
          current: fRaw.currentShort != null ? -fRaw.currentShort : fRaw.current,
          avg24h:  fRaw.avg24hShort  != null ? -fRaw.avg24hShort  : fRaw.avg24h,
          avg48h:  fRaw.avg48hShort  != null ? -fRaw.avg48hShort  : fRaw.avg48h,
        }
      : {
          current: fRaw.current,
          avg24h: fRaw.avg24h,
          avg48h: fRaw.avg48h,
        };
    // Compute the health score using the per-position funding context the
    // user is paying right now — not the 24h average. The component is
    // sensitive to changes in real time so users notice when funding flips.
    const health = scorePositionHealth({
      side: p.side,
      markPrice: p.markPrice,
      entryPrice: p.entryPrice,
      leverage: p.leverage,
      liquidationPrice: p.liquidationPrice,
      tpPrice: p.tpPrice,
      slPrice: p.slPrice,
      unrealizedPnl: p.unrealizedPnl,
      marginUsed: p.marginUsed,
      currentFunding: f.current,
    });

    // Daily funding cost-of-carry in USD using the live rate. The 30d
    // projection just multiplies by 30 — assumes funding stays flat,
    // which it never does, but it's the rate-card the user wants.
    // Pass intervalH from funding_snapshots so per-symbol 4h venues
    // (Binance high-volume perps, MEXC variable-cycle pairs) compound
    // 24/4h = 6× per day instead of the per-exchange 8h default's 3×.
    const dailyCarry = dailyFundingCarryUsd({
      side: p.side,
      positionValue: p.positionValue,
      currentFundingPct: f.current,
      exchange: p.exchange,
      intervalHoursOverride: fRaw.intervalH,
    });
    if (dailyCarry != null && Number.isFinite(dailyCarry)) {
      aggregateDailyCarry += dailyCarry;
      dailyCarryHasData = true;
    }
    return {
      id: p.id,
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      exchange: p.exchange,
      symbol: p.symbol,
      side: p.side,
      size: p.size,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice,
      positionValue: p.positionValue,
      unrealizedPnl: p.unrealizedPnl,
      leverage: p.leverage,
      marginUsed: p.marginUsed,
      liquidationPrice: p.liquidationPrice,
      tpPrice: p.tpPrice,
      slPrice: p.slPrice,
      cumulativeFunding: p.cumulativeFunding,
      // funding context (rates already in % per native interval — UI doesn't
      // need to re-normalise to display)
      currentFunding: f.current,
      avg24hFunding: f.avg24h,
      avg48hFunding: f.avg48h,
      // Per-symbol funding interval in hours from funding_snapshots
      // (null when the venue is uniform across symbols; UI falls back
      // to intervalHoursFor on the exchange label). Sent to /positions
      // so the displayed APR uses the right 24/intervalH compounding
      // per row instead of assuming the per-exchange default.
      fundingIntervalHours: fRaw.intervalH,
      // Position health score (0-100) + label + factor breakdown for tooltip
      healthScore: health.score,
      healthLabel: health.label,
      healthFactors: health.factors,
      healthReasons: health.reasons,
      // Per-position daily funding cost projection in USD (positive = user
      // receives, negative = user pays). Assumes the current rate holds.
      dailyFundingCarryUsd: dailyCarry,
      updatedAt: p.updatedAt,
    };
  });

  // Build debug payload only when explicitly asked (admin / dev tooling).
  let debugPayload: Record<string, unknown> | undefined;
  if (debug) {
    const sql = getSQL();
    const missing = positions
      .filter(p => {
        const f = fundingMap.get(`${p.exchange}|${p.symbol}`);
        return !f || (f.current == null && f.avg24h == null && f.avg48h == null);
      })
      .map(p => ({ exchange: p.exchange, symbol: p.symbol, side: p.side }));
    // What does funding_snapshots actually have for those pairs (any time)?
    const exList = Array.from(new Set(missing.map(m => m.exchange)));
    const symList = Array.from(new Set(missing.map(m => m.symbol)));
    const evidenceRows = exList.length > 0 && symList.length > 0
      ? await sql`
          SELECT exchange, symbol, MAX(ts) AS last_ts, COUNT(*) AS row_count
          FROM funding_snapshots
          WHERE exchange = ANY(${sql.array(exList)}::text[])
            AND symbol   = ANY(${sql.array(symList)}::text[])
          GROUP BY exchange, symbol
        `
      : [];
    debugPayload = {
      missingPairs: missing,
      evidenceForMissing: evidenceRows,
      fundingMapKeys: Array.from(fundingMap.keys()),
    };
  }

  return NextResponse.json(
    {
      summary: {
        equity,
        nominal,
        totalLong,
        totalShort,
        leverageLong,
        leverageShort,
        totalUnrealizedPnl: totalUnrealized,
        // Aggregate daily funding carry across the user's full book.
        // null if NO position had a known current rate (rare — would
        // mean every venue's funding column is dark right now).
        dailyFundingCarryUsd: dailyCarryHasData ? aggregateDailyCarry : null,
        // True/computed flag: lets the UI hint whether the equity figure
        // came from real account-balance fetches (true) or from the
        // margin-sum fallback (computed). Useful for the per-exchange
        // tooltip in /positions.
        equitySource: trueEquityFromBalances > 0 ? 'true' : 'computed',
      },
      // Per-source account balances (cash + uPnL + margin). Empty array
      // when no client has implemented fetchAccountBalance yet. The UI
      // uses this for the per-exchange equity breakdown row.
      accountBalances: accountBalances.map(b => ({
        sourceType: b.sourceType,
        sourceId: b.sourceId,
        exchange: b.exchange,
        equityUsd: b.equityUsd,
        availableUsd: b.availableUsd,
        marginUsedUsd: b.marginUsedUsd,
        updatedAt: b.updatedAt,
      })),
      positions: decorated,
      ts: Date.now(),
      ...(debugPayload ? { debug: debugPayload } : {}),
    },
    { headers: NO_STORE },
  );
  } catch (e) {
    // Without this guard a transient DB blip or one-off query timeout
    // bubbles up as a generic 500 with a stack trace in dev — partners
    // and signed-in users would see an unhandled Next.js error page
    // instead of a clean JSON response their dashboard can render.
    console.error('account/positions error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'Failed to load positions' },
      { status: 500, headers: NO_STORE },
    );
  }
}
