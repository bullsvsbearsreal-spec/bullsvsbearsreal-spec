'use client';

/**
 * AuthWall — previously gated content behind auth.
 * Platform is now open — pass-through only.
 * Kept as a no-op wrapper so existing usages don't break.
 */
export default function AuthWall({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
