// CoinMarketCal API integration for crypto events
// API docs: https://coinmarketcal.com/en/doc/api

const COINMARKETCAL_API = 'https://developers.coinmarketcal.com/v1';

export interface CryptoEvent {
  id: number;
  title: string;
  coins: {
    id: string;
    name: string;
    symbol: string;
    rank: number;
  }[];
  date_event: string;
  created_date: string;
  description: string;
  proof: string;
  source: string;
  is_hot: boolean;
  vote_count: number;
  positive_vote_count: number;
  percentage: number;
  categories: {
    id: number;
    name: string;
  }[];
}

export interface EventCategory {
  id: number;
  name: string;
}

// Event categories from CoinMarketCal
export const EVENT_CATEGORIES = {
  EXCHANGE: { id: 1, name: 'Exchange', icon: '🏦' },
  AIRDROP: { id: 2, name: 'Airdrop', icon: '🎁' },
  RELEASE: { id: 3, name: 'Release', icon: '🚀' },
  UPDATE: { id: 4, name: 'Update', icon: '⬆️' },
  PARTNERSHIP: { id: 5, name: 'Partnership', icon: '🤝' },
  BURN: { id: 6, name: 'Burn', icon: '🔥' },
  CONFERENCE: { id: 7, name: 'Conference', icon: '🎤' },
  MEETUP: { id: 8, name: 'Meetup', icon: '👥' },
  HARDFORK: { id: 9, name: 'Hard Fork', icon: '🍴' },
  ICO: { id: 10, name: 'ICO', icon: '💰' },
  COMMUNITY: { id: 11, name: 'Community', icon: '🌐' },
  REBRANDING: { id: 12, name: 'Rebranding', icon: '✨' },
  STAKING: { id: 13, name: 'Staking', icon: '💎' },
  AMA: { id: 14, name: 'AMA', icon: '❓' },
  TOKENOMICS: { id: 15, name: 'Tokenomics', icon: '📊' },
  UNLOCK: { id: 16, name: 'Token Unlock', icon: '🔓' },
};

// Fetch events for a specific coin
export async function fetchCoinEvents(symbol: string): Promise<CryptoEvent[]> {
  try {
    // Try CoinMarketCal API first
    const response = await fetch(
      `${COINMARKETCAL_API}/events?coins=${symbol.toUpperCase()}&max=20`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.body || [];
    }
  } catch (error) {
    console.error('CoinMarketCal API error:', error);
  }

  // Fallback to mock data for demo
  return getMockEvents(symbol);
}

// Fetch upcoming events across all coins
export async function fetchUpcomingEvents(limit: number = 20): Promise<CryptoEvent[]> {
  try {
    const response = await fetch(
      `${COINMARKETCAL_API}/events?max=${limit}&sortBy=hot_events`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 300 },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.body || [];
    }
  } catch (error) {
    console.error('CoinMarketCal API error:', error);
  }

  return getMockUpcomingEvents();
}

// Mock data for demo purposes
function getMockEvents(symbol: string): CryptoEvent[] {
  const now = new Date();
  const events: CryptoEvent[] = [
    {
      id: 1,
      title: `${symbol.toUpperCase()} Token Unlock`,
      coins: [{ id: '1', name: symbol, symbol: symbol.toUpperCase(), rank: 50 }],
      date_event: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_date: now.toISOString(),
      description: `Scheduled token unlock releasing approximately 2.5% of total supply.`,
      proof: 'https://example.com',
      source: 'Official Announcement',
      is_hot: true,
      vote_count: 156,
      positive_vote_count: 142,
      percentage: 91,
      categories: [{ id: 16, name: 'Token Unlock' }],
    },
    {
      id: 2,
      title: `${symbol.toUpperCase()} Major Exchange Listing`,
      coins: [{ id: '1', name: symbol, symbol: symbol.toUpperCase(), rank: 50 }],
      date_event: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_date: now.toISOString(),
      description: `New tier-1 exchange listing confirmed. Trading pairs: ${symbol}/USDT, ${symbol}/BTC.`,
      proof: 'https://example.com',
      source: 'Exchange Announcement',
      is_hot: true,
      vote_count: 234,
      positive_vote_count: 220,
      percentage: 94,
      categories: [{ id: 1, name: 'Exchange' }],
    },
    {
      id: 3,
      title: `${symbol.toUpperCase()} v2.0 Mainnet Launch`,
      coins: [{ id: '1', name: symbol, symbol: symbol.toUpperCase(), rank: 50 }],
      date_event: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      created_date: now.toISOString(),
      description: `Major protocol upgrade with improved scalability and new features.`,
      proof: 'https://example.com',
      source: 'Development Blog',
      is_hot: false,
      vote_count: 89,
      positive_vote_count: 78,
      percentage: 88,
      categories: [{ id: 3, name: 'Release' }],
    },
    {
      id: 4,
      title: `${symbol.toUpperCase()} Partnership Announcement`,
      coins: [{ id: '1', name: symbol, symbol: symbol.toUpperCase(), rank: 50 }],
      date_event: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      created_date: now.toISOString(),
      description: `Strategic partnership with major tech company to be announced.`,
      proof: 'https://example.com',
      source: 'Twitter',
      is_hot: true,
      vote_count: 312,
      positive_vote_count: 298,
      percentage: 96,
      categories: [{ id: 5, name: 'Partnership' }],
    },
    {
      id: 5,
      title: `${symbol.toUpperCase()} Community AMA`,
      coins: [{ id: '1', name: symbol, symbol: symbol.toUpperCase(), rank: 50 }],
      date_event: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      created_date: now.toISOString(),
      description: `Live AMA session with the founding team discussing roadmap and updates.`,
      proof: 'https://example.com',
      source: 'Discord',
      is_hot: false,
      vote_count: 67,
      positive_vote_count: 61,
      percentage: 91,
      categories: [{ id: 14, name: 'AMA' }],
    },
  ];

  return events;
}

function getMockUpcomingEvents(): CryptoEvent[] {
  const now = new Date();
  const coins = ['BTC', 'ETH', 'SOL', 'JUP', 'ARB', 'OP', 'MATIC', 'AVAX', 'LINK', 'UNI'];

  return coins.map((symbol, index) => ({
    id: index + 100,
    title: getRandomEventTitle(symbol),
    coins: [{ id: String(index), name: symbol, symbol, rank: index + 1 }],
    date_event: new Date(now.getTime() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
    created_date: now.toISOString(),
    description: `Upcoming event for ${symbol}`,
    proof: 'https://example.com',
    source: 'Official',
    is_hot: index < 3,
    vote_count: Math.floor(Math.random() * 300) + 50,
    positive_vote_count: Math.floor(Math.random() * 250) + 40,
    percentage: Math.floor(Math.random() * 20) + 80,
    categories: [getRandomCategory()],
  }));
}

function getRandomEventTitle(symbol: string): string {
  const titles = [
    `${symbol} Token Unlock - 5M tokens`,
    `${symbol} Exchange Listing`,
    `${symbol} Mainnet Upgrade`,
    `${symbol} Staking Rewards Update`,
    `${symbol} Partnership Reveal`,
    `${symbol} Community AMA`,
    `${symbol} Airdrop Announcement`,
    `${symbol} Governance Vote`,
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

function getRandomCategory(): { id: number; name: string } {
  const categories = Object.values(EVENT_CATEGORIES);
  const cat = categories[Math.floor(Math.random() * categories.length)];
  return { id: cat.id, name: cat.name };
}

// Get category icon
export function getCategoryIcon(categoryName: string): string {
  const category = Object.values(EVENT_CATEGORIES).find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  return category?.icon || '📅';
}

// Format event date
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0) return 'Past';
  if (diffDays <= 7) return `In ${diffDays} days`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
