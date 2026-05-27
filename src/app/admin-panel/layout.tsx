/**
 * Server-side auth gate for /admin-panel.
 *
 * Roles allowed: owner, admin, advisor.
 *   · Not signed in → /login
 *   · Moderator     → /mod-panel
 *   · Marketer      → /marketing-panel
 *   · Anyone else   → /  (home)
 *
 * Sub-pages (/admin-panel/affiliates, /admin-panel/broadcast) inherit
 * this gate. Affiliates is owner/admin/advisor (read-only revenue
 * view). Broadcast is admin/owner only; if an advisor sneaks past
 * this layout, the POST endpoint still rejects them.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSQL, isDBConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/admin-panel');
  }

  // Look up the role INSIDE the try (DB may hiccup), then call
  // redirect() OUTSIDE — Next's redirect throws a NEXT_REDIRECT
  // error that we must NOT swallow with the DB catch handler.
  let role: string | undefined;
  if (isDBConfigured()) {
    try {
      const db = getSQL();
      const rows = await db`SELECT role FROM users WHERE id = ${session.user.id}`;
      role = rows[0]?.role;
    } catch {
      // DB hiccup — fail closed (redirect to home) rather than fail open.
      redirect('/');
    }
  }
  if (role === 'moderator') redirect('/mod-panel');
  if (role === 'marketer')  redirect('/marketing-panel');
  if (role === 'support')   redirect('/support-panel');
  if (role !== 'owner' && role !== 'admin' && role !== 'advisor') {
    redirect('/');
  }

  return <>{children}</>;
}
