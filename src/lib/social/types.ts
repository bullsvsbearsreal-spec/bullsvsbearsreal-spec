/**
 * Social-feed (Twitter/X via RSS) shared types + fetcher interface.
 *
 * Designed so we can swap the upstream source — primary is nitter.net but we
 * may need to fall back to RSSHub-self-hosted, rss.app, or X API Basic if
 * nitter dies. Keeping the contract narrow means swapping is one file.
 */

export interface SocialPost {
  /** Stable globally-unique id. Format: `${handle.toLowerCase()}_${tweetIdOrPubDate}`. */
  id: string;
  /** Lowercase handle without `@`, e.g. "zachxbt". */
  handle: string;
  /** Display name as it appears on the source ("ZachXBT"). Optional. */
  displayName?: string;
  /** Plain-text tweet body — HTML stripped, RT prefix removed, entities decoded. */
  body: string;
  /** Original HTML/Atom description as returned by the source. Useful for embeds, optional. */
  bodyHtml?: string;
  /** Canonical x.com URL for the tweet (rewritten from nitter etc.). */
  link: string;
  /** Tweet publish time. */
  pubDate: Date;
}

export interface SocialFetcher {
  /** Identifier for logging + the `source` column. */
  readonly name: string;
  /**
   * Fetch the most recent posts for a single handle. Throws on HTTP errors —
   * the cron handler will catch + record per-handle so one bad handle doesn't
   * tank the batch.
   */
  fetchHandle(handle: string): Promise<SocialPost[]>;
}
