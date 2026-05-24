/**
 * Hub bot v2 — lifecycle watcher for live trade ideas.
 *
 * Every 5 minutes:
 *   1. Load all live ideas (status='live')
 *   2. For each: check current mark price against invalidation
 *      - If invalidated → close + send follow-up close message
 *      - If horizon_h elapsed → expire + record outcome_pct
 *
 * Schedule (systemd timer on the droplet):
 *   /etc/systemd/system/infohub-cron-watch-ideas.timer
 *   OnCalendar=*-*-* *:*:00/5  (every 5 minutes)
 *
 * Mark prices come from fetchAllFundingRates (which carries markPrice
 * for every linked venue) — no extra upstream calls. We average across
 * venues to denoise a single bad print.
 */

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '../_auth';
import {
  initDB, isDBConfigured,
  listLiveTradeIdeas, closeTradeIdea,
  type TradeIdeaRow,
} from '@/lib/db';
import { sendMessage } from '@/lib/telegram';
import { fetchAllFundingRates } from '@/lib/api/aggregator';
import { renderInvalidationClose } from '@/lib/bot/idea-renderer';

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;
  if (!isDBConfigured()) return NextResponse.json({ ok: true, skipped: 'db not configured' });

  const started = Date.now();
  await initDB();

  const ideas = await listLiveTradeIdeas();
  if (ideas.length === 0) {
    return NextResponse.json({
      ok: true,
      ideasChecked: 0,
      durationMs: Date.now() - started,
    });
  }

  // Pull current marks across venues, average per symbol
  const funding = await fetchAllFundingRates('crypto').catch(() => []);
  const marksBySymbol = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const fr of funding) {
    if (!fr.markPrice || fr.markPrice <= 0) continue;
    const prior = marksBySymbol.get(fr.symbol) ?? 0;
    const n = counts.get(fr.symbol) ?? 0;
    marksBySymbol.set(fr.symbol, (prior * n + fr.markPrice) / (n + 1));
    counts.set(fr.symbol, n + 1);
  }

  let invalidatedCount = 0;
  let expiredCount = 0;
  let skippedNoMark = 0;

  for (const idea of ideas) {
    const mark = marksBySymbol.get(idea.symbol);
    if (!mark || mark <= 0) {
      skippedNoMark++;
      continue;
    }

    const action = decideAction(idea, mark);
    if (action === 'invalidated') {
      const outcomePct = computeOutcomePct(idea, mark);
      await closeTradeIdea(idea.id, 'invalidated', outcomePct);
      invalidatedCount++;

      // Notify everyone that received the original push
      if (idea.invalidation != null) {
        const msg = renderInvalidationClose(idea.symbol, idea.side, idea.invalidation);
        for (const chatId of idea.pushed_to) {
          try {
            await sendMessage(chatId, msg, 'HTML');
          } catch { /* keep iterating */ }
        }
      }
    } else if (action === 'expired') {
      const outcomePct = computeOutcomePct(idea, mark);
      await closeTradeIdea(idea.id, 'expired', outcomePct);
      expiredCount++;
      // No follow-up message on expiry — only on invalidation. Quiet expiry
      // is the design-doc spec.
    }
  }

  return NextResponse.json({
    ok: true,
    ideasChecked: ideas.length,
    invalidatedCount,
    expiredCount,
    skippedNoMark,
    durationMs: Date.now() - started,
  });
}

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
