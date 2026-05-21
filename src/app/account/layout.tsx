// /account redirects to /dashboard. The metadata here cascades to
// subroutes that don't define their own (/account/connections,
// /account/api-keys), so use the canonical /account entry — NOT
// /dashboard, which set the wrong page title ("Dashboard · Command
// Center") on every /account/* page in the browser tab.
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/account');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
