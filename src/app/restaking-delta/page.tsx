/**
 * /restaking-delta — legacy URL.
 *
 * Was a delta/changes view of restaking yields. /restaking itself was
 * later consolidated into /staking (which covers both LST + LRT).
 * Skipping the redirect chain and pointing straight at /staking.
 *
 * Original implementation backed up at page.tsx.bak.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RestakingDeltaLegacyRedirect() {
  redirect('/staking');
}
