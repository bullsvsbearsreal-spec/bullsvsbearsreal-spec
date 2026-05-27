/**
 * /options-iv — legacy URL.
 *
 * Was the IV (implied volatility) dashboard. Consolidated into
 * /options in May 2026 — the main options page already renders the
 * IV smile across strikes for the live expiry. Deeper IV-only views
 * (term structure, surface contour) from this page can be re-added
 * as sections of /options if needed.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OptionsIvLegacyRedirect() {
  redirect('/options');
}
