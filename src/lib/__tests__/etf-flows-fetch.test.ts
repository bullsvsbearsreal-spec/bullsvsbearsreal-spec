import { describe, it, expect } from 'vitest';
import { parseFlowCell, parseFarsideDate, farsideUrl } from '../etf-flows-fetch';

describe('parseFlowCell', () => {
  it('parses a plain positive number', () => {
    expect(parseFlowCell('123.4')).toBe(123.4);
    expect(parseFlowCell('500')).toBe(500);
  });

  it('parses parenthesized values as NEGATIVE (US accounting convention)', () => {
    // Farside uses "(50.2)" to mean -50.2 (red on the table)
    expect(parseFlowCell('(50.2)')).toBe(-50.2);
    expect(parseFlowCell('(0.5)')).toBe(-0.5);
  });

  it('strips commas from large numbers', () => {
    expect(parseFlowCell('1,234.5')).toBe(1234.5);
    expect(parseFlowCell('(1,000.0)')).toBe(-1000);
  });

  it('returns null for empty / whitespace input', () => {
    expect(parseFlowCell('')).toBeNull();
    expect(parseFlowCell('   ')).toBeNull();
  });

  it('returns null for em-dashes / hyphens (Farside uses these for "no data")', () => {
    expect(parseFlowCell('-')).toBeNull();
    expect(parseFlowCell('–')).toBeNull();
  });

  it('returns null for unparseable strings', () => {
    expect(parseFlowCell('not a number')).toBeNull();
    expect(parseFlowCell('TBD')).toBeNull();
  });

  it('handles zero correctly (not null, just 0)', () => {
    expect(parseFlowCell('0')).toBe(0);
    expect(parseFlowCell('0.0')).toBe(0);
  });

  it('handles leading + trailing whitespace', () => {
    expect(parseFlowCell('  42.5  ')).toBe(42.5);
  });
});

describe('parseFarsideDate', () => {
  it('parses a standard "DD MMM YYYY" format', () => {
    expect(parseFarsideDate('05 May 2026')).toBe('2026-05-05');
    expect(parseFarsideDate('15 Jan 2026')).toBe('2026-01-15');
  });

  it('parses both short and long month names (case-insensitive)', () => {
    expect(parseFarsideDate('15 JAN 2026')).toBe('2026-01-15');
    expect(parseFarsideDate('15 January 2026')).toBe('2026-01-15');
    expect(parseFarsideDate('15 january 2026')).toBe('2026-01-15');
  });

  it('handles single-digit days without leading zero', () => {
    expect(parseFarsideDate('5 May 2026')).toBe('2026-05-05');
  });

  it('returns null for unparseable input (non-date rows)', () => {
    expect(parseFarsideDate('Average')).toBeNull();
    expect(parseFarsideDate('Minimum')).toBeNull();
    expect(parseFarsideDate('Maximum')).toBeNull();
  });

  it('returns null for empty / nonsense input', () => {
    expect(parseFarsideDate('')).toBeNull();
    expect(parseFarsideDate('not a date')).toBeNull();
    expect(parseFarsideDate('99 Foo 2026')).toBeNull();
  });

  it('handles all 12 month abbreviations', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach((m, i) => {
      const date = parseFarsideDate(`15 ${m} 2026`);
      const expectedMonth = String(i + 1).padStart(2, '0');
      expect(date).toBe(`2026-${expectedMonth}-15`);
    });
  });
});

describe('farsideUrl', () => {
  it('returns the BTC URL for asset=btc', () => {
    expect(farsideUrl('btc')).toMatch(/farside\.co\.uk/);
    expect(farsideUrl('btc')).toMatch(/bitcoin/i);
  });

  it('returns the ETH URL for asset=eth', () => {
    expect(farsideUrl('eth')).toMatch(/farside\.co\.uk/);
    expect(farsideUrl('eth')).toMatch(/ethereum/i);
  });

  it('returns different URLs for btc vs eth', () => {
    expect(farsideUrl('btc')).not.toBe(farsideUrl('eth'));
  });
});
