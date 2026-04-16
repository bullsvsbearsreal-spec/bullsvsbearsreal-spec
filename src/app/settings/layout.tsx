import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/settings');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
