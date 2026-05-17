/**
 * Pure search-palette helpers — kept out of TerminalHeader.tsx so they
 * can be unit-tested without dragging in React's JSX runtime.
 *
 * The palette's user-input pipeline is: case-fold → check against the
 * curated `POPULAR_*` symbol lists + nav-page index → if nothing
 * matched AND the query looks ticker-shaped, surface a "Open in /chart"
 * fallback that TradingView's chart resolves at load time.
 *
 * Real-world repro that prompted this fallback (May 2026): christian
 * + snake typed CSX, AAPL, MSTR into ⌘K and got "No matches" even
 * though /chart resolves them. POPULAR_SYMBOLS was crypto-only.
 */

/** Heuristic to detect "user typed a ticker we don't pre-index" so the
 *  palette can offer a graceful "open in chart" fallback rather than
 *  returning zero results. Conservative: 2–6 chars, mostly letters,
 *  optionally with a trailing digit run + '!' for futures (CL1! etc).
 */
export function looksLikeTicker(s: string): boolean {
  if (!s) return false;
  const trimmed = s.trim().toUpperCase();
  return /^[A-Z]{2,6}([0-9]{1,3}!?)?$/.test(trimmed);
}
