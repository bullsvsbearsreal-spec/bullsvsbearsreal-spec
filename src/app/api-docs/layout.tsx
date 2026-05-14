import { pageMetadata } from '@/lib/seo';
import { ALL_EXCHANGES } from '@/lib/constants';

export const metadata = pageMetadata('/api-docs');

const apiJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebAPI',
  name: 'InfoHub Crypto Derivatives API',
  description: `REST API for real-time funding rates, open interest, tickers, spreads, liquidations, and arbitrage data across ${ALL_EXCHANGES.length} exchanges.`,
  url: 'https://info-hub.io/api-docs',
  provider: {
    '@type': 'Organization',
    name: 'InfoHub',
    url: 'https://info-hub.io',
  },
  documentation: 'https://info-hub.io/api-docs',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(apiJsonLd) }}
      />
      {children}
    </>
  );
}
