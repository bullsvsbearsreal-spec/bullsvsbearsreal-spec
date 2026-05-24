/**
 * Render a scored trade idea into Telegram HTML in the sharp-trader voice
 * locked in via the design doc.
 *
 * Voice example (from the design Q&A):
 *
 *   BTC — long bias, ★★★
 *
 *   Funding paid for shorts (-0.04%, top 2%). Whales loaded $42M long.
 *   OI building 8% with no price move = coiled.
 *
 *   Stay above 112.3k or it dies. Magnet at 115.2k from the liq cluster.
 *
 *   nfa · your risk
 *
 * Punchy, numbers-forward, no fluff. The signal stack drives the prose
 * via deterministic templates so we don't burn LLM tokens to render every
 * single push (LLM is only used for the casual chat path).
 */

import type { ScoredIdea, SignalContribution } from './idea-scorer';

const STAR_CHAR = '★';

/** Render the star count for display. ★★★★ / ★★★ / ★★ / (hidden). */
export function renderStars(stars: 0 | 2 | 3 | 4): string {
  return stars === 0 ? '' : STAR_CHAR.repeat(stars);
}

/**
 * Render the full Telegram-ready HTML for one idea push. Used by both the
 * /ideas command and the proactive push cron. Includes the standard
 * disclaimer footer.
 */
export function renderIdea(idea: ScoredIdea, opts: {
  /** When true (proactive push), include a header like "🎯 Setup forming" */
  asPush?: boolean;
  /** Optional callout when the user already holds this position */
  positionWarning?: string;
} = {}): string {
  const stars = renderStars(idea.stars);
  const bias = idea.side === 'long' ? 'long bias' : 'short bias';
  const lines: string[] = [];

  if (opts.asPush) {
    lines.push('🎯 <b>Setup forming</b>');
    lines.push('');
  }

  lines.push(`<b>${idea.symbol} — ${bias}, ${stars}</b>`);
  if (opts.positionWarning) {
    lines.push(`⚠ ${opts.positionWarning}`);
  }
  lines.push('');

  // Signal-driven prose. Each fired signal contributes a one-line evidence
  // statement. Top 4 by points to keep it punchy.
  const top = [...idea.signals].sort((a, b) => b.points - a.points).slice(0, 4);
  for (const s of top) {
    lines.push(renderSignalLine(s));
  }
  lines.push('');

  // Invalidation + the kicker. If no invalidation level is known we just
  // skip the kicker — never make one up.
  if (idea.invalidation != null) {
    const direction = idea.side === 'long' ? 'above' : 'below';
    const failDirection = idea.side === 'long' ? 'loses' : 'reclaims';
    lines.push(`Stay ${direction} ${formatPrice(idea.invalidation)} or it ${failDirection === 'loses' ? 'dies' : 'dies'}.`);
  }

  lines.push('');
  lines.push('<i>nfa · your risk</i>');
  return lines.join('\n');
}

/**
 * Render a single signal as a one-liner. Sharp-trader phrasing — punchy,
 * not academic.
 */
function renderSignalLine(s: SignalContribution): string {
  // The detail strings produced by the scorer are already quant-style.
  // Just punch them up with the right framing for the signal type.
  switch (s.slug) {
    case 'funding':
      return `${s.detail}.`;
    case 'whales':
      return `${s.detail}.`;
    case 'oi_cluster':
      return `${s.detail} = coiled.`;
    case 'basis':
      return `${s.detail} — one venue out of line, free spread.`;
    case 'long_short':
      return `${s.detail} — crowded the wrong way.`;
    default:
      return `${s.detail}.`;
  }
}

/**
 * Render the basket-style push for correlated-day clustering. Headline coin
 * gets the full treatment, alts get a one-line "same setup" callout.
 */
export function renderBasket(headline: ScoredIdea, alts: ScoredIdea[]): string {
  const headlineRender = renderIdea(headline, { asPush: true });
  if (alts.length === 0) return headlineRender;

  // Insert the alt-list after the title line
  const altLine = alts
    .map((a) => `${a.symbol} ${renderStars(a.stars)}`)
    .join(', ');
  const lines = headlineRender.split('\n');
  // Find the title line (starts with <b>SYMBOL) and insert after
  const titleIdx = lines.findIndex((l) => l.startsWith('<b>'));
  if (titleIdx === -1) return headlineRender;
  lines.splice(titleIdx + 1, 0, `<i>Same setup forming on: ${altLine}</i>`);
  return lines.join('\n');
}

/**
 * Render the daily morning brief.
 *
 *   ☕ Morning Brief · 24 May
 *
 *   Top setups:
 *   1. BTC long ★★★★ — funding -0.04%, whales loaded $42M, OI coiling
 *   2. ETH short ★★★ — basis blow-out vs cohort, OI ↓
 *   3. SOL squeeze ★★★ — whales short, OI rising
 *
 *   Regime: <one-liner>
 *
 *   nfa · your risk
 */
export function renderMorningBrief(args: {
  date: Date;
  ideas: ScoredIdea[];
  regime: string;
}): string {
  const lines: string[] = [];
  lines.push(`☕ <b>Morning Brief · ${formatDate(args.date)}</b>`);
  lines.push('');

  if (args.ideas.length > 0) {
    lines.push('Top setups:');
    args.ideas.slice(0, 3).forEach((idea, i) => {
      const stars = renderStars(idea.stars);
      const bias = idea.side === 'long' ? 'long' : 'short';
      const topSig = [...idea.signals].sort((a, b) => b.points - a.points)[0]?.detail
        ?? 'multi-signal alignment';
      lines.push(`${i + 1}. ${idea.symbol} ${bias} ${stars} — ${topSig.toLowerCase()}`);
    });
  } else {
    lines.push("No high-conviction setups this morning — let things develop.");
  }

  lines.push('');
  lines.push(`Regime: ${args.regime}`);
  lines.push('');
  lines.push('<i>nfa · your risk</i>');
  return lines.join('\n');
}

/** Render an invalidation close-out message for the lifecycle watcher. */
export function renderInvalidationClose(symbol: string, side: 'long' | 'short', level: number): string {
  const sideText = side === 'long' ? 'long' : 'short';
  return `❌ <b>${symbol} ${sideText} invalidated</b> at ${formatPrice(level)}. Closing.`;
}

// ─── Format helpers ────────────────────────────────────────────────

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  return p.toPrecision(4);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
