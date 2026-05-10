/**
 * GET  /api/account/exchange-keys      list the calling user's keys (metadata only)
 * POST /api/account/exchange-keys      add a new key
 *
 * Both auth-gated via NextAuth session. Never returns or accepts the encrypted
 * blobs over the wire — secrets enter via POST body, leave via decrypt only on
 * the position-sync code path.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  isDBConfigured,
  initDB,
  listUserExchangeKeys,
  addUserExchangeKey,
} from '@/lib/db';
import { encryptSecret, encryptSecretLegacy, isEncryptionConfigured, safePrefix } from '@/lib/crypto/exchange-keys';
import { getSQL } from '@/lib/db';
import {
  isSupportedExchange,
  EXCHANGES_WITH_PASSPHRASE,
  SUPPORTED_EXCHANGES,
} from '@/lib/portfolio/supported-exchanges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503, headers: NO_STORE });
  }
  const keys = await listUserExchangeKeys(session.user.id);
  return NextResponse.json(
    {
      keys: keys.map(k => ({
        id: k.id,
        exchange: k.exchange,
        label: k.label,
        keyPrefix: k.keyPrefix,
        lastSyncedAt: k.lastSyncedAt,
        lastError: k.lastError,
        createdAt: k.createdAt,
      })),
      supportedExchanges: SUPPORTED_EXCHANGES,
    },
    { headers: NO_STORE },
  );
}

interface CreateBody {
  exchange?: string;
  label?: string;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503, headers: NO_STORE });
  }
  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      {
        error: 'Server misconfigured: EXCHANGE_KEY_ENCRYPTION_KEY env var not set. Contact support.',
      },
      { status: 503, headers: NO_STORE },
    );
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }

  const exchange = body.exchange?.trim();
  const apiKey = body.apiKey?.trim();
  const apiSecret = body.apiSecret?.trim();
  const passphrase = body.passphrase?.trim();
  const label = body.label?.trim().slice(0, 60) || null;

  if (!isSupportedExchange(exchange)) {
    return NextResponse.json(
      {
        error: `Unsupported exchange. Pick one of: ${SUPPORTED_EXCHANGES.join(', ')}`,
      },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!apiKey || apiKey.length < 8 || apiKey.length > 256) {
    return NextResponse.json(
      { error: 'apiKey is required (8-256 chars)' },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!apiSecret || apiSecret.length < 8 || apiSecret.length > 256) {
    return NextResponse.json(
      { error: 'apiSecret is required (8-256 chars)' },
      { status: 400, headers: NO_STORE },
    );
  }
  const needsPassphrase = EXCHANGES_WITH_PASSPHRASE.has(exchange);
  if (needsPassphrase && (!passphrase || passphrase.length > 128)) {
    return NextResponse.json(
      { error: `${exchange} requires a passphrase (1-128 chars)` },
      { status: 400, headers: NO_STORE },
    );
  }

  // Make sure tables exist before first POST.
  await initDB();

  // Two-phase encryption: we need the row's keyId to bind the v2 AAD,
  // but we don't know it until after the INSERT. So:
  //   1. INSERT with v1 (no AAD) blobs to get the keyId back
  //   2. UPDATE the same row with v2 (AAD-bound) blobs using that keyId
  //
  // If step 2 fails (network blip mid-call), the row stays as v1 —
  // still decryptable via the legacy path, just without AAD protection
  // for that row. The promote-v1-to-v2 migration cron picks those up.
  const userId = session.user.id;
  let result;
  try {
    result = await addUserExchangeKey({
      userId,
      exchange,
      label,
      keyPrefix: safePrefix(apiKey, 8),
      encryptedKey: encryptSecretLegacy(apiKey),
      encryptedSecret: encryptSecretLegacy(apiSecret),
      encryptedPassphrase: passphrase ? encryptSecretLegacy(passphrase) : null,
      // Phase B will populate this from the exchange's own permissions endpoint.
      // For now, NULL — UI shows "unknown" until first sync.
      permissions: null,
    });

    // Phase 2: re-encrypt with v2 (AAD = `${userId}:${keyId}`) and UPDATE.
    try {
      const ctx = { userId, keyId: result.id };
      const v2Key = encryptSecret(apiKey, ctx);
      const v2Secret = encryptSecret(apiSecret, ctx);
      const v2Pass = passphrase ? encryptSecret(passphrase, ctx) : null;
      const sql = getSQL();
      await sql`
        UPDATE user_exchange_keys
        SET encrypted_key = ${v2Key},
            encrypted_secret = ${v2Secret},
            encrypted_passphrase = ${v2Pass}
        WHERE id = ${result.id} AND user_id = ${userId}
      `;
    } catch (upgradeErr) {
      // Non-fatal: row exists as v1 and still decrypts. Log so the
      // migration cron can pick it up later.
      console.warn('[exchange-keys POST] v2 upgrade failed (row stays v1):', upgradeErr);
    }
  } catch (err: any) {
    // 23505 = unique_violation — same key prefix already on this user/exchange
    if (err?.code === '23505') {
      return NextResponse.json(
        { error: 'This key is already connected to your account.' },
        { status: 409, headers: NO_STORE },
      );
    }
    console.error('[exchange-keys POST]', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to save key' }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    { id: result.id, exchange, keyPrefix: safePrefix(apiKey, 8) },
    { status: 201, headers: NO_STORE },
  );
}
