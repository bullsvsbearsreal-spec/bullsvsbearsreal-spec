/**
 * GET /api/dashboard/widgets  → current user's saved layout (or default)
 * PUT /api/dashboard/widgets  → upsert layout (body: { widgets: [...] })
 *
 * Auth: NextAuth session required. Layout is per-user; not shared.
 *
 * Tier note: this endpoint is OPEN during the "free during launch"
 * window so every signed-in user can experiment with the widget grid.
 * When LAUNCH_GATING_ENABLED flips in src/components/TierGate.tsx, the
 * /dashboard/widgets page will paywall non-Pro users at the UI level —
 * this endpoint stays open so existing layouts continue to load for
 * downgrade-to-Free users (read-only fallback) rather than 403ing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, verifySameOrigin } from '@/lib/auth';
import {
  isDBConfigured,
  initDB,
  getUserDashboardLayout,
  setUserDashboardLayout,
  type DashboardWidget,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Default layout for new users — first opens to a curated starter set
 *  so empty state isn't "blank canvas, where do I start". 4 widgets is
 *  enough to look meaningful without crowding mobile. */
const DEFAULT_LAYOUT: DashboardWidget[] = [
  { id: 'default-funding-btc', type: 'funding', config: { symbol: 'BTC' } },
  { id: 'default-oi-btc', type: 'oi', config: { symbol: 'BTC' } },
  { id: 'default-watchlist', type: 'watchlist', config: {} },
  { id: 'default-alerts', type: 'alerts', config: {} },
];

const ALLOWED_TYPES = new Set([
  'funding', 'oi', 'liquidations', 'watchlist',
  'alerts', 'whales', 'news', 'positions',
]);

function validWidget(w: unknown): w is DashboardWidget {
  if (!w || typeof w !== 'object') return false;
  const x = w as Record<string, unknown>;
  if (typeof x.id !== 'string' || x.id.length === 0 || x.id.length > 64) return false;
  if (typeof x.type !== 'string' || !ALLOWED_TYPES.has(x.type)) return false;
  // config is optional + free-form; just ensure it isn't a huge blob
  if (x.config !== undefined) {
    if (typeof x.config !== 'object' || x.config === null) return false;
    try {
      if (JSON.stringify(x.config).length > 2_000) return false; // ~2KB cap per widget
    } catch { return false; }
  }
  return true;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json(
      { widgets: DEFAULT_LAYOUT, isDefault: true },
      { headers: NO_STORE },
    );
  }
  await initDB();
  const stored = await getUserDashboardLayout(session.user.id);
  if (stored === null) {
    // Never saved → return the default. Frontend treats this as "you
    // haven't customised yet" and can show a tooltip.
    return NextResponse.json({ widgets: DEFAULT_LAYOUT, isDefault: true }, { headers: NO_STORE });
  }
  return NextResponse.json({ widgets: stored, isDefault: false }, { headers: NO_STORE });
}

interface PutBody {
  widgets?: unknown;
}

export async function PUT(req: NextRequest) {
  const originErr = verifySameOrigin(req);
  if (originErr) return originErr;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }

  let body: PutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  if (!Array.isArray(body.widgets)) {
    return NextResponse.json({ error: 'widgets must be an array' }, { status: 400, headers: NO_STORE });
  }
  if (body.widgets.length > 24) {
    return NextResponse.json({ error: 'Too many widgets (max 24)' }, { status: 400, headers: NO_STORE });
  }

  // Strict per-widget validation — reject the whole payload on a single
  // bad row so we don't silently drop part of a user's intent.
  const cleaned: DashboardWidget[] = [];
  for (const w of body.widgets) {
    if (!validWidget(w)) {
      return NextResponse.json(
        { error: 'One or more widgets failed validation' },
        { status: 400, headers: NO_STORE },
      );
    }
    cleaned.push({
      id: w.id,
      type: w.type,
      ...(w.config ? { config: w.config } : {}),
    });
  }

  await initDB();
  const ok = await setUserDashboardLayout(session.user.id, cleaned);
  if (!ok) {
    return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, widgets: cleaned }, { headers: NO_STORE });
}
