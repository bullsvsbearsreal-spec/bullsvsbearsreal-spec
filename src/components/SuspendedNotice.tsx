/**
 * Reusable "feature paused" maintenance notice.
 *
 * Used to render a clean placeholder for /dashboard and /signup
 * while we polish the experience. Flip the SUSPENDED flag in the
 * consuming page to re-enable the real UI.
 */

import Link from 'next/link';
import { Construction, ArrowRight } from 'lucide-react';

interface Props {
  /** Headline shown to the user, e.g. "Dashboard paused" */
  title: string;
  /** Sub-paragraph explaining what's happening + ETA if known */
  description: string;
  /** Optional href + label for the primary CTA back to safety */
  primaryCta?: { href: string; label: string };
  /** Optional second CTA */
  secondaryCta?: { href: string; label: string };
}

export default function SuspendedNotice({
  title,
  description,
  primaryCta = { href: '/', label: 'Back to home' },
  secondaryCta,
}: Props) {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-amber-400/30 bg-amber-500/[0.03] p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-amber-500/10 border border-amber-400/30 flex items-center justify-center">
          <Construction className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          {description}
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Link
            href={primaryCta.href}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-hub-yellow text-black font-semibold text-sm hover:bg-hub-yellow/90 transition-all"
          >
            {primaryCta.label}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.1] text-neutral-300 font-semibold text-sm hover:bg-white/[0.04] transition-all"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
        <p className="mt-6 text-[11px] text-neutral-600">
          Temporarily paused — flip <code className="text-neutral-500">SUSPENDED</code> in source to re-enable.
        </p>
      </div>
    </main>
  );
}
