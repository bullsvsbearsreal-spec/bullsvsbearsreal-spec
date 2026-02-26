export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import postgres from 'postgres';
import { Resend } from 'resend';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXTAUTH_URL || 'https://info-hub.io';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = getSQL();

    // Check if user exists (don't reveal if they don't — always return success)
    const users = await db`SELECT id, email FROM users WHERE email = ${email}`;

    if (users.length > 0) {
      // Generate a secure token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Ensure table exists before any queries against it
      await db`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          token TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      // Invalidate any existing tokens for this email
      await db`UPDATE password_reset_tokens SET used = true WHERE email = ${email} AND used = false`;

      // Store the token
      await db`
        INSERT INTO password_reset_tokens (token, email, expires_at)
        VALUES (${token}, ${email}, ${expiresAt.toISOString()})
      `;

      const resetUrl = `${BASE_URL}/reset-password?token=${token}`;

      // Send the email
      await resend.emails.send({
        from: 'InfoHub <noreply@info-hub.io>',
        to: email,
        subject: 'Reset your InfoHub password',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 20px; font-weight: 600; color: #fff; margin: 0;">InfoHub</h1>
            </div>
            <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 32px;">
              <h2 style="font-size: 18px; font-weight: 600; color: #fff; margin: 0 0 12px;">Reset your password</h2>
              <p style="font-size: 14px; color: #999; line-height: 1.6; margin: 0 0 24px;">
                We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
              </p>
              <a href="${resetUrl}" style="display: inline-block; background: #f5a623; color: #000; font-weight: 600; font-size: 14px; padding: 10px 24px; border-radius: 8px; text-decoration: none;">
                Reset Password
              </a>
              <p style="font-size: 12px; color: #666; margin: 24px 0 0; line-height: 1.5;">
                If you didn't request this, you can safely ignore this email. Your password won't be changed.
              </p>
            </div>
            <p style="font-size: 11px; color: #444; text-align: center; margin-top: 24px;">
              InfoHub &mdash; Real-time derivatives intelligence
            </p>
          </div>
        `,
      });
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ message: 'If that email exists, we sent a reset link' });
  } catch (e: any) {
    console.error('Forgot password error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
