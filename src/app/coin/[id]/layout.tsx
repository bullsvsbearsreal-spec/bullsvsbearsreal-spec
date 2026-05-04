import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const name = id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
  const title = `${name} Price, Events & Market Data`;
  const description = `Live ${name} price, market cap, trading volume, upcoming events, and token unlocks. Track ${name} across 32 exchanges on InfoHub.`;

  return {
    title,
    description,
    alternates: { canonical: `https://info-hub.io/coin/${id}` },
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
