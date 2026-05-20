'use client';

/**
 * Site-wide banner announcing "Pro + Whale tiers free during launch".
 * Dismissible per session (sessionStorage) — comes back on next visit.
 *
 * Hidden once a user is on a paid tier (no reason to upsell them) and
 * for admins (they're already Whale via resolveUserTier).
 *
 * Renders above <Header> in app/layout.tsx so it spans the full viewport
 * width and doesn't shift content below it once mounted (we reserve the
 * space via CSS).
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Sparkles, X, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'launch-banner-dismissed';

export default function LaunchBanner() {
  const { data: session, status } = useSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show on the pricing page itself (redundant).
    if (typeof window !== 'undefined' && window.location.pathname === '/pricing') {
      return;
    }
    // Dismissed this session — stay hidden.
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') return;
    } catch { /* sessionStorage unavailable — show anyway */ }
    setVisible(true);
  }, []);

  // Hide for admin (already Whale) and once we know the role.
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === 'admin') return null;

  // Don't show while session is resolving — avoids flash for admins.
  if (status === 'loading') return null;

  if (!visible) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
    setVisible(false);
  };

  return (
    <div
      role="banner"
      className="relative w-full border-b border-amber-400/20 bg-gradient-to-r from-amber-500/[0.08] via-emerald-500/[0.06] to-amber-500/[0.08]"
    >
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2 text-[11px] sm:text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden />
          <p className="text-neutral-200 truncate">
            <span className="font-semibold text-amber-300">Free during launch</span>
            <span className="text-neutral-400">
              {' · '}Pro + Whale tiers unlocked for everyone while we onboard early users.
            </span>
          </p>
          <Link
            href="/pricing"
            className="hidden sm:inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold whitespace-nowrap"
          >
            See pricing <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <Link
          href="/pricing"
          className="sm:hidden text-[11px] font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap"
        >
          Pricing →
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss launch banner"
          className="text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
