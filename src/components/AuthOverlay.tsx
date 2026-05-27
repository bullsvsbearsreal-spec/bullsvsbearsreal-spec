'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Lock } from 'lucide-react';
import { ALL_EXCHANGES } from '@/lib/constants';

export default function AuthOverlay() {
  // Capture the gated path so the user lands back here after login,
  // not on /dashboard. Without this, every gated page hits Sign In and
  // dumps the user on the dashboard — they then have to re-navigate.
  const pathname = usePathname() || '/';
  const loginHref = `/login?callbackUrl=${encodeURIComponent(pathname)}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 text-center">
        <div className="flex justify-center mb-6">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-white">info</span>
            <span className="bg-gradient-to-r from-hub-yellow to-hub-orange bg-clip-text text-transparent">hub</span>
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <div className="w-14 h-14 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-6 h-6 text-hub-yellow" />
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Sign in to continue
          </h2>
          <p className="text-neutral-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
            Sign in to access all features across {ALL_EXCHANGES.length} exchanges.
          </p>

          <div className="space-y-3">
            <Link
              href={loginHref}
              className="w-full h-12 rounded-xl bg-hub-yellow hover:bg-hub-yellow-light text-black font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-hub-yellow/20 transition-all"
            >
              Sign In
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/"
              className="w-full h-12 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
