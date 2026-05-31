import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  negativeKeyCacheHas,
  negativeKeyCacheSet,
  preAuthIpAllowed,
  PREAUTH_MAX_PER_MIN,
  clearApiKeyCache,
} from '../v1-auth';

afterEach(() => {
  vi.useRealTimers();
  clearApiKeyCache(); // also clears the negative cache between cases
});

describe('negativeKeyCache (rejected-key memo — avoids re-querying the DB)', () => {
  it('returns false for an unknown key hash', () => {
    expect(negativeKeyCacheHas('never-seen-hash-aaa')).toBe(false);
  });

  it('returns true immediately after a key hash is recorded', () => {
    negativeKeyCacheSet('bad-hash-bbb');
    expect(negativeKeyCacheHas('bad-hash-bbb')).toBe(true);
  });

  it('expires an entry after the 60s TTL', () => {
    vi.useFakeTimers();
    negativeKeyCacheSet('bad-hash-ccc');
    expect(negativeKeyCacheHas('bad-hash-ccc')).toBe(true);
    vi.advanceTimersByTime(61_000); // past TTL
    expect(negativeKeyCacheHas('bad-hash-ccc')).toBe(false);
  });

  it('is cleared by clearApiKeyCache (revocation safety)', () => {
    negativeKeyCacheSet('bad-hash-ddd');
    expect(negativeKeyCacheHas('bad-hash-ddd')).toBe(true);
    clearApiKeyCache();
    expect(negativeKeyCacheHas('bad-hash-ddd')).toBe(false);
  });
});

describe('preAuthIpAllowed (per-IP throttle on uncached validations)', () => {
  it('allows up to PREAUTH_MAX_PER_MIN then blocks the same IP', () => {
    const ip = 'ip-allow-then-block';
    for (let i = 0; i < PREAUTH_MAX_PER_MIN; i++) {
      expect(preAuthIpAllowed(ip)).toBe(true);
    }
    expect(preAuthIpAllowed(ip)).toBe(false);
  });

  it('tracks IPs independently — one exhausted IP does not block another', () => {
    const a = 'ip-independent-a';
    const b = 'ip-independent-b';
    for (let i = 0; i < PREAUTH_MAX_PER_MIN; i++) preAuthIpAllowed(a);
    expect(preAuthIpAllowed(a)).toBe(false); // a exhausted
    expect(preAuthIpAllowed(b)).toBe(true);  // b still fresh
  });

  it('resets the budget after the 60s window elapses', () => {
    vi.useFakeTimers();
    const ip = 'ip-window-reset';
    for (let i = 0; i < PREAUTH_MAX_PER_MIN; i++) preAuthIpAllowed(ip);
    expect(preAuthIpAllowed(ip)).toBe(false);
    vi.advanceTimersByTime(61_000); // past window
    expect(preAuthIpAllowed(ip)).toBe(true);
  });
});
