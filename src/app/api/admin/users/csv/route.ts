/**
 * GET /api/admin/users/csv
 *
 * CSV export of the full user roster for the admin Users tab. Each
 * column is RFC-4180 escaped — no helper dep, just inline. Streaming
 * not worth it at our scale (single-digit thousands of rows).
 *
 * Schema-aligned with GET /api/admin/users: alerts live in
 * `user_prefs.prefs->'alerts'`, not `users.alerts`. The earlier draft
 * referenced a non-existent column and silently returned 0 for every
 * row's alert_count.
 */
import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

function csvEsc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : String(v);
  // Quote if it contains comma, quote, or newline. Doubles quotes.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const db = getSQL();
    const rows = await db`
      SELECT
        u.id, u.email, u.name,
        COALESCE(u.role, 'user') AS role,
        COALESCE(u.billing_tier, 'free') AS billing_tier,
        u.created_at, u.last_seen, u.suspended_at, u.email_verified,
        u.referral_code, u.referred_by_user_id,
        COALESCE(
          jsonb_array_length(
            CASE WHEN jsonb_typeof(up.prefs->'alerts') = 'array'
                 THEN up.prefs->'alerts'
                 ELSE '[]'::jsonb END
          ), 0
        ) AS alert_count,
        COUNT(DISTINCT hw.id)::int  AS watched_wallets,
        COUNT(DISTINCT uek.id)::int AS connected_keys,
        COUNT(DISTINCT uw.id)::int  AS connected_wallets
      FROM users u
      LEFT JOIN user_prefs         up  ON up.user_id = u.id
      LEFT JOIN hl_watched_wallets hw  ON hw.user_id = u.id
      LEFT JOIN user_exchange_keys uek ON uek.user_id = u.id
      LEFT JOIN user_wallets       uw  ON uw.user_id = u.id
      GROUP BY u.id, up.prefs
      ORDER BY u.created_at DESC NULLS LAST
      LIMIT 10000
    `;

    const headers = [
      'id','email','name','role','billing_tier',
      'created_at','last_seen','suspended_at','email_verified',
      'referral_code','referred_by_user_id',
      'alert_count','watched_wallets','connected_keys','connected_wallets',
    ];
    const lines = [headers.join(',')];
    for (const r of rows as any[]) {
      lines.push([
        r.id, r.email, r.name, r.role, r.billing_tier,
        r.created_at, r.last_seen, r.suspended_at, r.email_verified,
        r.referral_code, r.referred_by_user_id,
        r.alert_count, r.watched_wallets, r.connected_keys, r.connected_wallets,
      ].map(csvEsc).join(','));
    }

    const csv = lines.join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="infohub-users-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('Users CSV export error:', e);
    return NextResponse.json({ error: 'Failed to export users' }, { status: 500 });
  }
}
