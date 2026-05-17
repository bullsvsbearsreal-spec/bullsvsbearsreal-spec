/**
 * Pure-function ranking helpers for the referral leaderboard.
 *
 * Extracted from the SQL ORDER-BY in /api/invite/leaderboard so the
 * ranking behavior (verified DESC, signups DESC as tiebreaker) is
 * unit-testable and reusable from any client surface that wants to
 * compute someone's rank given a snapshot of the leaderboard.
 */

export interface ReferrerStats {
  /** Inviter identifier — we only ever pass the code-prefix in client surfaces. */
  codePrefix: string;
  signups: number;
  verified: number;
}

export interface RankedReferrer extends ReferrerStats {
  rank: number;
}

/**
 * Sort referrers by ranking rule + assign 1-based ranks.
 *
 * Ranking: verified DESC, then signups DESC. Ties on both keys share
 * a rank (standard "1224" sort-style competition ranking).
 *
 * Stable for already-sorted inputs (no jitter on ties).
 */
export function rankReferrers(stats: ReferrerStats[]): RankedReferrer[] {
  // Sort by ranking rule. We don't mutate the input — make a copy.
  const sorted = [...stats].sort((a, b) => {
    if (b.verified !== a.verified) return b.verified - a.verified;
    return b.signups - a.signups;
  });

  // Assign ranks with tie handling. Walk the list, increment rank only
  // when the (verified, signups) tuple changes from the previous entry.
  const ranked: RankedReferrer[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (i === 0) {
      ranked.push({ ...cur, rank: 1 });
      continue;
    }
    const prev = sorted[i - 1];
    const tied = prev.verified === cur.verified && prev.signups === cur.signups;
    ranked.push({
      ...cur,
      // Tied entries get the same rank as the previous one. Next non-tied
      // entry skips the appropriate number of ranks ("1224" style).
      rank: tied ? ranked[i - 1].rank : i + 1,
    });
  }
  return ranked;
}

/**
 * Find a specific user's rank in a leaderboard snapshot. Returns null
 * if the user isn't in the snapshot (e.g. zero referrals → never made
 * the GROUP BY).
 */
export function findRank(ranked: RankedReferrer[], codePrefix: string): number | null {
  const e = ranked.find((r) => r.codePrefix === codePrefix);
  return e ? e.rank : null;
}
