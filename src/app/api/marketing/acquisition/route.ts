/**
 * GET /api/marketing/acquisition
 *
 * Aggregate signups by acquisition source. Returns three breakdowns:
 *
 *   bySource    — count by utm_source     (twitter, newsletter, organic, etc.)
 *   byCampaign  — count by utm_campaign   (pro-launch, x-promo, etc.)
 *   byReferer   — count by HTTP referer host (excludes our own host)
 *
 * Each row carries:
 *   { key, signups, paid, converted_pct }
 * where paid = number of users in that bucket who upgraded past 'free'.
 *
 * Query params:
 *   window — 'all' | '30d' | '7d' (default 'all')
 *
 * Gated by requireMarketer (admin/owner/marketer).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireMarketer } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

type Window = 'all' | '30d' | '7d';

function parseWindow(s: string | null): Window {
  return s === '30d' || s === '7d' ? s : 'all';
}

type SourceRow = { source: string; signups: number; paid: number };

interface DBRow {
  key: string | null;
  signups: number | string;
  paid: number | string;
}

export async function GET(request: NextRequest) {
  const denied = await requireMarketer();
  if (denied) return denied;
  if (!isDBConfigured()) return NextResponse.json({ bySource: [], byCampaign: [], byReferer: [] });

  const { searchParams } = new URL(request.url);
  const win = parseWindow(searchParams.get('window'));
  const days = win === '30d' ? 30 : win === '7d' ? 7 : 0;

  await initDB();
  const db = getSQL();

  const runAgg = async (column: 'acq_utm_source' | 'acq_utm_campaign' | 'acq_referer'): Promise<SourceRow[]> => {
    try {
      const rows = days > 0
        ? await db`
            SELECT ${db(column)} AS key,
                   COUNT(*)::int AS signups,
                   COUNT(*) FILTER (WHERE billing_tier IS NOT NULL AND billing_tier <> 'free')::int AS paid
            FROM users
            WHERE ${db(column)} IS NOT NULL
              AND ${db(column)} <> ''
              AND created_at > NOW() - (${days}::int * INTERVAL '1 day')
            GROUP BY ${db(column)}
            ORDER BY signups DESC
            LIMIT 50
          ` as unknown as DBRow[]
        : await db`
            SELECT ${db(column)} AS key,
                   COUNT(*)::int AS signups,
                   COUNT(*) FILTER (WHERE billing_tier IS NOT NULL AND billing_tier <> 'free')::int AS paid
            FROM users
            WHERE ${db(column)} IS NOT NULL
              AND ${db(column)} <> ''
            GROUP BY ${db(column)}
            ORDER BY signups DESC
            LIMIT 50
          ` as unknown as DBRow[];
      return rows.map(r => {
        const signups = Number(r.signups) || 0;
        const paid = Number(r.paid) || 0;
        return { source: r.key ?? '(unknown)', signups, paid };
      });
    } catch (e) {
      console.warn(`acquisition agg failed for ${column}:`, e);
      return [];
    }
  };

  const [bySource, byCampaign, byRefererRaw] = await Promise.all([
    runAgg('acq_utm_source'),
    runAgg('acq_utm_campaign'),
    runAgg('acq_referer'),
  ]);

  // Normalize referer values to host only — full URLs are visually noisy.
  const byReferer = byRefererRaw.map(r => {
    let host = r.source;
    try { host = new URL(r.source).host || r.source; } catch { /* leave as-is */ }
    return { ...r, source: host };
  });

  // Total signups in window — for the "X% of total signups attributed" line.
  let totalSignups = 0;
  let totalPaid = 0;
  try {
    const totals = days > 0
      ? await db`
          SELECT COUNT(*)::int AS signups,
                 COUNT(*) FILTER (WHERE billing_tier IS NOT NULL AND billing_tier <> 'free')::int AS paid
          FROM users
          WHERE created_at > NOW() - (${days}::int * INTERVAL '1 day')
        `
      : await db`
          SELECT COUNT(*)::int AS signups,
                 COUNT(*) FILTER (WHERE billing_tier IS NOT NULL AND billing_tier <> 'free')::int AS paid
          FROM users
        `;
    totalSignups = Number((totals as any[])[0]?.signups) || 0;
    totalPaid = Number((totals as any[])[0]?.paid) || 0;
  } catch { /* swallow */ }

  return NextResponse.json({
    window: win,
    totals: { signups: totalSignups, paid: totalPaid },
    bySource,
    byCampaign,
    byReferer,
  });
}
