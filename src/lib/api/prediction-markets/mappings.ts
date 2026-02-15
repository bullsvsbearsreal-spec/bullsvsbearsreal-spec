export interface MarketMapping {
  label: string;
  category: string;
  polymarketMatch: string; // regex tested against question
  kalshiMatch: string;     // regex tested against title OR ticker
}

// Top cross-listed events between Polymarket and Kalshi
// Based on real API data from both platforms
export const CURATED_MAPPINGS: MarketMapping[] = [
  // Crypto price targets
  { label: 'BTC above $150K', category: 'Crypto', polymarketMatch: 'bitcoin.*reach.*\\$?150|bitcoin.*150.?000', kalshiMatch: 'BTC.*150|bitcoin.*150' },
  { label: 'BTC above $200K', category: 'Crypto', polymarketMatch: 'bitcoin.*reach.*\\$?200|bitcoin.*200.?000', kalshiMatch: 'KXBTC.*200|bitcoin.*200' },
  { label: 'ETH above $2500', category: 'Crypto', polymarketMatch: 'ethereum.*2.?500|eth.*2.?500', kalshiMatch: 'KXETH.*250000|ETH.*2500' },
  { label: 'ETH above $3000', category: 'Crypto', polymarketMatch: 'ethereum.*3.?000|eth.*3.?000', kalshiMatch: 'KXETH.*300000|ETH.*3000' },
  { label: 'ETH below $1500', category: 'Crypto', polymarketMatch: 'ethereum.*below.*1.?500|eth.*below.*1.?500', kalshiMatch: 'KXETHMINY.*1500|ethereum.*below.*1500' },
  { label: 'ETH below $1000', category: 'Crypto', polymarketMatch: 'ethereum.*below.*1.?000|eth.*below.*1.?000', kalshiMatch: 'KXETHMINY.*1000|ethereum.*below.*1000' },

  // Fed rate decisions
  { label: 'Fed rate cut March 2026', category: 'Economics', polymarketMatch: 'fed.*decrease.*march|fed.*cut.*march|interest.*rate.*march', kalshiMatch: 'FED.*MAR|FOMC.*MAR|rate.*cut.*march' },
  { label: 'Fed rate increase', category: 'Economics', polymarketMatch: 'fed.*increase.*rate|fed.*hike|interest.*rate.*increase', kalshiMatch: 'FED.*HIKE|rate.*increase' },
  { label: 'Fed rate cut count 2026', category: 'Economics', polymarketMatch: 'fed.*cut.*rate.*2026|rate.*cut.*2026|how many.*cut', kalshiMatch: 'KXRATECUTCOUNT|fed.*cut.*rate' },

  // Politics - Government
  { label: 'Government shutdown', category: 'Politics', polymarketMatch: 'government.*shutdown|shutdown.*saturday', kalshiMatch: 'GOVSHUT|government.*shutdown|shutdown' },
  { label: 'Trump Moscow visit', category: 'Politics', polymarketMatch: 'trump.*moscow|trump.*visit.*russia', kalshiMatch: 'KXTRUMPMOSCOW|trump.*moscow' },
  { label: 'Trump Zelenskyy meeting', category: 'Politics', polymarketMatch: 'trump.*zelenskyy|trump.*zelensky', kalshiMatch: 'KXTRUMPZELENSKYY|trump.*zelenskyy' },
  { label: 'US-Iran agreement', category: 'Politics', polymarketMatch: 'iran.*deal|iran.*agreement|us.*iran', kalshiMatch: 'KXUSAIRANAGREEMENT|iran.*deal|iran.*agreement' },
  { label: 'US strikes Iran', category: 'Politics', polymarketMatch: 'us.*strikes.*iran|strike.*iran', kalshiMatch: 'IRAN.*STRIKE|strike.*iran' },
  { label: 'Tariffs on China', category: 'Politics', polymarketMatch: 'tariff.*china|china.*tariff', kalshiMatch: 'KXTARIFFRATEPRC|tariff.*china' },
  { label: 'Tariffs on EU', category: 'Politics', polymarketMatch: 'tariff.*eu|europe.*tariff', kalshiMatch: 'KXTARIFFSEU|tariff.*eu' },
  { label: 'Tariffs on Mexico', category: 'Politics', polymarketMatch: 'tariff.*mexico|mexico.*tariff', kalshiMatch: 'KXTARIFFSMEX|tariff.*mexico' },

  // Tech / AI
  { label: 'OpenAI profit conversion', category: 'Tech', polymarketMatch: 'openai.*profit|openai.*for.profit', kalshiMatch: 'KXOPENAIPROFIT|openai.*profit' },
  { label: 'OpenAI vs Anthropic IPO', category: 'Tech', polymarketMatch: 'openai.*anthropic.*ipo|anthropic.*ipo', kalshiMatch: 'KXOAIANTH|openai.*anthropic' },
  { label: 'DeepSeek R2 release', category: 'Tech', polymarketMatch: 'deepseek.*r2|deepseek.*release', kalshiMatch: 'KXDEEPSEEKR2|deepseek.*r2' },
  { label: 'AGI / Turing test', category: 'Tech', polymarketMatch: 'agi|turing.*test|artificial.*general', kalshiMatch: 'AITURING|agi|turing' },

  // World events
  { label: 'Next Pope', category: 'World', polymarketMatch: 'next.*pope|pope.*francis|new.*pope', kalshiMatch: 'KXNEWPOPE|next.*pope|pope' },
  { label: 'Elon Musk Mars', category: 'World', polymarketMatch: 'elon.*mars|musk.*mars', kalshiMatch: 'KXELONMARS|elon.*mars|musk.*mars' },

  // Economics
  { label: 'US recession', category: 'Economics', polymarketMatch: 'recession.*2026|us.*recession', kalshiMatch: 'RECESSION|GDP.*NEGATIVE|recession' },
  { label: 'Inflation CPI', category: 'Economics', polymarketMatch: 'cpi|inflation.*rate|consumer.*price', kalshiMatch: 'CPIYOY|CPI|inflation' },
  { label: 'Average tariff rate', category: 'Economics', polymarketMatch: 'average.*tariff|tariff.*rate', kalshiMatch: 'KXAVGTARIFF|average.*tariff' },
  { label: 'Trump Fed chair nomination', category: 'Economics', polymarketMatch: 'trump.*fed.*chair|nominate.*fed', kalshiMatch: 'FED.*CHAIR|trump.*fed.*chair' },
];

const STOP_WORDS = new Set([
  'the', 'will', 'be', 'before', 'after', 'above', 'below',
  'by', 'on', 'in', 'at', 'for', 'and', 'or', 'not', 'yes', 'no',
  'this', 'that', 'what', 'when', 'how', 'end', 'price', 'market',
  'does', 'than', 'more', 'less', 'any', 'each', 'all', 'from',
  'with', 'about', 'into', 'over', 'under', 'between', 'during',
  'its', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'can', 'could', 'would', 'should', 'may', 'might', 'shall',
  'win', 'won', 'game', 'match', 'team', 'play',
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
