import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createApiKey, listApiKeys, countUserApiKeys, initDB } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const MAX_KEYS_PER_USER = 5;

/**
 * GET /api/v1/keys — List user's API keys (requires session auth)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  await initDB();
  const keys = await listApiKeys(session.user.id);
  return NextResponse.json({ success: true, data: keys });
}

/**
 * POST /api/v1/keys — Create a new API key (requires session auth)
 * Body: { name?: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  await initDB();

  // Check key limit
  const count = await countUserApiKeys(session.user.id);
  if (count >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      { success: false, error: `Maximum ${MAX_KEYS_PER_USER} API keys allowed. Revoke an existing key first.` },
      { status: 400 },
    );
  }

  let name = 'Default';
  try {
    const body = await request.json();
    if (body.name && typeof body.name === 'string') {
      name = body.name.slice(0, 50);
    }
  } catch {}

  const result = await createApiKey(session.user.id, name);

  return NextResponse.json({
    success: true,
    data: {
      id: result.id,
      key: result.key, // Only shown once!
      prefix: result.prefix,
      name,
      warning: 'Save this key now — it will not be shown again.',
    },
  }, { status: 201 });
}
