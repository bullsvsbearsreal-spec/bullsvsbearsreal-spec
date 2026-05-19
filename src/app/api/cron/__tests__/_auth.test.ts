import { describe, it, expect, beforeEach, vi } from 'vitest';

// CRON_SECRET is read at module load — we need to re-import per test so each
// test can configure its own secret.

function makeRequest(authHeader: string | null): { headers: { get: (k: string) => string | null } } {
  return {
    headers: { get: (k: string) => k === 'authorization' ? authHeader : null },
  };
}

describe('verifyCronAuth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null (authorized) when Authorization matches Bearer <secret>', async () => {
    process.env.CRON_SECRET = 'my-test-secret';
    const { verifyCronAuth } = await import('../_auth');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = verifyCronAuth(makeRequest('Bearer my-test-secret') as any);
    expect(result).toBeNull();
  });

  it('returns 401 NextResponse on missing Authorization header', async () => {
    process.env.CRON_SECRET = 'my-test-secret';
    const { verifyCronAuth } = await import('../_auth');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = verifyCronAuth(makeRequest(null) as any);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('returns 401 on wrong secret (length mismatch)', async () => {
    process.env.CRON_SECRET = 'my-test-secret';
    const { verifyCronAuth } = await import('../_auth');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = verifyCronAuth(makeRequest('Bearer wrong') as any);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('returns 401 on wrong secret (same length, different chars)', async () => {
    process.env.CRON_SECRET = 'my-test-secret';
    const { verifyCronAuth } = await import('../_auth');
    // 'my-test-secret'.length === 14, build a wrong same-length value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = verifyCronAuth(makeRequest('Bearer wrong-fake-key') as any);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET env var is empty (defense against misconfig)', async () => {
    delete process.env.CRON_SECRET;
    const { verifyCronAuth } = await import('../_auth');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = verifyCronAuth(makeRequest('Bearer anything') as any);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('trims trailing whitespace from CRON_SECRET (defends against env var newlines)', async () => {
    // The module trims at load time
    process.env.CRON_SECRET = '  my-secret  ';
    const { verifyCronAuth } = await import('../_auth');
    // After trim, secret = 'my-secret'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = verifyCronAuth(makeRequest('Bearer my-secret') as any);
    expect(result).toBeNull();
  });

  it('returns 401 on Authorization missing the Bearer prefix', async () => {
    process.env.CRON_SECRET = 'my-test-secret';
    const { verifyCronAuth } = await import('../_auth');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = verifyCronAuth(makeRequest('my-test-secret') as any);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('error response is JSON with a generic "Unauthorized" body', async () => {
    process.env.CRON_SECRET = 'secret';
    const { verifyCronAuth } = await import('../_auth');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = verifyCronAuth(makeRequest('Bearer wrong-key-here') as any);
    expect(result).not.toBeNull();
    if (result) {
      const body = await result.json();
      expect(body.error).toBe('Unauthorized');
    }
  });
});
