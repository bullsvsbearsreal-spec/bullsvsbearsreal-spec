/**
 * GET    /api/account/webhook       — read current webhook config (URL only,
 *                                     secret never re-exposed after creation)
 * PUT    /api/account/webhook       — set webhook URL + rotate secret. Returns
 *                                     the new secret ONCE; user must save it.
 * DELETE /api/account/webhook       — clear webhook config
 * POST   /api/account/webhook/test  — fire a synthetic alert.test event to
 *                                     the configured URL so the user can
 *                                     verify their receiver works.
 *
 * Whale tier only — /pricing's "Custom alert webhooks (your own HTTPS
 * endpoint)" row is a Whale-tier entitlement. Free / Trader / Pro users
 * get a 403 with an upgrade message.
 *
 * Payload format + HMAC scheme documented in lib/notifications.ts
 * (sendAlertWebhook). Receivers verify authenticity via
 * `HMAC-SHA256(secret, body)` compared against `X-InfoHub-Signature`.
 */
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth, getUserTier } from '@/lib/auth';
import { getSQL, isDBConfigured } from '@/lib/db';
import { validateWebhookUrl, sendAlertWebhook } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

interface WebhookConfig {
  url: string;
  secret: string;
  createdAt: string;
}

/** Read webhook config from user_prefs.notificationPrefs.webhook */
async function readConfig(userId: string): Promise<WebhookConfig | null> {
  const sql = getSQL();
  const rows = await sql`
    SELECT prefs->'notificationPrefs'->'webhook' AS webhook
    FROM user_prefs WHERE user_id = ${userId}
  ` as Array<{ webhook: WebhookConfig | null }>;
  return rows[0]?.webhook ?? null;
}

/** Whale-tier gate. Returns null if allowed, an error Response otherwise. */
async function requireWhale(userId: string): Promise<NextResponse | null> {
  const tier = await getUserTier(userId);
  if (tier !== 'whale') {
    return NextResponse.json(
      {
        error: `Custom HTTPS webhooks are a Whale-tier feature. Your current tier is ${tier}. See /pricing to upgrade — free during launch.`,
      },
      { status: 403, headers: NO_STORE },
    );
  }
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }
  const gate = await requireWhale(session.user.id);
  if (gate) return gate;

  const cfg = await readConfig(session.user.id);
  // Never re-expose the secret on read. Caller already saved it on PUT.
  return NextResponse.json(
    { configured: !!cfg, url: cfg?.url ?? null, createdAt: cfg?.createdAt ?? null },
    { headers: NO_STORE },
  );
}

interface PutBody { url?: string }

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }
  const gate = await requireWhale(session.user.id);
  if (gate) return gate;

  let body: PutBody;
  try { body = await req.json(); } catch { body = {}; }
  const url = (body.url ?? '').trim();
  const urlError = validateWebhookUrl(url);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400, headers: NO_STORE });
  }

  // 32-byte hex secret = 64 chars. Plenty of entropy for HMAC.
  const secret = randomBytes(32).toString('hex');
  const cfg: WebhookConfig = { url, secret, createdAt: new Date().toISOString() };

  const sql = getSQL();
  await sql`
    INSERT INTO user_prefs (user_id, prefs, updated_at)
    VALUES (
      ${session.user.id},
      jsonb_build_object('notificationPrefs', jsonb_build_object('webhook', ${JSON.stringify(cfg)}::jsonb)),
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      prefs = jsonb_set(
        COALESCE(user_prefs.prefs, '{}'::jsonb),
        ARRAY['notificationPrefs','webhook'],
        ${JSON.stringify(cfg)}::jsonb,
        true
      ),
      updated_at = NOW()
  `;

  return NextResponse.json(
    {
      url,
      secret,
      createdAt: cfg.createdAt,
      warning: 'Save this secret now — it will not be shown again. Use it to verify HMAC-SHA256 of the request body against X-InfoHub-Signature.',
    },
    { headers: NO_STORE },
  );
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }
  // No tier gate on DELETE — a user who downgrades from Whale should
  // still be able to clear stale config. (Setting requires whale though.)

  const sql = getSQL();
  await sql`
    UPDATE user_prefs
    SET prefs = prefs #- ARRAY['notificationPrefs','webhook'],
        updated_at = NOW()
    WHERE user_id = ${session.user.id}
  `;
  return NextResponse.json({ cleared: true }, { headers: NO_STORE });
}

