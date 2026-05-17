import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Page Not Found',
  description: 'No route maps to this URL on InfoHub.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-20 flex flex-col items-center justify-center text-center">
        <div className="text-6xl font-bold text-hub-yellow mb-4 font-mono">404</div>
        <h1 className="text-xl font-semibold text-white mb-2">Nothing trades here</h1>
        <p className="text-neutral-400 text-sm mb-8 max-w-md">
          No route maps to this URL. The page may have moved, or you followed a stale link.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/home"
            className="px-4 py-2 bg-hub-yellow text-black rounded-lg font-medium text-sm hover:bg-hub-yellow/90 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/funding"
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-medium text-sm hover:bg-white/10 transition-colors"
          >
            Funding rates
          </Link>
          <Link
            href="/chart"
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-medium text-sm hover:bg-white/10 transition-colors"
          >
            Chart
          </Link>
          <Link
            href="/screener"
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-medium text-sm hover:bg-white/10 transition-colors"
          >
            Screener
          </Link>
          <Link
            href="/funding-arb"
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-medium text-sm hover:bg-white/10 transition-colors"
          >
            Funding arb
          </Link>
          <Link
            href="/trader-watch"
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-medium text-sm hover:bg-white/10 transition-colors"
          >
            Trader watch
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
