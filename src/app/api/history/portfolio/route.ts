export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initDB, isDBConfigured, getPortfolioHistory } from '@/lib/db';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const url = new URL(request.url);
    const days = Math.min(Number(url.searchParams.get('days')) || 30, 365);

    const history = await getPortfolioHistory(session.user.id, days);
    return NextResponse.json({ history });
  } catch (e) {
    console.error('[history/portfolio] error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
