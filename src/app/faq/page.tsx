'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ALL_EXCHANGES } from '@/lib/constants';
import { HelpCircle, ChevronDown } from 'lucide-react';

/* -- FAQ Data ------------------------------------------------------------ */

const faqs = [
  {
    q: 'What is InfoHub?',
    a: `It\u2019s a derivatives dashboard that pulls data from ${ALL_EXCHANGES.length} exchanges into one screen. Funding rates, OI, liquidations, screener \u2014 instead of opening 30 tabs, you open one.`,
  },
  {
    q: 'What data do you provide?',
    a: 'Funding rates, open interest, liquidations, a screener (RSI, volume, 24h change), CVD, options data (max pain, put/call, IV smile), prediction markets, basis tracking, long/short ratios, whale alerts, and news. We keep adding stuff.',
  },
  {
    q: 'Which exchanges do you track?',
    a: `Currently ${ALL_EXCHANGES.length}: ${ALL_EXCHANGES.join(', ')}. We add new ones regularly \u2014 both CEX and DEX.`,
  },
  {
    q: 'Is InfoHub free?',
    a: 'Yes. No login, no account, no paywall. Just open it and use it.',
  },
  {
    q: 'How often is data updated?',
    a: 'Most data refreshes every 30\u201360 seconds. CVD updates every 15 seconds. Options data every 60 seconds. The timestamp on each page shows when data was last fetched.',
  },
  {
    q: 'What is a funding rate?',
    a: 'It\u2019s a periodic payment between longs and shorts on perp contracts that keeps the perp price close to spot. Positive rate = longs pay shorts (market is bullish/overleveraged long). Negative = shorts pay longs. Most exchanges settle every 8 hours, some hourly.',
  },
  {
    q: 'What is open interest?',
    a: 'OI is the total number of open derivative contracts. If OI is rising while price goes up, new money is coming in long. If OI drops, positions are closing. It\u2019s one of the best signals for gauging market conviction.',
  },
  {
    q: 'What are liquidations?',
    a: 'When a leveraged position loses enough that the exchange force-closes it. Big liquidation cascades can move price fast \u2014 that\u2019s why traders watch them. Our liquidation page shows them in real-time across all exchanges.',
  },
  {
    q: 'How do I compare rates across exchanges?',
    a: 'The Compare page shows funding for the same coin across every exchange side-by-side. The Arbitrage section on the funding page surfaces the biggest rate differentials automatically.',
  },
  {
    q: 'Is there an API?',
    a: 'Yes \u2014 check the API Docs page. All endpoints are free, no auth required. Just don\u2019t hammer them.',
  },
  {
    q: 'Do you support mobile?',
    a: 'Yep. Fully responsive \u2014 works on phone, tablet, desktop. All the same features.',
  },
  {
    q: 'Who built this?',
    a: 'A couple of traders who got tired of switching between exchange tabs. Check the Team page.',
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
          <h2 className="text-sm font-bold text-white mb-1">Something missing?</h2>
          <p className="text-xs text-neutral-400 mb-3">
            Drop us a line. We actually read these.
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
