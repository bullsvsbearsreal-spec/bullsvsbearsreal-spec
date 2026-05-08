import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/dashboard/v2');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
