const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

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
