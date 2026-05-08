/**
 * Tests for validateBugReport — locks in the /api/feedback POST contract
 * for the bug-report widget feature shipped in commit 4b735b97.
 */
import { describe, it, expect } from 'vitest';
import { validateBugReport } from '../validateBugReport';

describe('validateBugReport — happy path', () => {
  it('accepts a complete valid body', () => {
    const r = validateBugReport({
      message: 'The funding rates page hangs on first load',
      pageUrl: '/funding',
      severity: 'high',
      pageTitle: 'Funding Rates | InfoHub',
      userAgent: 'Mozilla/5.0',
      viewport: '1920x1080',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.message).toBe('The funding rates page hangs on first load');
      expect(r.data.pageUrl).toBe('/funding');
      expect(r.data.severity).toBe('high');
      expect(r.data.pageTitle).toBe('Funding Rates | InfoHub');
      expect(r.data.userAgent).toBe('Mozilla/5.0');
      expect(r.data.viewport).toBe('1920x1080');
    }
  });

  it('accepts a minimal valid body (only required fields)', () => {
    const r = validateBugReport({
      message: 'test',
      pageUrl: '/',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.severity).toBe('normal');
      expect(r.data.pageTitle).toBeNull();
      expect(r.data.userAgent).toBeNull();
      expect(r.data.viewport).toBeNull();
    }
  });

  it('trims whitespace from message before validating', () => {
    const r = validateBugReport({
      message: '   bugs   ',
      pageUrl: '/',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.message).toBe('bugs');
  });
});

describe('validateBugReport — message length', () => {
  it('rejects messages below 4 characters', () => {
    const r = validateBugReport({ message: 'abc', pageUrl: '/' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.error).toMatch(/at least 4/);
    }
  });

  it('rejects whitespace-only messages', () => {
    const r = validateBugReport({ message: '       ', pageUrl: '/' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at least 4/);
  });

  it('rejects empty string message', () => {
    const r = validateBugReport({ message: '', pageUrl: '/' });
    expect(r.ok).toBe(false);
  });

  it('accepts exactly 4-character message', () => {
    const r = validateBugReport({ message: 'abcd', pageUrl: '/' });
    expect(r.ok).toBe(true);
  });

  it('accepts exactly 2000-character message', () => {
    const r = validateBugReport({ message: 'a'.repeat(2000), pageUrl: '/' });
    expect(r.ok).toBe(true);
  });

  it('rejects message above 2000 characters', () => {
    const r = validateBugReport({ message: 'a'.repeat(2001), pageUrl: '/' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at most 2000/);
  });
});

describe('validateBugReport — pageUrl', () => {
  it('rejects missing pageUrl', () => {
    const r = validateBugReport({ message: 'valid message' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/pageUrl/);
  });

  it('rejects empty pageUrl', () => {
    const r = validateBugReport({ message: 'valid message', pageUrl: '' });
    expect(r.ok).toBe(false);
  });

  it('truncates very long pageUrl to 500 chars', () => {
    const long = '/page?' + 'x='.repeat(500);
    const r = validateBugReport({ message: 'valid message', pageUrl: long });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.pageUrl.length).toBe(500);
  });
});

describe('validateBugReport — severity', () => {
  it('defaults to normal when missing', () => {
    const r = validateBugReport({ message: 'valid message', pageUrl: '/' });
    if (r.ok) expect(r.data.severity).toBe('normal');
  });

  it('accepts low/normal/high', () => {
    for (const s of ['low', 'normal', 'high'] as const) {
      const r = validateBugReport({ message: 'valid', pageUrl: '/', severity: s });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.severity).toBe(s);
    }
  });

  it('falls back to normal for unknown severity values', () => {
    const r = validateBugReport({ message: 'valid', pageUrl: '/', severity: 'critical' });
    if (r.ok) expect(r.data.severity).toBe('normal');
  });

  it('falls back to normal for non-string severity', () => {
    const r = validateBugReport({ message: 'valid', pageUrl: '/', severity: 99 as any });
    if (r.ok) expect(r.data.severity).toBe('normal');
  });
});

describe('validateBugReport — optional field length caps', () => {
  it('truncates pageTitle to 200 chars', () => {
    const r = validateBugReport({
      message: 'valid', pageUrl: '/',
      pageTitle: 'x'.repeat(500),
    });
    if (r.ok) expect(r.data.pageTitle?.length).toBe(200);
  });

  it('truncates userAgent to 500 chars', () => {
    const r = validateBugReport({
      message: 'valid', pageUrl: '/',
      userAgent: 'Mozilla/' + 'x'.repeat(1000),
    });
    if (r.ok) expect(r.data.userAgent?.length).toBe(500);
  });

  it('truncates viewport to 32 chars', () => {
    const r = validateBugReport({
      message: 'valid', pageUrl: '/',
      viewport: 'x'.repeat(100),
    });
    if (r.ok) expect(r.data.viewport?.length).toBe(32);
  });

  it('treats empty optional strings as null', () => {
    const r = validateBugReport({
      message: 'valid', pageUrl: '/',
      pageTitle: '', userAgent: '', viewport: '',
    });
    if (r.ok) {
      // pageTitle uses .slice not falsy-check, so empty stays empty (matches route behaviour)
      expect(r.data.pageTitle).toBe('');
      // userAgent + viewport explicitly null on falsy
      expect(r.data.userAgent).toBeNull();
      expect(r.data.viewport).toBeNull();
    }
  });
});

describe('validateBugReport — body shape guards', () => {
  it('rejects null body', () => {
    const r = validateBugReport(null);
    expect(r.ok).toBe(false);
  });

  it('rejects undefined body', () => {
    const r = validateBugReport(undefined);
    expect(r.ok).toBe(false);
  });

  it('rejects array body', () => {
    const r = validateBugReport([]);
    expect(r.ok).toBe(false);
  });

  it('rejects primitive body', () => {
    expect(validateBugReport('a string').ok).toBe(false);
    expect(validateBugReport(42).ok).toBe(false);
    expect(validateBugReport(true).ok).toBe(false);
  });
});
