/**
 * Unit tests for the invite-code helpers — make sure codes are stable,
 * opaque, in the expected alphabet, and validators reject bad input.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeInviteCode, isValidInviteCodeShape, INVITE_CODE_FORMAT } from '../invite';

describe('computeInviteCode', () => {
  beforeEach(() => {
    process.env.INVITE_CODE_SECRET = 'test-secret-fixture';
  });

  it('returns a fixed-length code', () => {
    const code = computeInviteCode('user-abc-123');
    expect(code).toHaveLength(INVITE_CODE_FORMAT.length);
  });

  it('only uses the unambiguous alphabet', () => {
    const code = computeInviteCode('any-user-id');
    for (const ch of code) {
      expect(INVITE_CODE_FORMAT.alphabet).toContain(ch);
    }
    // Sanity: these should never appear
    expect(code).not.toContain('0');
    expect(code).not.toContain('O');
    expect(code).not.toContain('1');
    expect(code).not.toContain('I');
  });

  it('is deterministic for the same user ID + secret', () => {
    const a = computeInviteCode('stable-user');
    const b = computeInviteCode('stable-user');
    expect(a).toBe(b);
  });

  it('produces different codes for different user IDs', () => {
    const a = computeInviteCode('user-a');
    const b = computeInviteCode('user-b');
    expect(a).not.toBe(b);
  });

  it('changes when the secret changes (codes are opaque, not predictable)', () => {
    process.env.INVITE_CODE_SECRET = 'secret-one';
    const a = computeInviteCode('same-user');
    process.env.INVITE_CODE_SECRET = 'secret-two';
    const b = computeInviteCode('same-user');
    expect(a).not.toBe(b);
  });
});

describe('isValidInviteCodeShape', () => {
  it('accepts a well-formed code', () => {
    const code = computeInviteCode('valid-user');
    expect(isValidInviteCodeShape(code)).toBe(true);
  });

  it('rejects empty / null / undefined / wrong type', () => {
    expect(isValidInviteCodeShape('')).toBe(false);
    expect(isValidInviteCodeShape(null)).toBe(false);
    expect(isValidInviteCodeShape(undefined)).toBe(false);
    expect(isValidInviteCodeShape(123)).toBe(false);
    expect(isValidInviteCodeShape({})).toBe(false);
  });

  it('rejects wrong-length codes', () => {
    expect(isValidInviteCodeShape('SHORT')).toBe(false);
    expect(isValidInviteCodeShape('A'.repeat(INVITE_CODE_FORMAT.length + 1))).toBe(false);
  });

  it('rejects codes containing ambiguous chars', () => {
    // Build a code that's the right length but uses a banned char
    const bad = '0'.repeat(INVITE_CODE_FORMAT.length);
    expect(isValidInviteCodeShape(bad)).toBe(false);
  });

  it('rejects lowercase versions of a valid code', () => {
    const code = computeInviteCode('lowercase-test');
    expect(isValidInviteCodeShape(code.toLowerCase())).toBe(false);
  });

  it('rejects codes with whitespace', () => {
    const code = computeInviteCode('ws-test');
    expect(isValidInviteCodeShape(' ' + code.slice(1))).toBe(false);
    expect(isValidInviteCodeShape(code.slice(0, -1) + ' ')).toBe(false);
  });
});
