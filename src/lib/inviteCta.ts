/**
 * Helpers for the dashboard's invite-success banner CTA.
 *
 * The banner pivots its CTA based on how many people the user has
 * referred — at low counts it sends them back to /invite to grab
 * the link, at higher counts it sends them to /invite/leaderboard
 * where they can see their rank.
 *
 * Threshold = 3 verified. Picked because:
 *   - users with 0-2 verified can still climb fast (showing the
 *     leaderboard might feel demotivating; '5 spots from #1' is
 *     more useful at the top tier)
 *   - users with 3+ verified are within striking distance of the
 *     top-20 cut (current ranking is sparse; this will change as
 *     the system grows)
 *
 * Extracted so the threshold + copy live in one place and the test
 * suite can lock in the pivot behaviour.
 */

const LEADERBOARD_VERIFIED_THRESHOLD = 3;

export interface InviteCtaState {
  /** Path to link to. */
  href: string;
  /** Button text. */
  label: string;
  /** Subline shown to the user above the CTA. */
  subline: string;
}

/**
 * Decide which CTA to surface based on the user's verified count.
 * Returns null if the banner shouldn't render at all (zero signups).
 */
export function getInviteCta(stats: { signups: number; verified: number }): InviteCtaState | null {
  if (stats.signups <= 0) return null;
  if (stats.verified >= LEADERBOARD_VERIFIED_THRESHOLD) {
    return {
      href: '/invite/leaderboard',
      label: 'See leaderboard',
      subline: "You're in serious leaderboard territory — see where you rank.",
    };
  }
  return {
    href: '/invite',
    label: 'See details',
    subline: 'Keep sharing to climb the referral leaderboard.',
  };
}
