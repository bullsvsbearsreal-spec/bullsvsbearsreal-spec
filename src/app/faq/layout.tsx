import { pageMetadata } from '@/lib/seo';
import { ALL_EXCHANGES } from '@/lib/constants';

export const metadata = pageMetadata('/faq');

// Top FAQ entries for structured data (Google rich results)
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is InfoHub?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `InfoHub is a derivatives dashboard that pulls data from ${ALL_EXCHANGES.length} exchanges into one screen. Funding rates, OI, liquidations, screener — instead of opening 30 tabs, you open one.`,
      },
    },
    {
      '@type': 'Question',
      name: 'Which exchanges do you track?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `Currently ${ALL_EXCHANGES.length} exchanges including Binance, Bybit, OKX, Bitget, Hyperliquid, dYdX, and more. Both CEX and DEX are supported.`,
      },
    },
    {
      '@type': 'Question',
      name: 'What is a funding rate?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A periodic payment between longs and shorts on perpetual contracts that keeps the perp price close to spot. Positive rate means longs pay shorts; negative means shorts pay longs. Most exchanges settle every 8 hours.',
      },
    },
    {
      '@type': 'Question',
      name: 'How often is data updated?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Most data refreshes every 30-60 seconds. CVD updates every 15 seconds. Options data every 60 seconds. Timestamps on each page show the last fetch time.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is open interest?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'OI is the total number of open derivative contracts. Rising OI with rising price suggests new money entering long. Falling OI means positions are closing.',
      },
    },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
