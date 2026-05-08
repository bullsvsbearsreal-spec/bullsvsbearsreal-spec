/**
 * Tests for isValidEmail — used by signup, password-reset, and
 * verification flows. Regex looseness here would let invalid emails
 * into the user table; tightness would lock out legitimate users.
 */
import { describe, it, expect } from 'vitest';
import { isValidEmail } from '../rate-limit';

describe('isValidEmail — accepts standard emails', () => {
  it('accepts simple addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
  });

  it('accepts addresses with dots in the local part', () => {
    expect(isValidEmail('first.last@example.com')).toBe(true);
    expect(isValidEmail('a.b.c@example.com')).toBe(true);
  });

  it('accepts addresses with plus-tags', () => {
    expect(isValidEmail('user+filter@example.com')).toBe(true);
  });

  it('accepts subdomains', () => {
    expect(isValidEmail('user@mail.example.co.uk')).toBe(true);
  });

  it('accepts numeric domains', () => {
    expect(isValidEmail('user@example123.com')).toBe(true);
  });
});

describe('isValidEmail — rejects malformed addresses', () => {
  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects missing @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects missing local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('rejects missing TLD dot', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });

  it('rejects whitespace in any part', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
    expect(isValidEmail('user@ example.com')).toBe(false);
    expect(isValidEmail('user@example .com')).toBe(false);
    expect(isValidEmail('  user@example.com  ')).toBe(false);
  });

  it('rejects multiple @ symbols', () => {
    expect(isValidEmail('user@@example.com')).toBe(false);
    expect(isValidEmail('user@a@example.com')).toBe(false);
  });
});

describe('isValidEmail — length cap', () => {
  it('rejects emails longer than 254 chars (RFC 5321 cap)', () => {
    const longLocal = 'a'.repeat(245);
    const email = `${longLocal}@b.co`; // 245 + 1 + 4 = 250 → still OK
    expect(isValidEmail(email)).toBe(true);

    const tooLong = `${'a'.repeat(250)}@b.co`; // 250 + 1 + 4 = 255 → over cap
    expect(isValidEmail(tooLong)).toBe(false);
  });

  it('accepts emails right at the 254-char cap', () => {
    // Construct exactly 254 chars
    const local = 'a'.repeat(247); // 247 + 1 + 6 = 254
    const email = `${local}@bb.com`;
    expect(email.length).toBe(254);
    expect(isValidEmail(email)).toBe(true);
  });
});
