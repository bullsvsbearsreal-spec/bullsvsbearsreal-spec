export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Resend } from 'resend';
import { validatePassword } from '@/lib/auth/password';
import { isDBConfigured, getSQL } from '@/lib/db';
import { signupLimiter, isValidEmail, getClientIP } from '@/lib/auth/rate-limit';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

function generateCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function POST(req: Request) {
  try {
    // Rate limit by IP
    const ip = getClientIP(req);
    if (!signupLimiter.check(ip)) {
      return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const { name, email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Limit name length
    const safeName = typeof name === 'string' ? name.trim().slice(0, 100) : null;

    const pw = validatePassword(password);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.error }, { status: 400 });
    }

    if (!isDBConfigured()) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();

    const existing = await db`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      // Return generic response to prevent email enumeration
      return NextResponse.json({ requiresVerification: true, message: 'Check your email to complete registration' }, { status: 201 });
    }

    // Hash password and create user (unverified)
    const hash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    const rows = await db`
      INSERT INTO users (id, name, email, password_hash)
      VALUES (${id}, ${safeName}, ${email}, ${hash})
      RETURNING id, name, email
    `;

    // Generate and store verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await db`
      INSERT INTO email_verification_codes (user_id, email, code, expires_at)
      VALUES (${id}, ${email}, ${code}, ${expiresAt.toISOString()})
    `;

    // Send verification email
    const resend = getResend();
    if (!resend) {
      console.error('RESEND_API_KEY not configured — skipping verification email');
      return NextResponse.json({ user: rows[0], requiresVerification: true }, { status: 201 });
    }
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
              <p style="font-size: 12px; color: #666; line-height: 1.5;">If you didn't create an account, ignore this email.</p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Verification email error:', emailErr);
    }

    return NextResponse.json({ user: rows[0], requiresVerification: true }, { status: 201 });
  } catch (e: any) {
    console.error('Signup error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
