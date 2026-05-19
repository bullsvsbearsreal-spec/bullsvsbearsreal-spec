import type { Metadata } from 'next';
import { ALL_EXCHANGES } from '@/lib/constants';

interface Props {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  // Derive counts from constants so the meta title doesn't go stale
  // when a venue is added or removed. Was 'Across 33 Exchanges' but
  // the actual count is 32 — the meta has been wrong since Drift was
  // removed in Apr 2026.
  const total = ALL_EXCHANGES.length;
  const namedCount = 4;  // Binance, Bybit, OKX, Hyperliquid
  const title = `${sym} Funding Rates Across ${total} Exchanges`;
  const description = `Live ${sym} perpetual futures funding rates compared across Binance, Bybit, OKX, Hyperliquid, and ${total - namedCount} more exchanges. Track funding history, find arbitrage opportunities.`;

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
