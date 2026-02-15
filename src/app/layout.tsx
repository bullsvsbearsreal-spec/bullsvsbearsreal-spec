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
  title: 'InfoHub | Free Real-Time Derivatives Data',
  description: 'Free real-time funding rates, open interest, liquidations, and arbitrage tools across 21 exchanges (15 CEX + 6 DEX). Multi-asset: crypto, stocks, forex, commodities. Free API included.',
  keywords: [
    'funding rates', 'funding rate arbitrage', 'open interest', 'liquidations',
    'derivatives data', 'perpetual futures', 'DEX funding rates', 'free crypto API',
    'coinglass alternative', 'trading data', 'market analytics',
  ],
  authors: [{ name: 'InfoHub' }],
  creator: 'InfoHub',
  publisher: 'InfoHub',

  // Favicon and icons
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.svg', type: 'image/svg+xml' },
    ],
  },

  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://info-hub.io',
    siteName: 'InfoHub',
    title: 'InfoHub | Free Real-Time Derivatives Data',
    description: 'Free funding rates, open interest, liquidations & arbitrage across 21 exchanges (15 CEX + 6 DEX). Multi-asset: crypto, stocks, forex, commodities. No signup, free API.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'InfoHub - Free Real-Time Derivatives Data Across 21 Exchanges',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'InfoHub | Free Real-Time Derivatives Data',
    description: 'Free funding rates, arbitrage tools, OI & liquidations across 21 exchanges (15 CEX + 6 DEX). No signup required. Free API.',
    images: ['/og-image.svg'],
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
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        {/* Prevent FOUC: apply saved theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('infohub-theme');if(t==='green'||t==='blue')document.documentElement.dataset.theme=t}catch(e){}` }} />
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
