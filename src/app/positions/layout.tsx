import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/positions');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
