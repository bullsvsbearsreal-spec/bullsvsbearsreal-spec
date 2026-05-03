import { redirect } from 'next/navigation';

/**
 * /rekt has moved to /bounce/leaderboard as part of the bounce.tech
 * section consolidation. Permanent redirect preserves existing SEO + links.
 */
export default function RektRedirect() {
  redirect('/bounce/leaderboard');
}
