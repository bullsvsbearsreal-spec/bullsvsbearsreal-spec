/**
 * GET  /api/account/alerts            list calling user's alert rules
 * POST /api/account/alerts            upsert a rule (enable/disable, channels)
 *
 * Phase D MVP exposes a single rule kind: `funding_flip`. Body shape:
 *   { kind: 'funding_flip', enabled: boolean, channels?: ['telegram'|'email'], cooldownMin?: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  isDBConfigured,
  initDB,
  listUserAlertRules,
  upsertUserAlertRule,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const SUPPORTED_KINDS = new Set(['funding_flip']);
const SUPPORTED_CHANNELS = new Set(['telegram', 'email', 'browser_push']);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }
  const rules = await listUserAlertRules(session.user.id);
  return NextResponse.json(
    {
      rules,
      supportedKinds: Array.from(SUPPORTED_KINDS),
      supportedChannels: Array.from(SUPPORTED_CHANNELS),
    },
    { headers: NO_STORE },
  );
}

interface UpsertBody {
  kind?: string;
  enabled?: boolean;
  channels?: string[];
  cooldownMin?: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }

  let body: UpsertBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const kind = body.kind?.trim() ?? '';
  if (!SUPPORTED_KINDS.has(kind)) {
    return NextResponse.json(
      { error: `Unsupported kind. Try: ${Array.from(SUPPORTED_KINDS).join(', ')}` },
      { status: 400, headers: NO_STORE },
    );
  }
  const enabled = Boolean(body.enabled);
  const channelsRaw = Array.isArray(body.channels) && body.channels.length > 0
    ? body.channels.filter(c => typeof c === 'string')
    : ['telegram'];
  const channels = channelsRaw.filter(c => SUPPORTED_CHANNELS.has(c));
  if (channels.length === 0) {
    return NextResponse.json(
      { error: `No valid channels. Try: ${Array.from(SUPPORTED_CHANNELS).join(', ')}` },
      { status: 400, headers: NO_STORE },
    );
  }
  const cooldownMin = Math.max(5, Math.min(1440,
    Number.isFinite(body.cooldownMin as number) ? Number(body.cooldownMin) : 60,
  ));

  await initDB();

  const { id } = await upsertUserAlertRule({
    userId: session.user.id,
    kind,
    enabled,
    channels,
    cooldownMin,
  });

  return NextResponse.json({ id, kind, enabled, channels, cooldownMin }, { headers: NO_STORE });
}
