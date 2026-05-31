import { describe, it, expect } from 'vitest';
import { hashIpForLog } from '../v1-auth';

describe('hashIpForLog', () => {
  it('returns null for missing / unknown IPs (nothing useful to record)', () => {
    expect(hashIpForLog(null)).toBeNull();
    expect(hashIpForLog(undefined)).toBeNull();
    expect(hashIpForLog('')).toBeNull();
    expect(hashIpForLog('unknown')).toBeNull();
  });

  it('returns a 32-char lowercase hex hash for a real IP', () => {
    const h = hashIpForLog('203.0.113.7');
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is deterministic — same IP yields the same hash within a process', () => {
    expect(hashIpForLog('198.51.100.4')).toBe(hashIpForLog('198.51.100.4'));
  });

  it('maps distinct IPs to distinct hashes', () => {
    expect(hashIpForLog('10.0.0.1')).not.toBe(hashIpForLog('10.0.0.2'));
  });

  it('never leaks the raw IP into the stored value (pseudonymous)', () => {
    const ip = '192.0.2.55';
    const h = hashIpForLog(ip);
    expect(h).not.toBeNull();
    expect(h!.includes(ip)).toBe(false);
  });
});
