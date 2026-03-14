import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { getAuditLog, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 200);
    const events = await getAuditLog(limit);
    return NextResponse.json({ events });
  } catch (e) {
    console.error('Audit log error:', e);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
