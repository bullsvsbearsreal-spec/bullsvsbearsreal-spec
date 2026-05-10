/**
 * /funding-flips — legacy URL.
 *
 * Was a "Funding Flip Radar" scanning for coins where the most recent
 * funding payment flipped sign vs the previous one. Consolidated into
 * /funding (the main funding rates view) in May 2026 — sign flips are
 * an alert-style overlay on the same underlying data.
 *
 * Original implementation backed up at page.tsx.bak in case the flip
 * radar warrants its own tab on /funding.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FundingFlipsLegacyRedirect() {
  redirect('/funding');
}
