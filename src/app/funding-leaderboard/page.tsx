/**
 * /funding-leaderboard — legacy URL.
 *
 * Was a 30-day implied funding $ flow ranked by EXCHANGE (for BTC + ETH).
 * /funding-paid showed the same metric ranked by COIN. Both compute
 * cumulative-rate × open-interest but slice by different dimensions.
 * Consolidated to /funding-paid in May 2026 — the per-coin view is
 * more useful for most users.
 *
 * Original implementation backed up at page.tsx.bak in case we want
 * to re-add the per-exchange slice as a tab on /funding-paid.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FundingLeaderboardLegacyRedirect() {
  redirect('/funding-paid');
}
