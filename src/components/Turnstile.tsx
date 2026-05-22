'use client';

/**
 * Cloudflare Turnstile widget — vanilla script integration (no
 * dependency). Renders a CAPTCHA-style challenge that produces a
 * single-use token; pass that token to your server-side route, which
 * verifies it via lib/auth/turnstile.ts.
 *
 * If NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't configured the widget
 * renders nothing and onToken is never called — the parent form can
 * either gate submission on token-present (and stay locked) or treat
 * the missing widget as "feature disabled". The signup + forgot-
 * password forms in this repo take the latter approach so dev /
 * pre-keys environments still work.
 *
 * Usage:
 *   <Turnstile onToken={setToken} />
 *
 * `onToken` is called with the validated token on success and with
 * an empty string when the token expires (so the form can re-disable
 * submit until the user solves a fresh challenge).
 */

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          appearance?: 'always' | 'execute' | 'interaction-only';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptLoadingPromise: Promise<void> | null = null;

function ensureTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    // Avoid double-injecting if some other component loaded it
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_SRC.split('?')[0]}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed to load')), { once: true });
      // If the script has already loaded, window.turnstile is set
      // synchronously — short-circuit.
      if (window.turnstile) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile script failed to load'));
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

interface TurnstileProps {
  /** Called with the verification token on success, or empty string on expiry / error. */
  onToken: (token: string) => void;
  /** Optional theme. Defaults to 'auto' (follows system). */
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export default function Turnstile({ onToken, theme = 'auto', className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  // Keep the latest callback in a ref so the effect below doesn't
  // re-mount the widget every render when the parent re-creates the
  // callback. Solving the challenge twice on prop-tick would be a
  // poor UX.
  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return; // Feature disabled — render nothing.

    let cancelled = false;
    ensureTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => onTokenRef.current?.(token),
          'expired-callback': () => onTokenRef.current?.(''),
          'error-callback': () => onTokenRef.current?.(''),
        });
      })
      .catch(() => { /* script load failed — silently degrade */ });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
      }
    };
  }, [theme]);

  // No-op render when env var missing — parent form proceeds without
  // a token, which server-side treats as "Turnstile disabled" and
  // accepts the submission (see lib/auth/turnstile.ts).
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null;

  return <div ref={containerRef} className={className} aria-label="Bot protection challenge" />;
}
