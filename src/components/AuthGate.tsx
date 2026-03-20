'use client';

// Platform is open — all pages are publicly accessible.
// AuthGate is kept as a pass-through so it can be re-enabled if needed.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
