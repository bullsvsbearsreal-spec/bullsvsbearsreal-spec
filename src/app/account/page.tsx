/**
 * /account — legacy URL for the command center.
 *
 * The command center moved to /dashboard in May 2026. This file
 * exists only to redirect old links / bookmarks / shared URLs
 * (including the `/login?callbackUrl=/account` flow that older
 * sessions might still hit).
 *
 * `force-dynamic` is critical here — without it Next.js will
 * pre-render this page statically at build time and cache the
 * result, defeating the redirect on subsequent requests. With it,
 * every request runs the `redirect()` server action and returns
 * an HTTP 307 + Location: /dashboard.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AccountPage() {
  redirect('/dashboard');
}
