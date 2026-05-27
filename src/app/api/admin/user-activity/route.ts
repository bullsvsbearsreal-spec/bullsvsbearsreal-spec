/**
 * GET /api/admin/user-activity?userId=…
 *
 * Per-user activity timeline for the admin UserDrawer. Pulls together
 * lifecycle + behaviour events from several tables and returns them
 * in reverse-chronological order:
 *   - signup           (users.created_at)
 *   - email_verified   (users.email_verified)
 *   - last_seen        (heartbeat — most recent)
 *   - suspended        (users.suspended_at, if set)
 *   - wallet_added     (hl_watched_wallets per-row created_at, last 5)
 *   - key_added        (user_exchange_keys per-row created_at, last 5)
 *   - dex_wallet_added (user_wallets per-row created_at, last 5)
 *   - notification     (alert_notifications per-row sent_at, last 10)
 *   - admin_action     (admin_monitoring audit rows referencing this user, last 10)
 *
 * Capped to ~50 rows total; the UI shows them as a scroll list.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

type ActivityEvent = {
  type: string;
  label: string;
  detail?: string | null;
  timestamp: string;
};

export async function GET(request: NextRequest) {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    await initDB();
    const db = getSQL();

    const [
      user,
      walletAdds,
      keyAdds,
      dexWalletAdds,
      notifs,
      auditEntries,
    ] = await Promise.all([
      db`SELECT id, email, name, created_at, email_verified, last_seen, suspended_at
           FROM users WHERE id = ${userId} LIMIT 1`.catch(() => []),
      db`SELECT address, created_at FROM hl_watched_wallets
           WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 5`.catch(() => []),
      db`SELECT exchange, created_at FROM user_exchange_keys
           WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 5`.catch(() => []),
      db`SELECT chain, created_at FROM user_wallets
           WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 5`.catch(() => []),
      db`SELECT symbol, metric, channel, sent_at FROM alert_notifications
           WHERE user_id = ${userId} ORDER BY sent_at DESC LIMIT 10`.catch(() => []),
      db`SELECT metric, details, recorded_at FROM admin_monitoring
           WHERE metric LIKE 'audit_%'
             AND details::jsonb ->> 'targetUserId' = ${userId}
           ORDER BY recorded_at DESC LIMIT 10`.catch(() => []),
    ]);

    if ((user as any[]).length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const u = (user as any[])[0];
    const events: ActivityEvent[] = [];

    if (u.created_at) {
      events.push({
        type: 'signup',
        label: 'Signed up',
        timestamp: u.created_at instanceof Date ? u.created_at.toISOString() : String(u.created_at),
      });
    }
    if (u.email_verified) {
      events.push({
        type: 'verified',
        label: 'Verified email',
        timestamp: u.email_verified instanceof Date ? u.email_verified.toISOString() : String(u.email_verified),
      });
    }
    if (u.last_seen) {
      events.push({
        type: 'last_seen',
        label: 'Last seen',
        timestamp: u.last_seen instanceof Date ? u.last_seen.toISOString() : String(u.last_seen),
      });
    }
    if (u.suspended_at) {
      events.push({
        type: 'suspended',
        label: 'Suspended',
        timestamp: u.suspended_at instanceof Date ? u.suspended_at.toISOString() : String(u.suspended_at),
      });
    }
    for (const r of walletAdds as any[]) {
      events.push({
        type: 'wallet_added',
        label: 'Watched HL wallet',
        detail: r.address ? `${r.address.slice(0, 6)}…${r.address.slice(-4)}` : null,
        timestamp: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      });
    }
    for (const r of keyAdds as any[]) {
      events.push({
        type: 'key_added',
        label: 'Connected exchange key',
        detail: r.exchange ?? null,
        timestamp: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      });
    }
    for (const r of dexWalletAdds as any[]) {
      events.push({
        type: 'dex_wallet_added',
        label: 'Connected DEX wallet',
        detail: r.chain ?? null,
        timestamp: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      });
    }
    for (const r of notifs as any[]) {
      events.push({
        type: 'notification',
        label: `Alert: ${r.symbol ?? '?'} · ${r.metric ?? '?'}`,
        detail: r.channel ?? null,
        timestamp: r.sent_at instanceof Date ? r.sent_at.toISOString() : String(r.sent_at),
      });
    }
    for (const r of auditEntries as any[]) {
      const action = String(r.metric).replace(/^audit_/, '');
      const reason = r.details?.reason ?? null;
      events.push({
        type: 'admin_action',
        label: `Admin: ${action}`,
        detail: reason ?? null,
        timestamp: r.recorded_at instanceof Date ? r.recorded_at.toISOString() : String(r.recorded_at),
      });
    }

    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return NextResponse.json({
      user: { id: u.id, email: u.email, name: u.name },
      events: events.slice(0, 50),
    });
  } catch (e) {
    console.error('User activity route error:', e);
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
