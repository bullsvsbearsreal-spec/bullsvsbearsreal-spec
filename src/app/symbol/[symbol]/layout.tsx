import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { symbol: string } }): Promise<Metadata> {
  const symbol = params.symbol?.toUpperCase() || 'BTC';
  const title = `${symbol} Trading Dashboard`;
  const description = `Real-time ${symbol}/USDT price charts, funding rates, open interest, and volume across 24+ exchanges.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | InfoHub`,
      description,
      images: [`/api/og?title=${encodeURIComponent(`${symbol} Dashboard`)}&desc=${encodeURIComponent(description)}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | InfoHub`,
      description,
      images: [`/api/og?title=${encodeURIComponent(`${symbol} Dashboard`)}&desc=${encodeURIComponent(description)}`],
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
