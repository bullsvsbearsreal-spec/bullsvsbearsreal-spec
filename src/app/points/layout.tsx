import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/points');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
