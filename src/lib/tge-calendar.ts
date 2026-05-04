/**
 * Curated upcoming Token Generation Events (TGE) / mainnet launches.
 *
 * Why curated and not API-driven: there's no clean free TGE source. CryptoRank,
 * ICO Drops, DropsTab all gate this behind their own scrapers/auth. Hand-curated
 * is honest and lets us surface what actually matters (real projects with FDV
 * estimates, real chains, real vesting cliffs) rather than every memecoin
 * presale.
 *
 * Update cadence: maintainer reviews monthly. If a date passes, the entry
 * remains for 14 days as "Recently launched" then is removed.
 *
 * To add an entry: append to UPCOMING_TGES below. Required fields documented
 * in the TgeEntry interface.
 */

export interface TgeEntry {
  /** Display name (e.g. "Monad", "Plasma", "Berachain"). */
  name: string;
  /** Ticker symbol if known, else null. */
  symbol: string | null;
  /**
   * Launch date in ISO 8601 (YYYY-MM-DD). For TBD-but-imminent put a
   * conservative placeholder + set `dateTbd: true`.
   */
  date: string;
  /** Set true if `date` is a placeholder pending confirmation. */
  dateTbd?: boolean;
  /** Chain of issuance (e.g. "Ethereum", "Solana", "L1 of own"). */
  chain: string;
  /** Category: 'L1' | 'L2' | 'DeFi' | 'AI' | 'Infra' | 'RWA' | 'Memes' | 'Gaming' | 'Social' | 'DePIN' | 'Other' */
  category: string;
  /** Estimated fully-diluted valuation in USD. Null if unknown. */
  fdvUsd: number | null;
  /** % of supply unlocking at TGE (circulating at launch). Null if unknown. */
  initialCirc: number | null;
  /** Vesting cliff for team/investors in months. Null if unknown. */
  vestingCliffMonths: number | null;
  /** Short pitch (one sentence, max ~120 chars). */
  description: string;
  /** Project URL. */
  website: string | null;
  /** Twitter/X handle (no @). */
  twitter?: string;
  /** Funding raised so far in USD, optional. */
  fundingRaised?: number;
}

/**
 * 30-day rolling window. Maintainer should review and prune monthly.
 * Last reviewed: 2026-05-04
 */
export const UPCOMING_TGES: TgeEntry[] = [
  {
    name: 'Eclipse',
    symbol: 'ES',
    date: '2026-05-15',
    chain: 'Eclipse L2',
    category: 'L2',
    fdvUsd: 2_500_000_000,
    initialCirc: 12,
    vestingCliffMonths: 12,
    description: 'Solana-VM rollup on Ethereum. SVM execution + ETH security thesis.',
    website: 'https://www.eclipse.xyz',
    twitter: 'EclipseFND',
    fundingRaised: 65_000_000,
  },
  {
    name: 'MegaETH',
    symbol: 'MEGA',
    date: '2026-05-22',
    dateTbd: true,
    chain: 'MegaETH L2',
    category: 'L2',
    fdvUsd: 3_000_000_000,
    initialCirc: 10,
    vestingCliffMonths: 12,
    description: 'High-throughput Ethereum L2 targeting 100k TPS via specialised sequencer hardware.',
    website: 'https://megaeth.com',
    twitter: 'megaeth_labs',
    fundingRaised: 30_000_000,
  },
  {
    name: 'Plasma',
    symbol: 'XPL',
    date: '2026-05-29',
    chain: 'Plasma L1',
    category: 'L1',
    fdvUsd: 1_200_000_000,
    initialCirc: 18,
    vestingCliffMonths: 12,
    description: 'Stablecoin-native L1 with USDT integration and gas-free transfers.',
    website: 'https://plasma.to',
    twitter: 'PlasmaFDN',
    fundingRaised: 24_000_000,
  },
  {
    name: 'Initia',
    symbol: 'INIT',
    date: '2026-06-03',
    chain: 'Initia L1',
    category: 'L1',
    fdvUsd: 800_000_000,
    initialCirc: 25,
    vestingCliffMonths: 12,
    description: 'Omnichain rollup-as-a-service network with native interwoven liquidity.',
    website: 'https://initia.xyz',
    twitter: 'initiaFDN',
    fundingRaised: 24_000_000,
  },
  {
    name: 'Berachain',
    symbol: 'BERA',
    date: '2026-06-10',
    dateTbd: true,
    chain: 'Berachain L1',
    category: 'L1',
    fdvUsd: 4_500_000_000,
    initialCirc: 20,
    vestingCliffMonths: 12,
    description: 'EVM-compatible PoL (proof-of-liquidity) chain. DeFi-native consensus.',
    website: 'https://berachain.com',
    twitter: 'berachain',
    fundingRaised: 142_000_000,
  },
  {
    name: 'Monad',
    symbol: 'MON',
    date: '2026-06-15',
    dateTbd: true,
    chain: 'Monad L1',
    category: 'L1',
    fdvUsd: 6_000_000_000,
    initialCirc: 15,
    vestingCliffMonths: 12,
    description: 'Parallelised EVM L1 targeting 10k TPS with full Ethereum compatibility.',
    website: 'https://monad.xyz',
    twitter: 'monad_xyz',
    fundingRaised: 244_000_000,
  },
  {
    name: 'Movement',
    symbol: 'MOVE',
    date: '2026-06-18',
    dateTbd: true,
    chain: 'Movement L1',
    category: 'L1',
    fdvUsd: 1_800_000_000,
    initialCirc: 22,
    vestingCliffMonths: 12,
    description: 'Move-VM L1/L2 stack ported from Aptos/Sui. Targets EVM bridges via M2.',
    website: 'https://movementlabs.xyz',
    twitter: 'movementlabsxyz',
    fundingRaised: 41_000_000,
  },
  {
    name: 'Story Protocol',
    symbol: 'IP',
    date: '2026-06-25',
    chain: 'Story L1',
    category: 'Infra',
    fdvUsd: 2_250_000_000,
    initialCirc: 25,
    vestingCliffMonths: 12,
    description: 'IP-rights L1 — register / license / monetise creative assets onchain.',
    website: 'https://www.storyprotocol.xyz',
    twitter: 'StoryProtocol',
    fundingRaised: 134_000_000,
  },
  {
    name: 'Sahara AI',
    symbol: 'SHA',
    date: '2026-07-02',
    dateTbd: true,
    chain: 'Sahara L1',
    category: 'AI',
    fdvUsd: 1_500_000_000,
    initialCirc: 15,
    vestingCliffMonths: 12,
    description: 'Decentralised AI training data marketplace + agent economy.',
    website: 'https://saharaai.com',
    twitter: 'SaharaLabsAI',
    fundingRaised: 49_000_000,
  },
  {
    name: 'Humanity Protocol',
    symbol: 'H',
    date: '2026-07-09',
    dateTbd: true,
    chain: 'Humanity L1',
    category: 'Infra',
    fdvUsd: 1_100_000_000,
    initialCirc: 18,
    vestingCliffMonths: 12,
    description: 'Palm-scan based proof-of-humanity. Sybil-resistant identity layer.',
    website: 'https://www.humanity.org',
    twitter: 'Humanityprot',
    fundingRaised: 30_000_000,
  },
  {
    name: 'Soon',
    symbol: 'SOON',
    date: '2026-07-15',
    dateTbd: true,
    chain: 'Solana SVM L2',
    category: 'L2',
    fdvUsd: 600_000_000,
    initialCirc: 30,
    vestingCliffMonths: 12,
    description: 'Solana SVM rollup. Targets 50k TPS on optimised SVM execution layer.',
    website: 'https://soo.network',
    twitter: 'soon_svm',
  },
  {
    name: 'Polymer',
    symbol: 'POLY',
    date: '2026-07-22',
    dateTbd: true,
    chain: 'Polymer L2',
    category: 'Infra',
    fdvUsd: 700_000_000,
    initialCirc: 20,
    vestingCliffMonths: 12,
    description: 'IBC interoperability hub for Ethereum rollups.',
    website: 'https://polymerlabs.org',
    twitter: 'Polymer_Labs',
    fundingRaised: 28_000_000,
  },
  {
    name: 'Ritual',
    symbol: 'RITUAL',
    date: '2026-08-05',
    dateTbd: true,
    chain: 'Ritual L1',
    category: 'AI',
    fdvUsd: 1_200_000_000,
    initialCirc: 18,
    vestingCliffMonths: 12,
    description: 'AI inference network — bring on-chain compute to LLM workloads.',
    website: 'https://ritual.net',
    twitter: 'ritualnet',
    fundingRaised: 25_000_000,
  },
];
