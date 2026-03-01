'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ALL_EXCHANGES } from '@/lib/constants';
import { HelpCircle, ChevronDown, Search, X } from 'lucide-react';

/* -- Types --------------------------------------------------------------- */

type FAQCategory = 'General' | 'Data & Features' | 'Trading Concepts' | 'Technical';

interface FAQEntry {
  q: string;
  a: string;
  category: FAQCategory;
}

/* -- FAQ Data ------------------------------------------------------------ */

const faqs: FAQEntry[] = [
  /* ── General ── */
  {
    category: 'General',
    q: 'What is InfoHub?',
    a: `It\u2019s a derivatives dashboard that pulls data from ${ALL_EXCHANGES.length} exchanges into one screen. Funding rates, OI, liquidations, screener \u2014 instead of opening 30 tabs, you open one.`,
  },
  {
    category: 'General',
    q: 'Do I need an account?',
    a: 'No. Most features work without logging in. Create an account to sync your watchlist, alerts, and preferences across devices.',
  },
  {
    category: 'General',
    q: 'Who built this?',
    a: 'A developer and a derivatives trader who got tired of paying $200/month for data that should be free. More on the About page.',
  },
  {
    category: 'General',
    q: 'Do you support mobile?',
    a: 'Yep. Fully responsive \u2014 works on phone, tablet, desktop. All the same features.',
  },
  {
    category: 'General',
    q: 'How can I contribute?',
    a: 'Our GitHub repo is public \u2014 issues and pull requests are welcome. You can also join our Telegram community to discuss features, report bugs, or suggest improvements.',
  },

  /* ── Data & Features ── */
  {
    category: 'Data & Features',
    q: 'What data do you provide?',
    a: 'Funding rates, open interest, liquidations, a screener (RSI, volume, 24h change), CVD, options data (max pain, put/call, IV smile), prediction markets, basis tracking, long/short ratios, whale alerts, and news. We keep adding stuff.',
  },
  {
    category: 'Data & Features',
    q: 'Which exchanges do you track?',
    a: `Currently ${ALL_EXCHANGES.length}: ${ALL_EXCHANGES.join(', ')}. We add new ones regularly \u2014 both CEX and DEX.`,
  },
  {
    category: 'Data & Features',
    q: 'What DEX exchanges do you support?',
    a: 'We currently track Hyperliquid, dYdX, Drift, GMX, Aevo, Lighter, gTrade, and Aster DEX. Each has its own funding mechanism and settlement schedule, all normalized for easy comparison.',
  },
  {
    category: 'Data & Features',
    q: 'How often is data updated?',
    a: 'Most data refreshes every 30\u201360 seconds. CVD updates every 15 seconds. Options data every 60 seconds. The timestamp on each page shows when data was last fetched.',
  },
  {
    category: 'Data & Features',
    q: 'How do I compare rates across exchanges?',
    a: 'The Compare page shows funding for the same coin across every exchange side-by-side. The Arbitrage section on the funding page surfaces the biggest rate differentials automatically.',
  },
  {
    category: 'Data & Features',
    q: 'How does the Screener work?',
    a: 'The Screener lets you filter coins by RSI, 24h volume, 24h price change, and open interest change. You can combine multiple filters to find coins that match specific criteria \u2014 for example, high RSI with rising OI and spiking volume.',
  },
  {
    category: 'Data & Features',
    q: 'Can I set price alerts?',
    a: 'Yes. The Alerts page supports conditions for price, funding rate, open interest, and 24h change. You define the threshold and direction, and you get notified when the condition is met.',
  },
  {
    category: 'Data & Features',
    q: 'How do I track my portfolio?',
    a: 'The Portfolio page lets you add positions and track their P&L. Everything is stored locally in your browser by default. If you create an account, your watchlist and preferences can sync across devices.',
  },

  /* ── Trading Concepts ── */
  {
    category: 'Trading Concepts',
    q: 'What is a funding rate?',
    a: 'It\u2019s a periodic payment between longs and shorts on perp contracts that keeps the perp price close to spot. Positive rate = longs pay shorts (market is bullish/overleveraged long). Negative = shorts pay longs. Most exchanges settle every 8 hours, some hourly.',
  },
  {
    category: 'Trading Concepts',
    q: 'How are funding rates normalized?',
    a: 'All funding rates are converted to an 8-hour basis for comparison. Exchanges that settle hourly (like Drift or Hyperliquid) have their rates multiplied accordingly, so you can compare rates across exchanges without doing the math yourself.',
  },
  {
    category: 'Trading Concepts',
    q: 'What is open interest?',
    a: 'OI is the total number of open derivative contracts. If OI is rising while price goes up, new money is coming in long. If OI drops, positions are closing. It\u2019s one of the best signals for gauging market conviction.',
  },
  {
    category: 'Trading Concepts',
    q: 'What are liquidations?',
    a: 'When a leveraged position loses enough that the exchange force-closes it. Big liquidation cascades can move price fast \u2014 that\u2019s why traders watch them. Our liquidation page shows them in real-time across all exchanges.',
  },
  {
    category: 'Trading Concepts',
    q: 'What is CVD (Cumulative Volume Delta)?',
    a: 'CVD tracks the net difference between buying and selling volume over time. A rising CVD means more aggressive buying pressure; a falling CVD means more selling pressure. It helps you see whether price moves are backed by real demand or just low-liquidity wicks.',
  },
  {
    category: 'Trading Concepts',
    q: 'What is basis tracking?',
    a: 'Basis shows the premium or discount of futures prices relative to spot. A positive basis means futures trade above spot (contango), which is typical in bullish markets. A negative basis (backwardation) often signals bearish sentiment or high demand for shorts.',
  },

  /* ── Technical ── */
  {
    category: 'Technical',
    q: 'Is there an API?',
    a: 'Yes \u2014 check the API Docs page. All endpoints are publicly accessible, no auth required. Just don\u2019t hammer them.',
  },
  {
    category: 'Technical',
    q: 'Does InfoHub store my data?',
    a: 'By default, everything is stored locally in your browser using localStorage. If you create an account, your watchlist and preferences sync to our servers so they persist across devices. If you clear your browser data without an account, those settings will be reset.',
  },
];

/* -- Category config ----------------------------------------------------- */

const CATEGORIES: FAQCategory[] = ['General', 'Data & Features', 'Trading Concepts', 'Technical'];

const categoryDescriptions: Record<FAQCategory, string> = {
  General: 'About InfoHub, pricing, and the team',
  'Data & Features': 'Exchanges, data sources, and platform capabilities',
  'Trading Concepts': 'Funding rates, OI, liquidations, and more',
  Technical: 'API, data storage, and privacy',
};

/* -- FAQ Item Component --------------------------------------------------- */

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={isOpen}
      className="w-full text-left rounded-xl bg-[#0d0d0d] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-200 group"
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <h3 className="text-sm font-semibold text-white group-hover:text-hub-yellow transition-colors">
          {question}
        </h3>
        <ChevronDown
          className={`w-4 h-4 text-neutral-500 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-hub-yellow' : ''
          }`}
        />
      </div>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-xs text-neutral-400 leading-relaxed px-5 pb-4 pr-12">
          {answer}
        </p>
      </div>
    </button>
  );
}

/* -- Category Section Component ------------------------------------------ */

function CategorySection({
  category,
  description,
  items,
  openItems,
  onToggle,
}: {
  category: FAQCategory;
  description: string;
  items: FAQEntry[];
  openItems: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-3 mt-2">
        <h2 className="text-base font-bold text-white">{category}</h2>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
      </div>
      <div className="space-y-2">
        {items.map((faq) => (
          <FAQItem
            key={faq.q}
            question={faq.q}
            answer={faq.a}
            isOpen={openItems.has(faq.q)}
            onToggle={() => onToggle(faq.q)}
          />
        ))}
      </div>
    </section>
  );
}

/* -- Page ---------------------------------------------------------------- */

export default function FAQPage() {
  const [search, setSearch] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredFaqs = useMemo(() => {
    if (!search.trim()) return faqs;
    const terms = search.toLowerCase().trim();
    return faqs.filter(
      (faq) =>
        faq.q.toLowerCase().includes(terms) ||
        faq.a.toLowerCase().includes(terms) ||
        faq.category.toLowerCase().includes(terms)
    );
  }, [search]);

  const groupedByCategory = useMemo(() => {
    const grouped: Record<FAQCategory, FAQEntry[]> = {
      General: [],
      'Data & Features': [],
      'Trading Concepts': [],
      Technical: [],
    };
    for (const faq of filteredFaqs) {
      grouped[faq.category].push(faq);
    }
    return grouped;
  }, [filteredFaqs]);

  const resultCount = filteredFaqs.length;
  const isSearching = search.trim().length > 0;

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
              {faqs.length} answers across {CATEGORIES.length} categories
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-8 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-10 pr-10 py-2.5 text-sm text-white bg-[#111] border border-white/[0.06] rounded-xl placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40 focus:ring-1 focus:ring-hub-yellow/20 transition-all"
          />
          {isSearching && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search result count */}
        {isSearching && (
          <p className="text-xs text-neutral-500 mb-4 -mt-4">
            {resultCount === 0
              ? 'No matching questions found. Try different keywords.'
              : `${resultCount} result${resultCount !== 1 ? 's' : ''} found`}
          </p>
        )}

        {/* FAQ Sections grouped by category */}
        <div className="space-y-8">
          {CATEGORIES.map((category) => (
            <CategorySection
              key={category}
              category={category}
              description={categoryDescriptions[category]}
              items={groupedByCategory[category]}
              openItems={openItems}
              onToggle={toggleItem}
            />
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-10 bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl p-5 text-center">
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
