/**
 * Tests for the /position-size pure math. These lock in the
 * formulas that decide how big a real-money trade should be —
 * a regression here silently sizes positions wrong. Every edge
 * case the UI handles has a test below.
 */
import { describe, it, expect } from 'vitest';
import {
  computeSizing,
  computeLiqPreview,
  computeKelly,
  riskTierFor,
  MAINT_MARGIN,
} from '../sizing';

describe('computeSizing — invalid inputs', () => {
  it('returns null for zero account', () => {
    expect(computeSizing({ side: 'long', account: 0, riskPct: 1, entry: 100, stop: 95 })).toBe(null);
  });
  it('returns null for zero riskPct', () => {
    expect(computeSizing({ side: 'long', account: 10000, riskPct: 0, entry: 100, stop: 95 })).toBe(null);
  });
  it('returns null for zero entry', () => {
    expect(computeSizing({ side: 'long', account: 10000, riskPct: 1, entry: 0, stop: 95 })).toBe(null);
  });
  it('returns null for zero stop', () => {
    expect(computeSizing({ side: 'long', account: 10000, riskPct: 1, entry: 100, stop: 0 })).toBe(null);
  });
  it('returns null for negative inputs', () => {
    expect(computeSizing({ side: 'long', account: -10000, riskPct: 1, entry: 100, stop: 95 })).toBe(null);
    expect(computeSizing({ side: 'long', account: 10000, riskPct: -1, entry: 100, stop: 95 })).toBe(null);
  });
});

describe('computeSizing — risk-based notional', () => {
  it('1% risk on $10k with 2% stop → $5k notional', () => {
    // Classic textbook example: risk $100 with stop 2% away
    // → can put $5000 in (50x the risk amount)
    const r = computeSizing({ side: 'long', account: 10000, riskPct: 1, entry: 100, stop: 98 });
    expect(r).not.toBeNull();
    expect(r!.riskUsd).toBe(100);
    expect(r!.stopDistPct).toBeCloseTo(2, 6);
    expect(r!.notional).toBeCloseTo(5000, 6);
    expect(r!.leverageNeeded).toBeCloseTo(0.5, 6);
  });

  it('2% risk on $10k with 1% stop → $20k notional (2x leverage)', () => {
    const r = computeSizing({ side: 'long', account: 10000, riskPct: 2, entry: 100, stop: 99 });
    expect(r).not.toBeNull();
    expect(r!.riskUsd).toBe(200);
    expect(r!.notional).toBeCloseTo(20000, 6);
    expect(r!.leverageNeeded).toBeCloseTo(2, 6);
  });

  it('positionUnits = notional / entry', () => {
    const r = computeSizing({ side: 'long', account: 10000, riskPct: 1, entry: 1000, stop: 950 });
    expect(r).not.toBeNull();
    // notional = 100 / 0.05 = 2000 USD → 2 BTC at $1000
    expect(r!.positionUnits).toBeCloseTo(2, 6);
  });

  it('returns 0 notional when entry equals stop (zero stop distance)', () => {
    const r = computeSizing({ side: 'long', account: 10000, riskPct: 1, entry: 100, stop: 100 });
    expect(r).not.toBeNull();
    expect(r!.stopDistPct).toBe(0);
    expect(r!.notional).toBe(0);
  });
});

describe('computeSizing — direction validity', () => {
  it('long with stop below entry is valid', () => {
    const r = computeSizing({ side: 'long', account: 10000, riskPct: 1, entry: 100, stop: 95 });
    expect(r!.directionValid).toBe(true);
  });
  it('long with stop ABOVE entry is invalid', () => {
    const r = computeSizing({ side: 'long', account: 10000, riskPct: 1, entry: 100, stop: 105 });
    expect(r!.directionValid).toBe(false);
  });
  it('short with stop above entry is valid', () => {
    const r = computeSizing({ side: 'short', account: 10000, riskPct: 1, entry: 100, stop: 105 });
    expect(r!.directionValid).toBe(true);
  });
  it('short with stop BELOW entry is invalid', () => {
    const r = computeSizing({ side: 'short', account: 10000, riskPct: 1, entry: 100, stop: 95 });
    expect(r!.directionValid).toBe(false);
  });
});

describe('computeSizing — R:R + target PnL', () => {
  it('target 2× stop distance → R:R = 2', () => {
    // Long entry 100, stop 98 (2% down), target 104 (4% up) → 2R
    const r = computeSizing({ side: 'long', account: 10000, riskPct: 1, entry: 100, stop: 98, target: 104 });
    expect(r!.rrRatio).toBeCloseTo(2, 6);
    expect(r!.targetMove).toBeCloseTo(4, 6);
    // notional 5000 × 4% move = $200 PnL
    expect(r!.targetPnl).toBeCloseTo(200, 6);
  });

  it('target = 0 means no target → zero R:R / targetPnl', () => {
    const r = computeSizing({ side: 'long', account: 10000, riskPct: 1, entry: 100, stop: 98 });
    expect(r!.rrRatio).toBe(0);
    expect(r!.targetMove).toBe(0);
    expect(r!.targetPnl).toBe(0);
  });

  it('short target below entry computes correctly', () => {
    // Short entry 100, stop 102 (2% up), target 94 (6% down) → 3R
    const r = computeSizing({ side: 'short', account: 10000, riskPct: 1, entry: 100, stop: 102, target: 94 });
    expect(r!.rrRatio).toBeCloseTo(3, 6);
    expect(r!.targetMove).toBeCloseTo(6, 6);
  });
});

describe('computeLiqPreview — null cases', () => {
  it('returns null when entry is 0', () => {
    expect(computeLiqPreview({ side: 'long', entry: 0, stop: 95, account: 10000, riskPct: 1 })).toBe(null);
  });
  it('returns null when leverage cannot be computed (zero stop distance)', () => {
    // entry == stop → stopDistPct = 0 → computedLev = 0 → null
    expect(computeLiqPreview({ side: 'long', entry: 100, stop: 100, account: 10000, riskPct: 1 })).toBe(null);
  });
});

describe('computeLiqPreview — sub-1x leverage = no liq risk', () => {
  // Account fully covers the position — there is mathematically no
  // liq price. UI needs `noLiqRisk: true`, not a negative liq value.
  it('returns noLiqRisk for sub-1x implicit leverage', () => {
    // $10k account, 1% risk, 2% stop → 0.5x lev → no liq risk
    const r = computeLiqPreview({ side: 'long', entry: 100, stop: 98, account: 10000, riskPct: 1 });
    expect(r).not.toBeNull();
    expect(r!.noLiqRisk).toBe(true);
    if (r && r.noLiqRisk) {
      expect(r.liq).toBe(null);
      expect(r.distPct).toBe(null);
      expect(r.stopToLiqPct).toBe(null);
      expect(r.leverageUsed).toBeCloseTo(0.5, 6);
    }
  });

  it('returns noLiqRisk for explicit sub-1x userLeverage', () => {
    const r = computeLiqPreview({ side: 'long', entry: 100, stop: 95, account: 10000, riskPct: 1, userLeverage: 0.5 });
    expect(r).not.toBeNull();
    expect(r!.noLiqRisk).toBe(true);
  });
});

describe('computeLiqPreview — liquidation math', () => {
  it('long 10x liq ≈ entry × (1 - 0.1 + 0.005)', () => {
    const r = computeLiqPreview({ side: 'long', entry: 100, stop: 95, account: 10000, riskPct: 1, userLeverage: 10 });
    expect(r).not.toBeNull();
    expect(r!.noLiqRisk).toBe(false);
    if (r && !r.noLiqRisk) {
      expect(r.liq).toBeCloseTo(100 * (1 - 0.1 + MAINT_MARGIN), 6);
      expect(r.leverageUsed).toBe(10);
    }
  });

  it('short 10x liq ≈ entry × (1 + 0.1 - 0.005)', () => {
    const r = computeLiqPreview({ side: 'short', entry: 100, stop: 105, account: 10000, riskPct: 1, userLeverage: 10 });
    expect(r).not.toBeNull();
    if (r && !r.noLiqRisk) {
      expect(r.liq).toBeCloseTo(100 * (1 + 0.1 - MAINT_MARGIN), 6);
    }
  });

  it('long: stop ABOVE liq → positive stopToLiqPct (safe)', () => {
    // Entry 100, stop 95, 10x → liq ≈ 90.5. Stop 95 is above liq.
    const r = computeLiqPreview({ side: 'long', entry: 100, stop: 95, account: 10000, riskPct: 1, userLeverage: 10 });
    if (r && !r.noLiqRisk) {
      expect(r.stopToLiqPct).toBeGreaterThan(0);
    }
  });

  it('long: stop BELOW liq → negative stopToLiqPct (liq fires first, bad)', () => {
    // Entry 100, 10x → liq ≈ 90.5. Stop 85 is BELOW liq.
    const r = computeLiqPreview({ side: 'long', entry: 100, stop: 85, account: 10000, riskPct: 1, userLeverage: 10 });
    if (r && !r.noLiqRisk) {
      expect(r.stopToLiqPct).toBeLessThan(0);
    }
  });

  it('explicit userLeverage overrides implicit', () => {
    // Implicit would be 0.5x (sub-1x), explicit 20x should win
    const r = computeLiqPreview({ side: 'long', entry: 100, stop: 98, account: 10000, riskPct: 1, userLeverage: 20 });
    if (r && !r.noLiqRisk) {
      expect(r.leverageUsed).toBe(20);
    }
  });

  it('NaN userLeverage falls back to implicit', () => {
    const r = computeLiqPreview({ side: 'long', entry: 100, stop: 95, account: 10000, riskPct: 5, userLeverage: NaN });
    // Implicit lev = 5/0.05 / 10000 × 10000 = 1.0 — at the boundary
    // (lev=1 is allowed; only lev<1 is sub-1x). Should produce a liq.
    expect(r).not.toBeNull();
    if (r && !r.noLiqRisk) {
      expect(r.leverageUsed).toBeCloseTo(1.0, 6);
    }
  });

  it('userLeverage = 0 falls back to implicit', () => {
    const r = computeLiqPreview({ side: 'long', entry: 100, stop: 95, account: 10000, riskPct: 5, userLeverage: 0 });
    expect(r).not.toBeNull();
    if (r && !r.noLiqRisk) {
      expect(r.leverageUsed).toBeCloseTo(1.0, 6);
    }
  });
});

describe('computeKelly — invalid inputs', () => {
  it('returns null for NaN inputs', () => {
    expect(computeKelly({ winRate: NaN, avgWin: 2, avgLoss: 1 })).toBe(null);
    expect(computeKelly({ winRate: 55, avgWin: NaN, avgLoss: 1 })).toBe(null);
    expect(computeKelly({ winRate: 55, avgWin: 2, avgLoss: NaN })).toBe(null);
  });
  it('returns null for win rate ≤0 or ≥100', () => {
    expect(computeKelly({ winRate: 0, avgWin: 2, avgLoss: 1 })).toBe(null);
    expect(computeKelly({ winRate: 100, avgWin: 2, avgLoss: 1 })).toBe(null);
    expect(computeKelly({ winRate: -5, avgWin: 2, avgLoss: 1 })).toBe(null);
    expect(computeKelly({ winRate: 105, avgWin: 2, avgLoss: 1 })).toBe(null);
  });
  it('returns null for non-positive avgWin/avgLoss', () => {
    expect(computeKelly({ winRate: 55, avgWin: 0, avgLoss: 1 })).toBe(null);
    expect(computeKelly({ winRate: 55, avgWin: 2, avgLoss: 0 })).toBe(null);
    expect(computeKelly({ winRate: 55, avgWin: -2, avgLoss: 1 })).toBe(null);
  });
});

describe('computeKelly — formula', () => {
  it('55% win rate, 2R avg win, 1R avg loss → ~32.5% full Kelly', () => {
    // f = 0.55 - 0.45/2 = 0.55 - 0.225 = 0.325 → 32.5%
    const r = computeKelly({ winRate: 55, avgWin: 2, avgLoss: 1 });
    expect(r).not.toBeNull();
    expect(r!.kellyPct).toBeCloseTo(32.5, 6);
    expect(r!.halfKelly).toBeCloseTo(16.25, 6);
    // EV = 0.55 × 2 - 0.45 × 1 = 1.1 - 0.45 = 0.65 R per trade
    expect(r!.ev).toBeCloseTo(0.65, 6);
  });

  it('50/50 with 1R/1R is break-even (Kelly = 0, EV = 0)', () => {
    const r = computeKelly({ winRate: 50, avgWin: 1, avgLoss: 1 });
    expect(r).not.toBeNull();
    expect(r!.kellyPct).toBeCloseTo(0, 6);
    expect(r!.ev).toBeCloseTo(0, 6);
  });

  it('40% win rate with 3R/1R is a positive edge', () => {
    // f = 0.4 - 0.6/3 = 0.4 - 0.2 = 0.2 → 20%
    // EV = 0.4×3 - 0.6×1 = 1.2 - 0.6 = 0.6
    const r = computeKelly({ winRate: 40, avgWin: 3, avgLoss: 1 });
    expect(r!.kellyPct).toBeCloseTo(20, 6);
    expect(r!.ev).toBeCloseTo(0.6, 6);
  });

  it('negative-edge scenario produces negative Kelly + negative EV', () => {
    // 30% win rate, 1R/1R — losing edge
    const r = computeKelly({ winRate: 30, avgWin: 1, avgLoss: 1 });
    expect(r!.kellyPct).toBeLessThan(0);
    expect(r!.ev).toBeLessThan(0);
  });

  it('halfKelly = kellyPct / 2 always', () => {
    const r = computeKelly({ winRate: 60, avgWin: 1.5, avgLoss: 1 });
    expect(r!.halfKelly).toBeCloseTo(r!.kellyPct / 2, 6);
  });
});

describe('riskTierFor', () => {
  it('returns low for 0-3x', () => {
    expect(riskTierFor(0.5)).toBe('low');
    expect(riskTierFor(1)).toBe('low');
    expect(riskTierFor(3)).toBe('low');
  });
  it('returns moderate for >3x to 10x', () => {
    expect(riskTierFor(3.5)).toBe('moderate');
    expect(riskTierFor(10)).toBe('moderate');
  });
  it('returns high for >10x to 20x', () => {
    expect(riskTierFor(10.5)).toBe('high');
    expect(riskTierFor(20)).toBe('high');
  });
  it('returns extreme for >20x', () => {
    expect(riskTierFor(21)).toBe('extreme');
    expect(riskTierFor(50)).toBe('extreme');
    expect(riskTierFor(100)).toBe('extreme');
  });
  it('returns low for invalid (NaN, negative, zero)', () => {
    expect(riskTierFor(NaN)).toBe('low');
    expect(riskTierFor(-5)).toBe('low');
    expect(riskTierFor(0)).toBe('low');
  });
});
