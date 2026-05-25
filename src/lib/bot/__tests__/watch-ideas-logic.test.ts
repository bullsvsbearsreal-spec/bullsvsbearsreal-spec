/**
 * Pure-logic tests for the watch-ideas cron decision functions. Avoids
 * the API route itself (which needs the cron-auth dance) and exercises
 * `decideAction` + `computeOutcomePct` directly.
 */

import { describe, it, expect } from 'vitest';
import {
  decideAction, computeOutcomePct,
} from '@/lib/bot/watch-ideas-logic';
import type { TradeIdeaRow } from '@/lib/db';

function row(over: Partial<TradeIdeaRow>): TradeIdeaRow {
  return {
    id: '1',
    symbol: 'BTC',
    side: 'long',
    setup_type: 'squeeze',
    score: 78,
    signal_stack: {},
    invalidation: 109_500,
    horizon_h: 24,
    pushed_to: [42],
    status: 'live',
    closed_at: null,
    outcome_pct: null,
    created_at: new Date(Date.now() - 60_000), // 1 min old
    ...over,
  };
}

describe('decideAction', () => {
  it('long invalidates when mark drops to or below the level', () => {
    expect(decideAction(row({ side: 'long', invalidation: 109_500 }), 109_500)).toBe('invalidated');
    expect(decideAction(row({ side: 'long', invalidation: 109_500 }), 109_000)).toBe('invalidated');
  });

  it('long stays live when mark is above invalidation', () => {
    expect(decideAction(row({ side: 'long', invalidation: 109_500 }), 113_000)).toBe('live');
  });

  it('short invalidates when mark rises to or above the level', () => {
    expect(decideAction(row({ side: 'short', invalidation: 115_000 }), 115_000)).toBe('invalidated');
    expect(decideAction(row({ side: 'short', invalidation: 115_000 }), 116_500)).toBe('invalidated');
  });

  it('expires when horizon elapsed', () => {
    const old = row({
      created_at: new Date(Date.now() - 25 * 3_600_000),
      horizon_h: 24,
    });
    expect(decideAction(old, 113_000)).toBe('expired');
  });

  it('invalidation supersedes expiry when both apply', () => {
    const old = row({
      created_at: new Date(Date.now() - 25 * 3_600_000),
      horizon_h: 24,
      side: 'long',
      invalidation: 109_500,
    });
    expect(decideAction(old, 109_000)).toBe('invalidated');
  });

  it('null invalidation never triggers an "invalidated" close', () => {
    expect(decideAction(row({ invalidation: null }), 1)).toBe('live');
  });
});

describe('computeOutcomePct', () => {
  it('returns null when invalidation is null', () => {
    expect(computeOutcomePct(row({ invalidation: null }), 113_000)).toBeNull();
  });

  it('long outcome is positive when mark > invalidation', () => {
    const out = computeOutcomePct(row({ side: 'long', invalidation: 100_000 }), 110_000);
    expect(out).toBeGreaterThan(0);
  });

  it('short outcome inverts sign — gain comes from mark below entry/invalidation', () => {
    const upMove = computeOutcomePct(row({ side: 'short', invalidation: 100_000 }), 110_000);
    expect(upMove).toBeLessThan(0); // short LOSES when mark went up
    const downMove = computeOutcomePct(row({ side: 'short', invalidation: 100_000 }), 90_000);
    expect(downMove).toBeGreaterThan(0); // short GAINS when mark went down
  });
});
