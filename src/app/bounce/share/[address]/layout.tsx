import type { Metadata } from 'next';

export async function generateMetadata(
  { params }: { params: { address: string } },
): Promise<Metadata> {
  const address = (params.address || '').toLowerCase();
  const title = `Share Rekt Card · ${address.slice(0, 6)}…${address.slice(-4)} | InfoHub`;
  const description = 'Download or share this wallet\'s rekt card as a 1200×630 image. Auto-unfurls on X, Telegram, Discord, Farcaster.';
  const ogImage = `https://info-hub.io/api/og/rekt/${address}`;
  return {
    title,
    description,
    alternates: { canonical: `https://info-hub.io/bounce/share/${address}` },
    openGraph: { title, description, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
