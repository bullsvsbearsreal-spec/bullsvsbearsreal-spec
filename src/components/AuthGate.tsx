'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import AuthOverlay from './AuthOverlay';

const PUBLIC_ROUTES = new Set([
  '/',
  '/faq',
  '/terms',
  '/privacy',
  '/referrals',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  // Core data pages — public with soft auth gates
  '/funding',
  '/open-interest',
  '/liquidations',
  '/options',
  '/basis',
  '/screener',
  '/fear-greed',
  '/dominance',
  '/top-movers',
  '/market-heatmap',
  '/longshort',
  '/execution-costs',
]);

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();

  const isPublic = PUBLIC_ROUTES.has(pathname);
  const needsGate = !isPublic && status === 'unauthenticated';

  if (needsGate) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none [filter:blur(6px)_brightness(0.4)]">
          {children}
        </div>
        <AuthOverlay />
      </div>
    );
  }

  return <>{children}</>;
}
