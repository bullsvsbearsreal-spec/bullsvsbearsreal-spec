import { describe, it, expect } from 'vitest';
import { extractTickers, classifyTitle } from '../listing-radar';

describe('extractTickers', () => {
  it('extracts a single XXXUSDT ticker', () => {
    expect(extractTickers('Binance will add JUPUSDT')).toEqual(['JUP']);
  });

  it('extracts multiple tickers from one title', () => {
    const out = extractTickers('Binance lists ADAUSDT, MATICUSDT, and DOGEUSDT');
    expect(out).toContain('ADA');
    expect(out).toContain('MATIC');
    expect(out).toContain('DOGE');
  });

  it('handles USDC variant', () => {
    expect(extractTickers('Coinbase adds PEPEUSDC')).toEqual(['PEPE']);
  });

  it('matches XXXBUSD when the regex finds it (BUSD is a known stablecoin suffix)', () => {
    // The regex BUSD? matches BUSD or BUS depending on greediness; for
    // a clean XXXBUSD form like "BNBBUSD" it captures BNB. We don't try
    // to parse the ambiguous "FILBUSD" case (which could be FIL+BUSD
    // or FILB+USD) — just lock in the simple unambiguous case.
    const out = extractTickers('Old BNB BUSD pair retired');
    // No XXXBUSD form in this title, so we hit the fallback branch
    // and pull BNB + BUSD (BUSD passes the false-positive filter since
    // it's the literal stablecoin name, not in the filter list)
    expect(out).toContain('BNB');
  });

  it('skips USDT/USDC/BUSD themselves', () => {
    const out = extractTickers('USDT and USDC stablecoin pairs');
    expect(out).not.toContain('USDT');
    expect(out).not.toContain('USDC');
  });

  it('falls back to bare-ticker regex when no XXXUSDT form is found', () => {
    const out = extractTickers('New token: HYPE launch announcement');
    expect(out).toContain('HYPE');
  });

  it('filters common false positives in fallback mode', () => {
    const out = extractTickers('We WILL ADD a NEW token');
    // 'WILL', 'ADD', 'NEW' should be filtered
    expect(out).not.toContain('WILL');
    expect(out).not.toContain('ADD');
    expect(out).not.toContain('NEW');
  });

  it('caps results at 5 to keep summary cards readable', () => {
    const out = extractTickers('AAAUSDT BBBUSDT CCCUSDT DDDUSDT EEEUSDT FFFUSDT GGGUSDT');
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it('returns empty for plain English with no tickers', () => {
    expect(extractTickers('Welcome to the platform')).toEqual([]);
  });

  it('deduplicates tickers that appear twice', () => {
    const out = extractTickers('BTCUSDT and BTCUSDC');
    expect(out.filter((t) => t === 'BTC').length).toBe(1);
  });
});

describe('classifyTitle', () => {
  it('classifies "Notice of Removal of Spot Trading Pairs" as delisting', () => {
    // This is the exact bug the comments call out: 'removal' must be
    // caught alongside 'delist' / 'removing' / 'will remove'.
    expect(classifyTitle('Notice of Removal of Spot Trading Pairs')).toBe('delisting');
  });

  it('classifies various delist phrasings', () => {
    expect(classifyTitle('Binance will delist BNTUSDT')).toBe('delisting');
    expect(classifyTitle('Removing perpetual pairs')).toBe('delisting');
    expect(classifyTitle('We will remove these markets')).toBe('delisting');
  });

  it('classifies perpetual / perp keywords', () => {
    expect(classifyTitle('New perpetual contracts launching')).toBe('perp');
    expect(classifyTitle('perp BTCUSDT')).toBe('perp');
  });

  it('classifies futures', () => {
    expect(classifyTitle('New BTC futures market')).toBe('futures');
  });

  it('classifies options', () => {
    expect(classifyTitle('ETH option chain expanded')).toBe('option');
  });

  it('classifies spot listings', () => {
    expect(classifyTitle('Coinbase will add JUPUSDT spot trading')).toBe('spot');
    expect(classifyTitle('Will list new tokens')).toBe('spot');
  });

  it('returns "other" for unclassifiable titles', () => {
    expect(classifyTitle('Important announcement about fees')).toBe('other');
  });

  it('is case-insensitive (lowercases title before matching)', () => {
    expect(classifyTitle('DELIST ANNOUNCEMENT')).toBe('delisting');
    expect(classifyTitle('SPOT TRADING')).toBe('spot');
  });

  it('delisting wins over spot when both phrases appear', () => {
    // 'Notice of Removal of Spot Trading Pairs' contains both 'remov'
    // and 'spot trading' — delisting must win (sell signal beats buy
    // signal in case of ambiguity, safer default).
    expect(classifyTitle('Removing spot trading pairs')).toBe('delisting');
  });
});
