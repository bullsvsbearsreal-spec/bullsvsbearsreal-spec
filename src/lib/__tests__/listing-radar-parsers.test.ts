/**
 * Tests for extractTickers + classifyTitle from listing-radar.
 *
 * /listing-radar pre-listing leak tracker depends on these parsers
 * scraping Binance/Coinbase announcement titles into structured events
 * (ticker + listing-type). A parser regression silently misclassifies
 * the entire /listing-radar feed (e.g. delistings showing as new spot
 * listings) and breaks the front-run window calculation.
 */
import { describe, it, expect } from 'vitest';
import { extractTickers, classifyTitle } from '../listing-radar';

describe('extractTickers — XXXUSDT-style structured patterns', () => {
  it('extracts a single ticker from a perpetual listing announcement', () => {
    const t = extractTickers('Binance Futures Will Launch USDⓈ-Margined BILLUSDT Perpetual Contract');
    expect(t).toContain('BILL');
  });

  it('extracts multiple tickers from a multi-pair launch', () => {
    const t = extractTickers('Binance Futures Will Launch AMDUSDT, QCOMUSDT and USARUSDT Perpetual Contracts');
    expect(t).toContain('AMD');
    expect(t).toContain('QCOM');
    expect(t).toContain('USAR');
  });

  it('handles USDC pairs', () => {
    const t = extractTickers('New listing: TESTUSDC');
    expect(t).toContain('TEST');
  });

  it('extracts from "Spot Trading Pairs" announcements', () => {
    const t = extractTickers('Notice of Removal of Spot Trading Pairs - FORMUSDT, FORMUSDC');
    expect(t).toContain('FORM');
  });

  it('does not include the quote currency itself as a ticker', () => {
    const t = extractTickers('USDT will be listed against XYZUSDT');
    expect(t).not.toContain('USDT');
    expect(t).not.toContain('USDC');
    expect(t).not.toContain('BUSD');
  });

  it('caps at 5 tickers (sanity ceiling for batch announcements)', () => {
    const t = extractTickers('Listing AAUSDT BBUSDT CCUSDT DDUSDT EEUSDT FFUSDT GGUSDT');
    expect(t.length).toBeLessThanOrEqual(5);
  });

  it('deduplicates same ticker mentioned multiple times', () => {
    const t = extractTickers('BTCUSDT will swap with BTCUSDC');
    // BTC appears twice — once in BTCUSDT, once in BTCUSDC
    const btcCount = t.filter(x => x === 'BTC').length;
    expect(btcCount).toBe(1);
  });
});

describe('extractTickers — bare-ticker fallback', () => {
  it('extracts bare tickers when no structured pair exists', () => {
    // No XXXUSDT pattern → falls back to bare uppercase tokens
    const t = extractTickers('Trading Competition: PEPE rewards');
    expect(t).toContain('PEPE');
  });

  it('filters common false-positive acronyms', () => {
    const t = extractTickers('NEW WILL ADD LAUNCH FUTURES SPOT MARGIN PERP OPEN CLOSE');
    expect(t).toEqual([]);
  });

  it('filters API/CEX/DEX/ETF/TBA from fallback', () => {
    const t = extractTickers('NEW API endpoint: TBA');
    expect(t).not.toContain('API');
    expect(t).not.toContain('TBA');
    expect(t).not.toContain('NEW');
  });

  it('filters fiat currencies from fallback', () => {
    const t = extractTickers('Available in USD EUR GBP markets');
    expect(t).not.toContain('USD');
    expect(t).not.toContain('EUR');
    expect(t).not.toContain('GBP');
  });
});

describe('extractTickers — edge cases', () => {
  it('returns [] for empty title', () => {
    expect(extractTickers('')).toEqual([]);
  });

  it('returns [] for title with no ticker-shaped tokens', () => {
    expect(extractTickers('A new feature is coming soon')).toEqual([]);
  });

  it('handles titles with numbers in tickers', () => {
    const t = extractTickers('Listing T2USDT and X3USDT');
    expect(t).toContain('T2');
    expect(t).toContain('X3');
  });
});

describe('classifyTitle — delisting + listing types', () => {
  it('classifies removal language as delisting', () => {
    expect(classifyTitle('Notice of Removal of Spot Trading Pairs')).toBe('delisting');
    expect(classifyTitle('Binance Will Delist FOO')).toBe('delisting');
    expect(classifyTitle('Will remove these markets')).toBe('delisting');
  });

  it('classifies "perpetual" as perp', () => {
    expect(classifyTitle('Will Launch USDⓈ-Margined BILLUSDT Perpetual Contract')).toBe('perp');
    expect(classifyTitle('New PERP listing: BTCUSDT')).toBe('perp');
  });

  it('classifies "futures" (non-perpetual) as futures', () => {
    expect(classifyTitle('Quarterly futures launch')).toBe('futures');
  });

  it('classifies "option" as option', () => {
    expect(classifyTitle('New BTC options expiry added')).toBe('option');
  });

  it('classifies "will add" / "will list" / "spot trading" as spot', () => {
    expect(classifyTitle('Binance Will Add SUI to Spot Markets')).toBe('spot');
    expect(classifyTitle('Will List XYZ')).toBe('spot');
    expect(classifyTitle('New spot trading pair available')).toBe('spot');
  });

  it('classifies miscellaneous announcements as other', () => {
    expect(classifyTitle('Trading competition starts tomorrow')).toBe('other');
    expect(classifyTitle('Maintenance update')).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(classifyTitle('DELIST FOO')).toBe('delisting');
    expect(classifyTitle('PERPETUAL contract')).toBe('perp');
    expect(classifyTitle('SPOT TRADING pairs')).toBe('spot');
  });
});

describe('classifyTitle — priority ordering', () => {
  // Important: delisting rule MUST fire before perpetual rule, otherwise
  // "Will delist USDⓈ-Margined Perpetual Contract" would classify as
  // "perp" instead of "delisting" — losing the most important signal.
  it('delisting takes priority over perp', () => {
    expect(classifyTitle('Will delist USDⓈ-Margined Perpetual Contract')).toBe('delisting');
  });

  it('delisting takes priority over spot', () => {
    expect(classifyTitle('Removing the will-add markets')).toBe('delisting');
  });

  it('perp takes priority over futures (perpetual is a kind of futures)', () => {
    expect(classifyTitle('USDⓈ-Margined Perpetual Contract launch (futures)')).toBe('perp');
  });
});
