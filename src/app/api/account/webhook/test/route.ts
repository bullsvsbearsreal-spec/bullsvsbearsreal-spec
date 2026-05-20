/**
 * POST /api/account/webhook/test — fire a synthetic alert.test event to
 * the caller's configured webhook URL so they can verify the receiver
 * accepts the payload + HMAC signature before relying on real alerts.
 *
 * Whale-tier gated, same as the parent /api/account/webhook surface.
 * Body: empty.
 * Returns: { ok: boolean, message: string }
 */
import { NextResponse } from 'next/server';
import { auth, getUserTier } from '@/lib/auth';
import { getSQL, isDBConfigured } from '@/lib/db';
import { sendAlertWebhook, type TriggeredAlertInfo } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

interface WebhookConfig {
  url: string;
  secret: string;
  createdAt: string;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }
  const tier = await getUserTier(session.user.id);
  if (tier !== 'whale') {
    return NextResponse.json(
      { error: `Custom HTTPS webhooks are a Whale-tier feature. Your tier is ${tier}. See /pricing.` },
      { status: 403, headers: NO_STORE },
    );
  }

  const sql = getSQL();
  const rows = await sql`
    SELECT prefs->'notificationPrefs'->'webhook' AS webhook
    FROM user_prefs WHERE user_id = ${session.user.id}
  ` as Array<{ webhook: WebhookConfig | null }>;
  const cfg = rows[0]?.webhook ?? null;
  if (!cfg?.url || !cfg?.secret) {
    return NextResponse.json(
      { error: 'No webhook configured. PUT /api/account/webhook with a URL first.' },
      { status: 400, headers: NO_STORE },
    );
  }

  // Synthetic alert — BTC funding flip is a recognisable shape for the
  // receiver to test against. Marked as `event: 'alert.test'` so the
  // receiver can route or filter it differently from real alerts.
  const fakeAlert: TriggeredAlertInfo = {
    alertId: 'test-' + Date.now(),
    symbol: 'BTC',
    metric: 'fundingRate',
    operator: 'gt',
    threshold: 0.0001,
    actualValue: 0.00015,
    exchange: 'Binance',
  };

  const ok = await sendAlertWebhook(cfg.url, cfg.secret, [fakeAlert], 'alert.test');
  return NextResponse.json(
    {
      ok,
      message: ok
        ? 'Test webhook delivered. Check your endpoint for the alert.test event.'
        : 'Test webhook failed. Check the URL is reachable, returns 2xx, and the server logs above for the error.',
    },
    { headers: NO_STORE },
  );
}
