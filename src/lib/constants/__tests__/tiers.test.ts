import { describe, it, expect } from 'vitest';
import {
  TIER_ORDER,
  TIER_LIMITS,
  TIER_PRICE_MONTHLY,
  TIER_PRICE_ANNUAL,
  TIER_BRANDING,
  FEATURE_MATRIX,
  TOOLS_BY_TIER,
  TOOLS_BY_TIER_COUNT,
  ANNUAL_DISCOUNT_PCT,
  annualSavingsUsd,
  resolveUserTier,
  tierAtLeast,
  type Tier,
} from '../tiers';
import {
  FREE_TIER_PER_MINUTE,
  TRADER_TIER_PER_MINUTE,
  PRO_TIER_PER_MINUTE,
  FREE_TIER_PER_DAY,
  TRADER_TIER_PER_DAY,
} from '@/lib/api/rate-limit';

const ALL_TIERS: Tier[] = ['free', 'trader', 'pro', 'whale'];

describe('TIER_ORDER', () => {
  it('is exactly free → trader → pro → whale', () => {
    expect(TIER_ORDER).toEqual(['free', 'trader', 'pro', 'whale']);
  });
});

describe('TIER_LIMITS', () => {
  it('has entries for all 4 tiers', () => {
    ALL_TIERS.forEach((t) => {
      expect(TIER_LIMITS[t]).toBeDefined();
    });
  });

  it('Free API limits match the rate-limit constants', () => {
    expect(TIER_LIMITS.free.apiPerMinute).toBe(FREE_TIER_PER_MINUTE);
    expect(TIER_LIMITS.free.apiPerDay).toBe(FREE_TIER_PER_DAY);
  });

  it('Trader API limits match the rate-limit constants', () => {
    expect(TIER_LIMITS.trader.apiPerMinute).toBe(TRADER_TIER_PER_MINUTE);
    expect(TIER_LIMITS.trader.apiPerDay).toBe(TRADER_TIER_PER_DAY);
  });

  it('Pro API limits match the rate-limit constants (unlimited daily)', () => {
    expect(TIER_LIMITS.pro.apiPerMinute).toBe(PRO_TIER_PER_MINUTE);
    expect(TIER_LIMITS.pro.apiPerDay).toBe(Infinity);
  });

  it('Whale has Infinity API + alerts + wallets', () => {
    expect(TIER_LIMITS.whale.apiPerMinute).toBe(Infinity);
    expect(TIER_LIMITS.whale.apiPerDay).toBe(Infinity);
    expect(TIER_LIMITS.whale.maxAlerts).toBe(Infinity);
    expect(TIER_LIMITS.whale.maxWatchedWallets).toBe(Infinity);
  });

  it('limits scale monotonically — Trader >= Free, Pro >= Trader, Whale >= Pro', () => {
    expect(TIER_LIMITS.trader.apiPerMinute).toBeGreaterThanOrEqual(TIER_LIMITS.free.apiPerMinute);
    expect(TIER_LIMITS.pro.apiPerMinute).toBeGreaterThanOrEqual(TIER_LIMITS.trader.apiPerMinute);
    expect(TIER_LIMITS.whale.apiPerMinute).toBeGreaterThanOrEqual(TIER_LIMITS.pro.apiPerMinute);

    expect(TIER_LIMITS.trader.maxAlerts).toBeGreaterThanOrEqual(TIER_LIMITS.free.maxAlerts);
    expect(TIER_LIMITS.pro.maxAlerts).toBeGreaterThanOrEqual(TIER_LIMITS.trader.maxAlerts);
    expect(TIER_LIMITS.whale.maxAlerts).toBeGreaterThanOrEqual(TIER_LIMITS.pro.maxAlerts);

    expect(TIER_LIMITS.trader.maxWatchedWallets).toBeGreaterThanOrEqual(TIER_LIMITS.free.maxWatchedWallets);
    expect(TIER_LIMITS.pro.maxWatchedWallets).toBeGreaterThanOrEqual(TIER_LIMITS.trader.maxWatchedWallets);
    expect(TIER_LIMITS.whale.maxWatchedWallets).toBeGreaterThanOrEqual(TIER_LIMITS.pro.maxWatchedWallets);

    expect(TIER_LIMITS.trader.historyDays).toBeGreaterThanOrEqual(TIER_LIMITS.free.historyDays);
    expect(TIER_LIMITS.pro.historyDays).toBeGreaterThanOrEqual(TIER_LIMITS.trader.historyDays);
    expect(TIER_LIMITS.whale.historyDays).toBeGreaterThanOrEqual(TIER_LIMITS.pro.historyDays);
  });

  it('Free has the documented limits (3 alerts, 5 wallets, 30d history)', () => {
    expect(TIER_LIMITS.free.maxAlerts).toBe(3);
    expect(TIER_LIMITS.free.maxWatchedWallets).toBe(5);
    expect(TIER_LIMITS.free.historyDays).toBe(30);
  });

  it('Trader has the documented limits (15 alerts, 30 wallets, 180d history)', () => {
    expect(TIER_LIMITS.trader.maxAlerts).toBe(15);
    expect(TIER_LIMITS.trader.maxWatchedWallets).toBe(30);
    expect(TIER_LIMITS.trader.historyDays).toBe(180);
  });

  it('Pro has the documented limits (75 alerts, 200 wallets, 365d history)', () => {
    expect(TIER_LIMITS.pro.maxAlerts).toBe(75);
    expect(TIER_LIMITS.pro.maxWatchedWallets).toBe(200);
    expect(TIER_LIMITS.pro.historyDays).toBe(365);
  });
});

describe('TIER_PRICE_MONTHLY + TIER_PRICE_ANNUAL', () => {
  it('Free is $0 in both periods', () => {
    expect(TIER_PRICE_MONTHLY.free).toBe(0);
    expect(TIER_PRICE_ANNUAL.free).toBe(0);
  });

  it('Trader is $15, Pro is $49, Whale is $99 monthly', () => {
    expect(TIER_PRICE_MONTHLY.trader).toBe(15);
    expect(TIER_PRICE_MONTHLY.pro).toBe(49);
    expect(TIER_PRICE_MONTHLY.whale).toBe(99);
  });

  it('Annual prices are 10x monthly (~17% off = 2 months free)', () => {
    expect(TIER_PRICE_ANNUAL.trader).toBe(TIER_PRICE_MONTHLY.trader * 10);
    expect(TIER_PRICE_ANNUAL.pro).toBe(TIER_PRICE_MONTHLY.pro * 10);
    expect(TIER_PRICE_ANNUAL.whale).toBe(TIER_PRICE_MONTHLY.whale * 10);
  });

  it('Annual discount marketing label matches the actual savings', () => {
    // 10/12 = 0.833 → 17% discount on the annual vs 12x monthly
    const proSaving = 1 - TIER_PRICE_ANNUAL.pro / (TIER_PRICE_MONTHLY.pro * 12);
    expect(Math.round(proSaving * 100)).toBe(ANNUAL_DISCOUNT_PCT);
  });

  it('Prices monotonically increase: Free < Trader < Pro < Whale', () => {
    expect(TIER_PRICE_MONTHLY.free).toBeLessThan(TIER_PRICE_MONTHLY.trader);
    expect(TIER_PRICE_MONTHLY.trader).toBeLessThan(TIER_PRICE_MONTHLY.pro);
    expect(TIER_PRICE_MONTHLY.pro).toBeLessThan(TIER_PRICE_MONTHLY.whale);
  });
});

describe('TIER_BRANDING', () => {
  it('has entries for all 4 tiers with required fields', () => {
    ALL_TIERS.forEach((t) => {
      const b = TIER_BRANDING[t];
      expect(b.label).toBeTruthy();
      expect(b.textColor).toMatch(/^text-/);
      expect(b.bgTint).toBeTruthy();
      expect(b.borderTint).toMatch(/^border-/);
      expect(b.iconName).toMatch(/^(Sparkles|Compass|Zap|Crown)$/);
      expect(b.tagline).toBeTruthy();
    });
  });

  it('Whale uses the Crown icon + amber/gold styling', () => {
    expect(TIER_BRANDING.whale.iconName).toBe('Crown');
    expect(TIER_BRANDING.whale.textColor).toContain('amber');
  });

  it('Pro uses the Zap icon + emerald styling', () => {
    expect(TIER_BRANDING.pro.iconName).toBe('Zap');
    expect(TIER_BRANDING.pro.textColor).toContain('emerald');
  });

  it('Trader uses the Compass icon + sky styling', () => {
    expect(TIER_BRANDING.trader.iconName).toBe('Compass');
    expect(TIER_BRANDING.trader.textColor).toContain('sky');
  });

  it('Free uses the Sparkles icon + neutral styling', () => {
    expect(TIER_BRANDING.free.iconName).toBe('Sparkles');
    expect(TIER_BRANDING.free.textColor).toContain('neutral');
  });
});

describe('FEATURE_MATRIX', () => {
  it('every row has values for all 4 tiers', () => {
    FEATURE_MATRIX.forEach((row) => {
      expect(row.values.free).toBeDefined();
      expect(row.values.trader).toBeDefined();
      expect(row.values.pro).toBeDefined();
      expect(row.values.whale).toBeDefined();
    });
  });

  it('every label is unique', () => {
    const labels = FEATURE_MATRIX.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('Whale-only features exist (false for Free + Trader + Pro)', () => {
    const whaleOnly = FEATURE_MATRIX.filter((r) =>
      r.values.whale === true && r.values.free === false && r.values.trader === false && r.values.pro === false,
    );
    expect(whaleOnly.length).toBeGreaterThan(0);
    // Priority alert delivery is documented Whale-only
    const labels = whaleOnly.map((r) => r.label.toLowerCase());
    expect(labels.some((l) => l.includes('priority alert'))).toBe(true);
  });

  it('Pro-tier power features exist (true for Pro + Whale only)', () => {
    const proPlus = FEATURE_MATRIX.filter((r) =>
      r.values.pro === true && r.values.whale === true && r.values.free === false && r.values.trader === false,
    );
    expect(proPlus.length).toBeGreaterThan(0);
    const labels = proPlus.map((r) => r.label.toLowerCase());
    expect(labels.some((l) => l.includes('tax'))).toBe(true);
  });

  it('every value is either a boolean or a non-empty string', () => {
    FEATURE_MATRIX.forEach((row) => {
      Object.values(row.values).forEach((v) => {
        expect(typeof v === 'boolean' || (typeof v === 'string' && v.length > 0)).toBe(true);
      });
    });
  });
});

describe('resolveUserTier', () => {
  it('admin role always resolves to whale (regardless of billing)', () => {
    expect(resolveUserTier({ role: 'admin', billingTier: null })).toBe('whale');
    expect(resolveUserTier({ role: 'admin', billingTier: 'free' })).toBe('whale');
    expect(resolveUserTier({ role: 'admin', billingTier: 'trader' })).toBe('whale');
    expect(resolveUserTier({ role: 'admin', billingTier: 'pro' })).toBe('whale');
  });

  it('non-admin reads from billingTier when present', () => {
    expect(resolveUserTier({ role: 'user', billingTier: 'trader' })).toBe('trader');
    expect(resolveUserTier({ role: 'user', billingTier: 'pro' })).toBe('pro');
    expect(resolveUserTier({ role: 'user', billingTier: 'whale' })).toBe('whale');
    expect(resolveUserTier({ role: 'user', billingTier: 'free' })).toBe('free');
  });

  it('falls back to free when billingTier is null/undefined/invalid', () => {
    expect(resolveUserTier({ role: 'user', billingTier: null })).toBe('free');
    expect(resolveUserTier({ role: 'user', billingTier: undefined })).toBe('free');
    expect(resolveUserTier({ role: 'user', billingTier: 'enterprise' })).toBe('free');
  });

  it('null role falls back to free unless billingTier set', () => {
    expect(resolveUserTier({ role: null, billingTier: null })).toBe('free');
    expect(resolveUserTier({ role: null, billingTier: 'whale' })).toBe('whale');
    expect(resolveUserTier({ role: null, billingTier: 'trader' })).toBe('trader');
  });
});

describe('tierAtLeast', () => {
  it('a tier always satisfies itself', () => {
    ALL_TIERS.forEach((t) => {
      expect(tierAtLeast(t, t)).toBe(true);
    });
  });

  it('higher tier satisfies lower requirement', () => {
    expect(tierAtLeast('whale', 'pro')).toBe(true);
    expect(tierAtLeast('whale', 'trader')).toBe(true);
    expect(tierAtLeast('whale', 'free')).toBe(true);
    expect(tierAtLeast('pro', 'trader')).toBe(true);
    expect(tierAtLeast('pro', 'free')).toBe(true);
    expect(tierAtLeast('trader', 'free')).toBe(true);
  });

  it('lower tier does NOT satisfy higher requirement', () => {
    expect(tierAtLeast('free', 'trader')).toBe(false);
    expect(tierAtLeast('free', 'pro')).toBe(false);
    expect(tierAtLeast('free', 'whale')).toBe(false);
    expect(tierAtLeast('trader', 'pro')).toBe(false);
    expect(tierAtLeast('trader', 'whale')).toBe(false);
    expect(tierAtLeast('pro', 'whale')).toBe(false);
  });
});

describe('annualSavingsUsd', () => {
  it('Trader annual saves $30/yr ($180 - $150)', () => {
    expect(annualSavingsUsd('trader')).toBe(30);
  });

  it('Pro annual saves $98/yr ($588 - $490)', () => {
    expect(annualSavingsUsd('pro')).toBe(98);
  });

  it('Whale annual saves $198/yr ($1188 - $990)', () => {
    expect(annualSavingsUsd('whale')).toBe(198);
  });

  it('Free saves $0 (both $0)', () => {
    expect(annualSavingsUsd('free')).toBe(0);
  });
});

describe('ANNUAL_DISCOUNT_PCT', () => {
  it('matches the 17% headline (2 months free out of 12)', () => {
    expect(ANNUAL_DISCOUNT_PCT).toBe(17);
  });
});

describe('TOOLS_BY_TIER', () => {
  it('has exactly one entry per tier (free, trader, pro, whale)', () => {
    expect(TOOLS_BY_TIER).toHaveLength(4);
    const tiers = TOOLS_BY_TIER.map((t) => t.tier);
    expect(tiers).toEqual(['free', 'trader', 'pro', 'whale']);
  });

  it('every tier entry has heading, description, and at least 3 items', () => {
    TOOLS_BY_TIER.forEach((entry) => {
      expect(entry.heading).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.items.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('every item has a non-empty label', () => {
    TOOLS_BY_TIER.forEach((entry) => {
      entry.items.forEach((item) => {
        expect(item.label).toBeTruthy();
      });
    });
  });

  it('when href is set, it must be a relative route starting with /', () => {
    TOOLS_BY_TIER.forEach((entry) => {
      entry.items.forEach((item) => {
        if (item.href !== undefined) {
          expect(item.href).toMatch(/^\//);
        }
      });
    });
  });

  it('hrefs are unique within a tier (no duplicate links in one column)', () => {
    TOOLS_BY_TIER.forEach((entry) => {
      const hrefs = entry.items.map((i) => i.href).filter((h): h is string => !!h);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });
  });

  it('Whale tier has at least one feature without an href (pure features like priority alerts)', () => {
    const whale = TOOLS_BY_TIER.find((t) => t.tier === 'whale')!;
    const hrefless = whale.items.filter((i) => !i.href);
    expect(hrefless.length).toBeGreaterThan(0);
  });
});

describe('TOOLS_BY_TIER_COUNT', () => {
  it('equals the sum of items across all tiers (derived, not hardcoded)', () => {
    const summed = TOOLS_BY_TIER.reduce((acc, t) => acc + t.items.length, 0);
    expect(TOOLS_BY_TIER_COUNT).toBe(summed);
  });

  it('is greater than 25 (combined across all 4 tiers)', () => {
    expect(TOOLS_BY_TIER_COUNT).toBeGreaterThan(25);
  });
});
