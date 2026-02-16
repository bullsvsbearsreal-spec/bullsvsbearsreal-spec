import { NextRequest, NextResponse } from 'next/server';
import { INFOHUB_API_URL, ADMIN_API_KEY } from '@/lib/config';

export async function GET(request: NextRequest) {
  // Check that user is authenticated (has session cookie)
  const session = request.cookies.get('admin_session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const headers: Record<string, string> = {};
    if (ADMIN_API_KEY) {
      headers['Authorization'] = `Bearer ${ADMIN_API_KEY}`;
    }

    const res = await fetch(`${INFOHUB_API_URL}/api/health`, {
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `InfoHub API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to reach InfoHub: ${msg}` }, { status: 502 });
  }
}
