/**
 * GET /api/airdrops
 *
 * Curated airdrop tracker data. Returns upcoming, active, and ended airdrops
 * with eligibility criteria, guides, and estimated values.
 *
 * Query params:
 *   ?status=upcoming|active|ended  (filter by status)
 *   ?category=defi|l2|gaming|infrastructure|social
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/* ─── Types ──────────────────────────────────────────────────────── */

interface Airdrop {
  id: string;
  name: string;
  ticker: string | null;
  network: string;
  status: 'upcoming' | 'active' | 'ended';
  estimatedDate: string | null;
  snapshotDate: string | null;
  totalAllocation: string | null;
  estimatedValue: string | null;
  requirements: string[];
  eligibilityCriteria: string;
  website: string | null;
  category: 'defi' | 'l2' | 'gaming' | 'infrastructure' | 'social';
  difficulty: 'easy' | 'medium' | 'hard';
  riskLevel: 'low' | 'medium' | 'high';
  guide: string | null;
}

/* ─── Static data (curated, updated periodically) ────────────────── */
const DATA_AS_OF = '2026-03-09';

const AIRDROPS: Airdrop[] = [
  // ── ACTIVE / UPCOMING ──────────────────────────────────────────

  {
    id: 'opensea',
    name: 'OpenSea',
    ticker: 'SEA',
    network: 'Ethereum',
    status: 'active',
    estimatedDate: '2026-Q1',
    snapshotDate: null,
    totalAllocation: '50% of supply to community',
    estimatedValue: '$500 - $5,000',
    requirements: [
      'Trade NFTs on OpenSea (long account history preferred)',
      'Be active on OpenSea during 2024-2025',
      'Own NFTs from notable collections',
      'Use Seaport protocol',
    ],
    eligibilityCriteria: 'Confirmed by CEO Devin Finzer. 50% of supply to community. Long-term active traders prioritized. No KYC required. Launching Q1 2026.',
    website: 'https://opensea.io',
    category: 'social',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Trade NFTs on OpenSea with your primary wallet\n2. Maintain consistent trading activity\n3. List NFTs for sale across collections\n4. Use Seaport-powered features\n5. Check eligibility when claim portal opens',
  },
  {
    id: 'polymarket',
    name: 'Polymarket',
    ticker: 'POLY',
    network: 'Polygon',
    status: 'upcoming',
    estimatedDate: '2026-Q3',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$200 - $2,000',
    requirements: [
      'Place bets on diverse prediction markets',
      'Maintain consistent participation history',
      'Genuine trading activity (not sybil)',
    ],
    eligibilityCriteria: 'Confirmed by CMO in Oct 2025. Trademark filed for $POLY in Feb 2026. Likely after US relaunch stabilizes. Consistent, genuine participation across varied markets is key.',
    website: 'https://polymarket.com',
    category: 'defi',
    difficulty: 'easy',
    riskLevel: 'medium',
    guide: '1. Create a Polymarket account and deposit USDC\n2. Trade on a wide variety of prediction markets\n3. Maintain consistent weekly activity\n4. Spread activity across different categories\n5. Avoid bot-like patterns — organic usage only',
  },
  {
    id: 'backpack',
    name: 'Backpack',
    ticker: null,
    network: 'Solana',
    status: 'upcoming',
    estimatedDate: '2026-Q2',
    snapshotDate: null,
    totalAllocation: '25% of supply at TGE',
    estimatedValue: '$200 - $2,000',
    requirements: [
      'Use Backpack wallet and exchange',
      'Accumulate points (Season 4 ongoing)',
      'Hold Mad Lads NFTs (1% allocation)',
      'Be an active exchange trader',
    ],
    eligibilityCriteria: 'TGE plan confirmed Feb 2026. 24% to points holders, 1% to Mad Lads. Points Season 4 ongoing. No exact TGE date yet.',
    website: 'https://backpack.exchange',
    category: 'infrastructure',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: '1. Download and use the Backpack wallet\n2. Trade on Backpack Exchange regularly\n3. Accumulate points through daily activity\n4. Consider holding Mad Lads NFTs for bonus allocation\n5. Check Season 4 leaderboard for progress',
  },
  {
    id: 'hyperliquid-s2',
    name: 'Hyperliquid Season 2',
    ticker: 'HYPE',
    network: 'Hyperliquid',
    status: 'active',
    estimatedDate: '2026-H1',
    snapshotDate: null,
    totalAllocation: 'TBA (S1 was largest airdrop ever by mcap)',
    estimatedValue: '$500 - $100,000',
    requirements: [
      'Trade perpetuals on Hyperliquid',
      'Provide liquidity in HLP vault',
      'Maintain high trading volume',
      'Participate in spot markets',
    ],
    eligibilityCriteria: 'Season 1 was the largest airdrop by market cap ($6.2B). Active traders earn points. Higher volume = larger allocation. Season 2 live now.',
    website: 'https://hyperliquid.xyz',
    category: 'defi',
    difficulty: 'hard',
    riskLevel: 'medium',
    guide: '1. Deposit USDC to Hyperliquid\n2. Trade perpetuals across multiple pairs\n3. Deposit into the HLP vault for LP rewards\n4. Maintain consistent daily trading activity\n5. Explore spot markets and new listings\n6. Higher volume and consistency = better rewards',
  },
  {
    id: 'grass-s2',
    name: 'Grass Season 2',
    ticker: 'GRASS',
    network: 'Solana',
    status: 'active',
    estimatedDate: '2026-H1',
    snapshotDate: '2025-12-15',
    totalAllocation: '170M GRASS (17% of supply)',
    estimatedValue: '$100 - $500',
    requirements: [
      'Have Grass extension installed with 500+ points',
      'Maintain high uptime and bandwidth contribution',
      'Earn Network Points from active bandwidth use',
    ],
    eligibilityCriteria: 'Distributing 170M GRASS tokens gradually through H1 2026. Snapshot was mid-Nov to mid-Dec 2025. Need 500+ Grass Points. Anti-farming measures applied.',
    website: 'https://grass.io',
    category: 'infrastructure',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Install the Grass browser extension\n2. Create account and connect Solana wallet\n3. Keep extension active for Uptime Points\n4. Earn Network Points from bandwidth contributions\n5. Check points dashboard for Season 2 status\n6. New native wallet coming — migrate when available',
  },
  {
    id: 'abstract',
    name: 'Abstract',
    ticker: null,
    network: 'Abstract (zkSync)',
    status: 'upcoming',
    estimatedDate: '2026-Q2',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$200 - $1,000',
    requirements: [
      'Use Abstract mainnet dApps',
      'Earn XP points and badges',
      'Interact with multiple ecosystem apps',
    ],
    eligibilityCriteria: 'Mainnet launched Jan 2025. XP points system live — points convert to future token allocation. Built by Pudgy Penguins team (Igloo Inc).',
    website: 'https://abs.xyz',
    category: 'l2',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Connect wallet to Abstract mainnet\n2. Use ecosystem dApps to earn XP\n3. Collect badges for different activities\n4. Interact with at least 5 different apps\n5. Maintain weekly activity for consistency bonus',
  },
  {
    id: 'base',
    name: 'Base (Coinbase L2)',
    ticker: null,
    network: 'Base',
    status: 'upcoming',
    estimatedDate: 'TBA',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$500 - $5,000+',
    requirements: [
      'Bridge assets to Base',
      'Use DeFi protocols on Base',
      'Regular transaction history',
      'Use popular Base dApps (Aerodrome, Extra Finance)',
    ],
    eligibilityCriteria: 'Unconfirmed but highest-potential airdrop. JPMorgan estimates $12-34B market cap if token launches. Consistent organic usage on Base is the best strategy.',
    website: 'https://base.org',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'medium',
    guide: '1. Bridge ETH to Base via official bridge\n2. Swap tokens on Aerodrome or Uniswap\n3. Provide liquidity on Base DEXs\n4. Use lending protocols (Aave, Moonwell)\n5. Maintain weekly transaction activity\n6. Use diverse protocols — not just one app',
  },
  {
    id: 'scroll-s2',
    name: 'Scroll Season 2',
    ticker: 'SCR',
    network: 'Scroll',
    status: 'active',
    estimatedDate: 'TBA',
    snapshotDate: null,
    totalAllocation: 'TBA (S1 was 7% of supply)',
    estimatedValue: '$100 - $1,000',
    requirements: [
      'Bridge to Scroll mainnet',
      'Use Scroll DEXs (Ambient, SyncSwap)',
      'Provide liquidity',
      'Accumulate Scroll Marks (Sessions program)',
    ],
    eligibilityCriteria: 'Season 1 distributed 7% of SCR (Oct 2024). Season 2 Marks/Sessions program ongoing. No confirmed distribution date yet. DAO governance being restructured.',
    website: 'https://scroll.io',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'medium',
    guide: '1. Bridge ETH to Scroll via official bridge\n2. Swap tokens on Ambient Finance or SyncSwap\n3. Provide LP on multiple pools\n4. Use lending on Aave (Scroll)\n5. Accumulate Scroll Marks through activity\n6. Check Marks dashboard for Season 2 progress',
  },
  {
    id: 'eigenlayer-s2',
    name: 'EigenLayer Season 2',
    ticker: 'EIGEN',
    network: 'Ethereum',
    status: 'active',
    estimatedDate: '2026-H1',
    snapshotDate: null,
    totalAllocation: '~5% of supply',
    estimatedValue: '$500 - $5,000',
    requirements: [
      'Restake ETH or LSTs on EigenLayer',
      'Delegate to operators',
      'Use AVS services',
      'Maintain restaked position',
    ],
    eligibilityCriteria: 'Season 2 expands eligibility to broader restakers and operators. S1 was generous — high expectations for S2. Higher restaked amounts and duration = larger allocation.',
    website: 'https://eigenlayer.xyz',
    category: 'infrastructure',
    difficulty: 'medium',
    riskLevel: 'medium',
    guide: '1. Deposit ETH or LSTs (stETH, rETH) into EigenLayer\n2. Select and delegate to an active operator\n3. Explore and use AVS services\n4. Maintain your restaked position long-term\n5. Higher TVL and duration improves allocation',
  },
  {
    id: 'zircuit-s3',
    name: 'Zircuit Season 3',
    ticker: 'ZRC',
    network: 'Zircuit',
    status: 'active',
    estimatedDate: 'Ongoing',
    snapshotDate: null,
    totalAllocation: '~14% of supply',
    estimatedValue: '$100 - $500',
    requirements: [
      'Stake ETH/LSTs on Zircuit',
      'Transact on Zircuit mainnet',
      'Use DeFi protocols on Zircuit',
      'Earn Mainnet Festival rewards',
    ],
    eligibilityCriteria: 'Season 1 & 2 claimed. Season 3 live with 14% of ZRC for staking, usage, and testing. Mainnet Festival: 125% ZRC per 1 ETH spent, up to 375% for VIPs.',
    website: 'https://zircuit.com',
    category: 'l2',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Stake ETH or LSTs on Zircuit staking\n2. Bridge assets to Zircuit mainnet\n3. Transact on the network (earns Mainnet Festival rewards)\n4. Use DeFi protocols on Zircuit\n5. Check claim page at app.zircuit.com/airdrop',
  },
  {
    id: 'layerzero-s2',
    name: 'LayerZero Season 2',
    ticker: 'ZRO',
    network: 'Multi-chain',
    status: 'upcoming',
    estimatedDate: '2026',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$200 - $1,000',
    requirements: [
      'Bridge assets via LayerZero-powered bridges',
      'Use Stargate Finance',
      'Cross-chain messaging on multiple chains',
    ],
    eligibilityCriteria: 'Season 2 activity suggests preparation for another drop. Focus on genuine cross-chain usage across many chains over time.',
    website: 'https://layerzero.network',
    category: 'infrastructure',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: '1. Use Stargate Finance for cross-chain bridging\n2. Bridge on diverse chains (not just ETH-Arb)\n3. Use LayerZero-powered OFT tokens\n4. Maintain consistent activity over weeks\n5. Avoid sybil patterns — organic usage only',
  },
  {
    id: 'magic-eden-s2',
    name: 'Magic Eden Season 2',
    ticker: 'ME',
    network: 'Multi-chain',
    status: 'active',
    estimatedDate: '2026',
    snapshotDate: null,
    totalAllocation: '~12.5% of supply',
    estimatedValue: '$50 - $500',
    requirements: [
      'Trade NFTs on Magic Eden',
      'List NFTs for sale',
      'Cross-chain NFT activity',
      'Accumulate diamonds via daily tasks',
    ],
    eligibilityCriteria: 'Season 2 diamond rewards for NFT traders. Trade, list, and bid across Solana, ETH, and Bitcoin. Daily tasks for bonus diamonds.',
    website: 'https://magiceden.io',
    category: 'social',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Connect wallet to Magic Eden\n2. Trade NFTs on supported chains (Solana, ETH, Bitcoin)\n3. List NFTs for sale and place bids\n4. Complete daily tasks for bonus diamonds\n5. Check diamond balance regularly',
  },

  // ── ENDED ──────────────────────────────────────────────────────

  {
    id: 'monad',
    name: 'Monad',
    ticker: 'MON',
    network: 'Monad',
    status: 'ended',
    estimatedDate: '2025-11-24',
    snapshotDate: '2025-10-14',
    totalAllocation: '3.3B MON (3.3% of supply)',
    estimatedValue: 'Claimed — 76K wallets',
    requirements: [
      'Participated in public testnet',
      'Interacted with Monad ecosystem dApps',
      'Active in community programs',
    ],
    eligibilityCriteria: 'Mainnet launched Nov 24, 2025. Airdrop claim window Oct 14 - Nov 3, 2025. 76,021 unique wallets claimed. Five eligibility tracks: Monad Community, Onchain Users, Crypto Community, and more.',
    website: 'https://monad.xyz',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: null,
  },
  {
    id: 'berachain',
    name: 'Berachain',
    ticker: 'BERA',
    network: 'Berachain',
    status: 'ended',
    estimatedDate: '2025-02-06',
    snapshotDate: '2025-02-05',
    totalAllocation: '79M BERA (15.75% of supply)',
    estimatedValue: 'Claimed — $632M distributed',
    requirements: [
      'Berachain testnet user (Artio/bArtio)',
      'Bong Bear ecosystem NFT holder',
      'Social engagement contributor',
    ],
    eligibilityCriteria: 'Mainnet launched Feb 6, 2025. Claims ended March 20, 2025. 15.75% of supply to community. Future community incentives (65.5M BERA) earmarked.',
    website: 'https://berachain.com',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: null,
  },
  {
    id: 'linea',
    name: 'Linea',
    ticker: 'LINEA',
    network: 'Linea',
    status: 'ended',
    estimatedDate: '2025-09-09',
    snapshotDate: '2025-09-03',
    totalAllocation: '9.36B LINEA (9% of supply)',
    estimatedValue: 'Claimed — 749K wallets',
    requirements: [
      'Had 2,000+ LXP or 15,000+ LXP-L',
      'Participated in Linea Voyage campaigns',
      'Active mainnet usage',
    ],
    eligibilityCriteria: 'Token launched Sep 9, 2025. Claims ended Dec 9, 2025. 72B total supply. MetaMask rewards now earn LINEA via ongoing programme.',
    website: 'https://linea.build',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: null,
  },
  {
    id: 'hyperlane',
    name: 'Hyperlane',
    ticker: 'HYPER',
    network: 'Multi-chain',
    status: 'ended',
    estimatedDate: '2025-04-22',
    snapshotDate: '2025-02-28',
    totalAllocation: '7.45% of supply',
    estimatedValue: 'Claimed — ~88% claim rate',
    requirements: [
      'Used Hyperlane services before Feb 28, 2025',
      'Paid $5+ in protocol fees',
      'Passed sybil detection',
    ],
    eligibilityCriteria: 'TGE Apr 22, 2025. Claims ended May 22, 2025. Expansion Rewards ongoing quarterly for next 4 years — stake stHYPER for 1.6x multiplier.',
    website: 'https://hyperlane.xyz',
    category: 'infrastructure',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: null,
  },
  {
    id: 'initia',
    name: 'Initia',
    ticker: 'INIT',
    network: 'Initia',
    status: 'ended',
    estimatedDate: '2025-04-24',
    snapshotDate: null,
    totalAllocation: '50M INIT (5% of supply)',
    estimatedValue: 'Claimed — 80%+ in 24h',
    requirements: [
      'Participated in 2024 testnet phases',
      'Top users of LayerZero/IBC partners',
      'Social contributors',
    ],
    eligibilityCriteria: 'Mainnet launched Apr 24, 2025. Claims ended May 24, 2025. 194K testnet users, IBC power users, and social contributors eligible. Launched at $0.62, peaked at $0.93.',
    website: 'https://initia.xyz',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: null,
  },
  {
    id: 'story-protocol',
    name: 'Story Protocol',
    ticker: 'IP',
    network: 'Story',
    status: 'ended',
    estimatedDate: '2025-02-13',
    snapshotDate: null,
    totalAllocation: '50M+ IP tokens at launch',
    estimatedValue: 'Claimed — surged 261% week 1',
    requirements: [
      'Had 20+ Passport score',
      'Collected badges via testnet activity',
      'IP registration and licensing on testnet',
    ],
    eligibilityCriteria: 'TGE Feb 13, 2025. Anti-sybil enforcement. No fees to claim. IP token serves as gas, governance, and gets burned per transaction.',
    website: 'https://story.foundation',
    category: 'infrastructure',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: null,
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    ticker: 'ES',
    network: 'Eclipse',
    status: 'ended',
    estimatedDate: '2025-07-16',
    snapshotDate: null,
    totalAllocation: '100M ES (10% of supply)',
    estimatedValue: 'Claimed — 15% total distributed',
    requirements: [
      'Early Eclipse mainnet user',
      'Bridged and used SVM dApps on Eclipse',
    ],
    eligibilityCriteria: 'TGE Jul 16, 2025. Claims ended Aug 15, 2025. 1B total supply. Season 2 airdrop (4% of supply) planned for Q4 2025. SVM L2 on Ethereum.',
    website: 'https://eclipse.xyz',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'medium',
    guide: null,
  },
  {
    id: 'fuel',
    name: 'Fuel Network',
    ticker: 'FUEL',
    network: 'Fuel',
    status: 'ended',
    estimatedDate: '2024-12-19',
    snapshotDate: null,
    totalAllocation: '1.15B FUEL (11.5% of supply)',
    estimatedValue: 'Claimed — 200K+ users',
    requirements: [
      'Fuel Points program participant',
      'Bridged assets to Fuel',
      'Open-source contributor or moderator',
    ],
    eligibilityCriteria: 'Genesis Drop Phase 1 (Dec 2024) + Phase 2 (ended Mar 2, 2025). 10.1B total supply. Token price declined ~95% since ATH.',
    website: 'https://fuel.network',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'medium',
    guide: null,
  },
];

/* ─── Handler ────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const statusFilter = searchParams.get('status') as Airdrop['status'] | null;
  const categoryFilter = searchParams.get('category') as Airdrop['category'] | null;

  let filtered = AIRDROPS;

  if (statusFilter && ['upcoming', 'active', 'ended'].includes(statusFilter)) {
    filtered = filtered.filter(a => a.status === statusFilter);
  }

  if (categoryFilter && ['defi', 'l2', 'gaming', 'infrastructure', 'social'].includes(categoryFilter)) {
    filtered = filtered.filter(a => a.category === categoryFilter);
  }

  const body = {
    data: filtered,
    total: filtered.length,
    dataAsOf: DATA_AS_OF,
    timestamp: Date.now(),
  };

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
