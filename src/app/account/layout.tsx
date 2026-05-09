// /account redirects to /dashboard. The metadata here is mostly
// irrelevant since users never see this URL render anything, but we
// keep a minimal layout so subroutes (/account/connections,
// /account/api-keys) still work.
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/dashboard');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
