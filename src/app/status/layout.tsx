import { pageMetadata } from '@/lib/seo';

// /status is a client component (polls /api/status every 30s), so the
// metadata export has to live in a layout wrapper. Without this layout
// the page inherited the generic site default "InfoHub | Real-Time
// Crypto Derivatives Dashboard" — search results for "infohub status"
// (the obvious query when something looks wrong) didn't surface the
// right page. Now they do, with a proper share-card description.
export const metadata = pageMetadata('/status');

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
