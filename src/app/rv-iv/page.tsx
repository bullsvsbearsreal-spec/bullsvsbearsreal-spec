/**
 * /rv-iv — legacy URL.
 *
 * Was the realized vs implied vol comparison. Consolidated into
 * /options in May 2026. The unique RV-IV ratio and historical
 * comparison was specific to this page; can be re-added as a
 * section of /options if needed.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RvIvLegacyRedirect() {
  redirect('/options');
}
