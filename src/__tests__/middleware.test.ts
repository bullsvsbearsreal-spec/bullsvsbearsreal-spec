import { describe, it, expect } from 'vitest';
import { shouldSkip, AUTH_PATHS } from '../middleware';

describe('shouldSkip — middleware bucket bypass list', () => {
  it('returns true for /api/chat (has its own limiter)', () => {
    expect(shouldSkip('/api/chat')).toBe(true);
  });

  it('returns true for any /api/admin/* path (auth-protected)', () => {
    expect(shouldSkip('/api/admin/feedback')).toBe(true);
    expect(shouldSkip('/api/admin/users')).toBe(true);
    expect(shouldSkip('/api/admin/actions/trigger-cron')).toBe(true);
  });

  it('returns true for any /api/cron/* path (internal cron)', () => {
    expect(shouldSkip('/api/cron/snapshot')).toBe(true);
    expect(shouldSkip('/api/cron/whale-trades')).toBe(true);
    expect(shouldSkip('/api/cron/auto-tweet')).toBe(true);
  });

  it('returns true for /api/telegram/webhook', () => {
    expect(shouldSkip('/api/telegram/webhook')).toBe(true);
  });

  it('returns false for regular API paths (they need the limiter)', () => {
    expect(shouldSkip('/api/funding')).toBe(false);
    expect(shouldSkip('/api/openinterest')).toBe(false);
    expect(shouldSkip('/api/liquidations')).toBe(false);
    expect(shouldSkip('/api/tickers')).toBe(false);
  });

  it('returns false for /api/auth/* (they need strict bucket)', () => {
    expect(shouldSkip('/api/auth/signup')).toBe(false);
    expect(shouldSkip('/api/auth/session')).toBe(false);
  });

  it('returns false for v1 paths (they have their own bearer-token flow)', () => {
    // shouldSkip returns false, the middleware then routes them to handleV1Route
    expect(shouldSkip('/api/v1/status')).toBe(false);
    expect(shouldSkip('/api/v1/funding')).toBe(false);
  });

  it('partial matches do NOT skip (must start with full /api/admin/ or /api/cron/)', () => {
    expect(shouldSkip('/api/admin')).toBe(false);  // no trailing slash
    expect(shouldSkip('/api/cron')).toBe(false);
    // /api/chat must be EXACTLY '/api/chat', not '/api/chat/x'
    expect(shouldSkip('/api/chat/messages')).toBe(false);
  });
});

describe('AUTH_PATHS — strict-bucket auth routes', () => {
  it('is a non-empty Set', () => {
    expect(AUTH_PATHS).toBeInstanceOf(Set);
    expect(AUTH_PATHS.size).toBeGreaterThan(0);
  });

  it('contains the critical write paths', () => {
    expect(AUTH_PATHS.has('/api/auth/signup')).toBe(true);
    expect(AUTH_PATHS.has('/api/auth/forgot-password')).toBe(true);
    expect(AUTH_PATHS.has('/api/auth/reset-password')).toBe(true);
    expect(AUTH_PATHS.has('/api/auth/verify-email')).toBe(true);
    expect(AUTH_PATHS.has('/api/auth/2fa/challenge')).toBe(true);
  });

  it('does NOT contain read-only NextAuth endpoints (those hit moderate bucket)', () => {
    // Per CLAUDE.md: useSession() fires /api/auth/session on every page load.
    // If this set contained 'session', any user browsing 6 pages in 15 min
    // would trip the strict 5-req limit and see auth errors. Regression
    // guard against accidentally adding it.
    expect(AUTH_PATHS.has('/api/auth/session')).toBe(false);
    expect(AUTH_PATHS.has('/api/auth/csrf')).toBe(false);
    expect(AUTH_PATHS.has('/api/auth/providers')).toBe(false);
    expect(AUTH_PATHS.has('/api/auth/callback')).toBe(false);
  });

  it('every entry starts with /api/auth/', () => {
    AUTH_PATHS.forEach((p) => {
      expect(p.startsWith('/api/auth/')).toBe(true);
    });
  });
});
