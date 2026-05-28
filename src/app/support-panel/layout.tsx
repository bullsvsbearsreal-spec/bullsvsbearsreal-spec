/**
 * Server-side auth gate for /support-panel.
 *
 * Roles allowed: owner, admin, moderator, support.
 *   · Not signed in       → /login?callbackUrl=/support-panel
 *   · Marketer / advisor  → /marketing-panel or /admin-panel respectively
 *   · Anyone else         → /  (home)
 *
 * Same pattern as /mod-panel/layout.tsx: DB lookup INSIDE try, redirect
 * OUTSIDE so the NEXT_REDIRECT throw isn't swallowed.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSQL, isDBConfigured } from '@/lib/db';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// Internal support-rep surface — noindex (same logic as admin-panel).
export const metadata: Metadata = {
  title: 'Support Panel',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function SupportPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/support-panel');
  }

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
  if (role !== 'owner' && role !== 'admin' && role !== 'moderator' && role !== 'support') {
    redirect('/');
  }

  return <>{children}</>;
}
