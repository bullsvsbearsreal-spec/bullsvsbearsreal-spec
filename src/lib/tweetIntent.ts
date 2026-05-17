/**
 * Build a Twitter / X tweet-intent URL with pre-filled text.
 *
 * Used by /invite and /invite/leaderboard. Centralised so the
 * encoding is consistent + the spec is in one place.
 *
 * spec: https://developer.x.com/en/docs/twitter-for-websites/tweet-button/overview
 *
 * Notes on the URL:
 *   - `text` is the only required field. URL params are url-encoded
 *     automatically by URLSearchParams.
 *   - Twitter prepends "https://twitter.com" but X.com URLs work too.
 *     We keep twitter.com for compatibility with older clients.
 *   - Max effective tweet length is 280 chars including the URL.
 *     This helper does NOT enforce that — callers should keep their
 *     text trimmed.
 */

export interface TweetIntentOpts {
  /** Tweet body. Will be url-encoded. Should include the share URL
   *  inline (Twitter's `url` param sometimes appends weirdly). */
  text: string;
  /** Optional via=handle for "via @infohub" attribution. */
  via?: string;
  /** Optional hashtags array (without #). Twitter accepts comma-separated. */
  hashtags?: string[];
}

export function tweetIntent(opts: TweetIntentOpts): string {
  const params = new URLSearchParams();
  params.set('text', opts.text);
  if (opts.via) params.set('via', opts.via);
  if (opts.hashtags && opts.hashtags.length > 0) {
    params.set('hashtags', opts.hashtags.join(','));
  }
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
