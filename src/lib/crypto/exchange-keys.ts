/**
 * AES-256-GCM helpers for encrypting user-supplied exchange API keys at rest.
 *
 * Threat model:
 *   - Postgres backup leaks → useless without the env-var key
 *   - Env var leaks         → useless without the DB
 *   - Both leak together    → game over (this is everyone's threat model)
 *
 * Storage format: `${nonce_b64}.${ciphertext_b64}.${authTag_b64}`
 *   - nonce: 12 bytes random (per-record)
 *   - authTag: 16 bytes appended by GCM
 *
 * Master key:  EXCHANGE_KEY_ENCRYPTION_KEY env var
 *   - 32 bytes encoded as 64 hex chars
 *   - Generated once with: `openssl rand -hex 32`
 *   - Set on DO App Platform env vars; never log it, never commit it.
 *
 * If the key is rotated in the future, write a one-shot migration that
 * iterates user_exchange_keys, decrypts with old key, re-encrypts with new.
 * Don't try to do "lazy rotation" — too easy to leave rows mid-state.
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const NONCE_BYTES = 12;
const KEY_HEX_LENGTH = 64; // 32 bytes hex

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

export function encryptSecret(plaintext: string): string {
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

export function decryptSecret(blob: string): string {
  const parts = blob.split('.');
  if (parts.length !== 3) {
    throw new Error('Encrypted blob malformed (expected 3 base64 parts joined by ".")');
  }
  const [nonceB64, ctB64, tagB64] = parts;
  const key = loadKey();
  const nonce = Buffer.from(nonceB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  if (nonce.length !== NONCE_BYTES) {
    throw new Error(`Encrypted blob has invalid nonce length (got ${nonce.length}, expected ${NONCE_BYTES})`);
  }
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

/**
 * Returns the first N (default 8) chars of a key for safe display in UI.
 * Use this for the row label like "Binance •••3a7f" so users can recognise
 * which key they're looking at without re-exposing the secret.
 */
export function safePrefix(key: string, n: number = 8): string {
  return key.slice(0, n);
}
