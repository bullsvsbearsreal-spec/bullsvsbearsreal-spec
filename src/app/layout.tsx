import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
// ChatWidget hidden for now per user request — re-enable by importing + rendering
// const ChatWidget = dynamic(() => import('@/components/chat/ChatWidget'), { ssr: false })
import AlertEngine from '@/components/AlertEngine'
import { ALL_EXCHANGES } from '@/lib/constants'
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
        url: '/api/og',
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
    images: ['/api/og'],
    creator: '@infohub',
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

// JSON-LD structured data for search engines (site-wide)
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': 'https://info-hub.io/#app',
      name: 'InfoHub',
      url: 'https://info-hub.io',
      description: `Real-time funding rates, open interest, liquidations, and arbitrage tools across ${ALL_EXCHANGES.length}+ cryptocurrency exchanges (CEX + DEX). Multi-asset coverage including crypto, stocks, forex, and commodities.`,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser with JavaScript enabled',
      softwareVersion: '2.0',
      featureList: [
        'Real-time funding rates across 33 exchanges',
        'Open interest aggregation and tracking',
        'Liquidation heatmaps and alerts',
        'Funding rate arbitrage calculator',
        'Multi-asset support: crypto, stocks, forex, commodities',
        'CEX and DEX coverage',
        'Customizable alerts and notifications',
        'Historical data and charts',
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
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://info-hub.io/#website',
      url: 'https://info-hub.io',
      name: 'InfoHub',
      publisher: { '@id': 'https://info-hub.io/#org' },
      description: `Real-time crypto derivatives dashboard aggregating data from ${ALL_EXCHANGES.length}+ exchanges.`,
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
        {/* Prevent FOUC: apply saved theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('infohub-theme');if(t==='light')document.documentElement.dataset.theme=t}catch(e){}` }} />
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
        </Providers>
      </body>
    </html>
  )
}
