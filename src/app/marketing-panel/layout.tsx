/**
 * Server-side auth gate for /marketing-panel.
 *
 * Same shape as /mod-panel/layout.tsx — runs before the client
 * component renders so a 'user' role gets bounced without seeing
 * the shell.
 *
 * Roles allowed: owner, admin, marketer.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSQL, isDBConfigured } from '@/lib/db';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// Internal marketer surface — noindex (same logic as admin-panel).
export const metadata: Metadata = {
  title: 'Marketing Panel',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function MarketingPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/marketing-panel');
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
  if (role !== 'owner' && role !== 'admin' && role !== 'marketer') {
    redirect('/');
  }

  return <>{children}</>;
}
