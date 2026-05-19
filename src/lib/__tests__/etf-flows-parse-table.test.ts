import { describe, it, expect } from 'vitest';
import { parseFarsideTable } from '../etf-flows-fetch';

describe('parseFarsideTable', () => {
  it('returns null for empty HTML', () => {
    expect(parseFarsideTable('')).toBeNull();
    expect(parseFarsideTable('<html></html>')).toBeNull();
  });

  it('returns null when no <table> is present', () => {
    expect(parseFarsideTable('<div>No table here</div>')).toBeNull();
  });

  it('parses a minimal Farside table with one issuer + one date row', () => {
    const html = `
      <table class="etf">
        <tr><th>Date</th><th>IBIT</th><th>Total</th></tr>
        <tr><td>06 Jan 2026</td><td>123.4</td><td>123.4</td></tr>
      </table>
    `;
    const out = parseFarsideTable(html);
    expect(out).not.toBeNull();
    expect(out!.issuers).toEqual(['IBIT']);
    expect(out!.days.length).toBe(1);
    expect(out!.days[0].date).toBe('2026-01-06');
    expect(out!.days[0].perIssuer[0]).toBeCloseTo(123.4, 1);
  });

  it('strips the trailing "Total" column from issuer list', () => {
    const html = `
      <table class="etf">
        <tr><th>Date</th><th>IBIT</th><th>FBTC</th><th>Total</th></tr>
        <tr><td>05 Jan 2026</td><td>100</td><td>50</td><td>150</td></tr>
      </table>
    `;
    const out = parseFarsideTable(html);
    expect(out!.issuers).toEqual(['IBIT', 'FBTC']);  // Total stripped
  });

  it('skips summary rows like "Total" / "Minimum" / "Maximum" / "Average"', () => {
    const html = `
      <table class="etf">
        <tr><th>Date</th><th>IBIT</th></tr>
        <tr><td>04 Jan 2026</td><td>100</td></tr>
        <tr><td>Total</td><td>9999</td></tr>
        <tr><td>Minimum</td><td>-50</td></tr>
        <tr><td>Maximum</td><td>200</td></tr>
        <tr><td>Average</td><td>75</td></tr>
        <tr><td>05 Jan 2026</td><td>150</td></tr>
      </table>
    `;
    const out = parseFarsideTable(html);
    expect(out!.days.length).toBe(2);  // Only the 2 real dates, no summaries
    expect(out!.days.map((d) => d.date)).toContain('2026-01-04');
    expect(out!.days.map((d) => d.date)).toContain('2026-01-05');
  });

  it('returns days newest-first (after internal reverse)', () => {
    const html = `
      <table class="etf">
        <tr><th>Date</th><th>IBIT</th></tr>
        <tr><td>01 Jan 2026</td><td>10</td></tr>
        <tr><td>02 Jan 2026</td><td>20</td></tr>
        <tr><td>03 Jan 2026</td><td>30</td></tr>
      </table>
    `;
    const out = parseFarsideTable(html);
    // After reverse(), the newest date appears first
    expect(out!.days[0].date).toBe('2026-01-03');
    expect(out!.days[out!.days.length - 1].date).toBe('2026-01-01');
  });

  it('prefers <table class="etf"> over decorative wrapper tables (Wayback)', () => {
    const html = `
      <table class="thead"><tr><th>Decorative</th></tr></table>
      <table class="etf">
        <tr><th>Date</th><th>IBIT</th></tr>
        <tr><td>06 Jan 2026</td><td>100</td></tr>
      </table>
      <table class="tfooter"><tr><th>Footer</th></tr></table>
    `;
    const out = parseFarsideTable(html);
    expect(out!.issuers).toEqual(['IBIT']);
    expect(out!.days.length).toBe(1);
  });

  it('falls back to first <table> when no class="etf" matches', () => {
    const html = `
      <table>
        <tr><th>Date</th><th>IBIT</th></tr>
        <tr><td>07 Jan 2026</td><td>100</td></tr>
      </table>
    `;
    const out = parseFarsideTable(html);
    expect(out!.issuers).toEqual(['IBIT']);
  });

  it('handles cells with HTML entities (&nbsp;) and nested tags', () => {
    const html = `
      <table class="etf">
        <tr><th>Date</th><th><span>IBIT</span></th></tr>
        <tr><td>08 Jan 2026</td><td><b>123.4</b></td></tr>
      </table>
    `;
    const out = parseFarsideTable(html);
    expect(out!.issuers).toEqual(['IBIT']);
    expect(out!.days[0].perIssuer[0]).toBeCloseTo(123.4, 1);
  });

  it('totals across issuers (sum of per-issuer values)', () => {
    const html = `
      <table class="etf">
        <tr><th>Date</th><th>IBIT</th><th>FBTC</th></tr>
        <tr><td>09 Jan 2026</td><td>100</td><td>50</td></tr>
      </table>
    `;
    const out = parseFarsideTable(html);
    expect(out!.days[0].total).toBeCloseTo(150, 1);
  });

  it('returns null when table has no rows (just empty <table>)', () => {
    const html = `<table class="etf"></table>`;
    expect(parseFarsideTable(html)).toBeNull();
  });
});
