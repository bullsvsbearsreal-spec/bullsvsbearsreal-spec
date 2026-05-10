/**
 * /max-pain — legacy URL.
 *
 * Was the per-expiry max-pain dashboard. Consolidated into /options
 * in May 2026 — the main options page already prominently displays
 * the max-pain strike for the live expiry. Per-expiry max-pain
 * comparison from this page can be re-added as a section of /options.
 *
 * Original implementation backed up at page.tsx.bak.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MaxPainLegacyRedirect() {
  redirect('/options');
}
