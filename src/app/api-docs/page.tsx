/**
 * /api-docs — legacy URL for the API landing page.
 *
 * The API landing experience moved to /developers in early 2026. This
 * file is now a redirect stub so any old bookmarks, shared URLs, or
 * cached search results don't 404.
 *
 * Keeping a redirect rather than a duplicate page means there's only
 * one source of truth for API marketing copy + endpoint counts —
 * /developers — and the two pages can't drift out of sync (which is
 * what was happening when this file was a 683-line clone of the
 * landing).
 *
 * `force-dynamic` is critical here — without it Next.js will
 * pre-render this statically at build time, defeating the redirect
 * for subsequent requests after a CF flush.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ApiDocsLegacyPage() {
  redirect('/developers');
}
