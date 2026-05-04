/**
 * GET /api/fomc-playbook
 *
 * Historical 24h BTC reactions to FOMC rate decisions, plus the
 * countdown to the next meeting. Curated meeting dates (Fed publishes
 * the calendar a year out, so this list is hand-maintained).
 *
 * Uses CoinGecko's /coins/{id}/market_chart/range for historical close
 * lookups. Free, no auth. L1 cached 6 hours — historical reactions
 * don't change.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface MeetingMeta {
  /** ISO date of the FOMC announcement (US Eastern → UTC). Decisions
   *  release 14:00 ET ≈ 18:00 UTC normally; we use noon UTC of the date
   *  for simplicity. */
  date: string;
  /** Decision summary if known (post-meeting). */
  decision?: string;
}

interface MeetingResult extends MeetingMeta {
  isPast: boolean;
  daysUntil: number;
  /** Price at start of UTC day of meeting. */
  priceBefore: number | null;
  /** Price at start of UTC day after meeting (~24h later). */
  priceAfter: number | null;
  reactionPct: number | null;
}

interface ApiResponse {
  meetings: MeetingResult[];
  next: MeetingResult | null;
  past: MeetingResult[];
  averageReaction: number | null;
  ts: number;
}

/**
 * Curated FOMC meeting dates. Maintainer-edited.
 * Last reviewed: 2026-05-04
 *
 * Add new meetings as they're announced. The Federal Reserve publishes
 * the schedule for the upcoming year each spring.
 */
const FOMC_MEETINGS: MeetingMeta[] = [
  { date: '2024-01-31', decision: 'Hold 5.50%' },
  { date: '2024-03-20', decision: 'Hold 5.50%' },
  { date: '2024-05-01', decision: 'Hold 5.50%' },
  { date: '2024-06-12', decision: 'Hold 5.50%' },
  { date: '2024-07-31', decision: 'Hold 5.50%' },
  { date: '2024-09-18', decision: 'Cut 50bps → 5.00%' },
  { date: '2024-11-07', decision: 'Cut 25bps → 4.75%' },
  { date: '2024-12-18', decision: 'Cut 25bps → 4.50%' },
  { date: '2025-01-29', decision: 'Hold 4.50%' },
  { date: '2025-03-19', decision: 'Hold 4.50%' },
  { date: '2025-05-07', decision: 'Hold 4.50%' },
  { date: '2025-06-18', decision: 'Hold 4.50%' },
  { date: '2025-07-30', decision: 'Cut 25bps → 4.25%' },
  { date: '2025-09-17', decision: 'Cut 25bps → 4.00%' },
  { date: '2025-10-29', decision: 'Cut 25bps → 3.75%' },
  { date: '2025-12-10', decision: 'Hold 3.75%' },
  { date: '2026-01-28' },
  { date: '2026-03-18' },
  { date: '2026-04-29' },
  { date: '2026-06-17' },
  { date: '2026-07-29' },
  { date: '2026-09-16' },
  { date: '2026-11-04' },
  { date: '2026-12-16' },
];

const TIMEOUT = 12_000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 6 * 60 * 60 * 1000;

interface CGRange { prices: Array<[number, number]> }

async function fetchPriceWindow(unixSecondsFrom: number, unixSecondsTo: number): Promise<Array<[number, number]>> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${unixSecondsFrom}&to=${unixSecondsTo}`;
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, TIMEOUT);
    if (!res.ok) return [];
    const json = await res.json() as CGRange;
    return json.prices ?? [];
  } catch { return []; }
}

function dateAtUtcNoon(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getTime();
}

function nearestPriceAt(prices: Array<[number, number]>, targetMs: number): number | null {
  if (prices.length === 0) return null;
  let best: [number, number] | null = null;
  let bestDelta = Infinity;
  for (const p of prices) {
    const delta = Math.abs(p[0] - targetMs);
    if (delta < bestDelta) { bestDelta = delta; best = p; }
  }
  // Reject if best match is more than 12h away
  if (best && bestDelta < 12 * 3_600_000) return best[1];
  return null;
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=21600' },
    });
  }

  const now = Date.now();
  // Fetch a wide BTC price window covering all known meetings + buffer.
  // CoinGecko free tier returns hourly resolution for 1–90d ranges,
  // daily resolution beyond that. We need daily-level which is fine.
  const earliest = Math.min(...FOMC_MEETINGS.map(m => dateAtUtcNoon(m.date)));
  const latestPast = Math.max(...FOMC_MEETINGS
    .filter(m => dateAtUtcNoon(m.date) < now)
    .map(m => dateAtUtcNoon(m.date)));
  const fromUnix = Math.floor((earliest - 2 * 86_400_000) / 1000);
  const toUnix = Math.floor((latestPast + 2 * 86_400_000) / 1000);
  const prices = await fetchPriceWindow(fromUnix, toUnix);

  const meetings: MeetingResult[] = FOMC_MEETINGS.map(m => {
    const ms = dateAtUtcNoon(m.date);
    const isPast = ms < now;
    const daysUntil = Math.round((ms - now) / 86_400_000);
    let priceBefore: number | null = null;
    let priceAfter: number | null = null;
    let reactionPct: number | null = null;
    if (isPast) {
      priceBefore = nearestPriceAt(prices, ms);
      priceAfter = nearestPriceAt(prices, ms + 24 * 3_600_000);
      if (priceBefore != null && priceAfter != null && priceBefore > 0) {
        reactionPct = (priceAfter - priceBefore) / priceBefore;
      }
    }
    return {
      ...m,
      isPast,
      daysUntil,
      priceBefore,
      priceAfter,
      reactionPct,
    };
  });

  const past = meetings.filter(m => m.isPast).sort((a, b) => b.date.localeCompare(a.date));
  const future = meetings.filter(m => !m.isPast).sort((a, b) => a.date.localeCompare(b.date));
  const next = future[0] ?? null;

  const reactions = past.map(m => m.reactionPct).filter((x): x is number => x != null);
  const averageReaction = reactions.length > 0
    ? reactions.reduce((s, x) => s + x, 0) / reactions.length
    : null;

  const body: ApiResponse = {
    meetings,
    next,
    past,
    averageReaction,
    ts: now,
  };
  if (past.length > 0) l1 = { body, ts: now };

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=21600',
    },
  });
}
