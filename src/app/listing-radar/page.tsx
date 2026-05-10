/**
 * /listing-radar — legacy URL.
 *
 * Was a duplicate of /listings (CEX listing announcements feed). Same
 * data, same upstream source, slightly different framing. Consolidated
 * to /listings as the canonical URL in May 2026.
 *
 * Original implementation backed up at page.tsx.bak in case any of
 * the trader-style copy ("pump 30-200% in the first…") is worth
 * re-incorporating into /listings.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ListingRadarLegacyRedirect() {
  redirect('/listings');
}
