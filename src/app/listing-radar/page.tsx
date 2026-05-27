/**
 * /listing-radar — legacy URL.
 *
 * Was a duplicate of /listings (CEX listing announcements feed). Same
 * data, same upstream source, slightly different framing. Consolidated
 * to /listings as the canonical URL in May 2026.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ListingRadarLegacyRedirect() {
  redirect('/listings');
}
