import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/cvd');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
