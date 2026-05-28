import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
// ChatWidget hidden for now per user request — re-enable by importing + rendering
// const ChatWidget = dynamic(() => import('@/components/chat/ChatWidget'), { ssr: false })
import AlertEngine from '@/components/AlertEngine'
import ReportBugButton from '@/components/ReportBugButton'
import PageViewBeacon from '@/components/PageViewBeacon'
import { ALL_EXCHANGES, DEX_EXCHANGES } from '@/lib/constants'
import { FREE_TIER_PER_MINUTE, FREE_TIER_PER_DAY } from '@/lib/api/rate-limit'
import { ConditionalTerminalShell } from '@/components/design-system'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FFA500',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://info-hub.io'),
  title: {
    default: 'InfoHub | Real-Time Crypto Derivatives Dashboard',
    template: '%s | InfoHub',
  },
  description: `Real-time funding rates, open interest, liquidations, and arbitrage tools across ${ALL_EXCHANGES.length}+ exchanges (CEX + DEX). Multi-asset: crypto, stocks, forex, commodities.`,
  keywords: [
    'funding rates', 'funding rate arbitrage', 'open interest', 'liquidations',
    'derivatives data', 'perpetual futures', 'DEX funding rates', 'crypto API',
    'trading data', 'market analytics',
  ],
  authors: [{ name: 'InfoHub' }],
  creator: 'InfoHub',
  publisher: 'InfoHub',

  // Favicon and icons
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' },
    ],
  },

  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://info-hub.io',
    siteName: 'InfoHub',
    title: 'InfoHub | Real-Time Derivatives Data',
    description: `Real-time funding rates, open interest, liquidations & arbitrage across ${ALL_EXCHANGES.length}+ exchanges (CEX + DEX). Multi-asset: crypto, stocks, forex, commodities.`,
    images: [
      {
        // Site-wide OG (root URL share, fallback when a child page has
        // no per-page metadata) — uses the live-data 'tape' hero. Most
        // child pages override this with their own page-aware chrome
        // image via PAGE_META.
        url: '/api/og?v=tape',
        width: 1200,
        height: 630,
        alt: `InfoHub - Real-Time Derivatives Data Across ${ALL_EXCHANGES.length}+ Exchanges`,
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'InfoHub | Real-Time Derivatives Data',
    description: `Real-time funding rates, arbitrage tools, OI & liquidations across ${ALL_EXCHANGES.length}+ exchanges (CEX + DEX).`,
    images: ['/api/og?v=tape'],
    creator: '@info_hub69',
    site: '@info_hub69',
  },

  // Canonical & alternates
  alternates: {
    canonical: 'https://info-hub.io',
  },

  // Category
  category: 'finance',

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Additional meta
  other: {
    'application-name': 'InfoHub',
  },
}

// JSON-LD structured data for search engines (site-wide).
// Three @graph nodes that link to each other:
//   #app      — WebApplication (the dashboard product)
//   #api      — WebAPI (the partner-facing REST API)
//   #org      — Organization (publisher, with social profiles)
//   #website  — WebSite (with sitelinks search box action)
//
// Linking via @id lets Google merge the entities into one Knowledge
// Panel result; helps with the brand-mindshare gap vs Coinglass.
// Derive CEX/DEX breakdown from constants so the WebApplication
// description stays correct when a new venue is wired in. Hardcoded
// literals like "18 CEX + 14 DEX" go stale silently — the search
// result keeps showing the old number until someone notices.
const DEX_COUNT = DEX_EXCHANGES.size;
const CEX_COUNT = ALL_EXCHANGES.length - DEX_COUNT;

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': 'https://info-hub.io/#app',
      name: 'InfoHub',
      url: 'https://info-hub.io',
      description: `Real-time crypto derivatives dashboard: funding rates, open interest, liquidations, on-chain whales, and fee-aware arbitrage tools across ${ALL_EXCHANGES.length} exchanges (${CEX_COUNT} CEX + ${DEX_COUNT} DEX).`,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser with JavaScript enabled',
      softwareVersion: '2.0',
      featureList: [
        `Real-time funding rates across ${ALL_EXCHANGES.length} exchanges`,
        'Open interest aggregation and 24h change tracking',
        'Liquidation heatmap + real-time WebSocket feed',
        'Fee-aware funding-rate arbitrage scanner with A-D grading',
        'Cross-exchange spread scanner with net-of-fees calculation',
        'Bitcoin halving countdown',
        'Long/short ratio with regime classifier',
        'Options data: max pain, IV smile, put/call ratio',
        'On-chain DEX whale trade feed + Hyperliquid liquidation roulette',
        'Smart money leaderboard ranked by 90-day realized PnL',
        'Wallet Alerts — multi-venue position alerter (HL + gTrade)',
        'TradingView chart with 6 terminal info-bands',
        'Multi-asset support: crypto, stocks, forex, commodities',
      ],
      screenshot: {
        '@type': 'ImageObject',
        url: 'https://info-hub.io/api/og',
        width: 1200,
        height: 630,
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      creator: { '@id': 'https://info-hub.io/#org' },
      publisher: { '@id': 'https://info-hub.io/#org' },
    },
    {
      '@type': 'WebAPI',
      '@id': 'https://info-hub.io/#api',
      name: 'InfoHub Public API',
      url: 'https://info-hub.io/developers',
      description: `REST API for crypto derivatives data: 26 endpoints across ${ALL_EXCHANGES.length} exchanges with fee transparency, aggregate modes, and OpenAPI 3.1 spec. Free tier ${FREE_TIER_PER_MINUTE} req/min, ${FREE_TIER_PER_DAY.toLocaleString()} req/day.`,
      documentation: 'https://info-hub.io/developers/docs',
      provider: { '@id': 'https://info-hub.io/#org' },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        description: `Free tier — ${FREE_TIER_PER_MINUTE} req/min, ${FREE_TIER_PER_DAY.toLocaleString()} req/day, no credit card required`,
      },
    },
    {
      '@type': 'Organization',
      '@id': 'https://info-hub.io/#org',
      name: 'InfoHub',
      url: 'https://info-hub.io',
      logo: {
        '@type': 'ImageObject',
        url: 'https://info-hub.io/icon-512.png',
        width: 512,
        height: 512,
      },
      sameAs: [
        'https://t.me/info_hub69',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://info-hub.io/#website',
      url: 'https://info-hub.io',
      name: 'InfoHub',
      publisher: { '@id': 'https://info-hub.io/#org' },
      description: `Real-time crypto derivatives dashboard aggregating data from ${ALL_EXCHANGES.length} exchanges. Free tools for traders.`,
      // Sitelinks search box — lets Google show an in-result search bar
      // for site queries directly in the SERP. Resolves to /symbol/<X>.
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://info-hub.io/symbol/{search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f1117" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Preconnect to the aggregator (used by the StatusBar venue
            counter + StreamStatusBadge + the chart's CryptoMetricsPanel)
            so the TCP/TLS handshake is already warm before the first
            useAggregatorHealth poll fires. Cuts ~100-200ms off the
            first /health fetch on cold loads. dns-prefetch is a cheap
            fallback for browsers that skip preconnect. */}
        <link rel="preconnect" href="https://prices.info-hub.io" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://prices.info-hub.io" />
        {/* Prevent FOUC: apply saved theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('infohub-theme');if(t==='light')document.documentElement.dataset.theme=t}catch(e){}` }} />
        {/* Umami analytics tracker — privacy-friendly, no cookies, no
            PII. Only renders when the env vars are configured so dev /
            preview builds don't ping prod. The admin + marketing panels
            consume the same data via /api/admin/analytics (server-side
            proxy with the API token). */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && process.env.NEXT_PUBLIC_UMAMI_HOST && (
          <script
            defer
            src={`${process.env.NEXT_PUBLIC_UMAMI_HOST}/script.js`}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          />
        )}
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans bg-hub-black min-h-screen antialiased`} style={{ color: 'var(--fg-default)' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <Providers>
          <ConditionalTerminalShell>{children}</ConditionalTerminalShell>
          {/* ChatWidget hidden for now per user request — re-enable by uncommenting */}
          {/* <ChatWidget /> */}
          <AlertEngine />
          {/* Per-page bug report widget — small floating pill in bottom-right.
              Users can dismiss permanently per-device via localStorage. */}
          <ReportBugButton />
          {/* Anonymous page-view beacon. Posts the current pathname to
              /api/track-page-view on every route change — populates the
              page_views rollup the admin Growth tab reads from. */}
          <PageViewBeacon />
        </Providers>
      </body>
    </html>
  )
}
