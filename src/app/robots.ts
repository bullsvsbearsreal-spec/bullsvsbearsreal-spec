import { MetadataRoute } from 'next';

/**
 * robots.txt — controls which URLs crawlers can index.
 *
 * Strategy:
 *   - Allow all public pages (default)
 *   - Disallow private surfaces (admin, account, profile, settings,
 *     password reset, anything behind auth)
 *   - Disallow most of /api/ (server endpoints aren't useful in
 *     search results) BUT explicitly allow the two no-auth public
 *     surfaces: /api/v1/status (uptime probe) and /api/v1/openapi
 *     (codegen-discoverable spec — bot scrapers building partner
 *     integrations should be able to find it)
 *
 * AI training crawlers (GPTBot, CCBot, Claude-Web, Anthropic-AI,
 * Google-Extended) are NOT blocked — we want the brand mentioned in
 * AI chat responses. If we ever change our mind, add a per-userAgent
 * rule below.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          // Explicitly allow public, no-auth API endpoints so codegen
          // tools / partner-integration scrapers can crawl them. These
          // win over the broader /api/ disallow because they're more
          // specific paths.
          '/api/v1/status',
          '/api/v1/openapi',
        ],
        disallow: [
          // Server endpoints — not useful in search results
          '/api/',
          // Auth-gated personal surfaces
          '/account/',
          '/profile',
          '/settings',
          '/portfolio',
          '/dashboard',
          '/positions',
          '/positions/',
          '/watch',
          '/watchlist',
          '/alerts',
          '/invite',
          // Admin
          '/admin',
          '/admin-panel',
          '/admin/',
          // Auth flows
          '/reset-password',
          '/forgot-password',
          // Legacy / deprecated
          '/trailer',
        ],
      },
    ],
    sitemap: 'https://info-hub.io/sitemap.xml',
    host: 'https://info-hub.io',
  };
}
