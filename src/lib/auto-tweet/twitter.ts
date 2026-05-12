/**
 * Twitter API v2 client wrapper. Dry-run by default — only posts to
 * live Twitter when ALL four OAuth 1.0a env vars are present:
 *   TWITTER_API_KEY
 *   TWITTER_API_SECRET
 *   TWITTER_ACCESS_TOKEN
 *   TWITTER_ACCESS_TOKEN_SECRET
 *
 * (Twitter API v2 supports OAuth 2.0 user context too but OAuth 1.0a
 * is simpler for a single-account auto-poster — no token refresh.)
 *
 * If any env var is missing OR AUTO_TWEET_DRY_RUN=true is set, we
 * return a dry-run sentinel without making the network call. The
 * runner stores the would-be tweet in the DB either way so the
 * admin panel can review what got composed.
 */

import { createHmac } from 'crypto';

const POST_URL = 'https://api.twitter.com/2/tweets';

export interface PostTweetResult {
  /** True if the call succeeded OR we were in dry-run mode. The DB
   *  stores `posted_at` only for real successes; `posted_at` stays
   *  null for dry-runs so the admin panel can show them as pending. */
  ok: boolean;
  /** Twitter's id_str for the posted tweet (null in dry-run mode). */
  tweetId: string | null;
  /** True iff no network call was made because creds are missing
   *  or AUTO_TWEET_DRY_RUN=true. */
  dryRun: boolean;
  /** Error message on failure (network error, Twitter rejection). */
  error?: string;
}

function isDryRun(): boolean {
  if (process.env.AUTO_TWEET_DRY_RUN === 'true') return true;
  return !(
    process.env.TWITTER_API_KEY &&
    process.env.TWITTER_API_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN &&
    process.env.TWITTER_ACCESS_TOKEN_SECRET
  );
}

/**
 * Build the OAuth 1.0a Authorization header for a POST request.
 * Hand-rolled to avoid adding the `oauth-1.0a` npm dep for one call.
 */
function buildOAuthHeader(url: string, method: 'POST'): string {
  const apiKey         = process.env.TWITTER_API_KEY!;
  const apiSecret      = process.env.TWITTER_API_SECRET!;
  const accessToken    = process.env.TWITTER_ACCESS_TOKEN!;
  const accessSecret   = process.env.TWITTER_ACCESS_TOKEN_SECRET!;

  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     apiKey,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            accessToken,
    oauth_version:          '1.0',
  };

  // Build the signature base string
  const paramString = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&');
  const baseString = [
    method,
    encodeURIComponent(url),
    encodeURIComponent(paramString),
  ].join('&');

  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams.oauth_signature = signature;

  // Build Authorization header
  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');
}

export async function postTweet(text: string): Promise<PostTweetResult> {
  if (isDryRun()) {
    return { ok: true, tweetId: null, dryRun: true };
  }

  try {
    const res = await fetch(POST_URL, {
      method: 'POST',
      headers: {
        'Authorization': buildOAuthHeader(POST_URL, 'POST'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '<no body>');
      return {
        ok: false,
        tweetId: null,
        dryRun: false,
        error: `Twitter API ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const json = await res.json() as { data?: { id?: string } };
    return {
      ok: true,
      tweetId: json.data?.id ?? null,
      dryRun: false,
    };
  } catch (e) {
    return {
      ok: false,
      tweetId: null,
      dryRun: false,
      error: e instanceof Error ? e.message : 'unknown error',
    };
  }
}

/** Exposed for testing the dry-run gate without monkey-patching env. */
export const __testing = { isDryRun };
