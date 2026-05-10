/**
 * /skew — legacy URL.
 *
 * Was the cross-expiry options skew chart. Consolidated into /options
 * (the main options hub) in May 2026. The /options page already shows
 * IV smile across strikes; the cross-expiry skew curve from this page
 * could be re-added as a section if there's demand.
 *
 * Original implementation backed up at page.tsx.bak.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SkewLegacyRedirect() {
  redirect('/options');
}
