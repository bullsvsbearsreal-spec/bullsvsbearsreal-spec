export interface MarketMapping {
  label: string;
  category: string;
  polymarketMatch: string; // regex tested against question
  kalshiMatch: string;     // regex tested against title OR ticker
}

// Top cross-listed events between Polymarket and Kalshi
export const CURATED_MAPPINGS: MarketMapping[] = [
  // Crypto price targets
  { label: 'BTC above $100K', category: 'Crypto', polymarketMatch: 'bitcoin.*above.*\\$?100', kalshiMatch: 'BTC.*100|bitcoin.*100' },
  { label: 'BTC above $150K', category: 'Crypto', polymarketMatch: 'bitcoin.*above.*\\$?150', kalshiMatch: 'BTC.*150|bitcoin.*150' },
  { label: 'BTC above $200K', category: 'Crypto', polymarketMatch: 'bitcoin.*above.*\\$?200', kalshiMatch: 'BTC.*200|bitcoin.*200' },
  { label: 'ETH above $5K', category: 'Crypto', polymarketMatch: 'ethereum.*above.*\\$?5.?000', kalshiMatch: 'ETH.*5000|ethereum.*5' },
  { label: 'ETH above $10K', category: 'Crypto', polymarketMatch: 'ethereum.*above.*\\$?10', kalshiMatch: 'ETH.*10000|ethereum.*10' },
  { label: 'BTC all-time high 2026', category: 'Crypto', polymarketMatch: 'bitcoin.*all.time.*high.*2026', kalshiMatch: 'BTC.*ATH.*2026|bitcoin.*record' },

  // Fed rate decisions
  { label: 'Fed rate cut March 2026', category: 'Economics', polymarketMatch: 'fed.*cut.*march|fomc.*march.*cut', kalshiMatch: 'FED.*MAR|FOMC.*MAR.*CUT' },
  { label: 'Fed rate cut June 2026', category: 'Economics', polymarketMatch: 'fed.*cut.*june|fomc.*june.*cut', kalshiMatch: 'FED.*JUN|FOMC.*JUN.*CUT' },
  { label: 'Fed rate cut 2026', category: 'Economics', polymarketMatch: 'fed.*cut.*2026|rate.*cut.*2026', kalshiMatch: 'FED.*2026.*CUT|rate.*cut.*2026' },
  { label: 'US recession 2026', category: 'Economics', polymarketMatch: 'us.*recession.*2026|recession.*united.*states', kalshiMatch: 'RECESSION.*2026|GDP.*NEGATIVE' },

  // Politics
  { label: 'Trump approval rating', category: 'Politics', polymarketMatch: 'trump.*approval', kalshiMatch: 'TRUMP.*APPROVAL|POTUS.*APPROVAL' },
  { label: 'Government shutdown', category: 'Politics', polymarketMatch: 'government.*shutdown', kalshiMatch: 'GOV.*SHUTDOWN|SHUTDOWN' },

  // Tech/AI
  { label: 'OpenAI valuation', category: 'Tech', polymarketMatch: 'openai.*valuation|openai.*worth', kalshiMatch: 'OPENAI|openai.*valuat' },
  { label: 'AGI by 2030', category: 'Tech', polymarketMatch: 'agi.*2030|artificial.*general.*intelligence', kalshiMatch: 'AGI.*2030' },

  // Sports (common cross-listed)
  { label: 'Super Bowl winner', category: 'Sports', polymarketMatch: 'super.*bowl.*winner|win.*super.*bowl', kalshiMatch: 'SUPERBOWL|super.*bowl' },
  { label: 'NBA Finals winner', category: 'Sports', polymarketMatch: 'nba.*final|nba.*champion', kalshiMatch: 'NBA.*FINAL|nba.*champion' },
];

const STOP_WORDS = new Set([
  'the', 'will', 'be', 'before', 'after', 'above', 'below',
  'by', 'on', 'in', 'at', 'for', 'and', 'or', 'not', 'yes', 'no',
  'this', 'that', 'what', 'when', 'how', 'end', 'price', 'market',
  'does', 'than', 'more', 'less', 'any', 'each', 'all', 'from',
  'with', 'about', 'into', 'over', 'under', 'between', 'during',
  'its', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'can', 'could', 'would', 'should', 'may', 'might', 'shall',
]);

export function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// Jaccard similarity between two keyword sets
export function keywordSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = Array.from(setA).filter(x => setB.has(x)).length;
  const combined = new Set(a.concat(b));
  return combined.size === 0 ? 0 : intersection / combined.size;
}
