/**
 * Hub bot v2 — proactive idea scan + push.
 *
 * Every 5 minutes:
 *   1. Pull signals for the top-50 perp universe
 *   2. Score each (symbol, long) and (symbol, short) candidate
 *   3. Filter to score ≥ 75 and not pushed in the last 2h for that symbol
 *   4. Cluster correlated coins (same setup_type, same side, ≥ 3) into a
 *      single basket push with a headline + alt list
 *   5. Apply the daily push cap (max 3 / day across all subscribers,
 *      never 2 within 2h)
 *   6. Persist to bot_trade_ideas + push to each idea_notifications=true chat
 *
 * Schedule (systemd timer on the droplet):
 *   /etc/systemd/system/infohub-cron-scan-ideas.timer
 *   OnCalendar=*-*-* *:*:00/5  (every 5 minutes)
 */

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '../_auth';
import {
  initDB, isDBConfigured,
  insertTradeIdea, getIdeaPushSubscribers, countIdeasPushedSince,
  getLatestIdeaForSymbol,
} from '@/lib/db';
import { sendMessage } from '@/lib/telegram';
import { fetchTopUniverseSignals } from '@/lib/bot/signal-fetcher';
import {
  scoreIdea, isPushable, defaultHorizonForSetup,
  type ScoredIdea, type SetupType, type Side,
} from '@/lib/bot/idea-scorer';
import { renderBasket, renderIdea } from '@/lib/bot/idea-renderer';

// ── Tunables (locked by docs/hub-bot-v2.md) ───────────────────────────
const DAILY_PUSH_CAP = 3;
const COOLDOWN_HOURS_BETWEEN_PUSHES = 2;
const COOLDOWN_HOURS_PER_SYMBOL = 12; // don't re-push the same coin within 12h
const SCAN_UNIVERSE_SIZE = 50;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;
  if (!isDBConfigured()) return NextResponse.json({ ok: true, skipped: 'db not configured' });

  const started = Date.now();
  await initDB();

  // ── Push budget check ────────────────────────────────────────────
  const last24h = await countIdeasPushedSince(24);
  if (last24h >= DAILY_PUSH_CAP) {
    return NextResponse.json({
      ok: true,
      skipped: 'daily push cap reached',
      pushedLast24h: last24h,
      cap: DAILY_PUSH_CAP,
      durationMs: Date.now() - started,
    });
  }
  const last2h = await countIdeasPushedSince(COOLDOWN_HOURS_BETWEEN_PUSHES);
  if (last2h > 0) {
    return NextResponse.json({
      ok: true,
      skipped: '2h cooldown between pushes',
      pushedLast2h: last2h,
      durationMs: Date.now() - started,
    });
  }

  // ── Fetch signals + score ────────────────────────────────────────
  let universe;
  try {
    universe = await fetchTopUniverseSignals(SCAN_UNIVERSE_SIZE);
  } catch (e) {
    console.error('[cron/scan-ideas] signal fetch failed:', e);
    return NextResponse.json({ ok: false, error: 'signal fetch failed' }, { status: 500 });
  }

  const candidates: ScoredIdea[] = [];
  for (const coin of universe) {
    // Score both sides — pick whichever is higher.
    const longSetup = chooseSetupType(coin.inputs, 'long');
    const shortSetup = chooseSetupType(coin.inputs, 'short');
    const longIdea = scoreIdea(coin.symbol, longSetup, 'long', coin.inputs, {
      currentPrice: coin.currentPrice,
      horizonH: defaultHorizonForSetup(longSetup),
    });
    const shortIdea = scoreIdea(coin.symbol, shortSetup, 'short', coin.inputs, {
      currentPrice: coin.currentPrice,
      horizonH: defaultHorizonForSetup(shortSetup),
    });
    const best = longIdea.score >= shortIdea.score ? longIdea : shortIdea;
    if (isPushable(best.score)) candidates.push(best);
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      candidatesScored: universe.length,
      pushable: 0,
      pushed: 0,
      durationMs: Date.now() - started,
    });
  }

  // ── Per-symbol cooldown filter ───────────────────────────────────
  const cooldownMs = COOLDOWN_HOURS_PER_SYMBOL * 60 * 60 * 1000;
  const filteredCandidates: ScoredIdea[] = [];
  for (const c of candidates) {
    const latest = await getLatestIdeaForSymbol(c.symbol);
    if (latest && Date.now() - latest.created_at.getTime() < cooldownMs) continue;
    filteredCandidates.push(c);
  }

  if (filteredCandidates.length === 0) {
    return NextResponse.json({
      ok: true,
      candidatesScored: universe.length,
      pushable: candidates.length,
      skipped: 'all on per-symbol cooldown',
      durationMs: Date.now() - started,
    });
  }

  // ── Sort by score, take headline + optional basket ───────────────
  filteredCandidates.sort((a, b) => b.score - a.score);
  const headline = filteredCandidates[0];
  // Basket alts: same side + same setup type as headline + ≥ ★★★ (≥70)
  const alts = filteredCandidates
    .slice(1)
    .filter((c) => c.side === headline.side && c.setupType === headline.setupType && c.score >= 70)
    .slice(0, 4);

  // ── Render + persist + push ──────────────────────────────────────
  const subscribers = await getIdeaPushSubscribers();
  const pushedTo: number[] = [];

  const body = alts.length >= 2
    ? renderBasket(headline, alts)
    : renderIdea(headline, { asPush: true });

  // Persist FIRST so a partial-push failure still records the idea
  const ideaId = await insertTradeIdea({
    symbol: headline.symbol,
    side: headline.side,
    setupType: headline.setupType,
    score: headline.score,
    signalStack: {
      signals: headline.signals,
      basketAlts: alts.map((a) => ({ symbol: a.symbol, score: a.score, stars: a.stars })),
    },
    invalidation: headline.invalidation,
    horizonH: headline.horizonH,
    pushedTo: [], // populated below as pushes succeed
  });

  // Fan out to subscribers (sequential with small batch size; Telegram
  // rate-limits aggressive bursts).
  for (const chatId of subscribers) {
    try {
      const ok = await sendMessage(chatId, body, 'HTML');
      if (ok) pushedTo.push(chatId);
    } catch (e) {
      console.warn(`[cron/scan-ideas] push to ${chatId} failed:`, e instanceof Error ? e.message : e);
    }
  }

  // Update the row with the actual pushed_to list (best-effort; if it
  // fails the idea is still recorded just without the subscriber list).
  if (ideaId && pushedTo.length > 0) {
    try {
      const { getSQL } = await import('@/lib/db');
      const sql = getSQL();
      await sql`UPDATE bot_trade_ideas SET pushed_to = ${pushedTo} WHERE id = ${ideaId}`;
    } catch (e) {
      console.warn('[cron/scan-ideas] pushed_to update failed:', e);
    }
  }

  return NextResponse.json({
    ok: true,
    candidatesScored: universe.length,
    pushable: candidates.length,
    afterCooldown: filteredCandidates.length,
    pushedSymbol: headline.symbol,
    pushedSide: headline.side,
    pushedScore: headline.score,
    basketAltCount: alts.length,
    subscriberCount: subscribers.length,
    pushedTo: pushedTo.length,
    durationMs: Date.now() - started,
  });
}

/**
 * Pick the most-fitting setup type for a given side based on which
 * signals are firing. Heuristic, not learned — good enough for v1 since
 * the score itself doesn't depend on setup_type, only the label does.
 */
function chooseSetupType(inputs: { fundingPctileAbs: number; oiDelta4hPct: number; liqClusterDistPct: number; basisSpreadMaxPct: number; whaleCount4h: number }, _side: Side): SetupType {
  if (inputs.basisSpreadMaxPct >= 0.02) return 'funding_arb';
  if (inputs.liqClusterDistPct <= 3 && Math.abs(inputs.oiDelta4hPct) >= 8) return 'liq_hunt';
  if (inputs.whaleCount4h >= 2) return 'squeeze';
  return 'directional';
}
