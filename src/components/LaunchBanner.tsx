'use client';

/**
 * Site-wide banner announcing "Trader + Pro + Whale tiers free during launch".
 * Dismissible per session (sessionStorage) — comes back on next visit.
 *
 * Shown to EVERY user including admins. Admins were previously hidden
 * (rationale: "already Whale, no upsell") but that meant the team
 * running the site never saw the launch announcement they shipped,
 * which makes /pricing QA blind. The dismiss-X handles the "I don't
 * need to see this every page" case for any user including admins.
 *
 * Renders above the rest of the chrome inside TerminalShell so it
 * spans the full viewport width.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, X, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'launch-banner-dismissed';

export default function LaunchBanner() {
  const { status } = useSession();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  // Restore dismissed state from session storage on mount.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') setDismissed(true);
    } catch { /* sessionStorage unavailable — show anyway */ }
  }, []);

  // Don't show on /pricing itself (redundant). Uses usePathname so it
  // updates correctly on client-side navigation, not just initial mount.
  if (pathname === '/pricing') return null;

  // Don't render while session is resolving — avoids a flash before the
  // dismissed-state hydrates from sessionStorage.
  if (status === 'loading') return null;

  if (dismissed) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
    setDismissed(true);
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
              {' · '}Trader, Pro + Whale tiers unlocked for everyone while we onboard early users.
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
