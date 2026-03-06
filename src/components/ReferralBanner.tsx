import Link from 'next/link';
import { Gift, ArrowRight } from 'lucide-react';

/**
 * Slim referral CTA strip — drop above <Footer /> on high-traffic pages.
 * Fully self-contained, no props needed.
 */
export default function ReferralBanner() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 mb-6">
      <Link
        href="/referrals"
        className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-hub-yellow/20 hover:bg-hub-yellow/[0.03] transition-all duration-300 px-4 sm:px-5 py-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
            <Gift className="w-3.5 h-3.5 text-hub-yellow" />
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors truncate">
            <span className="text-neutral-300 font-medium">Get fee discounts</span>
            {' '}&mdash; sign up to exchanges through our referral links
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-hub-yellow group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </Link>
    </div>
  );
}
