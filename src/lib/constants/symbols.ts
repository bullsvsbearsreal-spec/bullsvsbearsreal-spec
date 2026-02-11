import { LayoutGrid, Crown, Gem, Dog, Layers, Coins, Bot, Gamepad2, Rocket, ChevronDown, Landmark, Cpu, BarChart3, DollarSign, Flame, Pickaxe } from 'lucide-react';

// Asset class type
export type AssetClass = 'crypto' | 'stocks' | 'forex' | 'commodities';

// Priority symbols for sorting (crypto)
export const PRIORITY_SYMBOLS: string[] = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK',
  'MATIC', 'LTC', 'UNI', 'ATOM', 'NEAR', 'ARB', 'OP', 'APT', 'SUI', 'INJ',
];

// Priority symbols for stocks
export const STOCK_PRIORITY_SYMBOLS: string[] = [
  'AAPL', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'MSFT', 'SPY', 'QQQ',
  'COIN', 'HOOD', 'AMD', 'NFLX', 'MSTR', 'PLTR', 'INTC', 'ARM', 'BA',
];

// Priority symbols for forex
export const FOREX_PRIORITY_SYMBOLS: string[] = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY',
];

// Priority symbols for commodities
export const COMMODITY_PRIORITY_SYMBOLS: string[] = [
  'XAU', 'XAG', 'WTI', 'BRENT', 'NATGAS', 'XCU', 'PAXG',
];

// Category icon mappings (crypto)
export const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: LayoutGrid,
  tops: Crown,
  alts: Gem,
  memes: Dog,
  layer2: Layers,
  defi: Coins,
  ai: Bot,
  gaming: Gamepad2,
  highest: Rocket,
  lowest: ChevronDown,
};

// Symbol categories for funding rate filtering (crypto)
export const CATEGORIES: Record<string, { name: string; symbols: string[]; dynamic?: string }> = {
  all: { name: 'All', symbols: [] },
  tops: { name: 'Top 20', symbols: ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'LTC', 'MATIC', 'UNI', 'ATOM', 'NEAR', 'ARB', 'OP', 'APT', 'SUI', 'INJ'] },
  alts: { name: 'Alts', symbols: ['SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK', 'ATOM', 'NEAR', 'APT', 'SUI', 'SEI', 'TIA', 'INJ', 'FTM', 'ALGO', 'EGLD', 'FLOW', 'HBAR', 'ICP', 'KAVA', 'MINA', 'ONE', 'ROSE', 'CELO', 'ZIL'] },
  memes: { name: 'Memes', symbols: ['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'MEME', 'NEIRO', 'BRETT', 'POPCAT', 'MOG', 'TURBO', 'BABYDOGE', 'ELON', 'LADYS', 'WOJAK', 'BOME', 'SLERF', 'CAT', 'GOAT', 'PNUT', 'ACT', 'HIPPO', 'SPX', 'GIGA', 'MYRO', 'BOOK', 'WEN'] },
  layer2: { name: 'Layer 2', symbols: ['ARB', 'OP', 'MATIC', 'IMX', 'METIS', 'STRK', 'MANTA', 'BLAST', 'ZK', 'SCROLL', 'MODE', 'ZETA'] },
  defi: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR', 'SNX', 'CRV', 'COMP', 'SUSHI', 'YFI', 'LDO', 'DYDX', 'GMX', 'PENDLE', 'JUP', 'RAY', 'INJ', 'CAKE', 'BAL', 'RUNE', '1INCH', 'DODO', 'PERP'] },
  ai: { name: 'AI', symbols: ['FET', 'RENDER', 'AGIX', 'OCEAN', 'TAO', 'WLD', 'RNDR', 'AKT', 'ARKM', 'AI', 'AIOZ', 'PHB', 'NMR', 'CTXC', 'OLAS', 'ALI', 'GLM', 'LPT', 'VIRTUAL', 'AI16Z'] },
  gaming: { name: 'Gaming', symbols: ['AXS', 'SAND', 'MANA', 'IMX', 'GALA', 'ENJ', 'ILV', 'MAGIC', 'PIXEL', 'PRIME', 'PORTAL', 'YGG', 'RON', 'SUPER', 'GODS', 'LOKA', 'PYR', 'ALICE', 'BEAM', 'BIGTIME'] },
  highest: { name: 'Highest', symbols: [], dynamic: 'highest' },
  lowest: { name: 'Lowest', symbols: [], dynamic: 'lowest' },
};

export type Category = keyof typeof CATEGORIES;

// Stock categories
export const STOCK_CATEGORIES: Record<string, { name: string; symbols: string[]; dynamic?: string }> = {
  all: { name: 'All', symbols: [] },
  tech: { name: 'Tech', symbols: ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'META', 'AMZN', 'NVDA', 'AMD', 'INTC', 'ARM', 'AVGO', 'QCOM', 'TSM', 'MRVL', 'MU', 'CRM', 'ORCL', 'NET', 'SNOW', 'SHOP', 'NFLX', 'PLTR'] },
  crypto_adjacent: { name: 'Crypto', symbols: ['COIN', 'HOOD', 'MSTR', 'RIOT', 'MARA', 'CLSK', 'CIFR'] },
  mega_cap: { name: 'Mega Cap', symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'BRK', 'JPM', 'V', 'MA', 'WMT', 'UNH', 'JNJ', 'PG', 'XOM', 'HD', 'COST', 'DIS', 'NKE', 'KO', 'PEP', 'PFE', 'LLY', 'BA', 'UBER', 'ABNB'] },
  indices: { name: 'Indices', symbols: ['SPY', 'SPX', 'QQQ', 'IWM', 'DIA', 'ARKK'] },
  highest: { name: 'Highest', symbols: [], dynamic: 'highest' },
  lowest: { name: 'Lowest', symbols: [], dynamic: 'lowest' },
};

export const STOCK_CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: LayoutGrid,
  tech: Cpu,
  crypto_adjacent: Coins,
  mega_cap: Crown,
  indices: BarChart3,
  highest: Rocket,
  lowest: ChevronDown,
};

// Forex categories
export const FOREX_CATEGORIES: Record<string, { name: string; symbols: string[]; dynamic?: string }> = {
  all: { name: 'All', symbols: [] },
  majors: { name: 'Majors', symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'] },
  crosses: { name: 'Crosses', symbols: ['EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'EURNZD', 'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD', 'AUDJPY', 'AUDCHF', 'AUDNZD', 'AUDCAD', 'NZDJPY', 'CADJPY', 'CHFJPY'] },
  emerging: { name: 'Emerging', symbols: ['USDKRW', 'USDMXN', 'USDBRL', 'USDTRY', 'USDZAR', 'USDSGD', 'USDHKD', 'USDSEK', 'USDNOK', 'USDPLN', 'USDCZK', 'USDHUF', 'USDTWD', 'USDINR', 'TRYUSD'] },
  highest: { name: 'Highest', symbols: [], dynamic: 'highest' },
  lowest: { name: 'Lowest', symbols: [], dynamic: 'lowest' },
};

export const FOREX_CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: LayoutGrid,
  majors: DollarSign,
  crosses: Landmark,
  emerging: Gem,
  highest: Rocket,
  lowest: ChevronDown,
};

// Commodity categories
export const COMMODITY_CATEGORIES: Record<string, { name: string; symbols: string[]; dynamic?: string }> = {
  all: { name: 'All', symbols: [] },
  metals: { name: 'Metals', symbols: ['XAU', 'XAG', 'XPT', 'XPD', 'XCU', 'HG', 'PAXG'] },
  energy: { name: 'Energy', symbols: ['WTI', 'BRENT', 'NATGAS', 'UKOIL', 'USOIL'] },
  highest: { name: 'Highest', symbols: [], dynamic: 'highest' },
  lowest: { name: 'Lowest', symbols: [], dynamic: 'lowest' },
};

export const COMMODITY_CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: LayoutGrid,
  metals: Pickaxe,
  energy: Flame,
  highest: Rocket,
  lowest: ChevronDown,
};

// Helper: get categories and icons for a given asset class
export function getCategoriesForAssetClass(assetClass: AssetClass): {
  categories: Record<string, { name: string; symbols: string[]; dynamic?: string }>;
  icons: Record<string, React.ComponentType<{ className?: string }>>;
  prioritySymbols: string[];
} {
  switch (assetClass) {
    case 'stocks':
      return { categories: STOCK_CATEGORIES, icons: STOCK_CATEGORY_ICONS, prioritySymbols: STOCK_PRIORITY_SYMBOLS };
    case 'forex':
      return { categories: FOREX_CATEGORIES, icons: FOREX_CATEGORY_ICONS, prioritySymbols: FOREX_PRIORITY_SYMBOLS };
    case 'commodities':
      return { categories: COMMODITY_CATEGORIES, icons: COMMODITY_CATEGORY_ICONS, prioritySymbols: COMMODITY_PRIORITY_SYMBOLS };
    case 'crypto':
    default:
      return { categories: CATEGORIES, icons: CATEGORY_ICONS, prioritySymbols: PRIORITY_SYMBOLS };
  }
}
