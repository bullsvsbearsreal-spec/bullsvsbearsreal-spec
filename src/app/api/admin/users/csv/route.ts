/**
 * GET /api/admin/users/csv
 *
 * CSV export of the full user roster for the admin Users tab. Each
 * column is RFC-4180 escaped — no helper dep, just inline. Streaming
 * not worth it at our scale (single-digit thousands of rows).
 */
import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured, getSQL } from '@/lib/db';

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
    const db = getSQL();
    const rows = await db`
      SELECT
        u.id, u.email, u.name,
        COALESCE(u.role, 'user') AS role,
        COALESCE(u.billing_tier, 'free') AS billing_tier,
        u.created_at, u.last_seen, u.suspended_at, u.email_verified,
        u.referral_code, u.referred_by_user_id,
        (CASE WHEN jsonb_typeof(u.alerts) = 'array'
              THEN jsonb_array_length(u.alerts) ELSE 0 END) AS alert_count,
        (SELECT COUNT(*) FROM hl_watched_wallets w WHERE w.user_id = u.id) AS watched_wallets,
        (SELECT COUNT(*) FROM user_exchange_keys k WHERE k.user_id = u.id) AS connected_keys,
        (SELECT COUNT(*) FROM user_wallets w WHERE w.user_id = u.id) AS connected_wallets
      FROM users u
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
