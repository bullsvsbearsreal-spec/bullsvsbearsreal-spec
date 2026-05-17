/**
 * URL-slug helper — used to generate stable, shareable URL fragments
 * for FAQ questions, doc sections, and any other content that needs
 * deep-linking.
 *
 * Why this exists separately from the FAQ page: the FAQ page slugify
 * was inlined originally, but the same need shows up on /developers/docs,
 * /guides/*, and any page where we render headings users might share.
 * Centralising means one place to change rules + one test suite.
 *
 * Rules:
 *   - lowercase
 *   - strip apostrophes / quote chars entirely (so "user's data" → "users-data"
 *     not "user-s-data")
 *   - non-alphanumeric → single dash
 *   - trim leading/trailing dashes
 *   - cap length at 60 chars (keeps URLs reasonable + matches what
 *     most SEO guides recommend for slug max)
 *
 * Stable across renders: same input → same output. The slug is
 * deterministic, not index-based, so re-ordering content doesn't
 * break shared links.
 */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['"`]/g, '')                    // strip apostrophes / quotes
    .replace(/[^a-z0-9]+/g, '-')              // non-alphanumerics → -
    .replace(/^-+|-+$/g, '')                  // trim leading/trailing -
    .slice(0, 60);                            // keep URLs reasonable
}
