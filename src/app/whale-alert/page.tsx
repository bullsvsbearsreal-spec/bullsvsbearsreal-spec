/**
 * /whale-alert — legacy URL.
 *
 * Was a "Large liquidations across exchanges" page that overlapped 1:1
 * with /liquidations (same data, different framing). Consolidated to
 * the canonical liquidations feed in May 2026.
 *
 * `force-dynamic` prevents Next.js from pre-rendering the redirect
 * statically — without it the redirect can be cached as the page
 * itself and stop firing.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function WhaleAlertLegacyRedirect() {
  redirect('/liquidations');
}
