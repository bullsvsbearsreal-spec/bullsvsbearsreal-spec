/**
 * Competitor comparison table — landing-page conversion lift.
 *
 * Renders a sticky-header table comparing InfoHub against the three
 * crypto-derivatives data tools most ad-clicks will recognise:
 * CoinGlass, Laevitas, CoinAnk. The pitch is the FEATURE STACK at
 * the FREE tier — every cell either says "Free", "Paid", or "—" and
 * shows InfoHub-first ordering so the comparison reads in our favour
 * across the row.
 *
 * Honest disclosure: numbers reflect each competitor's current free
 * tier as of May 2026 per public pricing pages. Re-verify quarterly
 * — competitor pricing rotates and we don't want to ship a lie that
 * outdates and damages credibility.
 */

import Link from 'next/link';
import { ALL_EXCHANGES } from '@/lib/constants/exchanges';
import { TIER_PRICE_MONTHLY } from '@/lib/constants/tiers';
import { Check, X as XIcon, ExternalLink } from 'lucide-react';

type Cell = boolean | string;

interface Row {
  feature: string;
  detail?: string;
  values: { infohub: Cell; coinglass: Cell; laevitas: Cell; coinank: Cell };
}

const COMPARISON_ROWS: Row[] = [
  {
    feature: 'Free tier',
    detail: 'Card not required',
    values: { infohub: true, coinglass: true, laevitas: 'Limited', coinank: true },
  },
  {
    feature: 'Funding-rate scanner',
    values: { infohub: `${ALL_EXCHANGES.length} exchanges`, coinglass: '14 exchanges', laevitas: 'Premium', coinank: '8 exchanges' },
  },
  {
    feature: 'Cross-venue funding arb pair grader (A→D)',
    values: { infohub: 'Free', coinglass: false, laevitas: false, coinank: false },
  },
  {
    feature: 'Spreads + fee-aware net APR',
    values: { infohub: 'Free', coinglass: 'Premium', laevitas: 'Premium', coinank: false },
  },
  {
    feature: 'Hyperliquid whales (live positions)',
    values: { infohub: 'Free', coinglass: false, laevitas: false, coinank: 'Limited' },
  },
  {
    feature: 'Open Interest aggregator',
    values: { infohub: 'Free', coinglass: 'Free', laevitas: 'Premium', coinank: 'Free' },
  },
  {
    feature: 'Liquidation feed + heatmap',
    values: { infohub: 'Free', coinglass: 'Free', laevitas: false, coinank: 'Free' },
  },
  {
    feature: 'Personal alerts (price / funding / OI)',
    values: { infohub: '5 free · 75 Pro', coinglass: 'Premium', laevitas: 'Premium', coinank: 'Premium' },
  },
  {
    feature: 'Telegram bot delivery',
    values: { infohub: 'Free', coinglass: false, laevitas: false, coinank: false },
  },
  {
    feature: 'Wallet watch (HL + gTrade)',
    values: { infohub: '10 free · 200 Pro', coinglass: false, laevitas: false, coinank: false },
  },
  {
    feature: 'Public REST API',
    values: { infohub: '100/min free · OpenAPI 3.1', coinglass: 'Paid only', laevitas: 'Enterprise', coinank: false },
  },
  {
    feature: 'Affiliate program',
    values: { infohub: '20% lifetime · USDT', coinglass: 'Variable', laevitas: false, coinank: false },
  },
  {
    feature: 'Starting paid tier (monthly)',
    // InfoHub price derived from TIER_PRICE_MONTHLY so the table can't
    // silently drift behind a future Trader-tier price change.
    values: { infohub: `$${TIER_PRICE_MONTHLY.trader}`, coinglass: '$29', laevitas: '$99', coinank: '$25' },
  },
];

function FeatureCell({ value, accent }: { value: Cell; accent?: 'pro' | 'neutral' }) {
  if (value === true) {
    return <Check className={`w-4 h-4 mx-auto ${accent === 'pro' ? 'text-emerald-400' : 'text-emerald-300'}`} aria-label="Included" />;
  }
  if (value === false) {
    return <XIcon className="w-4 h-4 mx-auto text-neutral-700" aria-label="Not included" />;
  }
  // String value — colour Free / Premium / specific numbers differently
  const lower = value.toLowerCase();
  const cls =
    accent === 'pro' && lower === 'free' ? 'text-emerald-300 font-semibold'
    : lower === 'free' ? 'text-emerald-300'
    : lower === 'premium' || lower === 'paid only' || lower === 'enterprise' ? 'text-amber-400 text-[10px]'
    : 'text-neutral-200';
  return <span className={`font-mono ${cls}`}>{value}</span>;
}

export default function CompetitorComparison() {
  return (
    <section
      aria-label="InfoHub vs CoinGlass vs Laevitas vs CoinAnk feature comparison"
      style={{
        background: 'var(--hub-bg-subtle, rgba(255,255,255,0.01))',
        border: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.06))',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-default, #fff)' }}>
          InfoHub vs the rest
        </h2>
        <Link
          href="/pricing"
          style={{ fontSize: 11, color: 'var(--hub-accent)', textDecoration: 'none' }}
          className="hover:underline"
        >
          See full pricing →
        </Link>
      </div>
      <p style={{ fontSize: 12, color: 'var(--fg-muted, #a3a3a3)', marginBottom: 12, lineHeight: 1.5 }}>
        Most crypto-data tools paywall the features you actually use to trade.
        InfoHub keeps the data terminal free — funding, OI, liquidations, charts,
        whales — and only charges for the power-user layer.
      </p>

      <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
        <table className="w-full text-[12px] min-w-[680px]">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/[0.06]">
              <th scope="col" className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold sticky left-0 bg-hub-darker">
                Feature
              </th>
              <th scope="col" className="px-3 py-2.5 text-center bg-hub-yellow/[0.07]">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-hub-yellow uppercase tracking-wider">
                  InfoHub
                </div>
              </th>
              <th scope="col" className="px-3 py-2.5 text-center">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  CoinGlass
                </div>
              </th>
              <th scope="col" className="px-3 py-2.5 text-center">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Laevitas
                </div>
              </th>
              <th scope="col" className="px-3 py-2.5 text-center">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  CoinAnk
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, i) => {
              const stripe = i % 2 === 0;
              return (
                <tr
                  key={row.feature}
                  className={`border-b border-white/[0.04] ${stripe ? '' : 'bg-white/[0.01]'}`}
                >
                  <th
                    scope="row"
                    className={`px-3 py-2 text-neutral-200 font-normal text-left sticky left-0 ${
                      stripe ? 'bg-hub-black' : 'bg-hub-dark'
                    }`}
                  >
                    <div>{row.feature}</div>
                    {row.detail && <div className="text-[10px] text-neutral-500 font-normal mt-0.5">{row.detail}</div>}
                  </th>
                  <td className="px-3 py-2 text-center bg-hub-yellow/[0.05]">
                    <FeatureCell value={row.values.infohub} accent="pro" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <FeatureCell value={row.values.coinglass} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <FeatureCell value={row.values.laevitas} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <FeatureCell value={row.values.coinank} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 10, color: 'var(--fg-subtle, #737373)', marginTop: 8, lineHeight: 1.5 }}>
        Comparison reflects each tool&apos;s public free-tier features and pricing as of May 2026.
        Things change — re-verify directly from each provider&apos;s site before making a decision.
      </p>
    </section>
  );
}
