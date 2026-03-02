import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Code2, ArrowRight, Bell } from 'lucide-react';

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[600px] mx-auto px-4 sm:px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center mx-auto mb-6">
          <Code2 className="w-8 h-8 text-hub-yellow" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
          API Access
        </h1>
        <p className="text-hub-yellow text-sm font-semibold uppercase tracking-wider mb-4">
          Coming Soon
        </p>
        <p className="text-neutral-500 text-sm leading-relaxed max-w-md mx-auto mb-10">
          We&apos;re building a developer API for subscribers. Real-time funding rates,
          open interest, liquidations, and more — programmatic access across 24+ exchanges.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm shadow-lg shadow-yellow-500/20 transition-all"
          >
            <Bell size={15} />
            Create account to get notified
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white font-medium text-sm transition-all"
          >
            Back to dashboard
            <ArrowRight size={15} />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
