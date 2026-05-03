import type { Metadata } from 'next';

/**
 * Per-address OG metadata — auto-generates a rekt card image URL per wallet
 * so Twitter / Telegram / Discord / Farcaster unfurl with a custom preview.
 */
export async function generateMetadata(
  { params }: { params: { address: string } },
): Promise<Metadata> {
  const address = (params.address || '').toLowerCase();
  const title = `Rekt Profile · ${address.slice(0, 6)}…${address.slice(-4)} | InfoHub`;
  const description = 'Hyperliquid liquidation history for this wallet, scored 0-1000 by bounce.tech. Check the tier, rank, notional, and rarest asset.';
  const ogImage = `https://info-hub.io/api/og/rekt/${address}`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://info-hub.io/bounce/${address}`,
    },
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
