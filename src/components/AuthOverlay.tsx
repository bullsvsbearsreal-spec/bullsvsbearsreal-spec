'use client';

import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';

export default function AuthOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-white">info</span>
            <span className="bg-gradient-to-r from-hub-yellow to-hub-orange bg-clip-text text-transparent">hub</span>
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <div className="w-14 h-14 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-6 h-6 text-hub-yellow" />
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Sign up to unlock all data
          </h2>
          <p className="text-neutral-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
            Create an account to access real-time funding rates, open interest,
            liquidations, and more across 30+ exchanges.
          </p>

          <div className="space-y-3">
            <Link
              href="/signup"
              className="w-full h-12 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 transition-all"
            >
              Create account
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/login"
              className="w-full h-12 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
