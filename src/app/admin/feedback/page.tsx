/**
 * /admin/feedback → redirect to /admin-panel#feedback.
 *
 * The bug-report inbox lives inside the new tabbed admin panel as the
 * Feedback tab. This redirect keeps the historic URL working for
 * anyone who bookmarked it or whose links land on the old path.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AdminFeedbackLegacyRedirectPage() {
  redirect('/admin-panel#feedback');
}
