/**
 * /account — legacy URL for the command center.
 *
 * The command center moved to /dashboard in May 2026. This file
 * exists only to redirect old links / bookmarks / shared URLs
 * (including the `/login?callbackUrl=/account` flow that older
 * sessions might still hit).
 *
 * Server-side redirect — no client roundtrip.
 */
import { redirect } from 'next/navigation';

export default function AccountPage() {
  redirect('/dashboard');
}
