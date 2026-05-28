/**
 * POST /api/webhooks/resend
 *
 * Resend webhook receiver. Listens for delivery-failure events and
 * auto-files a support ticket on the affected user's account so the
 * team sees it in /mod-panel#tickets and can reach out via Telegram /
 * Discord when email delivery is broken (Proton, iCloud, corporate
 * filters, etc.).
 *
 * Event types we react to:
 *   email.bounced      → hard bounce (mailbox gone, blocked) → urgent ticket
 *   email.complained   → marked as spam by recipient → high ticket
 *   email.delivery_delayed → transient (retry will happen) → noop
 *
 * Auth: Svix-signed payload. Set RESEND_WEBHOOK_SECRET in env to the
 * signing secret from the Resend dashboard webhook settings. Without
 * the env var set we accept the payload (dev/staging convenience) but
 * log a warning — production deploys MUST configure it.
 *
 * Setup steps (one-time, in Resend dashboard):
 *   1. Webhooks → Add Endpoint
 *   2. URL: https://info-hub.io/api/webhooks/resend
 *   3. Events: email.bounced, email.complained
 *   4. Copy the signing secret into RESEND_WEBHOOK_SECRET env var
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { initDB, isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface ResendEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

function verifySvixSignature(
  body: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string,
): boolean {
  if (!svixId || !svixTimestamp || !svixSignature) return false;
  // Svix signs in the format `v1,<base64 of HMAC-SHA256(secret, "id.timestamp.body")>`
  // The signing secret itself starts with `whsec_` and is base64-encoded —
  // strip the prefix + base64-decode it for the HMAC key.
  const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBuf: Buffer;
  try { keyBuf = Buffer.from(cleanSecret, 'base64'); } catch { return false; }
  const signedPayload = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac('sha256', keyBuf).update(signedPayload).digest('base64');

  // The header can carry multiple signatures separated by spaces:
  // "v1,sig1 v1,sig2". Accept if ANY of them match.
  const candidates = svixSignature.split(' ').map(s => s.trim());
  for (const cand of candidates) {
    const [version, sig] = cand.split(',');
    if (version !== 'v1' || !sig) continue;
    try {
      const a = Buffer.from(expected, 'base64');
      const b = Buffer.from(sig, 'base64');
      if (a.length !== b.length) continue;
      if (timingSafeEqual(a, b)) return true;
    } catch { /* mismatched length etc — skip */ }
  }
  return false;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  // Signature check. In production we require it; in dev we let it
  // through but log loudly so the env var setup is obvious.
  if (secret) {
    const svixId        = request.headers.get('svix-id')        ?? request.headers.get('webhook-id');
    const svixTimestamp = request.headers.get('svix-timestamp') ?? request.headers.get('webhook-timestamp');
    const svixSignature = request.headers.get('svix-signature') ?? request.headers.get('webhook-signature');
    if (!verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret)) {
      console.warn('Resend webhook: signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('Resend webhook: RESEND_WEBHOOK_SECRET not set in production — accepting unverified payload (FIX THIS)');
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = event.type ?? '';
  // Only act on hard delivery failures + spam complaints. Soft bounces
  // (delivery_delayed) get retried by Resend; no action needed our end.
  if (type !== 'email.bounced' && type !== 'email.complained') {
    return NextResponse.json({ ok: true, ignored: type });
  }

  // Resend's `to` field is sometimes a string, sometimes an array.
  // Normalize to a single recipient (we send one email per send).
  const toRaw = event.data?.to;
  const recipientEmail = Array.isArray(toRaw) ? toRaw[0] : toRaw;
  if (!recipientEmail || typeof recipientEmail !== 'string') {
    return NextResponse.json({ ok: true, ignored: 'no-recipient' });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ ok: true, ignored: 'no-db' });
  }

  await initDB();
  const db = getSQL();

  // Look up the affected user. If we sent an email to an address that
  // isn't a registered user (e.g. typo'd address from a typo'd signup,
  // or an old account that was deleted), there's no ticket to open —
  // just log + exit.
  let user: { id: string; email: string } | undefined;
  try {
    const rows = await db`
      SELECT id, email FROM users WHERE LOWER(email) = LOWER(${recipientEmail}) LIMIT 1
    ` as Array<{ id: string; email: string }>;
    user = rows[0];
  } catch (e) {
    console.warn('Resend webhook: user lookup failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!user) {
    await recordAuditEvent('email_delivery_failed_unknown_user', {
      type, recipientEmail,
      bounce: event.data?.bounce ?? null,
      subject: event.data?.subject ?? null,
    }).catch(() => { /* swallow */ });
    return NextResponse.json({ ok: true, action: 'no-user-match' });
  }

  // De-dup: if we already opened an OPEN delivery-failure ticket for
  // this user in the last 24h, don't pile on. Just append a note to
  // the existing one as an internal message so the team sees the recurrence
  // without 5 duplicate tickets.
  const subject = type === 'email.complained'
    ? `Email marked as spam by ${user.email}`
    : `Email delivery failed to ${user.email}`;

  let existingTicketId: number | null = null;
  try {
    const rows = await db`
      SELECT id FROM support_tickets
       WHERE user_id = ${user.id}
         AND subject LIKE 'Email delivery failed%' OR subject LIKE 'Email marked as spam%'
         AND status IN ('open', 'claimed')
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 1
    ` as Array<{ id: number }>;
    existingTicketId = rows[0]?.id ?? null;
  } catch { /* swallow — we'll just create a fresh one */ }

  const bounceDetail = event.data?.bounce
    ? `Bounce type: ${event.data.bounce.type ?? '?'} / ${event.data.bounce.subType ?? '?'}\n${event.data.bounce.message ?? ''}`.trim()
    : 'Recipient marked the message as spam.';

  const body = [
    `An InfoHub email failed to deliver to ${user.email}.`,
    '',
    `Event:   ${type}`,
    `Subject: ${event.data?.subject ?? '(unknown)'}`,
    '',
    bounceDetail,
    '',
    'Action: reach out via Telegram / Discord with the relevant link (password reset, verification, etc.). Use the admin "Auth Recovery" tools in /admin-panel#users → click the user → "Send reset link" to get a fresh URL you can paste.',
  ].join('\n');

  try {
    if (existingTicketId) {
      // Append a recurrence note as an internal mod-only message so
      // staff sees the new failure on the existing thread.
      await db`
        INSERT INTO support_ticket_messages (ticket_id, author_user_id, body, is_internal)
        VALUES (${existingTicketId}, NULL, ${body}, true)
      `;
      await db`UPDATE support_tickets SET updated_at = NOW() WHERE id = ${existingTicketId}`;
      await recordAuditEvent('email_delivery_failed_recurrence', {
        ticketId: existingTicketId,
        targetUserId: user.id,
        targetEmail: user.email,
        type,
      }).catch(() => { /* swallow */ });
      return NextResponse.json({ ok: true, action: 'appended', ticketId: existingTicketId });
    }

    // Fresh ticket — priority urgent for hard bounces, high for spam
    // complaints (the user is still getting OUR emails, just hated one).
    const priority = type === 'email.bounced' ? 'urgent' : 'high';
    const rows = await db`
      INSERT INTO support_tickets (user_id, subject, body, priority)
      VALUES (${user.id}, ${subject}, ${body}, ${priority})
      RETURNING id
    ` as Array<{ id: number }>;
    const ticketId = Number(rows[0].id);

    await recordAuditEvent('email_delivery_failed', {
      ticketId,
      targetUserId: user.id,
      targetEmail: user.email,
      type,
      bounce: event.data?.bounce ?? null,
      subject: event.data?.subject ?? null,
    }).catch(() => { /* swallow */ });

    return NextResponse.json({ ok: true, action: 'created', ticketId });
  } catch (e) {
    console.warn('Resend webhook: ticket insert failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
