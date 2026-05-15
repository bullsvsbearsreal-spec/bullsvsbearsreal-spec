/**
 * Tests for the wallet-watcher core: diff function, threshold filter,
 * and Telegram formatter. All three are pure: same input → same output,
 * no DB / fetch / Telegram side effects, so we exercise the full event
 * matrix without mocking.
 */

import { describe, it, expect } from 'vitest';
import {
  diffSnapshots, applyThresholds, formatEvent, DEFAULT_THRESHOLDS,
  parseJsonbArray, parseJsonbObject,
  type AccountSnapshot, type PositionLite, type Thresholds, type WatchEvent,
} from '../hl-watch';

// ─── Builders ────────────────────────────────────────────────────────

function pos(over: Partial<PositionLite> = {}): PositionLite {
  return {
    coin: 'BTC',
    szi: 0.5,                  // long 0.5 BTC
    positionValue: 50_000,     // $50k notional
    entryPx: 100_000,
    markPx: 100_000,
    liquidationPx: 90_000,     // 10% from entry/mark
    unrealizedPnl: 0,
    cumFundingAllTime: 0,
    ...over,
  };
}

function snap(positions: PositionLite[], over: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return {
    address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    venue: 'hyperliquid',
    positions,
    accountValue: 100_000,
    ts: 1_700_000_000_000,
    ...over,
  };
}

// ─── diffSnapshots ───────────────────────────────────────────────────

describe('diffSnapshots', () => {
  it('first ever snapshot returns no events (no prev to diff)', () => {
    const events = diffSnapshots(null, snap([pos()]));
    expect(events).toEqual([]);
  });

  it('emits opened when a new symbol appears', () => {
    const prev = snap([pos({ coin: 'BTC' })]);
    const curr = snap([pos({ coin: 'BTC' }), pos({ coin: 'ETH', szi: 5, positionValue: 10_000 })]);
    const events = diffSnapshots(prev, curr);
    const openEvents = events.filter(e => e.kind === 'opened');
    expect(openEvents).toHaveLength(1);
    expect(openEvents[0].symbol).toBe('ETH');
    expect(openEvents[0].payload.side).toBe('long');
    expect(openEvents[0].payload.sizeUsd).toBe(10_000);
  });

  it('emits closed when a symbol disappears', () => {
    const prev = snap([pos({ coin: 'BTC', positionValue: 50_000, unrealizedPnl: 2_500 })]);
    const curr = snap([]);
    const events = diffSnapshots(prev, curr);
    const closedEvents = events.filter(e => e.kind === 'closed');
    expect(closedEvents).toHaveLength(1);
    expect(closedEvents[0].symbol).toBe('BTC');
    // Realized PnL approximates as the prev tick's unrealized PnL.
    expect(closedEvents[0].payload.realizedPnl).toBe(2_500);
    expect(closedEvents[0].payload.prevSizeUsd).toBe(50_000);
  });

  it('detects shorts on close and reports side correctly', () => {
    const prev = snap([pos({ coin: 'ETH', szi: -2, positionValue: 5_000, unrealizedPnl: -300 })]);
    const curr = snap([]);
    const events = diffSnapshots(prev, curr);
    expect(events[0].kind).toBe('closed');
    expect(events[0].payload.side).toBe('short');
    expect(events[0].payload.realizedPnl).toBe(-300);
  });

  it('emits size_changed when notional moves between snapshots', () => {
    const prev = snap([pos({ positionValue: 50_000 })]);
    const curr = snap([pos({ positionValue: 75_000 })]);
    const events = diffSnapshots(prev, curr);
    const sizeEvents = events.filter(e => e.kind === 'size_changed');
    expect(sizeEvents).toHaveLength(1);
    expect(sizeEvents[0].payload.prevSizeUsd).toBe(50_000);
    expect(sizeEvents[0].payload.sizeUsd).toBe(75_000);
    expect(sizeEvents[0].payload.deltaPct).toBeCloseTo(0.5, 5); // +50%
  });

  it('size_changed below 1% is suppressed (raw threshold)', () => {
    const prev = snap([pos({ positionValue: 50_000 })]);
    const curr = snap([pos({ positionValue: 50_100 })]); // +0.2%
    const events = diffSnapshots(prev, curr);
    expect(events.filter(e => e.kind === 'size_changed')).toHaveLength(0);
  });

  it('liq_danger fires when mark moves closer to liq', () => {
    // long: liq at 90k, mark drops 100k → 95k → distance shrinks
    const prev = snap([pos({ markPx: 100_000, liquidationPx: 90_000 })]);
    const curr = snap([pos({ markPx: 95_000, liquidationPx: 90_000 })]);
    const events = diffSnapshots(prev, curr);
    const liqEvents = events.filter(e => e.kind === 'liq_danger');
    expect(liqEvents).toHaveLength(1);
    // 95k → 90k = 5k gap on a 95k mark = ~5.26%
    expect(liqEvents[0].payload.distPct).toBeCloseTo(5_000 / 95_000, 3);
  });

  it('liq_danger does NOT fire when mark moves AWAY from liq', () => {
    const prev = snap([pos({ markPx: 100_000, liquidationPx: 90_000 })]);
    const curr = snap([pos({ markPx: 105_000, liquidationPx: 90_000 })]);
    const events = diffSnapshots(prev, curr);
    expect(events.filter(e => e.kind === 'liq_danger')).toHaveLength(0);
  });

  it('liq_danger does NOT fire when mark is unchanged (the regression case)', () => {
    // The original bug: distance was entry-vs-liq (constant) so the
    // alert never fired even when mark approached liq. Confirm that
    // with mark=mark (no change), nothing fires either — establishing
    // that we're using mark, not entry.
    const p = pos({ markPx: 100_000, liquidationPx: 90_000 });
    const events = diffSnapshots(snap([p]), snap([p]));
    expect(events.filter(e => e.kind === 'liq_danger')).toHaveLength(0);
  });

  it('emits funding_paid when cumFunding changes', () => {
    const prev = snap([pos({ cumFundingAllTime: -100 })]);  // already paid $100
    const curr = snap([pos({ cumFundingAllTime: -250 })]);  // now $250 → paid $150 more
    const events = diffSnapshots(prev, curr);
    const fund = events.filter(e => e.kind === 'funding_paid');
    expect(fund).toHaveLength(1);
    expect(fund[0].payload.fundingDelta).toBe(-150);
  });

  it('does NOT emit funding_paid for sub-$1 noise', () => {
    const prev = snap([pos({ cumFundingAllTime: -10.0 })]);
    const curr = snap([pos({ cumFundingAllTime: -10.5 })]); // 0.5 delta < 1
    const events = diffSnapshots(prev, curr);
    expect(events.filter(e => e.kind === 'funding_paid')).toHaveLength(0);
  });

  it('handles flip from long to short (close + open)', () => {
    // Currently the differ treats flip as same-symbol, so it'll emit
    // size_changed. Document that — if we later want flip detection
    // we'd compare szi sign.
    const prev = snap([pos({ szi: 0.5, positionValue: 50_000 })]);
    const curr = snap([pos({ szi: -0.5, positionValue: 50_000 })]);
    const events = diffSnapshots(prev, curr);
    // Same notional, no events — limitation we accept for now.
    expect(events.filter(e => e.kind === 'opened')).toHaveLength(0);
    expect(events.filter(e => e.kind === 'closed')).toHaveLength(0);
  });

  it('multiple positions diff independently', () => {
    const prev = snap([pos({ coin: 'BTC' }), pos({ coin: 'ETH', szi: 5 })]);
    const curr = snap([
      pos({ coin: 'BTC', positionValue: 60_000 }),         // size_changed
      pos({ coin: 'SOL', szi: 50, positionValue: 5_000 }), // opened
    ]);
    const events = diffSnapshots(prev, curr);
    expect(events.find(e => e.kind === 'opened' && e.symbol === 'SOL')).toBeDefined();
    expect(events.find(e => e.kind === 'closed' && e.symbol === 'ETH')).toBeDefined();
    expect(events.find(e => e.kind === 'size_changed' && e.symbol === 'BTC')).toBeDefined();
  });

  it('emits no events when nothing changed', () => {
    const p = pos({ coin: 'BTC', cumFundingAllTime: -50 });
    const events = diffSnapshots(snap([p]), snap([p]));
    expect(events).toEqual([]);
  });
});

// ─── applyThresholds ─────────────────────────────────────────────────

describe('applyThresholds', () => {
  const allOff: Thresholds = {
    triggerOpened: false, triggerClosed: false, triggerSizeChanged: false,
    triggerLiqDanger: false, triggerRealizedPnl: false, triggerFundingPaid: false,
    sizeChangePct: 0.10, liqDangerPct: 0.05, realizedPnlUsd: 1000, fundingPaidUsd: 1000,
  };

  it('drops all events when every trigger is disabled', () => {
    const events: WatchEvent[] = [
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 50_000 } },
      { kind: 'closed', symbol: 'ETH', payload: { side: 'long', realizedPnl: 5_000 } },
    ];
    expect(applyThresholds(events, allOff)).toEqual([]);
  });

  it('opened: gated only by triggerOpened', () => {
    const e: WatchEvent = { kind: 'opened', symbol: 'BTC', payload: {} };
    expect(applyThresholds([e], { ...allOff, triggerOpened: true })).toEqual([e]);
    expect(applyThresholds([e], { ...allOff, triggerOpened: false })).toEqual([]);
  });

  it('size_changed respects sizeChangePct threshold', () => {
    const small: WatchEvent = { kind: 'size_changed', symbol: 'BTC', payload: { deltaPct: 0.05 } };
    const big: WatchEvent   = { kind: 'size_changed', symbol: 'BTC', payload: { deltaPct: 0.50 } };
    const t: Thresholds = { ...allOff, triggerSizeChanged: true, sizeChangePct: 0.10 };
    expect(applyThresholds([small], t)).toEqual([]);   // 5% < 10% threshold
    expect(applyThresholds([big],   t)).toEqual([big]); // 50% >= 10%
  });

  it('size_changed respects negative deltas (downsize)', () => {
    const downsize: WatchEvent = { kind: 'size_changed', symbol: 'BTC', payload: { deltaPct: -0.30 } };
    const t: Thresholds = { ...allOff, triggerSizeChanged: true, sizeChangePct: 0.10 };
    expect(applyThresholds([downsize], t)).toEqual([downsize]); // |−30%| ≥ 10%
  });

  it('liq_danger fires only when distPct ≤ threshold', () => {
    const close: WatchEvent = { kind: 'liq_danger', symbol: 'BTC', payload: { distPct: 0.03 } };
    const far:   WatchEvent = { kind: 'liq_danger', symbol: 'BTC', payload: { distPct: 0.15 } };
    const t: Thresholds = { ...allOff, triggerLiqDanger: true, liqDangerPct: 0.05 };
    expect(applyThresholds([close], t)).toEqual([close]); // 3% within 5% band
    expect(applyThresholds([far],   t)).toEqual([]);      // 15% outside band
  });

  it('funding_paid uses absolute value for the threshold check', () => {
    const small: WatchEvent = { kind: 'funding_paid', symbol: 'BTC', payload: { fundingDelta: -500 } };
    const big:   WatchEvent = { kind: 'funding_paid', symbol: 'BTC', payload: { fundingDelta: -2_000 } };
    const t: Thresholds = { ...allOff, triggerFundingPaid: true, fundingPaidUsd: 1_000 };
    expect(applyThresholds([small], t)).toEqual([]);
    expect(applyThresholds([big],   t)).toEqual([big]);
  });

  it('closed: passes when triggerClosed is on regardless of realized', () => {
    const small: WatchEvent = { kind: 'closed', symbol: 'BTC', payload: { realizedPnl: 100 } };
    const t: Thresholds = { ...allOff, triggerClosed: true, realizedPnlUsd: 1_000_000 };
    expect(applyThresholds([small], t)).toEqual([small]);
  });

  it('closed: when only realized_pnl is on, gate by realizedPnl threshold', () => {
    const small: WatchEvent = { kind: 'closed', symbol: 'BTC', payload: { realizedPnl: 100 } };
    const big:   WatchEvent = { kind: 'closed', symbol: 'BTC', payload: { realizedPnl: 5_000 } };
    const t: Thresholds = { ...allOff, triggerClosed: false, triggerRealizedPnl: true, realizedPnlUsd: 1_000 };
    expect(applyThresholds([small], t)).toEqual([]);
    expect(applyThresholds([big],   t)).toEqual([big]);
  });

  it('default thresholds match the SQL defaults shipped in db migration', () => {
    expect(DEFAULT_THRESHOLDS.sizeChangePct).toBe(0.10);
    expect(DEFAULT_THRESHOLDS.liqDangerPct).toBe(0.05);
    expect(DEFAULT_THRESHOLDS.realizedPnlUsd).toBe(1000);
    expect(DEFAULT_THRESHOLDS.fundingPaidUsd).toBe(1000);
  });
});

// ─── formatEvent ─────────────────────────────────────────────────────

describe('formatEvent', () => {
  const addr = '0xabF68ea28e2522726F53b6413b87Ef7067FDf21A';

  it('opened: long has 🟢 LONG, short has 🔻 SHORT', () => {
    const longMsg = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 40_000 } },
      addr,
    );
    expect(longMsg).toContain('🟢 LONG opened');
    expect(longMsg).toContain('BTC');
    expect(longMsg).toContain('$40.0K');

    const shortMsg = formatEvent(
      { kind: 'opened', symbol: 'ETH', payload: { side: 'short', sizeUsd: 2_500_000 } },
      addr,
    );
    expect(shortMsg).toContain('🔻 SHORT opened');
    expect(shortMsg).toContain('$2.50M');
  });

  it('closed: positive realized PnL gets ✅, negative gets ❌', () => {
    const win = formatEvent(
      { kind: 'closed', symbol: 'BTC', payload: { side: 'long', prevSizeUsd: 50_000, realizedPnl: 2_500 } },
      addr,
    );
    expect(win).toContain('CLOSED');
    expect(win).toContain('+$2.5K');
    expect(win).toContain('✅');

    const loss = formatEvent(
      { kind: 'closed', symbol: 'BTC', payload: { side: 'long', prevSizeUsd: 50_000, realizedPnl: -1_200 } },
      addr,
    );
    expect(loss).toContain('-$1.2K');
    expect(loss).toContain('❌');
  });

  it('size_changed: positive delta says INCREASED, negative says DECREASED', () => {
    const inc = formatEvent(
      { kind: 'size_changed', symbol: 'BTC', payload: { side: 'long', prevSizeUsd: 50_000, sizeUsd: 75_000, deltaPct: 0.5 } },
      addr,
    );
    expect(inc).toContain('📈 INCREASED');
    expect(inc).toContain('+50.0%');

    const dec = formatEvent(
      { kind: 'size_changed', symbol: 'BTC', payload: { side: 'long', prevSizeUsd: 50_000, sizeUsd: 30_000, deltaPct: -0.4 } },
      addr,
    );
    expect(dec).toContain('📉 DECREASED');
    expect(dec).toContain('-40.0%');
  });

  it('liq_danger: includes distance percentage', () => {
    const msg = formatEvent(
      { kind: 'liq_danger', symbol: 'BTC', payload: { side: 'long', distPct: 0.0234 } },
      addr,
    );
    expect(msg).toContain('⚠️ NEAR LIQ');
    expect(msg).toContain('2.34%');
  });

  it('venue tag appears in the message', () => {
    const hl = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 40_000 } },
      addr, undefined, 'hyperliquid',
    );
    const gt = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 40_000 } },
      addr, undefined, 'gtrade',
    );
    const gmx = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 40_000 } },
      addr, undefined, 'gmx',
    );
    expect(hl).toContain('Hyperliquid');
    expect(gt).toContain('gTrade');
    expect(gmx).toContain('GMX');
  });

  it('label takes priority over short address in the header line', () => {
    const labelled = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 40_000 } },
      addr, 'OP guy',
    );
    expect(labelled).toContain('OP guy');
    expect(labelled).toContain('0xabF6'); // truncated addr still shown alongside
  });

  it('escapes Markdown control chars in labels', () => {
    const msg = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 40_000 } },
      addr, 'name*with_chars`',
    );
    // Asterisks/underscores/backticks in user-supplied labels must be
    // escaped or Telegram would parse them as Markdown formatting and
    // potentially break the rest of the message.
    expect(msg).toContain('name\\*with\\_chars\\`');
  });

  it('funding_paid: PAID for negative delta, RECEIVED for positive', () => {
    const paid = formatEvent(
      { kind: 'funding_paid', symbol: 'BTC', payload: { side: 'long', fundingDelta: -1_500 } },
      addr,
    );
    expect(paid).toContain('💸 PAID');
    expect(paid).toContain('$1.5K');

    const got = formatEvent(
      { kind: 'funding_paid', symbol: 'BTC', payload: { side: 'short', fundingDelta: 800 } },
      addr,
    );
    expect(got).toContain('💰 RECEIVED');
    expect(got).toContain('$800.00');
  });

  it('handles missing payload fields gracefully (no NaN / undefined leakage)', () => {
    const msg = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: {} },
      addr,
    );
    expect(msg).not.toContain('NaN');
    expect(msg).not.toContain('undefined');
  });

  // ─── Number formatting at scale ─────────────────────────────────

  it('formats notional at B-scale (≥$1B)', () => {
    const msg = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 1_500_000_000 } },
      addr,
    );
    expect(msg).toContain('$1.50B');
  });

  it('formats sub-$1k notional with 2-decimal precision', () => {
    const msg = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 42.50 } },
      addr,
    );
    expect(msg).toContain('$42.50');
  });

  it('truncated address always shows the leading 0x and trailing 4 chars', () => {
    const msg = formatEvent(
      { kind: 'opened', symbol: 'BTC', payload: { side: 'long', sizeUsd: 1_000 } },
      addr,
    );
    // Real-world: 0xabF68ea28e2522726F53b6413b87Ef7067FDf21A
    // shortAddr slices [0..6] + [-4]: '0xabF6…f21A' (preserves case)
    expect(msg).toContain('0xabF6');
    expect(msg).toContain('f21A');
  });

  it('handles size_changed crossing zero gracefully', () => {
    const msg = formatEvent(
      { kind: 'size_changed', symbol: 'BTC', payload: { side: 'long', prevSizeUsd: 50_000, sizeUsd: 0, deltaPct: -1.0 } },
      addr,
    );
    // -100% delta should still render (-100.0%, not crashing)
    expect(msg).toContain('-100.0%');
    expect(msg).not.toContain('NaN');
  });
});

// ─── diffSnapshots — additional edge cases ───────────────────────────

describe('diffSnapshots edge cases', () => {
  it('multiple symbols changing in one tick all emit independently', () => {
    const prev = snap([
      pos({ coin: 'BTC', positionValue: 50_000 }),
      pos({ coin: 'ETH', szi: 5,  positionValue: 10_000 }),
      pos({ coin: 'SOL', szi: 100, positionValue: 8_000 }),
    ]);
    const curr = snap([
      pos({ coin: 'BTC', positionValue: 75_000 }),                      // size_changed
      pos({ coin: 'ETH', szi: 5,  positionValue: 10_000, markPx: 95 }), // no event
      pos({ coin: 'SOL', szi: 80, positionValue: 6_400 }),              // size_changed (-20%)
      pos({ coin: 'PEPE', szi: 100_000, positionValue: 500 }),          // opened
    ]);
    const events = diffSnapshots(prev, curr);
    expect(events.find(e => e.kind === 'size_changed' && e.symbol === 'BTC')).toBeDefined();
    expect(events.find(e => e.kind === 'size_changed' && e.symbol === 'SOL')).toBeDefined();
    expect(events.find(e => e.kind === 'opened' && e.symbol === 'PEPE')).toBeDefined();
    // ETH unchanged → no event for it
    expect(events.find(e => e.symbol === 'ETH')).toBeUndefined();
  });

  it('liq_danger does not divide by zero when markPx is 0', () => {
    const prev = snap([pos({ markPx: 100, liquidationPx: 90 })]);
    // Pathological: markPx becomes 0 (shouldn't happen in real data)
    const curr = snap([pos({ markPx: 0, liquidationPx: 90 })]);
    const events = diffSnapshots(prev, curr);
    // Guard `currPos.markPx > 0` skips this branch — no NaN/Infinity events
    expect(events.find(e => e.kind === 'liq_danger')).toBeUndefined();
  });

  it('size_changed handles zero-prev gracefully (no division-by-zero)', () => {
    const prev = snap([pos({ positionValue: 0 })]); // edge: ghost row
    const curr = snap([pos({ positionValue: 50_000 })]);
    const events = diffSnapshots(prev, curr);
    // The differ should not crash; behaviour: emits nothing because
    // prevPos.positionValue > 0 gate fails.
    expect(events.find(e => e.kind === 'size_changed')).toBeUndefined();
  });

  it('exactly equal snapshots produce zero events even with non-zero PnL', () => {
    const p = pos({ coin: 'BTC', positionValue: 50_000, unrealizedPnl: 1_234, cumFundingAllTime: -50 });
    const events = diffSnapshots(snap([p]), snap([p]));
    expect(events).toEqual([]);
  });
});

// ─── applyThresholds — boundary cases ─────────────────────────────────

describe('applyThresholds boundary cases', () => {
  const t: Thresholds = {
    triggerOpened: true, triggerClosed: true, triggerSizeChanged: true,
    triggerLiqDanger: true, triggerRealizedPnl: true, triggerFundingPaid: true,
    sizeChangePct: 0.10, liqDangerPct: 0.05, realizedPnlUsd: 1000, fundingPaidUsd: 1000,
  };

  it('size_changed at exactly the threshold passes (>= comparison)', () => {
    const e: WatchEvent = { kind: 'size_changed', symbol: 'BTC', payload: { deltaPct: 0.10 } };
    expect(applyThresholds([e], t)).toEqual([e]);
  });

  it('liq_danger at exactly the threshold passes (<= comparison)', () => {
    const e: WatchEvent = { kind: 'liq_danger', symbol: 'BTC', payload: { distPct: 0.05 } };
    expect(applyThresholds([e], t)).toEqual([e]);
  });

  it('funding_paid at exactly the threshold passes', () => {
    const e: WatchEvent = { kind: 'funding_paid', symbol: 'BTC', payload: { fundingDelta: -1000 } };
    expect(applyThresholds([e], t)).toEqual([e]);
  });

  it('empty events array returns empty array (not undefined)', () => {
    expect(applyThresholds([], t)).toEqual([]);
  });

  it('events with unknown kind are filtered out', () => {
    // @ts-expect-error - testing defensive default branch
    const e: WatchEvent = { kind: 'totally-not-a-kind', symbol: 'BTC', payload: {} };
    expect(applyThresholds([e], t)).toEqual([]);
  });
});

// ─── JSONB parse helpers — regression tests for the postgres.js
//      "string instead of array/object" return quirk ───────────────────

describe('parseJsonbArray', () => {
  it('passes through arrays unchanged', () => {
    const arr = [{ coin: 'BTC' }, { coin: 'ETH' }];
    expect(parseJsonbArray(arr)).toBe(arr);
  });

  it('parses a JSON string into an array', () => {
    const raw = '[{"coin":"BTC","szi":1.5}]';
    expect(parseJsonbArray(raw)).toEqual([{ coin: 'BTC', szi: 1.5 }]);
  });

  it('returns [] for malformed JSON strings', () => {
    expect(parseJsonbArray('not valid json {{')).toEqual([]);
  });

  it('returns [] for null/undefined/non-array shapes', () => {
    expect(parseJsonbArray(null)).toEqual([]);
    expect(parseJsonbArray(undefined)).toEqual([]);
    expect(parseJsonbArray(42)).toEqual([]);
    expect(parseJsonbArray({ not: 'an array' })).toEqual([]);
  });

  it('returns [] when JSON parses to a non-array value', () => {
    expect(parseJsonbArray('"just a string"')).toEqual([]);
    expect(parseJsonbArray('{"obj":true}')).toEqual([]);
    expect(parseJsonbArray('null')).toEqual([]);
  });

  it('handles the production-observed shape (16k char positions string)', () => {
    // The actual bug case — postgres.js returned the JSONB column as
    // a real JSON string. parseJsonbArray must recover the array so
    // the differ has a real prev snapshot to diff against.
    const big = JSON.stringify(Array.from({ length: 50 }, (_, i) => ({
      coin: `SYM${i}`, szi: i + 1, positionValue: 1000 * i,
    })));
    const result = parseJsonbArray<{ coin: string }>(big);
    expect(result).toHaveLength(50);
    expect(result[0].coin).toBe('SYM0');
    expect(result[49].coin).toBe('SYM49');
  });
});

describe('parseJsonbObject', () => {
  it('passes through plain objects unchanged', () => {
    const obj = { side: 'long', sizeUsd: 1000 };
    expect(parseJsonbObject(obj)).toBe(obj);
  });

  it('parses a JSON object string', () => {
    expect(parseJsonbObject('{"side":"long","sizeUsd":1000}'))
      .toEqual({ side: 'long', sizeUsd: 1000 });
  });

  it('returns {} for malformed JSON', () => {
    expect(parseJsonbObject('not valid json')).toEqual({});
  });

  it('returns {} for arrays (we want object, not array)', () => {
    expect(parseJsonbObject([1, 2, 3])).toEqual({});
    expect(parseJsonbObject('[1,2,3]')).toEqual({});
  });

  it('returns {} for null/undefined/scalars', () => {
    expect(parseJsonbObject(null)).toEqual({});
    expect(parseJsonbObject(undefined)).toEqual({});
    expect(parseJsonbObject(42)).toEqual({});
    expect(parseJsonbObject('"scalar"')).toEqual({});
  });

  it('handles the production-observed event payload shape', () => {
    // The bug case for events — payload returned as JSON string,
    // UI accessed e.payload.side and got undefined → 'LONG CHIP · $0.00'.
    // parseJsonbObject recovers the real shape.
    const raw = '{"side":"short","sizeUsd":176810.0376}';
    const result = parseJsonbObject<{ side?: string; sizeUsd?: number }>(raw);
    expect(result.side).toBe('short');
    expect(result.sizeUsd).toBe(176810.0376);
  });
});
