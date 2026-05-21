import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/account/connections');

export default function ConnectionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
