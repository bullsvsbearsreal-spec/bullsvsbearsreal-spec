/**
 * GET /api/referrals   → affiliate dashboard data
 *   { code, link, summary, events, payout }
 *
 * PUT /api/referrals   → update USDT payout wallet + chain
 *   body: { wallet, chain }
 *
 * Auth: NextAuth session required. Each call also lazily ensures the
 * user has a referral_code (idempotent — does nothing on repeat).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, verifySameOrigin } from '@/lib/auth';
import {
  isDBConfigured,
  initDB,
  ensureUserReferralCode,
  getReferralProfile,
  listReferralEvents,
  getReferralSummary,
  setUsdtPayoutConfig,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const ALLOWED_CHAINS = new Set(['solana', 'arbitrum', 'base']);

/**
 * Cheap shape validation for the destination wallet — full chain-specific
 * validation happens on the payout cron. This only catches obvious
 * typos so the UI can give a fast hint without an RPC round-trip.
 *
 * - solana: 32-44 chars, base58 alphabet
 * - arbitrum / base: 0x + 40 hex (EVM address)
 */
function looksLikeWallet(addr: string, chain: 'solana' | 'arbitrum' | 'base'): boolean {
  const trimmed = addr.trim();
  if (chain === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
}

function buildShareLink(code: string, base: string | null): string {
  const root = (base || 'https://info-hub.io').replace(/\/$/, '');
  return `${root}/?ref=${code}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }
  await initDB();

  const userId = session.user.id;
  // Lazy-backfill: legacy users + race conditions where the signup
  // ensureUserReferralCode call dropped a result. Idempotent.
  const code = await ensureUserReferralCode(userId);
  const [profile, summary, events] = await Promise.all([
    getReferralProfile(userId),
    getReferralSummary(userId),
    listReferralEvents(userId, 50),
  ]);

  const link = code ? buildShareLink(code, process.env.NEXT_PUBLIC_BASE_URL ?? null) : null;
  return NextResponse.json(
    {
      code: profile?.referralCode ?? code,
      link,
      summary,
      payout: profile?.payout ?? { wallet: null, chain: null },
      events,
      // Surface the program terms inline so the UI doesn't drift from
      // the public /referrals copy. Keep these in sync with the public
      // page (/referrals) — single source of truth would live in a
      // constants file when this stabilises.
      terms: {
        commissionPct: 20,
        recurring: 'lifetime',
        // 90-day cookie — matches middleware.ts REFERRAL_COOKIE_MAX_AGE_SEC
        // (90 * 24 * 3600). Was reported as 60 here, creating a mismatch
        // between what /settings/referrals showed users ("60-day cookie")
        // and what the actual cookie did (90 days). Bumped to 90 in
        // task #73 but this display literal was missed.
        cookieDays: 90,
        minPayoutUsd: 25,
        referredDiscountPct: 10,
        referredDiscountDuration: 'lifetime',
      },
    },
    { headers: NO_STORE },
  );
}

interface PutBody {
  wallet?: string | null;
  chain?: string | null;
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
  await initDB();

  let body: PutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  // Both null = clear the config. Otherwise both must be set + valid.
  const clearing = (body.wallet == null || body.wallet === '') && (body.chain == null || body.chain === '');
  if (clearing) {
    await setUsdtPayoutConfig(session.user.id, null, null);
    return NextResponse.json({ ok: true, wallet: null, chain: null }, { headers: NO_STORE });
  }

  const chain = (body.chain || '').toLowerCase().trim();
  if (!ALLOWED_CHAINS.has(chain)) {
    return NextResponse.json(
      { error: `Invalid chain. Allowed: ${Array.from(ALLOWED_CHAINS).join(', ')}` },
      { status: 400, headers: NO_STORE },
    );
  }
  const wallet = (body.wallet || '').trim();
  if (!looksLikeWallet(wallet, chain as 'solana' | 'arbitrum' | 'base')) {
    return NextResponse.json(
      { error: chain === 'solana' ? 'That doesn\'t look like a Solana address.' : 'That doesn\'t look like an EVM (0x…) address.' },
      { status: 400, headers: NO_STORE },
    );
  }

  await setUsdtPayoutConfig(session.user.id, wallet, chain as 'solana' | 'arbitrum' | 'base');
  return NextResponse.json({ ok: true, wallet, chain }, { headers: NO_STORE });
}
