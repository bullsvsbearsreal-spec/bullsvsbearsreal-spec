import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/pricing');

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
