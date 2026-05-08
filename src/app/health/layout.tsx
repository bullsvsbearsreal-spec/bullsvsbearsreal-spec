import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/health');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
