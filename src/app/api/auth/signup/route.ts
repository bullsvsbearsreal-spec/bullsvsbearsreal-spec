export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import postgres from 'postgres';
import { Resend } from 'resend';
import { validatePassword } from '@/lib/auth/password';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

const resend = new Resend(process.env.RESEND_API_KEY);

function generateCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const pw = validatePassword(password);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.error }, { status: 400 });
    }

    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();

    const existing = await db`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Ensure email_verified column exists
    await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ DEFAULT NULL`.catch(() => {});

    // Hash password and create user (unverified)
    const hash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    const rows = await db`
      INSERT INTO users (id, name, email, password_hash)
      VALUES (${id}, ${name || null}, ${email}, ${hash})
      RETURNING id, name, email
    `;

    // Ensure verification table exists
    await db`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, email TEXT NOT NULL,
        code TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Generate and store verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await db`
      INSERT INTO email_verification_codes (user_id, email, code, expires_at)
      VALUES (${id}, ${email}, ${code}, ${expiresAt.toISOString()})
    `;

    // Send verification email
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
