'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, ArrowLeft, ExternalLink } from 'lucide-react';

/**
 * Branded header shown on every /bounce/* page.
 * Custom logo mark, sub-nav, and a persistent link back to InfoHub + out to bounce.tech.
 */
export default function BounceHeader() {
  const pathname = usePathname() || '';

  const subNav = [
    { href: '/bounce', label: 'Overview' },
    { href: '/bounce/leaderboard', label: 'Rekt Board' },
    { href: '/bounce/check', label: 'Check Wallet' },
    { href: '/bounce/claim', label: 'Claim Guide' },
  ];

  // Determine active: exact match or (for dynamic routes) starts-with.
  const isActive = (href: string) => {
    if (pathname === href) return true;
    // Per-address profile pages highlight "Check Wallet" in the nav
    if (href === '/bounce/check' && /^\/bounce\/0x[a-fA-F0-9]{40}/.test(pathname)) return true;
    return false;
  };

  return (
    <div className="bg-gradient-to-r from-red-500/[0.06] via-orange-500/[0.03] to-transparent border-b border-red-400/15">
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Back link */}
        <div className="flex items-center justify-between mb-3">
          <Link href="/" className="text-[11px] text-neutral-500 hover:text-hub-yellow transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> back to InfoHub
          </Link>
          <a
            href="https://bounce.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors inline-flex items-center gap-1"
          >
            open bounce.tech <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Logo + Title */}
        <div className="flex items-center gap-3 mb-4">
          <BounceLogo />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">bounce.tech</h1>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-400/15 text-red-400 font-bold">
                private beta
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              Leveraged tokens on HyperEVM · InfoHub integration
            </div>
          </div>
        </div>

        {/* Sub-nav */}
        <nav aria-label="bounce.tech sub-navigation" className="flex gap-1 overflow-x-auto -mx-1 px-1">
          {subNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                isActive(item.href)
                  ? 'bg-red-400/15 text-red-400'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

/**
 * Custom bounce.tech logo mark. Styled as a flame inside a bouncing badge.
 * Pure SVG so it scales + stays crisp + has no network dependency.
 */
export function BounceLogo({ size = 48 }: { size?: number }) {
  return (
    <div
      className="relative flex-shrink-0 rounded-xl bg-gradient-to-br from-red-500/20 via-orange-500/15 to-transparent border border-red-400/30 p-2"
      style={{ width: size, height: size }}
      aria-label="bounce.tech"
    >
      {/* Gradient flame icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="url(#bounceGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="bounceGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ff6b6b" />
            <stop offset="50%" stopColor="#ff9500" />
            <stop offset="100%" stopColor="#ffcb2e" />
          </linearGradient>
        </defs>
        {/* Flame path from lucide Flame */}
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
      {/* Small hot glow at the bottom */}
      <div
        className="absolute inset-x-2 bottom-0 h-1 rounded-full blur-sm opacity-60 bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400"
        aria-hidden
      />
    </div>
  );
}
