'use client';

// Wraps page content in TerminalShell EXCEPT for routes that need full-screen chrome
// (auth pages, the TradingView chart, error/loading screens).

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import TerminalShell from './TerminalShell';

const EXCLUDED_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

export default function ConditionalTerminalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const skip = EXCLUDED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (skip) return <>{children}</>;
  return <TerminalShell>{children}</TerminalShell>;
}
