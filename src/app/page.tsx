import HomeOrange from './HomeOrange';

// JSON-LD structured data for search engines
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'InfoHub',
  url: 'https://info-hub.io',
  description: 'Real-time funding rates, open interest, liquidations, and arbitrage tools across 30+ crypto exchanges.',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeOrange />
    </>
  );
}
