export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const db = getSQL();

    // Check if user already exists
    const existing = await db`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Hash password and create user
    const hash = await bcrypt.hash(password, 12);
    const rows = await db`
      INSERT INTO users (name, email, password_hash)
      VALUES (${name || null}, ${email}, ${hash})
      RETURNING id, name, email
    `;

    return NextResponse.json({ user: rows[0] }, { status: 201 });
  } catch (e: any) {
    console.error('Signup error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
