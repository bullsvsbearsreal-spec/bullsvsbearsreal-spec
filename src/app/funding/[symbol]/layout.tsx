import type { Metadata } from 'next';

interface Props {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  const title = `${sym} Funding Rates Across 30+ Exchanges`;
  const description = `Live ${sym} perpetual futures funding rates compared across Binance, Bybit, OKX, Hyperliquid, and 26+ more exchanges. Track funding history, find arbitrage opportunities.`;

  return {
    title,
    description,
    alternates: { canonical: `https://info-hub.io/funding/${sym}` },
    openGraph: {
      title: `${title} | InfoHub`,
      description,
      images: [`/api/og?title=${encodeURIComponent(title)}&desc=${encodeURIComponent(description)}`],
    },
    twitter: {
      title: `${title} | InfoHub`,
      description,
      images: [`/api/og?title=${encodeURIComponent(title)}&desc=${encodeURIComponent(description)}`],
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
