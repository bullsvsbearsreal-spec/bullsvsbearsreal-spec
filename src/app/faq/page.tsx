'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { HelpCircle, ChevronDown } from 'lucide-react';

/* -- FAQ Data ------------------------------------------------------------ */

const faqs = [
  {
    q: 'What is InfoHub?',
    a: 'InfoHub is a real-time cryptocurrency derivatives dashboard that aggregates data from 20+ exchanges into a single, unified interface. It gives traders instant visibility into funding rates, open interest, liquidations, and more \u2014 without needing to open dozens of tabs.',
  },
  {
    q: 'What data do you provide?',
    a: 'InfoHub covers funding rates, open interest, liquidations, a screener with RSI and volume data, cumulative volume delta (CVD), options data (max pain, put/call ratio, IV smile), prediction markets, basis/premium tracking, and aggregated crypto news. New features are added regularly.',
  },
  {
    q: 'Which exchanges do you track?',
    a: 'We aggregate data from Binance, Bybit, OKX, Bitget, MEXC, Kraken, BingX, Phemex, Hyperliquid, dYdX, Aster DEX, Lighter, Aevo, Drift, GMX, KuCoin, Deribit, HTX, Bitfinex, WhiteBIT, Coinbase, CoinEx, gTrade, and Bitunix. More are added over time.',
  },
  {
    q: 'Is InfoHub free?',
    a: 'Yes, InfoHub is completely free to use. There is no login, no account required, and no paywall. All features are available to everyone.',
  },
  {
    q: 'How often is data updated?',
    a: 'Data is updated in real-time, with most endpoints polling every 30\u201360 seconds depending on the data type. Aggregate trades (CVD) refresh every 15 seconds. Options data refreshes every 60 seconds.',
  },
  {
    q: 'What is a funding rate?',
    a: 'Funding rates are periodic payments between long and short traders on perpetual futures contracts. They keep the perpetual price anchored to the spot price. A positive funding rate means longs pay shorts (bullish market), while a negative rate means shorts pay longs (bearish market). Funding is typically settled every 8 hours on most exchanges.',
  },
  {
    q: 'What is open interest?',
    a: 'Open interest (OI) is the total number of outstanding derivative contracts (futures/perpetuals) that have not been settled. Rising OI with rising price suggests new money entering long positions. Falling OI suggests positions are being closed.',
  },
  {
    q: 'What are liquidations?',
    a: 'Liquidations occur when a leveraged trading position is forcibly closed by the exchange because the trader\u2019s margin balance falls below the maintenance requirement. Large cascading liquidations can amplify price moves and are a key signal for traders.',
  },
  {
    q: 'How do I compare rates across exchanges?',
    a: 'Use the Compare page to view funding rates for the same asset side-by-side across every exchange we track. The Arbitrage section on the funding page highlights the best funding rate differentials for cross-exchange strategies.',
  },
  {
    q: 'Is there an API?',
    a: 'A public API is not currently available, but it is planned for the future. Stay tuned for updates.',
  },
  {
    q: 'Do you support mobile?',
    a: 'Yes. InfoHub is fully responsive and designed to work on phones, tablets, and desktop browsers. All features are accessible on mobile.',
  },
  {
    q: 'Who built InfoHub?',
    a: 'InfoHub was built by a small team of crypto traders and developers who wanted a single dashboard for all the derivatives data they needed. The project is actively maintained and growing.',
  },
];

/* -- FAQ Item Component --------------------------------------------------- */

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      onClick={() => setOpen(!open)}
      className="card-premium w-full text-left px-5 py-4 group"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-white group-hover:text-hub-yellow transition-colors">
          {question}
        </h3>
        <ChevronDown
          className={`w-4 h-4 text-neutral-500 flex-shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-hub-yellow' : ''
          }`}
        />
      </div>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-xs text-neutral-400 leading-relaxed pr-8">{answer}</p>
      </div>
    </button>
  );
}

/* -- Page ---------------------------------------------------------------- */

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
            <HelpCircle className="w-4 h-4 text-hub-yellow" />
          </div>
          <div>
            <h1 className="heading-page">Frequently Asked Questions</h1>
            <p className="text-neutral-500 text-sm mt-0.5">
              Everything you need to know about InfoHub
            </p>
          </div>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {faqs.map((faq) => (
            <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-8 bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl p-5 text-center">
          <h2 className="text-sm font-bold text-white mb-1">Still have questions?</h2>
          <p className="text-xs text-neutral-400 mb-3">
            Reach out and we will get back to you as soon as possible.
          </p>
          <a
            href="mailto:contact@info-hub.io"
            className="inline-flex items-center gap-2 px-4 py-2 bg-hub-yellow text-black font-semibold text-xs rounded-md hover:bg-hub-yellow/90 transition-all"
          >
            Contact Us
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
