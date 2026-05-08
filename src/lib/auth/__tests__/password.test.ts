/**
 * Tests for validatePassword — used in signup, change-password,
 * and reset-password routes. A regression here could weaken account
 * security, so locking in the rules with explicit tests.
 */
import { describe, it, expect } from 'vitest';
import { validatePassword } from '../password';

describe('validatePassword — happy path', () => {
  it('accepts a password meeting all rules', () => {
    const r = validatePassword('Password123');
    expect(r.ok).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it('accepts complex passwords with symbols', () => {
    expect(validatePassword('Aa1!@#$%^&*()').ok).toBe(true);
    expect(validatePassword('Hunter2!').ok).toBe(true);
  });
});

describe('validatePassword — length rule', () => {
  it('rejects empty password', () => {
    const r = validatePassword('');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/at least 8/);
  });

  it('rejects 7-character password', () => {
    expect(validatePassword('Abc123x').ok).toBe(false);
  });

  it('accepts exactly 8-character password', () => {
    expect(validatePassword('Abc1234x').ok).toBe(true);
  });

  it('handles undefined-like falsy values', () => {
    expect(validatePassword(null as any).ok).toBe(false);
    expect(validatePassword(undefined as any).ok).toBe(false);
  });
});

describe('validatePassword — character class rules', () => {
  it('requires uppercase letter', () => {
    const r = validatePassword('password123');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/uppercase/);
  });

  it('requires lowercase letter', () => {
    const r = validatePassword('PASSWORD123');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/lowercase/);
  });

  it('requires a digit', () => {
    const r = validatePassword('PasswordOnly');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/number/);
  });

  it('rejects all-uppercase even at long length', () => {
    expect(validatePassword('ABCDEFGHIJK').ok).toBe(false);
  });

  it('rejects all-lowercase even at long length', () => {
    expect(validatePassword('abcdefghijk').ok).toBe(false);
  });

  it('rejects all-digits even at long length', () => {
    expect(validatePassword('12345678901').ok).toBe(false);
  });
});

describe('validatePassword — error message ordering', () => {
  // Length error fires FIRST so users fix the most important issue first.
  it('reports length error before character-class errors', () => {
    const r = validatePassword('short');
    expect(r.error).toMatch(/at least 8/);
  });

  it('reports uppercase before lowercase', () => {
    const r = validatePassword('lowercase123');
    expect(r.error).toMatch(/uppercase/);
  });

  it('reports lowercase before digit', () => {
    const r = validatePassword('UPPERCASE123');
    expect(r.error).toMatch(/lowercase/);
  });
});
