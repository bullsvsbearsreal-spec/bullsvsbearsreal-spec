import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/screener');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
