/**
 * /restaking-delta — legacy URL.
 *
 * Was a delta/changes view of restaking yields. Folded into /restaking
 * (the main yield aggregator) in May 2026 — delta is a sub-aspect of
 * the same data, not a separate page.
 *
 * Original implementation backed up at page.tsx.bak in case the delta
 * view is worth re-adding as a tab on /restaking.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RestakingDeltaLegacyRedirect() {
  redirect('/restaking');
}
