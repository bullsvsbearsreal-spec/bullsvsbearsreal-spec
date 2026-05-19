import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('isDBConfigured', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns true when DATABASE_URL env var is set', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    const { isDBConfigured } = await import('../index');
    expect(isDBConfigured()).toBe(true);
  });

  it('returns false when DATABASE_URL is unset', async () => {
    delete process.env.DATABASE_URL;
    const { isDBConfigured } = await import('../index');
    expect(isDBConfigured()).toBe(false);
  });

  it('returns false when DATABASE_URL is an empty string', async () => {
    process.env.DATABASE_URL = '';
    const { isDBConfigured } = await import('../index');
    expect(isDBConfigured()).toBe(false);
  });
});
