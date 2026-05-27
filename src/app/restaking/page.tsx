/**
 * /restaking — legacy URL.
 *
 * Was the "Restaking Yield Aggregator" — but /staking ("Staking +
 * Restaking Yields") already covers both LST (liquid staking like
 * Lido, Rocket Pool) AND LRT (liquid restaking like Ether.fi, Renzo,
 * Kelp), with the same DeFi Llama upstream. /restaking was a subset.
 * Consolidated to /staking in May 2026.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RestakingLegacyRedirect() {
  redirect('/staking');
}
