'use client';

/**
 * Fire-and-forget page-view beacon.
 *
 * Mounted once at the root (next to AlertEngine in layout.tsx). Watches
 * the pathname via Next's router and POSTs a normalised route to
 * /api/track-page-view on every change.
 *
 * Implementation notes:
 *   · Uses navigator.sendBeacon when available so the request survives
 *     page unload (e.g. user clicks an external link); fetch fallback
 *     otherwise.
 *   · Anonymous-safe: the API ignores everything except the route.
 *   · Failures are silent. Page views are best-effort analytics —
 *     never block the UI.
 *   · Self-throttles to once per route per second so a fast
 *     forward/back doesn't double-count.
 *   · Skips /admin-panel/* and other operator-only paths to keep the
 *     stats clean (we're already on the dashboard counting; recording
 *     a /admin-panel/users hit pollutes the top-pages table).
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// /mod-panel, /marketing-panel, /support-panel added alongside the
// existing /admin-panel skip — these are operator-only surfaces and
// counting visits to /mod-panel/tickets pollutes the same "top pages"
// table the operator looks at on /admin-panel#analytics. Same logic
// the original commit applied to /admin-panel.
const SKIP_PREFIXES = ['/admin-panel', '/admin/', '/mod-panel', '/marketing-panel', '/support-panel', '/_next'];

export default function PageViewBeacon() {
  const pathname = usePathname();
  const lastRoute = useRef<string | null>(null);
  const lastFired = useRef<number>(0);

  useEffect(() => {
    if (!pathname) return;
    if (SKIP_PREFIXES.some(p => pathname.startsWith(p))) return;

    // Same route within 1s? Skip — fast back/forward shouldn't double-count.
    const now = Date.now();
    if (pathname === lastRoute.current && now - lastFired.current < 1000) return;
    lastRoute.current = pathname;
    lastFired.current = now;

    const body = JSON.stringify({ route: pathname });

    // sendBeacon is preferred (survives page unload), but it returns
    // false when the queue rejects the payload (size cap, disabled,
    // disconnected). On false we fall through to fetch with keepalive
    // — same survive-unload property, slightly slower path.
    let queued = false;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        queued = navigator.sendBeacon('/api/track-page-view', blob);
      }
    } catch { /* fall through to fetch */ }

    if (queued) return;

    try {
      void fetch('/api/track-page-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch { /* swallow */ }
  }, [pathname]);

  return null;
}
