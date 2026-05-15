/**
 * MEXC client unit tests — pure functions only (signature + symbol
 * parser). Network-touching paths (validateKey, fetchPositions,
 * fetchCumulativeFunding) are covered by manual smoke-testing against
 * a real key, same as the other CEX clients in this directory.
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { __mexcSignForTests, __mexcSymbolToBaseForTests } from '../mexc';

describe('mexc — signature', () => {
  it('returns HMAC-SHA256 hex over the prehash with the API secret', () => {
    const apiKey = 'demo-key';
    const apiSecret = 'demo-secret';
    const timestamp = '1700000000000';
    const query = 'page_num=1&page_size=100';

    const prehash = `${apiKey}${timestamp}${query}`;
    const expected = createHmac('sha256', apiSecret).update(prehash).digest('hex');

    expect(__mexcSignForTests(prehash, apiSecret)).toBe(expected);
  });

  it('produces 64-char lowercase hex output (SHA-256 hex contract)', () => {
    const sig = __mexcSignForTests('anything', 'whatever');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different signatures for different secrets (sanity)', () => {
    const a = __mexcSignForTests('payload', 'secret-a');
    const b = __mexcSignForTests('payload', 'secret-b');
    expect(a).not.toBe(b);
  });

  it('produces different signatures for different timestamps with the same query', () => {
    // The signing prehash includes the timestamp, so re-submitting a
    // request a millisecond later must produce a different signature.
    // Otherwise replay protection on MEXC's side is meaningless.
    const apiKey = 'k';
    const secret = 's';
    const query = 'page_num=1';
    const sig1 = __mexcSignForTests(`${apiKey}1700000000000${query}`, secret);
    const sig2 = __mexcSignForTests(`${apiKey}1700000000001${query}`, secret);
    expect(sig1).not.toBe(sig2);
  });

  it('handles empty query string (no params on validateKey + open_positions)', () => {
    // /api/v1/private/account/assets and /open_positions both take no
    // params. The prehash collapses to apiKey + timestamp, and the
    // signature must still be 64-hex-char.
    const sig = __mexcSignForTests('keyabc1700000000000', 'secret');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('mexc — symbolToBase', () => {
  it('strips the _USDT quote suffix to recover the base asset', () => {
    expect(__mexcSymbolToBaseForTests('BTC_USDT')).toBe('BTC');
    expect(__mexcSymbolToBaseForTests('ETH_USDT')).toBe('ETH');
    expect(__mexcSymbolToBaseForTests('SOL_USDT')).toBe('SOL');
  });

  it('strips the 1000-prefix that MEXC uses for low-priced tokens', () => {
    // Matches the Binance convention — '1000PEPE_USDT' is a perp on
    // 1000 PEPE per contract unit, so the underlying base is still PEPE.
    // The /funding aggregator stores 'PEPE' so a base of '1000PEPE'
    // would miss the join.
    expect(__mexcSymbolToBaseForTests('1000PEPE_USDT')).toBe('PEPE');
    expect(__mexcSymbolToBaseForTests('1000SHIB_USDT')).toBe('SHIB');
    expect(__mexcSymbolToBaseForTests('1000BONK_USDT')).toBe('BONK');
  });

  it('strips the 1M-prefix for the million-multiplier symbols', () => {
    expect(__mexcSymbolToBaseForTests('1MBABYDOGE_USDT')).toBe('BABYDOGE');
  });

  it('leaves regular tickers untouched when no _ separator is present', () => {
    // Defensive: if MEXC ever serves a symbol without the underscore
    // (unlikely on futures, possible on some indexes), don't blow up.
    expect(__mexcSymbolToBaseForTests('BTC')).toBe('BTC');
  });

  it('does not strip a leading "10" that is part of the ticker', () => {
    // "10INCH" is not a real MEXC symbol, but the parser should NOT
    // treat the leading "10" as the 1000-prefix — only an exact "1000"
    // prefix should trigger the strip. Guards against an over-eager
    // regex.
    expect(__mexcSymbolToBaseForTests('10INCH_USDT')).toBe('10INCH');
  });

  it('does not strip a leading "1" that is part of the ticker', () => {
    // "1INCH" should pass through untouched. The "1M" strip only fires
    // on exactly "1M" + something — same defensive shape as the
    // 1000-prefix check.
    expect(__mexcSymbolToBaseForTests('1INCH_USDT')).toBe('1INCH');
  });
});
