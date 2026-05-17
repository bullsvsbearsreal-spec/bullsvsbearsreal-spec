/**
 * Global loading skeleton — terminal-style boot indicator that
 * matches the rest of the app's Bloomberg/TTY aesthetic rather than
 * the generic spinning circle the Next.js scaffold ships with.
 *
 * Pure CSS animation (the dot keyframes are in globals.css). No JS
 * needed — this can render before hydration.
 */
import { ALL_EXCHANGES } from '@/lib/constants';

export default function Loading() {
  return (
    <div className="min-h-screen bg-hub-black flex items-center justify-center font-mono">
      <div className="flex flex-col items-center gap-2 text-[11px]">
        <span className="text-hub-yellow tracking-widest uppercase">
          [boot] streaming<span className="animate-loading-dots" />
        </span>
        <span className="text-neutral-600 text-[10px]">
          infohub · {ALL_EXCHANGES.length} venues · real-time
        </span>
      </div>
    </div>
  );
}
