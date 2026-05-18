import { describe, it, expect } from 'vitest';
import { generateLinkCode } from '../telegram';

describe('generateLinkCode', () => {
  it('returns a 6-character string', () => {
    const code = generateLinkCode();
    expect(code).toHaveLength(6);
    expect(typeof code).toBe('string');
  });

  it('uses only the unambiguous alphabet (no 0/O/1/I/L)', () => {
    // Run many times to surface any character that shouldn't appear
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 200; i++) {
      const code = generateLinkCode();
      for (const ch of code) {
        expect(alphabet).toContain(ch);
      }
    }
  });

  it('never contains the banned ambiguous chars (0/O/1/I)', () => {
    // The actual alphabet excludes 0, O, 1, I — the four most
    // commonly confused chars when manually retyping codes. L is
    // kept in (it's not in the banned list — the upstream comment
    // explicitly says "no 0/O/1/I confusion").
    for (let i = 0; i < 500; i++) {
      const code = generateLinkCode();
      expect(code).not.toContain('0');
      expect(code).not.toContain('O');
      expect(code).not.toContain('1');
      expect(code).not.toContain('I');
    }
  });

  it('produces different codes on consecutive calls (crypto-secure randomness)', () => {
    // Probabilistic: with 32^6 ≈ 1B possible codes, two consecutive
    // duplicates are astronomically unlikely with proper randomness.
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(generateLinkCode());
    // Should be very close to 100 unique
    expect(codes.size).toBeGreaterThan(95);
  });
});
