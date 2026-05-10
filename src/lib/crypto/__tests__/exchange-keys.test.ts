/**
 * Tests for the AES-256-GCM exchange-key encryption helpers.
 *
 * Locks in the v1 ↔ v2 format compatibility: v1 (legacy, no AAD) decrypts
 * via the legacy path, v2 (with `${userId}:${keyId}` AAD) requires ctx and
 * fails when the row identity doesn't match (defends against row-copy
 * attacks where someone with DB write access moves user A's blob into
 * user B's row).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  encryptSecret,
  encryptSecretLegacy,
  decryptSecret,
  isV2Blob,
} from '../exchange-keys';

beforeAll(() => {
  // Set a deterministic test key. 32 bytes = 64 hex chars.
  process.env.EXCHANGE_KEY_ENCRYPTION_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
});

describe('v1 (legacy) round-trip', () => {
  it('encrypts and decrypts back the original string', () => {
    const blob = encryptSecretLegacy('hello-world');
    expect(blob.split('.')).toHaveLength(3);
    expect(isV2Blob(blob)).toBe(false);
    const plain = decryptSecret(blob); // ctx is optional for v1
    expect(plain).toBe('hello-world');
  });

  it('produces different ciphertext per call (random IV)', () => {
    const a = encryptSecretLegacy('same-input');
    const b = encryptSecretLegacy('same-input');
    expect(a).not.toBe(b);
  });
});

describe('v2 (AAD-bound) round-trip', () => {
  const ctx = { userId: 'user-123', keyId: 42 };

  it('encrypts with v2. prefix and decrypts with matching ctx', () => {
    const blob = encryptSecret('binance-secret-key', ctx);
    expect(blob.startsWith('v2.')).toBe(true);
    expect(isV2Blob(blob)).toBe(true);
    expect(blob.split('.')).toHaveLength(4);
    expect(decryptSecret(blob, ctx)).toBe('binance-secret-key');
  });

  it('accepts string keyId as well as number', () => {
    const stringCtx = { userId: 'u-1', keyId: 'uuid-aaa' };
    const blob = encryptSecret('plaintext', stringCtx);
    expect(decryptSecret(blob, stringCtx)).toBe('plaintext');
  });
});

describe('v2 AAD enforcement (row-copy attack)', () => {
  it('refuses to decrypt when userId differs', () => {
    const blob = encryptSecret('alice-secret', { userId: 'alice', keyId: 1 });
    expect(() => decryptSecret(blob, { userId: 'bob', keyId: 1 })).toThrow();
  });

  it('refuses to decrypt when keyId differs', () => {
    const blob = encryptSecret('row-1-secret', { userId: 'alice', keyId: 1 });
    expect(() => decryptSecret(blob, { userId: 'alice', keyId: 2 })).toThrow();
  });

  it('throws when v2 blob is decrypted without ctx', () => {
    const blob = encryptSecret('s', { userId: 'u', keyId: 1 });
    expect(() => decryptSecret(blob)).toThrow(/v2 blob requires/);
  });
});

describe('format detection + cross-version', () => {
  it('isV2Blob returns true only for v2 prefix', () => {
    expect(isV2Blob('v2.aaa.bbb.ccc')).toBe(true);
    expect(isV2Blob('aaa.bbb.ccc')).toBe(false);
    expect(isV2Blob('v3.aaa.bbb.ccc')).toBe(false);
    expect(isV2Blob('')).toBe(false);
  });

  it('legacy blobs still decrypt without ctx', () => {
    const blob = encryptSecretLegacy('legacy-secret');
    expect(decryptSecret(blob)).toBe('legacy-secret');
    // ctx supplied to v1 decrypt is silently ignored
    expect(decryptSecret(blob, { userId: 'whatever', keyId: 999 })).toBe('legacy-secret');
  });

  it('rejects malformed blobs (wrong part count)', () => {
    expect(() => decryptSecret('only-one-part')).toThrow(/malformed/);
    expect(() => decryptSecret('aa.bb')).toThrow(/malformed/);
    // 'v2.aa.bb' is 3 parts → falls into the v1 path (not 4 parts so not v2),
    // which then fails on the nonce length check. Either error is acceptable
    // for "this isn't a real blob".
    expect(() => decryptSecret('v2.aa.bb', { userId: 'u', keyId: 1 })).toThrow();
  });
});
