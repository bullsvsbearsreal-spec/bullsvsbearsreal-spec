import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/account/api-keys');

export default function ApiKeysLayout({ children }: { children: React.ReactNode }) {
  return children;
}
