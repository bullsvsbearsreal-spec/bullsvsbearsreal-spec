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
export const preferredRegion = 'dxb1';
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
const DATA_AS_OF = '2026-03-08';

const AIRDROPS: Airdrop[] = [
  {
    id: 'monad',
    name: 'Monad',
    ticker: 'MON',
    network: 'Monad',
    status: 'upcoming',
    estimatedDate: '2026-06-01',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$1,000 - $5,000',
    requirements: [
      'Join the Monad Discord and verify',
      'Follow Monad on Twitter/X',
      'Participate in testnet when available',
      'Engage with Monad ecosystem dApps',
    ],
    eligibilityCriteria: 'Early community members and testnet participants expected to be eligible. Active Discord and social engagement may increase allocation.',
    website: 'https://monad.xyz',
    category: 'l2',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Join the official Monad Discord server\n2. Complete verification steps\n3. Follow @moaborz and @moaborz on X\n4. Participate in community events and quizzes\n5. Test on the testnet when launched\n6. Bridge assets when mainnet goes live',
  },
  {
    id: 'berachain',
    name: 'Berachain',
    ticker: 'BERA',
    network: 'Berachain',
    status: 'active',
    estimatedDate: '2026-04-15',
    snapshotDate: '2026-03-01',
    totalAllocation: '~100M BERA',
    estimatedValue: '$500 - $3,000',
    requirements: [
      'Use Berachain testnet (bArtio)',
      'Provide liquidity on BEX',
      'Delegate BGT to validators',
      'Mint Honey stablecoin',
    ],
    eligibilityCriteria: 'Testnet users who performed swaps, provided liquidity, and delegated BGT. Higher activity = larger allocation.',
    website: 'https://berachain.com',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: '1. Add Berachain bArtio testnet to your wallet\n2. Get testnet tokens from the faucet\n3. Swap tokens on BEX (the native DEX)\n4. Provide liquidity to at least 2 pools\n5. Delegate BGT to validators\n6. Mint and use Honey stablecoin\n7. Try lending on Bend protocol',
  },
  {
    id: 'linea',
    name: 'Linea',
    ticker: null,
    network: 'Linea',
    status: 'upcoming',
    estimatedDate: '2026-Q3',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$200 - $2,000',
    requirements: [
      'Bridge ETH to Linea',
      'Swap on Linea DEXs',
      'Provide liquidity',
      'Use Linea dApps regularly',
      'Participate in Linea Voyage campaigns',
    ],
    eligibilityCriteria: 'Active mainnet users with consistent usage over time. Voyage NFT holders likely to get bonus allocations.',
    website: 'https://linea.build',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'medium',
    guide: '1. Bridge ETH to Linea using the official bridge\n2. Use SyncSwap or Horizon DEX for swaps\n3. Provide LP on at least one pool\n4. Complete Linea Voyage campaigns for POAPs\n5. Use lending protocols like LineaBank\n6. Maintain regular activity (weekly transactions)',
  },
  {
    id: 'scroll',
    name: 'Scroll',
    ticker: 'SCR',
    network: 'Scroll',
    status: 'active',
    estimatedDate: '2026-05-01',
    snapshotDate: null,
    totalAllocation: '~7% of supply',
    estimatedValue: '$300 - $1,500',
    requirements: [
      'Bridge to Scroll mainnet',
      'Use Scroll DEXs (Ambient, SyncSwap)',
      'Provide liquidity',
      'Hold Scroll Marks (Session 2)',
    ],
    eligibilityCriteria: 'Scroll Marks program participants. Season 2 ongoing — earn Marks through bridging, swapping, and LP.',
    website: 'https://scroll.io',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: '1. Bridge ETH to Scroll via official bridge\n2. Swap tokens on Ambient Finance\n3. Provide LP on SyncSwap or Ambient\n4. Use lending on Aave (Scroll)\n5. Accumulate Scroll Marks through activity\n6. Check Scroll Marks dashboard for progress',
  },
  {
    id: 'abstract',
    name: 'Abstract',
    ticker: null,
    network: 'Abstract',
    status: 'upcoming',
    estimatedDate: '2026-Q2',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$200 - $1,000',
    requirements: [
      'Use Abstract testnet',
      'Mint NFTs on Abstract',
      'Interact with ecosystem dApps',
    ],
    eligibilityCriteria: 'Early adopters and testnet users. Consumer-focused L2 backed by Igloo (Pudgy Penguins team).',
    website: 'https://abs.xyz',
    category: 'l2',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Connect wallet to Abstract testnet\n2. Get testnet tokens from faucet\n3. Mint test NFTs on the platform\n4. Use at least 3 ecosystem dApps\n5. Follow @AbstractChain on X',
  },
  {
    id: 'eigenlayer-s2',
    name: 'EigenLayer Season 2',
    ticker: 'EIGEN',
    network: 'Ethereum',
    status: 'active',
    estimatedDate: '2026-06-01',
    snapshotDate: null,
    totalAllocation: '~5% of supply',
    estimatedValue: '$500 - $5,000',
    requirements: [
      'Restake ETH or LSTs on EigenLayer',
      'Delegate to operators',
      'Use AVS services',
      'Maintain restaked position',
    ],
    eligibilityCriteria: 'Season 2 stakedrop for restakers and AVS users. Higher restaked amounts and longer duration = larger allocation.',
    website: 'https://eigenlayer.xyz',
    category: 'infrastructure',
    difficulty: 'medium',
    riskLevel: 'medium',
    guide: '1. Deposit ETH or LSTs (stETH, rETH) into EigenLayer\n2. Select and delegate to an operator\n3. Explore AVS services built on EigenLayer\n4. Maintain your restaked position\n5. Higher TVL and duration improves allocation',
  },
  {
    id: 'hyperlane',
    name: 'Hyperlane',
    ticker: null,
    network: 'Multi-chain',
    status: 'upcoming',
    estimatedDate: '2026-Q2',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$100 - $500',
    requirements: [
      'Bridge assets using Hyperlane',
      'Use Hyperlane-powered dApps',
      'Run a validator (advanced)',
    ],
    eligibilityCriteria: 'Users of Hyperlane messaging protocol and bridges. Cross-chain activity on supported chains.',
    website: 'https://hyperlane.xyz',
    category: 'infrastructure',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Use Hyperlane bridges to move assets between chains\n2. Interact with dApps that use Hyperlane messaging\n3. Bridge on multiple supported chains for diversity\n4. Advanced: Run a Hyperlane validator node',
  },
  {
    id: 'grass',
    name: 'Grass Season 2',
    ticker: 'GRASS',
    network: 'Solana',
    status: 'active',
    estimatedDate: '2026-04-01',
    snapshotDate: null,
    totalAllocation: '~10% of supply',
    estimatedValue: '$100 - $500',
    requirements: [
      'Install Grass browser extension',
      'Keep extension running (bandwidth sharing)',
      'Refer friends for bonus points',
    ],
    eligibilityCriteria: 'Season 2 rewards for bandwidth contributors. Points based on uptime and data contributed.',
    website: 'https://getgrass.io',
    category: 'infrastructure',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Install the Grass browser extension\n2. Create an account and connect wallet\n3. Keep the extension active while browsing\n4. Check your points dashboard regularly\n5. Share referral link for bonus multiplier',
  },
  {
    id: 'initia',
    name: 'Initia',
    ticker: 'INIT',
    network: 'Initia',
    status: 'upcoming',
    estimatedDate: '2026-Q2',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$300 - $2,000',
    requirements: [
      'Use Initia testnet',
      'Stake INIT tokens on testnet',
      'Explore Minitia rollups',
      'Provide liquidity',
    ],
    eligibilityCriteria: 'Testnet participants and early ecosystem users. Modular L1 with interwoven rollups.',
    website: 'https://initia.xyz',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: '1. Connect to Initia testnet\n2. Get testnet tokens from faucet\n3. Stake INIT tokens to validators\n4. Try at least 2 Minitia rollups\n5. Swap and provide LP on the native DEX\n6. Participate in governance proposals',
  },
  {
    id: 'fuel',
    name: 'Fuel Network',
    ticker: 'FUEL',
    network: 'Fuel',
    status: 'active',
    estimatedDate: '2026-05-01',
    snapshotDate: null,
    totalAllocation: '~20% community',
    estimatedValue: '$200 - $1,000',
    requirements: [
      'Bridge ETH to Fuel mainnet',
      'Swap on Fuel DEXs',
      'Provide liquidity',
      'Accumulate Fuel Points',
    ],
    eligibilityCriteria: 'Fuel Points program participants. Points earned through bridging, swapping, and LP provision on mainnet.',
    website: 'https://fuel.network',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'medium',
    guide: '1. Bridge ETH to Fuel via the official bridge\n2. Use Mira Exchange for swaps\n3. Provide LP on available pools\n4. Check your Fuel Points balance\n5. Maintain consistent weekly activity',
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    ticker: null,
    network: 'Eclipse',
    status: 'upcoming',
    estimatedDate: '2026-Q3',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$200 - $1,500',
    requirements: [
      'Bridge to Eclipse mainnet',
      'Use Solana-style dApps on Eclipse',
      'Swap and provide liquidity',
    ],
    eligibilityCriteria: 'SVM-based L2 on Ethereum. Early mainnet users likely eligible for token launch distribution.',
    website: 'https://eclipse.xyz',
    category: 'l2',
    difficulty: 'medium',
    riskLevel: 'medium',
    guide: '1. Bridge ETH to Eclipse mainnet\n2. Explore the Eclipse ecosystem dApps\n3. Perform swaps on available DEXs\n4. Provide liquidity where possible\n5. Interact with multiple protocols for diversity',
  },
  {
    id: 'story-protocol',
    name: 'Story Protocol',
    ticker: null,
    network: 'Story',
    status: 'upcoming',
    estimatedDate: '2026-Q3',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$100 - $1,000',
    requirements: [
      'Register IP assets on testnet',
      'License and remix IP',
      'Participate in creator campaigns',
    ],
    eligibilityCriteria: 'IP-focused L1 for creators. Testnet users and IP registrants expected to be eligible.',
    website: 'https://storyprotocol.xyz',
    category: 'infrastructure',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Connect wallet to Story testnet\n2. Register a test IP asset\n3. Create a license for your IP\n4. Remix or derive from existing IP\n5. Participate in community creator events',
  },
  {
    id: 'zircuit',
    name: 'Zircuit Season 2',
    ticker: 'ZRC',
    network: 'Zircuit',
    status: 'active',
    estimatedDate: '2026-04-01',
    snapshotDate: null,
    totalAllocation: '~7% of supply',
    estimatedValue: '$100 - $500',
    requirements: [
      'Stake ETH/LSTs on Zircuit',
      'Bridge to Zircuit mainnet',
      'Use Zircuit DeFi protocols',
      'Accumulate Zircuit Points',
    ],
    eligibilityCriteria: 'Season 2 of Zircuit Points campaign. Stakers and active mainnet users earn points toward airdrop.',
    website: 'https://zircuit.com',
    category: 'l2',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Stake ETH or LSTs on Zircuit staking\n2. Bridge assets to Zircuit mainnet\n3. Use DeFi protocols on Zircuit\n4. Check your Zircuit Points balance\n5. Maintain staking for duration bonus',
  },
  {
    id: 'layerzero-s2',
    name: 'LayerZero Season 2',
    ticker: 'ZRO',
    network: 'Multi-chain',
    status: 'upcoming',
    estimatedDate: '2026-Q3',
    snapshotDate: null,
    totalAllocation: 'TBA',
    estimatedValue: '$200 - $1,000',
    requirements: [
      'Bridge assets via LayerZero-powered bridges',
      'Use Stargate Finance',
      'Cross-chain messaging activity',
    ],
    eligibilityCriteria: 'Second airdrop for LayerZero users. Focus on genuine cross-chain usage post-Season 1.',
    website: 'https://layerzero.network',
    category: 'infrastructure',
    difficulty: 'medium',
    riskLevel: 'low',
    guide: '1. Use Stargate Finance for cross-chain bridging\n2. Bridge on multiple chains (not just ETH↔Arb)\n3. Use LayerZero-powered OFT tokens\n4. Maintain consistent activity over weeks\n5. Avoid sybil patterns (organic usage only)',
  },
  {
    id: 'magic-eden-s2',
    name: 'Magic Eden Season 2',
    ticker: 'ME',
    network: 'Multi-chain',
    status: 'active',
    estimatedDate: '2026-05-01',
    snapshotDate: null,
    totalAllocation: '~12.5% of supply',
    estimatedValue: '$50 - $500',
    requirements: [
      'Trade NFTs on Magic Eden',
      'List NFTs for sale',
      'Cross-chain NFT activity',
      'Accumulate Magic Eden diamonds',
    ],
    eligibilityCriteria: 'Season 2 diamond rewards for NFT traders. Trade, list, and bid across multiple chains.',
    website: 'https://magiceden.io',
    category: 'social',
    difficulty: 'easy',
    riskLevel: 'low',
    guide: '1. Connect wallet to Magic Eden\n2. Trade NFTs on supported chains (Solana, ETH, Bitcoin)\n3. List NFTs for sale\n4. Place bids on collections\n5. Check your diamond balance daily\n6. Complete daily tasks for bonus diamonds',
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
