import { describe, it, expect } from 'vitest';
import robots from '../robots';

describe('robots()', () => {
  const config = robots();

  it('returns a config with rules + sitemap + host', () => {
    expect(config.rules).toBeDefined();
    expect(config.sitemap).toBeDefined();
    expect(config.host).toBeDefined();
  });

  it('host + sitemap point to info-hub.io', () => {
    expect(config.host).toBe('https://info-hub.io');
    expect(config.sitemap).toBe('https://info-hub.io/sitemap.xml');
  });

  it('has at least one rule', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    expect(rules.length).toBeGreaterThan(0);
  });

  it('applies rules to user-agent *', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    expect(rules[0].userAgent).toBe('*');
  });

  it('allows root / (public homepage)', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const allow = rules[0].allow;
    expect(allow).toContain('/');
  });

  it('explicitly allows public no-auth API endpoints (/api/v1/status + /api/v1/openapi)', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const allow = rules[0].allow;
    expect(allow).toContain('/api/v1/status');
    expect(allow).toContain('/api/v1/openapi');
  });

  it('disallows /api/ generally (server endpoints not useful in search)', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const disallow = rules[0].disallow;
    expect(disallow).toContain('/api/');
  });

  it('disallows admin surfaces', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const disallow = rules[0].disallow;
    expect(disallow).toContain('/admin');
    expect(disallow).toContain('/admin-panel');
  });

  it('disallows auth-gated personal surfaces', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const disallow = rules[0].disallow;
    expect(disallow).toContain('/account/');
    expect(disallow).toContain('/profile');
    expect(disallow).toContain('/portfolio');
    expect(disallow).toContain('/dashboard');
    expect(disallow).toContain('/positions');
  });

  it('disallows auth-flow URLs', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const disallow = rules[0].disallow;
    expect(disallow).toContain('/reset-password');
    expect(disallow).toContain('/forgot-password');
  });

  it('does NOT block AI training crawlers (no per-userAgent rules for GPTBot etc)', () => {
    // Per the comment in robots.ts — we intentionally don't block AI crawlers
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    // Only one rule, with userAgent='*' — no specific block rules
    const aiBlockingRules = rules.filter((r) => {
      const ua = r.userAgent;
      if (typeof ua === 'string' && ua !== '*') return true;
      if (Array.isArray(ua) && ua.some((u) => u !== '*')) return true;
      return false;
    });
    expect(aiBlockingRules.length).toBe(0);
  });
});
