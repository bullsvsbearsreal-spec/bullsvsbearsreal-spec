/**
 * Tests for the Farside ETF flow parsers — the cell + date parsers used
 * to scrape https://farside.co.uk/bitcoin-etf-flow-all-data/ and ditto
 * for ETH. Both feed /etf-flows AND /etf-counterfactual ("what if BTC
 * was 5x leveraged on each day's net flow").
 *
 * The biggest silent-failure risk:
 *   - parseFlowCell must invert paren-wrapped numbers ("(33.4)" = -33.4M).
 *     Lose that and outflow days render as inflow days. Page still loads,
 *     numbers are catastrophically wrong.
 *
 * The format hasn't changed for years but the upstream HTML is hand-edited
 * so a typo (em-dash for minus, comma in wrong place) would silently break.
 */
import { describe, it, expect } from 'vitest';
import { parseFlowCell, parseFarsideDate } from '../etf-flows-fetch';

describe('parseFlowCell — positive flows (inflows)', () => {
  it('parses a plain decimal as positive', () => {
    expect(parseFlowCell('123.4')).toBe(123.4);
    expect(parseFlowCell('0.5')).toBe(0.5);
    expect(parseFlowCell('1')).toBe(1);
  });

  it('strips comma thousand-separators', () => {
    expect(parseFlowCell('1,234.5')).toBe(1234.5);
    expect(parseFlowCell('12,345')).toBe(12345);
  });

  it('handles whitespace around the number', () => {
    expect(parseFlowCell('  100.0  ')).toBe(100);
    expect(parseFlowCell('\t50.0\n')).toBe(50);
  });
});

describe('parseFlowCell — negative flows (outflows)', () => {
  it('paren-wrapped numbers are negative (Farside convention)', () => {
    // CRITICAL: Farside writes outflows as "(33.4)" — without the
    // sign flip the page would show inflows where there are outflows.
    expect(parseFlowCell('(33.4)')).toBe(-33.4);
    expect(parseFlowCell('(123.45)')).toBe(-123.45);
  });

  it('paren-wrapped with thousand-separator commas still negate', () => {
    expect(parseFlowCell('(1,234.5)')).toBe(-1234.5);
  });

  it('handles whitespace around paren-wrapped values', () => {
    expect(parseFlowCell('  (50.0)  ')).toBe(-50);
  });
});

describe('parseFlowCell — null sentinels', () => {
  it('returns null for empty / dash / em-dash cells (no flow that day)', () => {
    expect(parseFlowCell('')).toBe(null);
    expect(parseFlowCell('   ')).toBe(null);
    expect(parseFlowCell('-')).toBe(null);
    expect(parseFlowCell('–')).toBe(null); // em-dash
  });

  it('returns null for unparseable junk', () => {
    expect(parseFlowCell('TBD')).toBe(null);
    expect(parseFlowCell('N/A')).toBe(null);
    expect(parseFlowCell('???')).toBe(null);
  });
});

describe('parseFarsideDate', () => {
  it('parses "DD Mon YYYY" into ISO date', () => {
    expect(parseFarsideDate('05 May 2026')).toBe('2026-05-05');
    expect(parseFarsideDate('15 Jan 2024')).toBe('2024-01-15');
    expect(parseFarsideDate('31 Dec 2025')).toBe('2025-12-31');
  });

  it('accepts single-digit days', () => {
    expect(parseFarsideDate('5 May 2026')).toBe('2026-05-05');
    expect(parseFarsideDate('1 Jan 2026')).toBe('2026-01-01');
  });

  it('is case-insensitive on month names (just first 3 chars matter)', () => {
    expect(parseFarsideDate('05 may 2026')).toBe('2026-05-05');
    expect(parseFarsideDate('05 MAY 2026')).toBe('2026-05-05');
    expect(parseFarsideDate('05 May 2026')).toBe('2026-05-05');
    // Farside writes "Sept" sometimes — first 3 chars still parse.
    expect(parseFarsideDate('15 Sept 2025')).toBe('2025-09-15');
  });

  it('all 12 months parse correctly', () => {
    const expectations: Array<[string, string]> = [
      ['01 Jan 2026', '2026-01-01'],
      ['01 Feb 2026', '2026-02-01'],
      ['01 Mar 2026', '2026-03-01'],
      ['01 Apr 2026', '2026-04-01'],
      ['01 May 2026', '2026-05-01'],
      ['01 Jun 2026', '2026-06-01'],
      ['01 Jul 2026', '2026-07-01'],
      ['01 Aug 2026', '2026-08-01'],
      ['01 Sep 2026', '2026-09-01'],
      ['01 Oct 2026', '2026-10-01'],
      ['01 Nov 2026', '2026-11-01'],
      ['01 Dec 2026', '2026-12-01'],
    ];
    for (const [input, expected] of expectations) {
      expect(parseFarsideDate(input)).toBe(expected);
    }
  });

  it('returns null on non-date rows (Farside summary rows: Total/Average/etc)', () => {
    expect(parseFarsideDate('Total')).toBe(null);
    expect(parseFarsideDate('Average')).toBe(null);
    expect(parseFarsideDate('Minimum')).toBe(null);
    expect(parseFarsideDate('Maximum')).toBe(null);
    expect(parseFarsideDate('')).toBe(null);
  });

  it('returns null on malformed dates', () => {
    expect(parseFarsideDate('2026-05-05')).toBe(null); // ISO not Farside format
    expect(parseFarsideDate('05/05/2026')).toBe(null);
    expect(parseFarsideDate('May 5')).toBe(null); // missing year
    expect(parseFarsideDate('05 Foo 2026')).toBe(null); // bad month
  });
});
