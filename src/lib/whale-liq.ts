/**
 * Whale Liquidation Roulette — flatten the existing /api/hl-whales whale
 * data into a per-position feed sorted by proximity-to-liquidation.
 *
 * Pure compute on top of the warm /api/hl-whales cache. No new ingestion
 * or DB needed — just a transform + sort.
 *
 * Scope: Hyperliquid only for now (clearinghouseState exposes liq price
 * publicly for any address). GMX V2 + gTrade liq prices would require
 * pulling per-position margin maintenance details — defer to v2.
 */

export interface WhaleLiqRow {
  /** Whale address (full, lowercased). */
  address: string;
  /** Display label from leaderboard or "Custom" / truncated address. */
  label: string;
  /** Account-level USD net asset value at HL. */
  accountValue: number;
  exchange: 'Hyperliquid';
  /** Coin / symbol. */
  coin: string;
  side: 'long' | 'short';
  /** Position size in coin units. */
  size: number;
  /** USD notional. */
  positionValue: number;
  /** Implied current mark price (positionValue / size). */
  markPrice: number;
  /** Liq price reported by HL clearinghouseState. */
  liquidationPrice: number;
  /** Distance to liq as a fraction of mark (0..1). 0.05 = 5% buffer. */
  distancePct: number;
  /** Realised + open PnL on this position. */
  unrealizedPnl: number;
  /** Reported leverage (effective, post-margin). */
  leverage: number;
  /** Account-level all-time PnL where available. */
  allTimePnl?: number;
  /** Account-level all-time ROI where available. */
  allTimeRoi?: number;
}

export interface WhaleLiqFeed {
  ts: number;
  rows: WhaleLiqRow[];
  /** Total whales scanned (after filter to those with at least one position). */
  scanned: number;
  /** Total open positions across scanned whales. */
  positionsTotal: number;
  /** Positions within 5% of liquidation (the spicy slice). */
  withinFive: number;
  /** Positions within 10% of liquidation. */
  withinTen: number;
}

interface WhaleData {
  address: string;
  label: string;
  accountValue: number;
  totalNotional: number;
  marginUsed: number;
  withdrawable: number;
  positionCount: number;
  positions: Array<{
    coin: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    positionValue: number;
    unrealizedPnl: number;
    roe: number;
    leverage: number;
    liquidationPrice: number | null;
    marginUsed: number;
    cumulativeFunding: number;
  }>;
  lastUpdated: number;
  allTimePnl?: number;
  allTimeRoi?: number;
}

/**
 * Distance from current mark to liquidation price, as a fraction of mark.
 * Returns null when:
 *   - mark or liq is non-positive / non-finite
 *   - position is already past liquidation (distance < 0)
 *
 * For long positions, distance is positive when mark > liq (still safe).
 * For short positions, distance is positive when mark < liq (still safe).
 *
 * Exported for unit testability — the inline math used to live in
 * buildWhaleLiqFeed which can't be tested without spinning up a fake
 * /api/hl-whales server.
 */
export function liqDistancePct(
  side: 'long' | 'short',
  markPrice: number,
  liquidationPrice: number,
): number | null {
  if (!Number.isFinite(markPrice) || markPrice <= 0) return null;
  if (!Number.isFinite(liquidationPrice) || liquidationPrice <= 0) return null;
  const distance = side === 'long'
    ? (markPrice - liquidationPrice) / markPrice
    : (liquidationPrice - markPrice) / markPrice;
  if (!Number.isFinite(distance) || distance < 0) return null;
  return distance;
}

/**
 * Build the roulette feed by reading the warm /api/hl-whales cache. Caller
 * passes the origin so this lib stays pure (testable + reusable from
 * cron/api-route alike).
 */
export async function buildWhaleLiqFeed(origin: string): Promise<WhaleLiqFeed> {
  const ts = Date.now();
  let whales: WhaleData[] = [];
  try {
    const res = await fetch(`${origin}/api/hl-whales`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      whales = (await res.json()) as WhaleData[];
    }
  } catch { /* ignore — return empty feed */ }

  const rows: WhaleLiqRow[] = [];

  for (const w of whales) {
    if (!w.positions || w.positions.length === 0) continue;
    for (const p of w.positions) {
      if (p.liquidationPrice == null || p.liquidationPrice <= 0) continue;
      if (!Number.isFinite(p.size) || p.size === 0) continue;
      const sizeAbs = Math.abs(p.size);
      const markPrice = sizeAbs > 0 ? p.positionValue / sizeAbs : 0;
      if (!Number.isFinite(markPrice) || markPrice <= 0) continue;

      const distance = liqDistancePct(p.side, markPrice, p.liquidationPrice);
      if (distance == null) continue; // already past liq, malformed inputs — skip

      rows.push({
        address: w.address,
        label: w.label,
        accountValue: w.accountValue,
        exchange: 'Hyperliquid',
        coin: p.coin,
        side: p.side,
        size: sizeAbs,
        positionValue: p.positionValue,
        markPrice,
        liquidationPrice: p.liquidationPrice,
        distancePct: distance,
        unrealizedPnl: p.unrealizedPnl,
        leverage: p.leverage,
        allTimePnl: w.allTimePnl,
        allTimeRoi: w.allTimeRoi,
      });
    }
  }

  // Closest-to-liq first.
  rows.sort((a, b) => a.distancePct - b.distancePct);

  return {
    ts,
    rows,
    scanned: whales.length,
    positionsTotal: rows.length,
    withinFive: rows.filter(r => r.distancePct < 0.05).length,
    withinTen: rows.filter(r => r.distancePct < 0.10).length,
  };
}
