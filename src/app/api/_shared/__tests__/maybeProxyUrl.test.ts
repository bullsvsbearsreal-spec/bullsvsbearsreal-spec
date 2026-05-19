import { describe, it, expect, beforeEach, vi } from 'vitest';

// PROXY_URL is read at module load — we re-import per test to control it.

describe('maybeProxyUrl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the URL unchanged when PROXY_URL is not set', async () => {
    delete process.env.PROXY_URL;
    const { maybeProxyUrl } = await import('../fetch');
    const url = 'https://example.com/some/path';
    expect(maybeProxyUrl(url)).toBe(url);
  });

  it('routes blocked domains (api.hbdm.com / HTX) through the proxy when configured', async () => {
    process.env.PROXY_URL = 'https://proxy.info-hub.io';
    const { maybeProxyUrl } = await import('../fetch');
    const blocked = 'https://api.hbdm.com/v2/contract';
    const out = maybeProxyUrl(blocked);
    expect(out).toContain('proxy.info-hub.io');
    expect(out).toContain('url=');
    expect(out).toContain(encodeURIComponent(blocked));
  });

  it('routes BitMEX through the proxy', async () => {
    process.env.PROXY_URL = 'https://proxy.info-hub.io';
    const { maybeProxyUrl } = await import('../fetch');
    const blocked = 'https://www.bitmex.com/api/v1/instrument';
    const out = maybeProxyUrl(blocked);
    expect(out).toMatch(/^https:\/\/proxy\.info-hub\.io/);
  });

  it('routes Yahoo Finance through the proxy', async () => {
    process.env.PROXY_URL = 'https://proxy.info-hub.io';
    const { maybeProxyUrl } = await import('../fetch');
    const blocked = 'https://query1.finance.yahoo.com/v7/finance/quote';
    const out = maybeProxyUrl(blocked);
    expect(out).toContain('proxy.info-hub.io');
    expect(out).toContain(encodeURIComponent(blocked));
  });

  it('does NOT proxy unblocked domains (Binance, Bybit)', async () => {
    process.env.PROXY_URL = 'https://proxy.info-hub.io';
    const { maybeProxyUrl } = await import('../fetch');
    expect(maybeProxyUrl('https://fapi.binance.com/fapi/v1/ticker'))
      .toBe('https://fapi.binance.com/fapi/v1/ticker');
    expect(maybeProxyUrl('https://api.bybit.com/v5/market/tickers'))
      .toBe('https://api.bybit.com/v5/market/tickers');
  });

  it('does NOT proxy gateio (works direct from FRA1)', async () => {
    process.env.PROXY_URL = 'https://proxy.info-hub.io';
    const { maybeProxyUrl } = await import('../fetch');
    const url = 'https://api.gateio.ws/api/v4/spot/currencies';
    expect(maybeProxyUrl(url)).toBe(url);
  });

  it('rejects malformed PROXY_URL (must start with https://)', async () => {
    process.env.PROXY_URL = 'http://insecure-proxy.com';  // http, not https
    const { maybeProxyUrl } = await import('../fetch');
    const blocked = 'https://api.hbdm.com/v2/contract';
    // Should pass through unchanged since PROXY_URL was rejected
    expect(maybeProxyUrl(blocked)).toBe(blocked);
  });

  it('strips trailing slashes from PROXY_URL', async () => {
    process.env.PROXY_URL = 'https://proxy.info-hub.io/';  // trailing slash
    const { maybeProxyUrl } = await import('../fetch');
    const blocked = 'https://api.hbdm.com/v2';
    const out = maybeProxyUrl(blocked);
    // Should not have double slashes (proxy.info-hub.io/?url=... not //?url=...)
    expect(out).not.toContain('//?');
  });

  it('handles trailing whitespace / newlines in PROXY_URL (defends against env corruption)', async () => {
    process.env.PROXY_URL = 'https://proxy.info-hub.io\n';
    const { maybeProxyUrl } = await import('../fetch');
    const blocked = 'https://api.hbdm.com/v2/contract';
    const out = maybeProxyUrl(blocked);
    // Should still produce a clean proxy URL
    expect(out).not.toContain('\n');
    expect(out).toContain('proxy.info-hub.io');
  });

  it('handles malformed input URLs without crashing', async () => {
    process.env.PROXY_URL = 'https://proxy.info-hub.io';
    const { maybeProxyUrl } = await import('../fetch');
    // Not a valid URL — should return as-is
    expect(maybeProxyUrl('not-a-url')).toBe('not-a-url');
  });
});
