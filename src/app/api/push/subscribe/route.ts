export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import { auth } from '@/lib/auth';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

// POST — save push subscription
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await req.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const db = getSQL();
    // Upsert push subscription in DB
    await db`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
      VALUES (
        ${session.user.id},
        ${subscription.endpoint},
        ${subscription.keys?.p256dh || ''},
        ${subscription.keys?.auth || ''},
        NOW()
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = ${session.user.id},
        p256dh = ${subscription.keys?.p256dh || ''},
        auth = ${subscription.keys?.auth || ''},
        created_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE — remove push subscription
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await req.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    const db = getSQL();
    await db`DELETE FROM push_subscriptions WHERE user_id = ${session.user.id} AND endpoint = ${endpoint}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
