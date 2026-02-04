// Token Unlocks data integration
// Provides vesting schedule and unlock information for top cryptocurrencies

export interface TokenUnlock {
  id: string;
  coinId: string;
  coinSymbol: string;
  coinName: string;
  unlockDate: string;
  unlockAmount: number;
  unlockValue: number;
  percentOfSupply: number;
  unlockType: 'cliff' | 'linear' | 'team' | 'investor' | 'ecosystem' | 'treasury';
  description: string;
  source?: string;
  isLarge: boolean; // >1% of supply
}

export interface VestingSchedule {
  coinId: string;
  totalLocked: number;
  totalLockedValue: number;
  percentLocked: number;
  nextUnlock: TokenUnlock | null;
  upcomingUnlocks: TokenUnlock[];
  unlockHistory: TokenUnlock[];
}

// Token unlock type labels
export const UNLOCK_TYPES = {
  cliff: { label: 'Cliff Unlock', color: 'error', description: 'Large one-time unlock' },
  linear: { label: 'Linear Vesting', color: 'warning', description: 'Gradual daily/weekly release' },
  team: { label: 'Team Tokens', color: 'purple', description: 'Team/advisor allocation' },
  investor: { label: 'Investor Tokens', color: 'blue', description: 'Private/seed investor allocation' },
  ecosystem: { label: 'Ecosystem', color: 'success', description: 'Ecosystem development fund' },
  treasury: { label: 'Treasury', color: 'hub-yellow', description: 'Protocol treasury release' },
};

// Fetch upcoming unlocks for a specific coin
export async function fetchTokenUnlocks(coinId: string): Promise<TokenUnlock[]> {
  // In production, this would call a real API like Token Unlocks or Messari
  return getMockTokenUnlocks(coinId);
}

// Fetch all upcoming major unlocks across the market
export async function fetchUpcomingUnlocks(limit: number = 10): Promise<TokenUnlock[]> {
  return getMockUpcomingUnlocks(limit);
}

// Get vesting schedule for a coin
export async function getVestingSchedule(coinId: string): Promise<VestingSchedule | null> {
  const unlocks = await fetchTokenUnlocks(coinId);
  if (!unlocks.length) return null;

  const now = new Date();
  const upcomingUnlocks = unlocks
    .filter(u => new Date(u.unlockDate) > now)
    .sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime());

  const totalLocked = upcomingUnlocks.reduce((sum, u) => sum + u.unlockAmount, 0);
  const totalLockedValue = upcomingUnlocks.reduce((sum, u) => sum + u.unlockValue, 0);

  return {
    coinId,
    totalLocked,
    totalLockedValue,
    percentLocked: upcomingUnlocks.reduce((sum, u) => sum + u.percentOfSupply, 0),
    nextUnlock: upcomingUnlocks[0] || null,
    upcomingUnlocks,
    unlockHistory: unlocks.filter(u => new Date(u.unlockDate) <= now),
  };
}

// Mock data with realistic token unlock schedules
function getMockTokenUnlocks(coinId: string): TokenUnlock[] {
  const now = new Date();
  const symbol = coinId.toUpperCase();

  // Coin-specific mock data
  const coinUnlocks: Record<string, TokenUnlock[]> = {
    arbitrum: [
      {
        id: 'arb-1',
        coinId: 'arbitrum',
        coinSymbol: 'ARB',
        coinName: 'Arbitrum',
        unlockDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        unlockAmount: 92650000,
        unlockValue: 92650000 * 1.2,
        percentOfSupply: 0.93,
        unlockType: 'investor',
        description: 'Investor token unlock - Series A allocation',
        isLarge: false,
      },
      {
        id: 'arb-2',
        coinId: 'arbitrum',
        coinSymbol: 'ARB',
        coinName: 'Arbitrum',
        unlockDate: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString(),
        unlockAmount: 185300000,
        unlockValue: 185300000 * 1.2,
        percentOfSupply: 1.86,
        unlockType: 'team',
        description: 'Team and advisor token unlock',
        isLarge: true,
      },
    ],
    optimism: [
      {
        id: 'op-1',
        coinId: 'optimism',
        coinSymbol: 'OP',
        coinName: 'Optimism',
        unlockDate: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString(),
        unlockAmount: 31340000,
        unlockValue: 31340000 * 2.5,
        percentOfSupply: 0.73,
        unlockType: 'ecosystem',
        description: 'Ecosystem fund distribution',
        isLarge: false,
      },
    ],
    jupiter: [
      {
        id: 'jup-1',
        coinId: 'jupiter',
        coinSymbol: 'JUP',
        coinName: 'Jupiter',
        unlockDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        unlockAmount: 125000000,
        unlockValue: 125000000 * 0.85,
        percentOfSupply: 1.25,
        unlockType: 'cliff',
        description: 'Community airdrop unlock - Round 2',
        isLarge: true,
      },
      {
        id: 'jup-2',
        coinId: 'jupiter',
        coinSymbol: 'JUP',
        coinName: 'Jupiter',
        unlockDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        unlockAmount: 50000000,
        unlockValue: 50000000 * 0.85,
        percentOfSupply: 0.5,
        unlockType: 'team',
        description: 'Team token vesting release',
        isLarge: false,
      },
    ],
    solana: [
      {
        id: 'sol-1',
        coinId: 'solana',
        coinSymbol: 'SOL',
        coinName: 'Solana',
        unlockDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        unlockAmount: 1500000,
        unlockValue: 1500000 * 150,
        percentOfSupply: 0.26,
        unlockType: 'linear',
        description: 'Foundation linear vesting',
        isLarge: false,
      },
    ],
    avalanche: [
      {
        id: 'avax-1',
        coinId: 'avalanche-2',
        coinSymbol: 'AVAX',
        coinName: 'Avalanche',
        unlockDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        unlockAmount: 9540000,
        unlockValue: 9540000 * 35,
        percentOfSupply: 1.33,
        unlockType: 'treasury',
        description: 'Treasury allocation release',
        isLarge: true,
      },
    ],
    aptos: [
      {
        id: 'apt-1',
        coinId: 'aptos',
        coinSymbol: 'APT',
        coinName: 'Aptos',
        unlockDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        unlockAmount: 11310000,
        unlockValue: 11310000 * 9,
        percentOfSupply: 1.04,
        unlockType: 'investor',
        description: 'Early investor unlock',
        isLarge: true,
      },
    ],
    sui: [
      {
        id: 'sui-1',
        coinId: 'sui',
        coinSymbol: 'SUI',
        coinName: 'Sui',
        unlockDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        unlockAmount: 64190000,
        unlockValue: 64190000 * 1.8,
        percentOfSupply: 0.64,
        unlockType: 'ecosystem',
        description: 'Ecosystem development unlock',
        isLarge: false,
      },
    ],
  };

  // Return coin-specific data or generate generic data
  if (coinUnlocks[coinId.toLowerCase()]) {
    return coinUnlocks[coinId.toLowerCase()];
  }

  // Generate generic mock data for unknown coins
  return [
    {
      id: `${coinId}-1`,
      coinId,
      coinSymbol: symbol,
      coinName: coinId.charAt(0).toUpperCase() + coinId.slice(1),
      unlockDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      unlockAmount: 5000000,
      unlockValue: 5000000,
      percentOfSupply: 0.5,
      unlockType: 'linear',
      description: 'Scheduled vesting release',
      isLarge: false,
    },
  ];
}

function getMockUpcomingUnlocks(limit: number): TokenUnlock[] {
  const allUnlocks: TokenUnlock[] = [];
  const coins = ['arbitrum', 'optimism', 'jupiter', 'solana', 'avalanche', 'aptos', 'sui'];

  for (const coinId of coins) {
    allUnlocks.push(...getMockTokenUnlocks(coinId));
  }

  return allUnlocks
    .filter(u => new Date(u.unlockDate) > new Date())
    .sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime())
    .slice(0, limit);
}

// Format unlock amount
export function formatUnlockAmount(amount: number): string {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
  return amount.toFixed(0);
}

// Format unlock value in USD
export function formatUnlockValue(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(0)}`;
}

// Get days until unlock
export function getDaysUntilUnlock(unlockDate: string): number {
  const now = new Date();
  const unlock = new Date(unlockDate);
  const diffTime = unlock.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Format relative unlock date
export function formatUnlockDate(unlockDate: string): string {
  const days = getDaysUntilUnlock(unlockDate);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return 'Unlocked';
  if (days <= 7) return `In ${days} days`;
  if (days <= 30) return `In ${Math.ceil(days / 7)} weeks`;
  return new Date(unlockDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
