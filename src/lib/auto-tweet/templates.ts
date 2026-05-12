/**
 * Tweet text composers — one per event kind, each with 3-4 variants
 * picked deterministically per event so the feed doesn't read like a
 * robot loop.
 *
 * Voice (matches @info_hub69's real posting style — verified by
 * skimming the live account):
 *   - all lowercase except cashtags ($BTC)
 *   - hook first ("something is happening", "the one nobody talks about")
 *   - specific numbers in the middle
 *   - plain-language explanation, not finance jargon
 *   - cliffhanger or "either X or Y" framing at the end
 *   - no hashtags, no emojis, no "InfoHub is excited to announce"
 *   - link last
 *
 * Variant selection is deterministic: hash the eventId, modulo
 * variant count. So tests can pin one specific output by varying
 * eventId, and production gets natural rotation across the feed.
 */

import type { AutoTweetEvent } from './types';

const BASE = 'https://info-hub.io';
const MAX_LEN = 280;

/* ─── Helpers ─────────────────────────────────────────────────────── */

function withUrl(text: string, url: string): string {
  const suffix = `\n\n${url}`;
  if (text.length + suffix.length <= MAX_LEN) return text + suffix;
  const room = MAX_LEN - suffix.length - 1; // -1 for ellipsis
  return text.slice(0, room) + '…' + suffix;
}

/** Format a fractional 8h rate as e.g. "+0.150%". */
function fmtRate(rate: number): string {
  return `${rate >= 0 ? '+' : ''}${(rate * 100).toFixed(3)}%`;
}

/** Format USD with K/M/B suffix. */
function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/** Approximate APR from an 8h rate (8h × 3 × 365). */
function fmtApr(rate8h: number): string {
  return `${Math.round(Math.abs(rate8h) * 3 * 365 * 100)}% APR`;
}

/** Cheap deterministic string hash for variant selection. */
function variantIndex(eventId: string, variantCount: number): number {
  let h = 0;
  for (let i = 0; i < eventId.length; i++) {
    h = ((h << 5) - h + eventId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % variantCount;
}

/* ─── Funding extreme ─────────────────────────────────────────────── */

export function composeFundingExtreme(ev: AutoTweetEvent): string {
  const rate8h = ev.value;
  const sym = ev.symbol;
  const venue = (ev.venue ?? 'a major venue').toLowerCase();
  const rate = fmtRate(rate8h);
  const apr = fmtApr(rate8h);
  const positive = rate8h > 0;

  const variants = positive
    ? [
        // (1) hook + "either X or Y" cliffhanger
        `funding got hot on $${sym}.\n\n${rate}/8h on ${venue}. that's ~${apr} for longs just to hold.\n\neither bears are about to get squeezed, or this fades by the next funding window.`,
        // (2) data-first, plain explanation
        `$${sym} perps on ${venue}: ${rate}/8h.\n\nlongs are paying shorts ~${apr} to stay long. that's the kind of carry that usually marks short-term tops.`,
        // (3) "the one nobody talks about" hook
        `the one nobody's talking about: $${sym} funding just crossed ${rate}/8h on ${venue}.\n\nanything above 0.10%/8h has historically marked local tops within 24h. watch the tape.`,
      ]
    : [
        // (1) shorts paying — bullish framing
        `someone is mass shorting $${sym}.\n\nfunding flipped to ${rate}/8h on ${venue}. shorts are paying longs ~${apr} every 8 hours just to hold.\n\neither they know something, or they're about to get rinsed.`,
        // (2) plain factual
        `$${sym} funding deeply negative: ${rate}/8h on ${venue}.\n\nshorts are paying ~${apr} to stay short. the last 3 times this hit on a major, $${sym} bounced inside 12h.`,
        // (3) cliffhanger
        `negative funding alert: $${sym} on ${venue} is at ${rate}/8h.\n\nshorts crowded, paying ~${apr} for the privilege. squeeze setup or genuine bearish conviction?`,
      ];

  const text = variants[variantIndex(ev.eventId, variants.length)];
  return withUrl(text, `${BASE}/funding/${sym}`);
}

/* ─── OI spike ────────────────────────────────────────────────────── */

export function composeOISpike(ev: AutoTweetEvent): string {
  const pct = ev.value;
  const sym = ev.symbol;
  const md = ev.metadata as { currentOiUsd?: number };
  const current = typeof md.currentOiUsd === 'number' ? fmtUsd(md.currentOiUsd) : '—';
  const positive = pct > 0;
  const absPct = Math.abs(pct).toFixed(1);

  const variants = positive
    ? [
        `something is happening on $${sym}.\n\nOI up ${absPct}% in the last hour to ${current}. that's fresh positioning, not unwinds.\n\nthese moves usually resolve into a 5%+ price move inside 24h.`,
        `$${sym} OI just jumped ${absPct}% in 1h to ${current}.\n\nOI doesn't predict direction. it predicts violence.`,
        `fresh leverage stacking on $${sym}: ${absPct}% OI build in the last hour, now ${current}.\n\neither someone's front-running news or the funding rate is about to get spicy.`,
      ]
    : [
        `$${sym} positions unwinding fast.\n\nOI down ${absPct}% in 1h to ${current}. either smart money pulling out or the book is cleaning up before the next leg.\n\nlower OI = less violent moves, both ways.`,
        `OI alert: $${sym} dropped ${absPct}% in the last hour to ${current}.\n\nthat's a big unwind. usually means a major holder closed or stops cascaded.`,
        `the $${sym} unwind continues: ${absPct}% OI gone in 1h. book down to ${current}.\n\nlight book = easy to push price. watch the next 4h.`,
      ];

  const text = variants[variantIndex(ev.eventId, variants.length)];
  return withUrl(text, `${BASE}/open-interest`);
}

/* ─── Liquidation cascade ─────────────────────────────────────────── */

export function composeLiqCascade(ev: AutoTweetEvent): string {
  const total = ev.value;
  const sym = ev.symbol;
  const totalStr = fmtUsd(total);
  const md = ev.metadata as { longSharePct?: number; dominantSide?: string };
  const longShare = typeof md.longSharePct === 'number' ? md.longSharePct : 50;
  const isLong = md.dominantSide === 'long';
  const isShort = md.dominantSide === 'short';

  const variants = isLong
    ? [
        `${totalStr} liquidated on $${sym} in the last 5 minutes.\n\n${longShare.toFixed(0)}% long. classic cascade — long stops triggered other long stops.\n\nthese usually keep going until the cluster runs out.`,
        `the $${sym} long flush continues.\n\n${totalStr} wiped in 5 min. ${longShare.toFixed(0)}% long-side. when one side dominates this hard, follow-through is the base case.`,
        `long-side carnage: ${totalStr} in $${sym} liquidations in 5 min. ${longShare.toFixed(0)}% long.\n\nthe biggest cluster sits a few % below current price. one more push and another wave fires.`,
      ]
    : isShort
    ? [
        `shorts just got wrecked on $${sym}.\n\n${totalStr} in liquidations, ${(100 - longShare).toFixed(0)}% short. squeeze in progress.\n\nshort squeezes usually overshoot before they fade.`,
        `${totalStr} $${sym} liquidations in 5 min, ${(100 - longShare).toFixed(0)}% short.\n\nshorts piled in, shorts paid. follow-through fades inside an hour but the wick can be brutal.`,
        `the $${sym} squeeze is on. ${totalStr} wiped in 5 min, ${(100 - longShare).toFixed(0)}% short-side.\n\nshorts who held through 2 rallies just got margin-called on the third.`,
      ]
    : [
        // mixed: both sides
        `${totalStr} liquidated on $${sym} in 5 min — and it's two-sided. ${longShare.toFixed(0)}% long / ${(100 - longShare).toFixed(0)}% short.\n\nboth sides bleeding usually means a high-vol regime is starting.`,
        `chop city: ${totalStr} in $${sym} liquidations across both sides in 5 min.\n\nneither side wins when funding swings this fast. lower your size.`,
      ];

  const text = variants[variantIndex(ev.eventId, variants.length)];
  return withUrl(text, `${BASE}/liquidations?symbol=${sym}`);
}

/* ─── Dispatch ────────────────────────────────────────────────────── */

export function composeTweet(ev: AutoTweetEvent): string {
  switch (ev.kind) {
    case 'funding-extreme': return composeFundingExtreme(ev);
    case 'oi-spike':        return composeOISpike(ev);
    case 'liq-cascade':     return composeLiqCascade(ev);
    case 'whale-fill':      throw new Error('whale-fill not yet implemented');
  }
}
