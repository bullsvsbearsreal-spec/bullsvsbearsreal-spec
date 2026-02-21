import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/funding');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
