import { LayoutGrid, Crown, Gem, Dog, Layers, Coins, Bot, Gamepad2, Rocket, ChevronDown } from 'lucide-react';

// Priority symbols for sorting
export const PRIORITY_SYMBOLS: string[] = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK',
  'MATIC', 'LTC', 'UNI', 'ATOM', 'NEAR', 'ARB', 'OP', 'APT', 'SUI', 'INJ',
];

// Category icon mappings
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

// Symbol categories for funding rate filtering
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
