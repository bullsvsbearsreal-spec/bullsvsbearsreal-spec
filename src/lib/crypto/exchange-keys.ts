/**
 * AES-256-GCM helpers for encrypting user-supplied exchange API keys at rest.
 *
 * Threat model:
 *   - Postgres backup leaks → useless without the env-var key
 *   - Env var leaks         → useless without the DB
 *   - Both leak together    → game over (this is everyone's threat model)
 *   - DB write access       → with v2 (AAD), copying ciphertext from user A's
 *                             row to user B's row produces a verify failure
 *                             (no confused-deputy attack on row-level identity)
 *
 * Storage formats:
 *
 *   v1 (legacy): `${nonce_b64}.${ciphertext_b64}.${authTag_b64}`
 *     - 3 dot-separated parts, no AAD. Existing rows pre-May-2026.
 *
 *   v2 (current): `v2.${nonce_b64}.${ciphertext_b64}.${authTag_b64}`
 *     - 4 dot-separated parts, with AAD = `${userId}:${keyId}` bound to
 *       the row. Decrypt fails if the row is ever copied between users.
 *
 *   nonce: 12 bytes random (per-record)
 *   authTag: 16 bytes appended by GCM
 *
 * Master key:  EXCHANGE_KEY_ENCRYPTION_KEY env var
 *   - 32 bytes encoded as 64 hex chars
 *   - Generated once with: `openssl rand -hex 32`
 *   - Set on DO App Platform env vars; never log it, never commit it.
 *
 * Migration path: existing v1 blobs continue to decrypt via the legacy
 * path. New encryptions emit v2. A separate one-shot migration cron can
 * re-encrypt v1 → v2 in place once we want every row covered.
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const NONCE_BYTES = 12;
const KEY_HEX_LENGTH = 64; // 32 bytes hex
const VERSION_V2 = 'v2';

function loadKey(): Buffer {
  const hex = (process.env.EXCHANGE_KEY_ENCRYPTION_KEY || '').trim();
  if (hex.length !== KEY_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(
      `EXCHANGE_KEY_ENCRYPTION_KEY missing or malformed — must be ${KEY_HEX_LENGTH} hex chars (32 bytes). Generate with: openssl rand -hex 32`,
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Returns true if the env var is configured. Use this to short-circuit the
 * `/api/account/exchange-keys` endpoints with a clean 503 instead of the
 * cryptic `Error: EXCHANGE_KEY_ENCRYPTION_KEY missing` if someone deploys
 * Phase A without setting the var.
 */
export function isEncryptionConfigured(): boolean {
  const hex = (process.env.EXCHANGE_KEY_ENCRYPTION_KEY || '').trim();
  return hex.length === KEY_HEX_LENGTH && /^[0-9a-fA-F]+$/.test(hex);
}

/**
 * Build the AAD bytes from the row's identity. Binding the ciphertext to
 * `userId:keyId` defends against a row-copy attack: an attacker with DB
 * write access can't move user A's encrypted_secret blob to user B's row
 * because the GCM tag won't verify with B's AAD.
 */
function buildAad(userId: string, keyId: string | number): Buffer {
  return Buffer.from(`${userId}:${keyId}`, 'utf8');
}

export interface EncryptionContext {
  userId: string;
  /** keyId may be a number from a serial PK or a string from a UUID column. */
  keyId: string | number;
}

/**
 * Encrypt a secret with v2 (AAD-bound) format. Caller MUST supply the row's
 * identity so the ciphertext is bound to it. If you don't have the identity
 * yet (e.g. you're inserting a new row and the keyId is auto-generated), use
 * `encryptSecretLegacy` and migrate after the row exists — but prefer to
 * defer the encryption until after the INSERT returns the keyId.
 */
export function encryptSecret(plaintext: string, ctx: EncryptionContext): string {
  const key = loadKey();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce);
  cipher.setAAD(buildAad(ctx.userId, ctx.keyId));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION_V2,
    nonce.toString('base64'),
    ciphertext.toString('base64'),
    tag.toString('base64'),
  ].join('.');
}

/**
 * Legacy v1 encrypt — no AAD, kept ONLY for the chicken-and-egg case where
 * we don't have a keyId yet (e.g. fresh insert with auto-generated PK).
 * Prefer the v2 path. Re-encrypt v1 rows to v2 via the migration cron.
 */
export function encryptSecretLegacy(plaintext: string): string {
  const key = loadKey();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    nonce.toString('base64'),
    ciphertext.toString('base64'),
    tag.toString('base64'),
  ].join('.');
}

/**
 * Decrypt either v1 (3 parts, no AAD) or v2 (4 parts, AAD = userId:keyId).
 * v2 callers must supply the row identity. v1 callers can omit it (legacy
 * path); the function ignores the supplied ctx for v1 blobs.
 */
export function decryptSecret(blob: string, ctx?: EncryptionContext): string {
  const parts = blob.split('.');

  // v2: 4 parts with version prefix
  if (parts.length === 4 && parts[0] === VERSION_V2) {
    if (!ctx) {
      throw new Error('decryptSecret: v2 blob requires EncryptionContext (userId + keyId)');
    }
    const [, nonceB64, ctB64, tagB64] = parts;
    const key = loadKey();
    const nonce = Buffer.from(nonceB64, 'base64');
    const ciphertext = Buffer.from(ctB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    if (nonce.length !== NONCE_BYTES) {
      throw new Error(`v2 blob has invalid nonce length (got ${nonce.length}, expected ${NONCE_BYTES})`);
    }
    const decipher = createDecipheriv(ALGO, key, nonce);
    decipher.setAAD(buildAad(ctx.userId, ctx.keyId));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  }

  // v1 legacy: 3 parts without version prefix
  if (parts.length === 3) {
    const [nonceB64, ctB64, tagB64] = parts;
    const key = loadKey();
    const nonce = Buffer.from(nonceB64, 'base64');
    const ciphertext = Buffer.from(ctB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    if (nonce.length !== NONCE_BYTES) {
      throw new Error(`v1 blob has invalid nonce length (got ${nonce.length}, expected ${NONCE_BYTES})`);
    }
    const decipher = createDecipheriv(ALGO, key, nonce);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  }

  throw new Error('Encrypted blob malformed (expected 3 parts for v1 or 4 parts for v2)');
}

/** True if the blob is v2 (AAD-bound). Used by the migration cron. */
export function isV2Blob(blob: string): boolean {
  return blob.startsWith(`${VERSION_V2}.`);
}

/**
 * Returns the first N (default 8) chars of a SUPPLIED-PLAINTEXT-KEY for
 * safe display in UI. The function is named to imply safety, but it's
 * the caller's job to pass the plaintext API key (not the encrypted blob)
 * — passing a ciphertext base64 would leak the first 8 chars of the
 * blob, not the key. Type guard the caller; consider replacing this
 * with a dedicated MaskedKey type later.
 */
export function safePrefix(key: string, n: number = 8): string {
  return key.slice(0, n);
}
