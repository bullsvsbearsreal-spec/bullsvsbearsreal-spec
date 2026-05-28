/**
 * POST /api/admin/users/[id]/send-reset-link
 *
 * Admin tool: generate a password reset token for a user, attempt to
 * email it via Resend, AND return the resulting URL in the response so
 * the admin can paste it into Discord/Telegram/whatever directly when
 * email delivery is broken.
 *
 * This is the "Resend → proton.me delivered to /dev/null" escape hatch.
 * Aggressive spam filters block our noreply@info-hub.io sender; the
 * customer can't help themselves; the admin needs a side-channel.
 *
 * Audit log captures who ran this against whom.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { requireAdminMutation, auth } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
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

  const { id } = await params;
  await initDB();
  const db = getSQL();

  let user: { id: string; email: string | null } | undefined;
  try {
    const rows = await db`SELECT id, email FROM users WHERE id = ${id}` as Array<{ id: string; email: string | null }>;
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

  // Generate fresh token + invalidate any outstanding tokens. Same shape
  // as /api/auth/forgot-password so the existing /reset-password page
  // works without changes.
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  try {
    await db`UPDATE password_reset_tokens SET used = true WHERE email = ${user.email} AND used = false`;
    await db`
      INSERT INTO password_reset_tokens (token, email, expires_at)
      VALUES (${token}, ${user.email}, ${expiresAt.toISOString()})
    `;
  } catch (e) {
    console.warn('reset token insert failed:', e);
    return NextResponse.json({ error: 'Failed to create reset token' }, { status: 500 });
  }

  const resetUrl = `${BASE_URL}/reset-password?token=${token}`;

  // Best-effort email — we capture success/failure so the admin knows
  // whether to fall back to the manual paste path.
  let emailSent = false;
  let emailError: string | null = null;
  const resend = getResend();
  if (resend) {
    try {
      await resend.emails.send({
        from: 'InfoHub <noreply@info-hub.io>',
        to: user.email,
        subject: 'Reset your InfoHub password',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 20px; font-weight: 600; color: #fff; margin: 0;">InfoHub</h1>
            </div>
            <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 32px;">
              <h2 style="font-size: 18px; font-weight: 600; color: #fff; margin: 0 0 12px;">Reset your password</h2>
              <p style="font-size: 14px; color: #999; line-height: 1.6; margin: 0 0 24px;">
                Our support team generated this reset link for you. Click below to choose a new password. Link expires in 1 hour.
              </p>
              <a href="${resetUrl}" style="display: inline-block; background: #f5a623; color: #000; font-weight: 600; font-size: 14px; padding: 10px 24px; border-radius: 8px; text-decoration: none;">
                Reset Password
              </a>
              <p style="font-size: 12px; color: #666; margin: 24px 0 0; line-height: 1.5;">
                Or paste this URL into your browser:<br>
                <span style="word-break: break-all; color: #999;">${resetUrl}</span>
              </p>
            </div>
          </div>
        `,
      });
      emailSent = true;
    } catch (e: any) {
      emailError = e?.message ?? 'Resend error';
      console.error('Admin reset-link email failed:', emailError);
    }
  } else {
    emailError = 'RESEND_API_KEY not configured';
  }

  const session = await auth();
  await recordAuditEvent('admin_send_reset_link', {
    targetUserId: user.id,
    targetEmail: user.email,
    actorId: session?.user?.id ?? null,
    actorEmail: session?.user?.email ?? null,
    emailSent,
    emailError,
  }).catch(e => console.warn('audit log failed:', e));

  // Always return the URL so the admin can use the side-channel even if
  // email delivery fails (Proton blocking, etc.).
  return NextResponse.json({
    ok: true,
    resetUrl,
    expiresAt: expiresAt.toISOString(),
    emailSent,
    emailError,
    targetEmail: user.email,
  });
}
