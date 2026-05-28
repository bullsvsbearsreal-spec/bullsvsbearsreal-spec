/**
 * GET /api/account/onboarding-status
 *
 * Returns a tiny snapshot of the calling user's setup completion for
 * the home-page OnboardingChecklist widget. Each step is a boolean,
 * computed in one round-trip via a single CTE-style query.
 *
 * Steps:
 *   emailVerified    — users.email_verified IS NOT NULL
 *   hasDisplayName   — users.name IS NOT NULL AND length > 0
 *   telegramLinked   — at least one row in telegram_links for user_id
 *   firstWalletWatch — at least one row in hl_watched_wallets for user_id
 *   firstAlert       — at least one row in user_position_alerts for user_id
 *
 * Returns all-false for unauthenticated callers (so the widget can
 * decide not to render). 200 OK in both cases — never blocks the page.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

interface StatusResp {
  emailVerified: boolean;
  hasDisplayName: boolean;
  telegramLinked: boolean;
  firstWalletWatch: boolean;
  firstAlert: boolean;
  completedCount: number;
  totalCount: number;
}

const EMPTY: StatusResp = {
  emailVerified: false,
  hasDisplayName: false,
  telegramLinked: false,
  firstWalletWatch: false,
  firstAlert: false,
  completedCount: 0,
  totalCount: 5,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(EMPTY, { headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json(EMPTY, { headers: NO_STORE });
  }

  await initDB();
  const db = getSQL();
  const userId = session.user.id;

  try {
    // One round-trip — 5 EXISTS / column lookups in a single SELECT.
    const rows = await db`
      SELECT
        (u.email_verified IS NOT NULL)                                          AS email_verified,
        (u.name IS NOT NULL AND LENGTH(TRIM(u.name)) > 0)                       AS has_display_name,
        EXISTS (SELECT 1 FROM telegram_links     WHERE user_id = ${userId})     AS telegram_linked,
        EXISTS (SELECT 1 FROM hl_watched_wallets WHERE user_id = ${userId})     AS first_wallet_watch,
        EXISTS (SELECT 1 FROM user_position_alerts WHERE user_id = ${userId})   AS first_alert
      FROM users u
      WHERE u.id = ${userId}
      LIMIT 1
    ` as Array<Record<string, boolean | null>>;

    const r = rows[0] ?? {};
    const out: StatusResp = {
      emailVerified:    r.email_verified    === true,
      hasDisplayName:   r.has_display_name  === true,
      telegramLinked:   r.telegram_linked   === true,
      firstWalletWatch: r.first_wallet_watch === true,
      firstAlert:       r.first_alert       === true,
      completedCount: 0,
      totalCount: 5,
    };
    out.completedCount = Number(out.emailVerified) + Number(out.hasDisplayName)
                       + Number(out.telegramLinked) + Number(out.firstWalletWatch)
                       + Number(out.firstAlert);
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (e) {
    // Don't crash the home page on a DB hiccup — return all-false and
    // the widget will gracefully decide to render the prompt for an
    // empty user (or, if dismissed, skip itself).
    console.warn('onboarding-status query failed:', e);
    return NextResponse.json(EMPTY, { headers: NO_STORE });
  }
}
