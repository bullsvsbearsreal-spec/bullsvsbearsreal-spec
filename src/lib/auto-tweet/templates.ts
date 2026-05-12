/**
 * Tweet text composers — one per event kind. Each takes an
 * AutoTweetEvent and produces the final tweet text (≤280 chars).
 *
 * Voice notes:
 *   - Match the on-site voice: terse, trader-jargon, numbers-first.
 *     Lines like "BTC funding just flipped..." not "InfoHub is excited
 *     to announce...".
 *   - Always include a link back to the relevant InfoHub page so the
 *     tweet pulls traffic. URL is appended; truncate text if needed.
 *   - Hashtags only on the symbol ticker — no spammy #crypto #BTC
 *     #trading stacks. CT scrolls past those.
 *   - Always end with the relevant InfoHub page URL.
 */

import type { AutoTweetEvent } from './types';

const BASE = 'https://info-hub.io';
const MAX_LEN = 280;

/** Helper — append URL with newline; truncate text if needed. */
function withUrl(text: string, url: string): string {
  const suffix = `\n\n${url}`;
  if (text.length + suffix.length <= MAX_LEN) return text + suffix;
  const room = MAX_LEN - suffix.length - 1; // -1 for ellipsis
  return text.slice(0, room) + '…' + suffix;
}

/** Format a 8h funding rate as e.g. "+0.142%/8h". */
function fmtRate8h(rate: number): string {
  const pct = rate * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(3)}%/8h`;
}

/** Format USD with K/M/B suffix. */
function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/* ─── Funding extreme ─────────────────────────────────────────────── */

export function composeFundingExtreme(ev: AutoTweetEvent): string {
  const rate8h = ev.value;
  const side = rate8h > 0 ? 'Longs paying' : 'Shorts paying';
  const annualised = Math.round(Math.abs(rate8h) * 3 * 365 * 100); // %APR (approx)

  // Two-line format: headline + context. Keeps it scannable.
  const headline = `${ev.symbol} funding hot on ${ev.venue} · ${fmtRate8h(rate8h)}`;
  const context = `${side} ~${annualised}% APR right now. Cross-venue table:`;

  return withUrl(`${headline}\n\n${context}`, `${BASE}/funding/${ev.symbol}`);
}

/* ─── OI spike ────────────────────────────────────────────────────── */

export function composeOISpike(ev: AutoTweetEvent): string {
  const pct = ev.value;
  const direction = pct > 0 ? 'building' : 'unwinding';
  const arrow = pct > 0 ? '▲' : '▼';
  const md = ev.metadata as { currentOiUsd?: number; previousOiUsd?: number };
  const current = typeof md.currentOiUsd === 'number' ? fmtUsd(md.currentOiUsd) : '—';

  const headline = `${ev.symbol} open interest ${direction} · ${arrow} ${Math.abs(pct).toFixed(1)}% in 1h`;
  const context = `OI now ${current}. Watch for follow-through:`;

  return withUrl(`${headline}\n\n${context}`, `${BASE}/open-interest`);
}

/* ─── Liquidation cascade ─────────────────────────────────────────── */

export function composeLiqCascade(ev: AutoTweetEvent): string {
  const total = ev.value;
  const md = ev.metadata as { longSharePct?: number; dominantSide?: string };
  const longShare = typeof md.longSharePct === 'number' ? md.longSharePct : 50;
  const side = md.dominantSide === 'long' ? 'Long-side carnage'
             : md.dominantSide === 'short' ? 'Shorts wrecked'
             : 'Two-sided';

  const headline = `${fmtUsd(total)} ${ev.symbol} liquidated in last 5 min`;
  const context = `${side} · ${longShare.toFixed(0)}% long. Live feed:`;

  return withUrl(`${headline}\n\n${context}`, `${BASE}/liquidations?symbol=${ev.symbol}`);
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
