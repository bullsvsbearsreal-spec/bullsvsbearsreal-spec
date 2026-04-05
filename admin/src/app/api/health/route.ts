import { NextRequest, NextResponse } from 'next/server';
import { INFOHUB_API_URL, ADMIN_API_KEY, AUTH_SECRET } from '@/lib/config';

async function hashToken(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time hex string comparison */
function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

export async function GET(request: NextRequest) {
  // Verify session HMAC — same check as middleware (which only covers /dashboard)
  const session = request.cookies.get('admin_session')?.value;
  const verify = request.cookies.get('admin_verify')?.value;
  if (!session || !verify || !AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const expectedVerify = await hashToken(`${AUTH_SECRET}-${session}`);
  if (!safeHexEqual(verify, expectedVerify)) {
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
    console.error('[admin/health]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to reach InfoHub API' }, { status: 502 });
  }
}
