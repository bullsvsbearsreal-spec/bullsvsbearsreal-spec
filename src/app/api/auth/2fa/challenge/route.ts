export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Resend } from 'resend';
import { isDBConfigured, getSQL } from '@/lib/db';
import { twoFaChallengeLimiter, isValidEmail, getClientIP } from '@/lib/auth/rate-limit';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Send a 2FA email code during login
export async function POST(req: Request) {
  try {
    // Rate limit by IP
    const ip = getClientIP(req);
    if (!twoFaChallengeLimiter.check(ip)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { email } = await req.json();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ sent: true }); // Don't reveal validation details
    }

    if (!isDBConfigured()) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();

    // Verify user exists and has email 2FA enabled (prevent email abuse)
    const users = await db`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      // Don't reveal whether email exists — return success silently
      return NextResponse.json({ sent: true });
    }

    const twofa = await db`SELECT email_2fa_enabled FROM user_2fa WHERE user_id = ${users[0].id}`;
    if (twofa.length === 0 || !twofa[0].email_2fa_enabled) {
      return NextResponse.json({ sent: true });
    }

    // Rate limit: 1 code per 60 seconds
    const recent = await db`
      SELECT id FROM twofa_login_codes
      WHERE email = ${email} AND created_at > NOW() - INTERVAL '60 seconds'
      LIMIT 1
    `;
    if (recent.length > 0) {
      return NextResponse.json({ error: 'Please wait before requesting a new code' }, { status: 429 });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await db`
      INSERT INTO twofa_login_codes (email, code, expires_at)
      VALUES (${email}, ${code}, ${expiresAt.toISOString()})
    `;

    // Probabilistic cleanup of expired codes (~5% of requests)
    if (Math.random() < 0.05) {
      db`DELETE FROM twofa_login_codes WHERE expires_at < NOW() - INTERVAL '1 hour'`.catch(() => {});
    }

    // Send email
    const resend = getResend();
    if (!resend) {
      console.error('RESEND_API_KEY not configured — skipping 2FA email');
      return NextResponse.json({ sent: true });
    }
    try {
      await resend.emails.send({
        from: 'InfoHub <noreply@info-hub.io>',
        to: email,
        subject: 'Your InfoHub login code',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 20px; font-weight: 600; color: #fff; margin: 0;">InfoHub</h1>
            </div>
            <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 32px; text-align: center;">
              <h2 style="font-size: 18px; font-weight: 600; color: #fff; margin: 0 0 12px;">Login verification</h2>
              <p style="font-size: 14px; color: #999; line-height: 1.6; margin: 0 0 24px;">
                Enter this code to complete your sign-in. It expires in 10 minutes.
              </p>
              <div style="background: #111; border: 2px solid #f5a623; border-radius: 12px; padding: 16px 24px; display: inline-block; margin: 0 0 24px;">
                <span style="font-size: 32px; font-weight: 700; color: #f5a623; letter-spacing: 8px; font-family: monospace;">${code}</span>
              </div>
              <p style="font-size: 12px; color: #666; line-height: 1.5;">If you didn't try to sign in, someone may be using your credentials. Change your password.</p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('2FA email error:', emailErr);
    }

    return NextResponse.json({ sent: true });
  } catch (e: any) {
    console.error('2FA challenge error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
