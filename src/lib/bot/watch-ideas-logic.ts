/**
 * Pure-logic helpers for the watch-ideas cron. Lives in lib/bot so the
 * route.ts file stays compliant with Next.js's route-handler export
 * rules (only HTTP verbs + special config fields allowed).
 */

import type { TradeIdeaRow } from '@/lib/db';

/**
 * Per-idea decision: invalidate, expire, or keep live. Pure function so
 * we can unit-test it without the cron infra.
 */
export function decideAction(idea: TradeIdeaRow, currentMark: number): 'invalidated' | 'expired' | 'live' {
  // Invalidation check first — supersedes expiry
  if (idea.invalidation != null && idea.invalidation > 0) {
    if (idea.side === 'long' && currentMark <= idea.invalidation) return 'invalidated';
    if (idea.side === 'short' && currentMark >= idea.invalidation) return 'invalidated';
  }
  // Expiry by horizon
  const ageH = (Date.now() - idea.created_at.getTime()) / 3_600_000;
  if (ageH >= idea.horizon_h) return 'expired';
  return 'live';
}

/**
 * Realised outcome as a percent relative to the symbol's price at idea
 * creation. We don't have a recorded entry price (the design uses
 * "current price at idea time" implicit in invalidation distance), so we
 * approximate using invalidation as the reference: for a long, the
 * fair-value reference is invalidation × (1 + buffer). For PR2 v1 we
 * use the simpler "mark vs invalidation" framing — it's not perfect but
 * it's monotonic in the right direction.
 *
 * PR3 will store entry_price directly on the row.
 */
export function computeOutcomePct(idea: TradeIdeaRow, currentMark: number): number | null {
  if (idea.invalidation == null || idea.invalidation <= 0) return null;
  // Distance from invalidation to current, as % of invalidation
  const raw = ((currentMark - idea.invalidation) / idea.invalidation) * 100;
  // For shorts, invert sign (going UP from invalidation is BAD for shorts)
  const signed = idea.side === 'short' ? -raw : raw;
  return Math.round(signed * 100) / 100;
}
