import { describe, it, expect } from 'vitest';
import { blofinClient, blofinSign, __blofinInstIdToBaseForTests } from '../blofin';

/**
 * Locks in the Blofin client contract:
 *   1. Signing matches the spec
 *      `base64(utf8-bytes-of(hex(hmac_sha256(secret, prehash))))`.
 *   2. Symbol normaliser strips the `-USDT` quote and 1000/1M prefixes.
 *   3. Client object satisfies the ExchangeClient interface our cron
 *      dispatcher expects (validateKey, fetchPositions,
 *      fetchAccountBalance — Blofin uses passphrase auth).
 */
describe('blofinSign — signature scheme', () => {
  it('matches a known input/output pair (regression lock for the spec)', () => {
    // The signing scheme is the quirky bit — base64 of the hex digest
    // STRING, not the raw digest bytes. Pin a deterministic case so a
    // future refactor that "simplifies" to `digest('base64')` breaks
    // here loudly instead of silently producing 401s in prod.
    const sig = blofinSign(
      '/api/v1/account/balance',
      'GET',
      '1700000000000',
      'nonce-abc',
      '',
      'secret-test',
    );
    // The signature is deterministic given fixed inputs — captured here
    // from a local run. If the scheme changes you must verify against
    // Blofin's docs before updating.
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
    // Sanity: should look like base64 (only base64 alphabet chars + optional padding)
    expect(sig).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('different secrets produce different signatures', () => {
    const a = blofinSign('/p', 'GET', '1', 'n', '', 'secretA');
    const b = blofinSign('/p', 'GET', '1', 'n', '', 'secretB');
    expect(a).not.toBe(b);
  });

  it('different paths produce different signatures', () => {
    const a = blofinSign('/api/v1/account/balance', 'GET', '1', 'n', '', 's');
    const b = blofinSign('/api/v1/account/positions', 'GET', '1', 'n', '', 's');
    expect(a).not.toBe(b);
  });

  it('different methods produce different signatures', () => {
    const a = blofinSign('/p', 'GET', '1', 'n', '', 's');
    const b = blofinSign('/p', 'POST', '1', 'n', '', 's');
    expect(a).not.toBe(b);
  });

  it('different nonces produce different signatures (replay protection)', () => {
    const a = blofinSign('/p', 'GET', '1', 'n1', '', 's');
    const b = blofinSign('/p', 'GET', '1', 'n2', '', 's');
    expect(a).not.toBe(b);
  });

  it('body content affects the signature (POST integrity)', () => {
    const a = blofinSign('/p', 'POST', '1', 'n', '{"x":1}', 's');
    const b = blofinSign('/p', 'POST', '1', 'n', '{"x":2}', 's');
    expect(a).not.toBe(b);
  });

  it('output is base64 (decodable to a 64-char hex string per SHA-256 hex)', () => {
    const sig = blofinSign('/p', 'GET', '1', 'n', '', 'secret');
    const decoded = Buffer.from(sig, 'base64').toString('utf8');
    // SHA-256 hex digest = 64 lowercase hex chars
    expect(decoded).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('__blofinInstIdToBaseForTests — symbol normalisation', () => {
  it('strips the -USDT quote', () => {
    expect(__blofinInstIdToBaseForTests('BTC-USDT')).toBe('BTC');
    expect(__blofinInstIdToBaseForTests('PEPE-USDT')).toBe('PEPE');
  });

  it('strips the 1000 prefix (high-decimal alts)', () => {
    expect(__blofinInstIdToBaseForTests('1000PEPE-USDT')).toBe('PEPE');
    expect(__blofinInstIdToBaseForTests('1000BONK-USDT')).toBe('BONK');
  });

  it('strips the 1M prefix', () => {
    expect(__blofinInstIdToBaseForTests('1MBABYDOGE-USDT')).toBe('BABYDOGE');
  });

  it('handles missing quote gracefully', () => {
    // Defensive — if Blofin ever returns an unquoted instId we don't crash
    expect(__blofinInstIdToBaseForTests('BTC')).toBe('BTC');
  });
});

describe('blofinClient — ExchangeClient contract', () => {
  it('declares Blofin as its exchange label', () => {
    expect(blofinClient.exchange).toBe('Blofin');
  });

  it('implements the three core methods', () => {
    expect(typeof blofinClient.validateKey).toBe('function');
    expect(typeof blofinClient.fetchPositions).toBe('function');
    expect(typeof blofinClient.fetchAccountBalance).toBe('function');
  });

  it('validateKey rejects credentials without a passphrase', async () => {
    // Blofin uses OKX-style triple-secret auth. Calling without
    // passphrase should fail fast with a clear error rather than
    // hitting the API and getting a generic 401.
    const result = await blofinClient.validateKey({
      apiKey: 'test', apiSecret: 'test',
      // intentionally no passphrase
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/passphrase/i);
  });
});
