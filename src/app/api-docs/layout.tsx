import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/api-docs');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
