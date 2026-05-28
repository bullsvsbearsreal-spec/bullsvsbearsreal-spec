import type { Metadata } from 'next';

// Per-page metadata for the public trader-profile page. page.tsx is a
// client component (uses hooks for live data), so this layout carries
// the metadata. Dynamic title with the truncated address so social
// share previews actually identify which trader is being shared.
//
// Without this, every /trader/0x... URL got the generic site title
// "InfoHub | Real-Time Crypto Derivatives Dashboard" which made
// Twitter/Telegram/Discord shares look identical regardless of trader.
export function generateMetadata({ params }: { params: { address: string } }): Metadata {
  const addr = params.address || '';
  const short = addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
  return {
    title: `Trader ${short}`,
    description: `Live positions, PnL, and copy signal for ${short} across Hyperliquid, GMX, and gTrade. Live position sizes, leverage, liq distance, realized PnL.`,
    alternates: { canonical: `https://info-hub.io/trader/${addr}` },
    openGraph: {
      title: `Trader ${short} · InfoHub`,
      description: `Live positions + copy signal across HL / GMX / gTrade for ${short}`,
      url: `https://info-hub.io/trader/${addr}`,
    },
  };
}

export default function TraderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
