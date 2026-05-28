/**
 * POST /api/admin/users/[id]/send-verification
 *
 * Admin tool: generate a 6-digit verification code for a user, attempt
 * email delivery, AND return the code in the response so the admin can
 * paste it via Discord/etc when delivery is broken.
 *
 * Body: { autoVerify?: boolean }
 *   - autoVerify=true: skip the code entirely and mark email_verified=NOW().
 *     Use sparingly — when the customer has verified identity via another
 *     channel (Discord, email-on-file from billing, etc.).
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { Resend } from 'resend';
import { requireAdminMutation, auth } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminMutation(request);
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: any = {};
  try { body = await request.json(); } catch { /* body optional */ }
  const autoVerify = body?.autoVerify === true;

  const { id } = await params;
  await initDB();
  const db = getSQL();

  let user: { id: string; email: string | null; email_verified: string | null } | undefined;
  try {
    const rows = await db`SELECT id, email, email_verified FROM users WHERE id = ${id}` as Array<{ id: string; email: string | null; email_verified: string | null }>;
    user = rows[0];
  } catch (e) {
    console.warn('user lookup failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!user.email) {
    return NextResponse.json({ error: 'User has no email on file' }, { status: 400 });
  }

  const session = await auth();

  // Auto-verify path: just stamp users.email_verified and exit.
  if (autoVerify) {
    try {
      await db`UPDATE users SET email_verified = NOW() WHERE id = ${user.id} AND email_verified IS NULL`;
    } catch (e) {
      console.warn('auto-verify failed:', e);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    await recordAuditEvent('admin_auto_verify_email', {
      targetUserId: user.id,
      targetEmail: user.email,
      actorId: session?.user?.id ?? null,
      actorEmail: session?.user?.email ?? null,
    }).catch(e => console.warn('audit log failed:', e));
    return NextResponse.json({
      ok: true,
      autoVerified: true,
      targetEmail: user.email,
    });
  }

  // Code path: insert code + try email + return code.
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  try {
    // Invalidate any outstanding codes for this user — otherwise multiple
    // 6-digit codes would be simultaneously valid (only 900k possible
    // combos, so n× admin clicks = n× the guessable surface). Mirrors
    // send-reset-link/route.ts which does the same for password tokens.
    await db`DELETE FROM email_verification_codes WHERE user_id = ${user.id}`;
    await db`
      INSERT INTO email_verification_codes (user_id, email, code, expires_at)
      VALUES (${user.id}, ${user.email}, ${code}, ${expiresAt.toISOString()})
    `;
  } catch (e) {
    console.warn('verification code insert failed:', e);
    return NextResponse.json({ error: 'Failed to create verification code' }, { status: 500 });
  }

  let emailSent = false;
  let emailError: string | null = null;
  const resend = getResend();
  if (resend) {
    try {
      await resend.emails.send({
        from: 'InfoHub <noreply@info-hub.io>',
        to: user.email,
        subject: 'Verify your InfoHub account',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 20px; font-weight: 600; color: #fff; margin: 0;">InfoHub</h1>
            </div>
            <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 32px; text-align: center;">
              <h2 style="font-size: 18px; font-weight: 600; color: #fff; margin: 0 0 12px;">Verify your email</h2>
              <p style="font-size: 14px; color: #999; line-height: 1.6; margin: 0 0 24px;">
                Enter this code to verify your account. Expires in 15 minutes.
              </p>
              <div style="background: #111; border: 2px solid #f5a623; border-radius: 12px; padding: 16px 24px; display: inline-block; margin: 0 0 24px;">
                <span style="font-size: 32px; font-weight: 700; color: #f5a623; letter-spacing: 8px; font-family: monospace;">${code}</span>
              </div>
            </div>
          </div>
        `,
      });
      emailSent = true;
    } catch (e: any) {
      emailError = e?.message ?? 'Resend error';
      console.error('Admin verification email failed:', emailError);
    }
  } else {
    emailError = 'RESEND_API_KEY not configured';
  }

  await recordAuditEvent('admin_send_verification', {
    targetUserId: user.id,
    targetEmail: user.email,
    actorId: session?.user?.id ?? null,
    actorEmail: session?.user?.email ?? null,
    emailSent,
    emailError,
  }).catch(e => console.warn('audit log failed:', e));

  return NextResponse.json({
    ok: true,
    code,
    expiresAt: expiresAt.toISOString(),
    emailSent,
    emailError,
    targetEmail: user.email,
  });
}
