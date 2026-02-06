import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

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
  title: 'InfoHub | Real-Time Trading Data',
  description: 'Your one-stop destination for real-time trading data. Funding rates, open interest, liquidations, and market analytics across 6 major exchanges.',
  keywords: ['trading', 'funding rates', 'open interest', 'liquidations', 'market data', 'derivatives', 'perpetuals'],
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
    title: 'InfoHub | Real-Time Trading Data',
    description: 'Your one-stop destination for real-time trading data. Funding rates, open interest, liquidations, and market analytics across 6 major exchanges.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'InfoHub - Real-Time Trading Data',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'InfoHub | Real-Time Trading Data',
    description: 'Your one-stop destination for real-time trading data across 6 major exchanges.',
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
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans bg-hub-black text-white min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}
