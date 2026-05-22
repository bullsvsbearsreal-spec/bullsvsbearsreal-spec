/**
 * Cloudflare Turnstile — server-side token verifier.
 *
 * Set env vars to enable:
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  — public, embedded in the page
 *   TURNSTILE_SECRET_KEY            — server-only, used for siteverify
 *
 * If either env var is missing, verifyTurnstileToken returns true (no-op).
 * That lets us ship the widget to production without breaking when the
 * keys haven't been configured yet — defense in depth, not a hard gate.
 *
 * Cloudflare's siteverify spec:
 *   POST https://challenges.cloudflare.com/turnstile/v0/siteverify
 *   body: { secret, response[, remoteip] }
 *   response: { success: boolean, "error-codes": string[] }
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  'error-codes'?: string[];
}

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/**
 * Verify a Turnstile token from a form submission. Returns `true` when
 * the token is valid OR when Turnstile is not configured (graceful
 * fallback). Returns `false` only on an explicit verification failure.
 *
 * Pass the client IP when possible — Cloudflare scores on it.
 */
export async function verifyTurnstileToken(token: string | undefined | null, remoteIp?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Turnstile not configured — gracefully accept. The form keeps
    // working in dev / pre-keys environments without ceremony.
    return true;
  }
  if (!token || typeof token !== 'string' || token.length < 10) {
    return false;
  }
  try {
    const params = new URLSearchParams();
    params.set('secret', secret);
    params.set('response', token);
    if (remoteIp) params.set('remoteip', remoteIp);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.warn('[turnstile] siteverify HTTP', res.status);
      return false;
    }
    const json = (await res.json()) as SiteVerifyResponse;
    if (!json.success) {
      console.warn('[turnstile] verify failed:', json['error-codes']?.join(',') ?? 'no codes');
    }
    return Boolean(json.success);
  } catch (e) {
    console.warn('[turnstile] verify error:', e instanceof Error ? e.message : e);
    // Fail open on network errors — better to let a legit user through
    // when CF's verifier is down than to lock out the entire signup
    // flow. The rate limiter on /api/auth/signup (5/15min per IP via
    // src/middleware.ts) is the bot-defense floor; Turnstile is the
    // higher layer that we only enforce when it's actually responding.
    return true;
  }
}

/** Read the visitor IP from request headers (DO + Cloudflare conventions). */
export function readClientIp(req: { headers: Headers }): string | null {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  );
}
