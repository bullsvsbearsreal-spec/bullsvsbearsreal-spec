import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSQL, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
  }

  const sql = getSQL();

  const entries = await sql`
    SELECT id, email, name, source, status, created_at, notified_at
    FROM waitlist
    ORDER BY created_at DESC
    LIMIT 500
  `;

  const countResult = await sql`SELECT COUNT(*) as total FROM waitlist`;
  const total = Number(countResult[0]?.total || 0);

  return NextResponse.json({
    total,
    entries,
    timestamp: Date.now(),
  });
}
