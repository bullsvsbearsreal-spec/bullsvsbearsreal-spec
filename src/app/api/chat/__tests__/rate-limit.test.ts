import { describe, it, expect, beforeEach, vi } from 'vitest';

// The module uses top-level singleton state for the limit counters.
// We reset modules between tests so counters start fresh.

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('allows a fresh IP request', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const r = checkRateLimit('1.2.3.4', 100);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(99);  // 100 - 1
    expect(r.error).toBeUndefined();
  });

  it('rejects messages over MAX_INPUT_LENGTH (1000 chars)', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const r = checkRateLimit('1.2.3.4', 1001);
    expect(r.allowed).toBe(false);
    expect(r.error).toContain('Message too long');
  });

  it('decrements `remaining` on consecutive requests from same IP', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const a = checkRateLimit('5.5.5.5', 50);
    const b = checkRateLimit('5.5.5.5', 50);
    const c = checkRateLimit('5.5.5.5', 50);
    expect(a.remaining).toBeGreaterThan(b.remaining);
    expect(b.remaining).toBeGreaterThan(c.remaining);
  });

  it('different IPs have independent counters', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const fromA = checkRateLimit('10.10.10.10', 100);
    const fromB = checkRateLimit('20.20.20.20', 100);
    expect(fromA.allowed).toBe(true);
    expect(fromB.allowed).toBe(true);
    // Both should be at remaining=99 (fresh IPs)
    expect(fromA.remaining).toBe(99);
    expect(fromB.remaining).toBe(99);
  });

  it('blocks after MAX_PER_IP (100) hits for same IP', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const ip = '99.99.99.99';
    // Burn through the daily quota
    for (let i = 0; i < 100; i++) {
      checkRateLimit(ip, 50);
    }
    // 101st should be rejected
    const r = checkRateLimit(ip, 50);
    expect(r.allowed).toBe(false);
    expect(r.error).toContain('Daily limit reached');
  });

  it('returns allowed=true with positive remaining for valid requests', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const r = checkRateLimit('200.200.200.200', 1);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeGreaterThanOrEqual(0);
  });

  it('returns allowed=false with remaining=0 when over input length', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const r = checkRateLimit('any', 9999);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('handles empty input as 0 length (valid)', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const r = checkRateLimit('250.250.250.250', 0);
    expect(r.allowed).toBe(true);
  });

  it('accepts inputs exactly at the limit (1000 chars)', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const r = checkRateLimit('260.260.260.260', 1000);
    expect(r.allowed).toBe(true);
  });

  it('rejects inputs one over the limit (1001 chars)', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const r = checkRateLimit('270.270.270.270', 1001);
    expect(r.allowed).toBe(false);
  });
});
