export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import postgres from 'postgres';
import { Resend } from 'resend';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();

    // Find user
    const users = await db`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      // Don't reveal whether email exists
      return NextResponse.json({ sent: true });
    }

    const userId = users[0].id;

    // Rate limit: max 1 code per 60 seconds
    const recent = await db`
      SELECT id FROM email_verification_codes
      WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '60 seconds'
      LIMIT 1
    `;
    if (recent.length > 0) {
      return NextResponse.json({ error: 'Please wait before requesting a new code' }, { status: 429 });
    }

    // Generate and store new code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db`
      INSERT INTO email_verification_codes (user_id, email, code, expires_at)
      VALUES (${userId}, ${email}, ${code}, ${expiresAt.toISOString()})
    `;

    // Send email
    try {
      await resend.emails.send({
        from: 'InfoHub <noreply@info-hub.io>',
        to: email,
        subject: 'Verify your InfoHub account',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 20px; font-weight: 600; color: #fff; margin: 0;">InfoHub</h1>
            </div>
            <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 32px; text-align: center;">
              <h2 style="font-size: 18px; font-weight: 600; color: #fff; margin: 0 0 12px;">Verify your email</h2>
              <p style="font-size: 14px; color: #999; line-height: 1.6; margin: 0 0 24px;">
                Enter this code to verify your account. It expires in 15 minutes.
              </p>
              <div style="background: #111; border: 2px solid #f5a623; border-radius: 12px; padding: 16px 24px; display: inline-block; margin: 0 0 24px;">
                <span style="font-size: 32px; font-weight: 700; color: #f5a623; letter-spacing: 8px; font-family: monospace;">${code}</span>
              </div>
              <p style="font-size: 12px; color: #666; line-height: 1.5;">If you didn't request this, ignore this email.</p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Resend verification email error:', emailErr);
    }

    return NextResponse.json({ sent: true });
  } catch (e: any) {
    console.error('Resend verification error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
