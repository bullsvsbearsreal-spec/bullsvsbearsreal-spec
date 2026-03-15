'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Lock, ArrowRight, BarChart3 } from 'lucide-react';

/**
 * AuthWall — Coinglass-style auth gate.
 *
 * Wraps page content. If the user is NOT signed in, renders a blurred preview
 * of the children with a sign-in overlay on top. Signed-in users see content
 * normally.
 *
 * Usage:
 *   <AuthWall>
 *     <FundingPage />
 *   </AuthWall>
 */
export default function AuthWall({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  // While loading session, show content without wall (avoids flash)
  if (status === 'loading') return <>{children}</>;

  // Authenticated — pass through
  if (status === 'authenticated') return <>{children}</>;

  // ── Unauthenticated: show blurred preview + overlay ──
  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: 'blur(6px)', opacity: 0.5, maxHeight: '70vh', overflow: 'hidden' }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Gradient fade at bottom of blurred content */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none" />

      {/* Auth overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-20">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-2xl p-8 text-center shadow-2xl backdrop-blur-sm">
            {/* Icon */}
            <div className="w-14 h-14 rounded-xl bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center mx-auto mb-5">
              <Lock className="w-6 h-6 text-hub-yellow" />
            </div>

            {/* Heading */}
            <h2 className="text-xl font-bold text-white mb-2">
              Sign in to continue
            </h2>
            <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
              Create a free account to access real-time funding rates, open interest, liquidations, and more across 33 exchanges.
            </p>

            {/* Features list */}
            <div className="grid grid-cols-2 gap-2 mb-6 text-left">
              {[
                'Funding rates',
                'Open interest',
                'Liquidations',
                'Screener & alerts',
                'Price arbs & spreads',
                'Token unlocks',
              ].map(feature => (
                <div key={feature} className="flex items-center gap-2 text-xs text-neutral-400">
                  <BarChart3 className="w-3 h-3 text-hub-yellow/60 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-black transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #FFB800, #FF8C00, #E06600)' }}
            >
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="block mt-3 text-sm text-neutral-500 hover:text-white transition-colors"
            >
              Already have an account? <span className="text-hub-yellow font-medium">Sign in</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
