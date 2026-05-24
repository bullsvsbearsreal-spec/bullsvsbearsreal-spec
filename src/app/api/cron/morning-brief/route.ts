/**
 * Hub bot v2 — daily morning brief at 08:00 UTC.
 *
 * Each morning:
 *   1. Pull signals + score the top-N universe
 *   2. Take the top 3 setups (any side, any setup_type)
 *   3. Compute a one-line market regime summary
 *   4. Render the brief in sharp-trader voice
 *   5. Push to every chat with idea_notifications=true
 *
 * Schedule (systemd timer on the droplet):
 *   /etc/systemd/system/infohub-cron-morning-brief.timer
 *   OnCalendar=*-*-* 08:00:00 UTC
 *
 * Brief does NOT count toward the daily 3-push cap — it's a separate
 * cadence. Brief content is intentionally lighter than a proactive push
 * (one-line per setup, not a full signal stack).
 */

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '../_auth';
import { initDB, isDBConfigured, getIdeaPushSubscribers } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';
import { fetchTopUniverseSignals } from '@/lib/bot/signal-fetcher';
import {
  scoreIdea, isSurfaceable, defaultHorizonForSetup,
  type ScoredIdea,
} from '@/lib/bot/idea-scorer';
import { renderMorningBrief } from '@/lib/bot/idea-renderer';

const UNIVERSE_SIZE = 50;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;
  if (!isDBConfigured()) return NextResponse.json({ ok: true, skipped: 'db not configured' });

  const started = Date.now();
  await initDB();

  const universe = await fetchTopUniverseSignals(UNIVERSE_SIZE).catch(() => []);
  if (universe.length === 0) {
    return NextResponse.json({ ok: false, error: 'no universe data' }, { status: 500 });
  }

  // ── Score both sides, keep best per symbol, take top-3 by score ──
  const scored: ScoredIdea[] = [];
  for (const coin of universe) {
    const longIdea = scoreIdea(coin.symbol, 'directional', 'long', coin.inputs, {
      currentPrice: coin.currentPrice,
      horizonH: defaultHorizonForSetup('directional'),
    });
    const shortIdea = scoreIdea(coin.symbol, 'directional', 'short', coin.inputs, {
      currentPrice: coin.currentPrice,
      horizonH: defaultHorizonForSetup('directional'),
    });
    const best = longIdea.score >= shortIdea.score ? longIdea : shortIdea;
    if (isSurfaceable(best.score)) scored.push(best);
  }
  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);

  // ── Regime: derive from aggregate funding (positive = risk-on) ───
  const regime = deriveRegime(universe);

  const body = renderMorningBrief({
    date: new Date(),
    ideas: top3,
    regime,
  });

  // ── Push ─────────────────────────────────────────────────────────
  const subscribers = await getIdeaPushSubscribers();
  let pushed = 0;
  for (const chatId of subscribers) {
    try {
      const ok = await sendMessage(chatId, body, 'HTML');
      if (ok) pushed++;
    } catch (e) {
      console.warn(`[cron/morning-brief] push to ${chatId} failed:`, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    ok: true,
    universeSize: universe.length,
    surfaceable: scored.length,
    topIdeaCount: top3.length,
    regime,
    subscribers: subscribers.length,
    pushed,
    durationMs: Date.now() - started,
  });
}

interface UniverseCoin {
  symbol: string;
  inputs: { fundingPct: number; oiDelta4hPct: number };
}

function deriveRegime(coins: UniverseCoin[]): string {
  if (coins.length === 0) return 'data unavailable';
  // Median funding across universe — positive = longs paying = risk-on
  const fundings = coins.map((c) => c.inputs.fundingPct).sort((a, b) => a - b);
  const median = fundings[Math.floor(fundings.length / 2)];
  // Median OI 4h change — positive = leverage growing
  const oiDeltas = coins.map((c) => c.inputs.oiDelta4hPct).sort((a, b) => a - b);
  const oiMedian = oiDeltas[Math.floor(oiDeltas.length / 2)];

  const tone = median > 0.005
    ? 'risk-on'
    : median < -0.005
      ? 'risk-off'
      : 'balanced';
  const oiPart = Math.abs(oiMedian) >= 3
    ? `, leverage ${oiMedian >= 0 ? 'building' : 'unwinding'} (OI ${oiMedian >= 0 ? '+' : ''}${oiMedian.toFixed(1)}%/4h)`
    : '';
  const fundingPart = `funding median ${median >= 0 ? '+' : ''}${median.toFixed(4)}%`;
  return `${tone} · ${fundingPart}${oiPart}`;
}
