import { describe, it, expect } from 'vitest';

/**
 * Pure-function reproduction of the equity roll-up logic in
 * /api/account/positions/route.ts. Verifies the hybrid math used to
 * compute the headline equity figure when some sources have real
 * account-balance data (cash + uPnL + margin) and others only have
 * per-position margin contributions.
 *
 * Bugs this guards against (caught after the cross-margin equity fix
 * landed):
 *   1. Using `> 0` instead of `length > 0` would mask negative equity
 *      (margin call) by flipping back to the legacy margin-sum
 *      fallback that doesn't see the loss.
 *   2. Summing only `accountBalances` would understate the user's
 *      total whenever they have positions from a source whose client
 *      hasn't implemented fetchAccountBalance yet (GMX, Lighter,
 *      gTrade on the wallet side as of May 2026).
 */

interface MockPosition {
  sourceType: 'cex' | 'dex';
  sourceId: number;
  marginUsed: number | null;
  unrealizedPnl: number | null;
}

interface MockBalance {
  sourceType: 'cex' | 'dex';
  sourceId: number;
  equityUsd: number;
}

/** Mirrors the equity roll-up in /api/account/positions/route.ts. */
function rollupEquity(positions: MockPosition[], accountBalances: MockBalance[]): {
  equity: number;
  equitySource: 'true' | 'computed';
} {
  let totalMargin = 0;
  let totalUnrealized = 0;
  for (const p of positions) {
    if (p.marginUsed != null) totalMargin += p.marginUsed;
    if (p.unrealizedPnl != null) totalUnrealized += p.unrealizedPnl;
  }
  const balanceSourceKeys = new Set(
    accountBalances.map(b => `${b.sourceType}|${b.sourceId}`),
  );
  let untrackedMargin = 0;
  let untrackedUnrealized = 0;
  for (const p of positions) {
    const key = `${p.sourceType}|${p.sourceId}`;
    if (balanceSourceKeys.has(key)) continue;
    if (p.marginUsed != null) untrackedMargin += p.marginUsed;
    if (p.unrealizedPnl != null) untrackedUnrealized += p.unrealizedPnl;
  }
  const trueEquityFromBalances = accountBalances.reduce((acc, b) => acc + b.equityUsd, 0);
  const equity = accountBalances.length > 0
    ? trueEquityFromBalances + untrackedMargin + untrackedUnrealized
    : (totalMargin + totalUnrealized);
  const equitySource = accountBalances.length > 0 ? 'true' : 'computed';
  return { equity, equitySource };
}

describe('equity roll-up', () => {
  it('legacy path: no balance rows → margin-sum equity from positions', () => {
    const r = rollupEquity(
      [{ sourceType: 'cex', sourceId: 1, marginUsed: 200, unrealizedPnl: 50 }],
      [],
    );
    expect(r.equity).toBe(250);
    expect(r.equitySource).toBe('computed');
  });

  it('balance row covers all positions: equity = sum of balance equity', () => {
    // User has MEXC (cross-margin): true equity is $5000 even though
    // only $200 is allocated to the open position.
    const r = rollupEquity(
      [{ sourceType: 'cex', sourceId: 1, marginUsed: 200, unrealizedPnl: 50 }],
      [{ sourceType: 'cex', sourceId: 1, equityUsd: 5000 }],
    );
    expect(r.equity).toBe(5000); // NOT the $250 margin sum
    expect(r.equitySource).toBe('true');
  });

  it('mixed: some sources have balance, others fall back to margin+uPnL', () => {
    // User has MEXC (balance) + GMX (no balance impl yet). MEXC equity
    // = $5000, GMX contributes $300 margin + $20 uPnL = $320.
    // Total = $5320.
    const r = rollupEquity(
      [
        { sourceType: 'cex', sourceId: 1, marginUsed: 200, unrealizedPnl: 50 },
        { sourceType: 'dex', sourceId: 7, marginUsed: 300, unrealizedPnl: 20 },
      ],
      [{ sourceType: 'cex', sourceId: 1, equityUsd: 5000 }],
    );
    expect(r.equity).toBe(5320);
    expect(r.equitySource).toBe('true');
  });

  it('negative true equity is reported as-is (margin call signal)', () => {
    // User's account took a $200 loss on a $100 margin position →
    // negative equity. Old `> 0` check would have hidden this by
    // falling back to margin-sum (still positive). The fix surfaces
    // the real number.
    const r = rollupEquity(
      [{ sourceType: 'cex', sourceId: 1, marginUsed: 100, unrealizedPnl: -300 }],
      [{ sourceType: 'cex', sourceId: 1, equityUsd: -200 }],
    );
    expect(r.equity).toBe(-200);
    expect(r.equitySource).toBe('true');
  });

  it('zero true equity from balance row stays zero (not fall-through)', () => {
    // Edge case: user just withdrew everything; equity = 0.
    // Must NOT fall back to margin-sum (also 0 here, but the principle
    // is: data presence dominates).
    const r = rollupEquity(
      [],
      [{ sourceType: 'cex', sourceId: 1, equityUsd: 0 }],
    );
    expect(r.equity).toBe(0);
    expect(r.equitySource).toBe('true');
  });

  it('balance row for source X does NOT double-count X positions', () => {
    // Regression test: ensure positions whose source IS tracked don't
    // get added a second time via the "untracked" branch.
    const r = rollupEquity(
      [{ sourceType: 'cex', sourceId: 1, marginUsed: 999, unrealizedPnl: 999 }],
      [{ sourceType: 'cex', sourceId: 1, equityUsd: 5000 }],
    );
    expect(r.equity).toBe(5000); // not 5000 + 999 + 999
  });

  it('two CEX sources, only one with balance: hybrid sum', () => {
    // User has MEXC (sourceId=1, balance $3000) and Binance (sourceId=2,
    // no balance impl in this scenario, margin=$400 + uPnL=$50 = $450).
    // Hybrid total = $3450.
    const r = rollupEquity(
      [
        { sourceType: 'cex', sourceId: 1, marginUsed: 100, unrealizedPnl: 0 },
        { sourceType: 'cex', sourceId: 2, marginUsed: 400, unrealizedPnl: 50 },
      ],
      [{ sourceType: 'cex', sourceId: 1, equityUsd: 3000 }],
    );
    expect(r.equity).toBe(3450);
  });

  it('multiple balance rows summed correctly', () => {
    const r = rollupEquity(
      [], // no positions
      [
        { sourceType: 'cex', sourceId: 1, equityUsd: 1000 },
        { sourceType: 'cex', sourceId: 2, equityUsd: 2500 },
        { sourceType: 'dex', sourceId: 3, equityUsd: 4500 },
      ],
    );
    expect(r.equity).toBe(8000);
  });
});
