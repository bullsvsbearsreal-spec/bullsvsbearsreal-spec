import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'InfoHub | The Ultimate Trading Data Platform',
  description: 'Your one-stop shop for all trading data - Funding rates, liquidations, charts, economic calendar, and more across CEX and DEX platforms.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans bg-hub-black text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
