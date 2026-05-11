import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/home');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
