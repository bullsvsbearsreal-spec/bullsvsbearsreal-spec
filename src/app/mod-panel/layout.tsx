/**
 * Server-side auth gate for /mod-panel.
 *
 * Runs before the client component renders, so a 'user' role gets
 * redirected before ever seeing the page shell. Closes the "flash
 * of authenticated UI" gap that pure client gates have.
 *
 * Roles allowed: owner, admin, moderator. Anyone else gets bounced:
 *   · Not signed in → /login?callbackUrl=/mod-panel
 *   · Signed in but wrong role → /  (home)
 */
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSQL, isDBConfigured } from '@/lib/db';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// Internal moderator surface — noindex (same logic as admin-panel).
export const metadata: Metadata = {
  title: 'Mod Panel',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function ModPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/mod-panel');
  }

  // Look up the role INSIDE the try, redirect OUTSIDE — Next's
  // redirect throws NEXT_REDIRECT which must not be caught.
  let role: string | undefined;
  if (isDBConfigured()) {
    try {
      const db = getSQL();
      const rows = await db`SELECT role FROM users WHERE id = ${session.user.id}`;
      role = rows[0]?.role;
    } catch {
      redirect('/');
    }
  }
  if (role !== 'owner' && role !== 'admin' && role !== 'moderator') {
    redirect('/');
  }

  return <>{children}</>;
}
