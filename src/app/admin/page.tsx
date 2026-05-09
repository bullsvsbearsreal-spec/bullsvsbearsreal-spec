/**
 * /admin → redirect to /admin-panel.
 *
 * This used to be a 672-LOC single-page admin dashboard. It got
 * superseded by the newer tabbed /admin-panel (Overview / Pipeline /
 * Alerts / Database / Users / Actions) which has feature parity plus
 * grouped actions, recent activity feed, and incremental tab loading.
 *
 * Keeping this route as a redirect so existing bookmarks + the sidebar
 * link card still work, but funnelling everyone into the canonical
 * /admin-panel.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AdminLegacyRedirectPage() {
  redirect('/admin-panel');
}
