import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import ChatWidget from '@/components/chat/ChatWidget'
import AlertEngine from '@/components/AlertEngine'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

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
  description: 'Real-time funding rates, open interest, liquidations, and arbitrage tools across 24+ exchanges (CEX + DEX). Multi-asset: crypto, stocks, forex, commodities.',
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
    description: 'Real-time funding rates, open interest, liquidations & arbitrage across 24+ exchanges (CEX + DEX). Multi-asset: crypto, stocks, forex, commodities.',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'InfoHub - Real-Time Derivatives Data Across 24+ Exchanges',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'InfoHub | Real-Time Derivatives Data',
    description: 'Real-time funding rates, arbitrage tools, OI & liquidations across 24+ exchanges (CEX + DEX).',
    images: ['/api/og'],
    creator: '@infohub',
  },

  // Robots
  robots: {
    index: true,
    follow: true,
  },
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
        {/* Prevent FOUC: apply saved theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('infohub-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans bg-hub-black text-white min-h-screen antialiased`}>
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        {children}
        <ChatWidget />
        <AlertEngine />
      </body>
    </html>
  )
}
