import { describe, it, expect } from 'vitest';
import { clearApiKeyCache } from '../v1-auth';

describe('clearApiKeyCache', () => {
  it('exists and is callable', () => {
    expect(typeof clearApiKeyCache).toBe('function');
  });

  it('returns undefined (side-effect only)', () => {
    expect(clearApiKeyCache()).toBeUndefined();
  });

  it('can be called multiple times without error', () => {
    expect(() => {
      clearApiKeyCache();
      clearApiKeyCache();
      clearApiKeyCache();
    }).not.toThrow();
  });

  it('does not require any arguments', () => {
    // Type-level: the signature takes no args. Calling with extras throws TS
    // but at runtime the call should work via array-spread.
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (clearApiKeyCache as any)('extra', 'args', 'ignored');
    }).not.toThrow();
  });
});
