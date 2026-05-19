import { describe, it, expect, vi } from 'vitest';

describe('/api/v1/status route', () => {
  it('GET handler returns operational status JSON', async () => {
    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('operational');
    expect(body.version).toBe('v1');
  });

  it('exposes the fee model identifier so partners can bump-detect', async () => {
    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json();
    expect(body.feeModel).toBeDefined();
    expect(body.feeModel.version).toBeTruthy();
    expect(body.feeModel.updatedAt).toBeTruthy();
    expect(Array.isArray(body.feeModel.surfacedOn)).toBe(true);
  });

  it('lists tiers with rateLimit + dailyLimit strings', async () => {
    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json();
    expect(body.tiers).toBeDefined();
    expect(body.tiers.free).toBeDefined();
    expect(body.tiers.pro).toBeDefined();
    expect(body.tiers.free.rateLimit).toMatch(/req\/min/);
    expect(body.tiers.free.dailyLimit).toMatch(/req\/day/);
    expect(body.tiers.pro.rateLimit).toMatch(/req\/min/);
  });

  it('tier rate-limit strings reflect the actual constants', async () => {
    const { FREE_TIER_PER_MINUTE, PRO_TIER_PER_MINUTE, FREE_TIER_PER_DAY } =
      await import('@/lib/api/rate-limit');
    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json();
    expect(body.tiers.free.rateLimit).toBe(`${FREE_TIER_PER_MINUTE} req/min`);
    expect(body.tiers.free.dailyLimit).toBe(`${FREE_TIER_PER_DAY.toLocaleString()} req/day`);
    expect(body.tiers.pro.rateLimit).toBe(`${PRO_TIER_PER_MINUTE} req/min`);
  });

  it('lists at least 10 endpoint descriptions (sanity check)', async () => {
    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json();
    expect(Array.isArray(body.endpoints)).toBe(true);
    expect(body.endpoints.length).toBeGreaterThan(10);
    body.endpoints.forEach((ep: { path: string; method: string; description: string }) => {
      expect(ep.path).toMatch(/^\/api\/v1\//);
      expect(['GET', 'POST']).toContain(ep.method);
      expect(ep.description).toBeTruthy();
    });
  });

  it('includes X-Fee-Model-Version + X-Fee-Model-Updated-At headers', async () => {
    const { GET } = await import('../route');
    const res = await GET();
    expect(res.headers.get('X-Fee-Model-Version')).toBeTruthy();
    expect(res.headers.get('X-Fee-Model-Updated-At')).toBeTruthy();
  });

  it('sets Cache-Control for edge caching (no-auth endpoint)', async () => {
    const { GET } = await import('../route');
    const res = await GET();
    const cc = res.headers.get('Cache-Control');
    expect(cc).toBeTruthy();
    expect(cc).toMatch(/s-maxage=/);
  });

  it('includes a documentation URL', async () => {
    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json();
    expect(body.documentation).toBe('https://info-hub.io/developers/docs');
  });

  it('includes a timestamp (current ms epoch)', async () => {
    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json();
    expect(typeof body.timestamp).toBe('number');
    // Should be within the last 60s
    expect(Math.abs(Date.now() - body.timestamp)).toBeLessThan(60_000);
  });
});
