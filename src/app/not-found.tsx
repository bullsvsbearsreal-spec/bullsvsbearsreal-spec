import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-20 flex flex-col items-center justify-center text-center">
        <div className="text-6xl font-bold text-hub-yellow mb-4">404</div>
        <h1 className="text-xl font-semibold text-white mb-2">Page Not Found</h1>
        <p className="text-neutral-400 text-sm mb-8 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2 bg-hub-yellow text-black rounded-lg font-medium text-sm hover:bg-hub-yellow/90 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/funding"
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-medium text-sm hover:bg-white/10 transition-colors"
          >
            Funding Rates
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
