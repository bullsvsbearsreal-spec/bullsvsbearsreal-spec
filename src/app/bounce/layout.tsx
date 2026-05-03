import { pageMetadata } from '@/lib/seo';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BounceHeader from './BounceHeader';

export const metadata = pageMetadata('/bounce');

/**
 * Shared layout for every /bounce/* page.
 * Wraps children with the standard InfoHub Header/Footer + a branded
 * BounceHeader that gives the whole section its own identity.
 */
export default function BounceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <BounceHeader />
      {children}
      <Footer />
    </div>
  );
}
