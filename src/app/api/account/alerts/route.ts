/**
 * GET  /api/account/alerts            list calling user's alert rules
 * POST /api/account/alerts            upsert a rule (enable/disable, channels)
 *
 * Phase D MVP exposes a single rule kind: `funding_flip`. Body shape:
 *   { kind: 'funding_flip', enabled: boolean, channels?: ['telegram'|'email'], cooldownMin?: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, getUserTier } from '@/lib/auth';
import {
  isDBConfigured,
  initDB,
  listUserAlertRules,
  upsertUserAlertRule,
} from '@/lib/db';
import { TIER_LIMITS } from '@/lib/constants/tiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const SUPPORTED_KINDS = new Set(['funding_flip']);
// 'webhook' is the generic HTTPS webhook channel (Whale-tier only). The
// URL + HMAC secret are stored separately under
// user_prefs.notificationPrefs.webhook via /api/account/webhook — the
// channel selection here just opts the user into that delivery path.
const SUPPORTED_CHANNELS = new Set(['telegram', 'email', 'browser_push', 'webhook']);
const WHALE_ONLY_CHANNELS = new Set(['webhook']);

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

  // Tier-gate Whale-only channels (currently just 'webhook'). Free + Pro
  // attempting to use 'webhook' get a 403 with the upgrade pitch.
  if (channels.some(c => WHALE_ONLY_CHANNELS.has(c))) {
    const tierForChannel = await getUserTier(session.user.id);
    if (tierForChannel !== 'whale') {
      const blocked = channels.filter(c => WHALE_ONLY_CHANNELS.has(c));
      return NextResponse.json(
        {
          error: `Channels ${blocked.join(', ')} require Whale tier. Your tier is ${tierForChannel}. See /pricing — free during launch.`,
        },
        { status: 403, headers: NO_STORE },
      );
    }
  }

  // Per-tier alert-rule cap (Free 5 / Pro 50 / Whale Unlimited per /pricing).
  // Only enforced on *new* rules — flipping enable/disable or changing
  // channels on an existing rule should always work (otherwise a Free
  // user who hit the cap then upgraded then downgraded couldn't manage
  // their existing rules). The cap counts rules irrespective of enabled
  // state since disabled-but-existing rows still occupy a slot.
  const tier = await getUserTier(session.user.id);
  const tierCap = TIER_LIMITS[tier].maxAlerts;
  if (Number.isFinite(tierCap)) {
    const existing = await listUserAlertRules(session.user.id);
    const isNewRule = !existing.some(r => r.kind === kind);
    if (isNewRule && existing.length >= tierCap) {
      const upsell = tier === 'free'
        ? ' Upgrade to Pro on /pricing for 50 alerts, or Whale for unlimited.'
        : ' Upgrade to Whale on /pricing for unlimited alerts.';
      return NextResponse.json(
        { error: `Your ${tier} tier allows ${tierCap} alert rules.${upsell}` },
        { status: 409, headers: NO_STORE },
      );
    }
  }

  const { id } = await upsertUserAlertRule({
    userId: session.user.id,
    kind,
    enabled,
    channels,
    cooldownMin,
  });

  return NextResponse.json({ id, kind, enabled, channels, cooldownMin }, { headers: NO_STORE });
}
