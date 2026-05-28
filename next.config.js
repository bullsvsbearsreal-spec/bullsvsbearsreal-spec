const { withSentryConfig } = require('@sentry/nextjs');
// Bundle analyzer is a devDep; only require it when explicitly running ANALYZE=true.
// Avoids a "Cannot find module '@next/bundle-analyzer'" crash in production
// (DO App Platform installs prod-only deps).
const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('@next/bundle-analyzer')({ enabled: true })
  : (config) => config;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'standalone',  // disabled — DO App Platform Heroku buildpack runs `next start` directly.
  // Vercel doesn't need standalone output either (it uses its own bundler).
  // Re-enable only if you switch to a Dockerfile-based deploy that runs `node .next/standalone/server.js`.
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cryptologos.cc' },
      { protocol: 'https', hostname: 's2.coinmarketcap.com' },
      { protocol: 'https', hostname: 'assets.coingecko.com' },
      { protocol: 'https', hostname: 'coin-images.coingecko.com' },
    ],
  },
  async redirects() {
    return [
      { source: '/sentiment', destination: '/fear-greed', permanent: true },
      { source: '/whale-alerts', destination: '/whale-alert', permanent: true },
      // Likely-typo paths — the sidebar label is "Funding Rates" but
      // the route is /funding. Users who type the label verbatim into
      // the URL bar (or follow stale external links) get a 404
      // instead of the page they wanted. Same for "open interest" →
      // /open-interest variants.
      { source: '/funding-rates', destination: '/funding', permanent: true },
      { source: '/openinterest', destination: '/open-interest', permanent: true },
      { source: '/long-short', destination: '/longshort', permanent: true },
      // /signals — removed at some point during the refactor. Bookmarks
      // + external links to /signals 404. The /breakouts page is the
      // closest spiritual successor (pattern-detection on coins).
      { source: '/signals', destination: '/breakouts', permanent: true },
      // /settings/* sub-routes that were consolidated into /profile —
      // the API Keys / Notifications / Connections tabs all live under
      // /profile now. Users following old links or external docs hit
      // the consolidated profile page instead of a 404.
      { source: '/settings/api-keys', destination: '/profile?tab=api-keys', permanent: true },
      { source: '/settings/profile', destination: '/profile', permanent: true },
      { source: '/settings/notifications', destination: '/profile?tab=notifications', permanent: true },
      { source: '/settings/connections', destination: '/profile?tab=connections', permanent: true },
      { source: '/settings/billing', destination: '/profile?tab=billing', permanent: true },
      // Plausible API-key landing paths that users hit but don't
      // exist as actual routes. Discovered while Chrome-browsing —
      // the developer docs link to /developers but partners often
      // try /developers/keys, /api-keys, /account/keys directly.
      { source: '/developers/keys', destination: '/profile?tab=api-keys', permanent: true },
      { source: '/api-keys', destination: '/profile?tab=api-keys', permanent: true },
      { source: '/apikeys', destination: '/profile?tab=api-keys', permanent: true },
      { source: '/api-key', destination: '/profile?tab=api-keys', permanent: true },
      { source: '/account', destination: '/profile', permanent: true },
      { source: '/account/keys', destination: '/profile?tab=api-keys', permanent: true },
    ];
  },
  async rewrites() {
    // Umami analytics — proxy the tracker through info-hub.io so the
    // browser sees same-origin requests. This:
    //   1. Sidesteps our CSP (script-src 'self' covers info-hub.io but
    //      not analytics.info-hub.io)
    //   2. Defeats adblockers that pattern-match on `analytics.*` hosts
    //      or `/script.js` paths
    //
    // The collect endpoint (/u/api/send) is NOT rewritten — it's
    // handled directly by src/app/u/api/send/route.ts which validates
    // Origin, rate-limits per IP, and preserves X-Forwarded-For for
    // Umami's GeoIP. A bare rewrite was an open relay anyone could
    // spam to pollute our stats with fake page-views.
    const umamiHost = process.env.UMAMI_HOST || process.env.NEXT_PUBLIC_UMAMI_HOST;
    if (!umamiHost) {
      // eslint-disable-next-line no-console
      console.warn(
        '[next.config] UMAMI_HOST/NEXT_PUBLIC_UMAMI_HOST not set at build time — ' +
        '/u/script.js rewrite disabled, analytics tracker will 404. If you intend ' +
        'to ship analytics, set UMAMI_HOST in the DO App Platform env (it must be ' +
        'available at BUILD time, not just runtime — rewrites are evaluated once).'
      );
      return [];
    }
    return [
      { source: '/u/script.js', destination: `${umamiHost}/script.js` },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.tradingview.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.sentry.io wss://fstream.binance.com wss://stream.bybit.com wss://ws.okx.com:8443 wss://ws.bitget.com wss://www.deribit.com wss://api.hbdm.com wss://backend-arbitrum.gains.trade wss://indexer.dydx.trade wss://api-pub.bitfinex.com wss://prices.info-hub.io https://prices.info-hub.io wss://api.hyperliquid.xyz https://api.hyperliquid.xyz",
              "frame-src https://*.tradingview.com",
              "child-src https://*.tradingview.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
}

module.exports = withBundleAnalyzer(withSentryConfig(nextConfig, {
  silent: true,
  disableServerWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  disableClientWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
}));
