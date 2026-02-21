export interface MarketMapping {
  label: string;
  category: string;
  polymarketMatch: string; // regex tested against question
  kalshiMatch: string;     // regex tested against title OR ticker
}

// Curated cross-listed events between Polymarket and Kalshi.
// Keep regexes TIGHT — false positives are worse than missed matches.
// Only add mappings when both platforms have genuinely the SAME question.
export const CURATED_MAPPINGS: MarketMapping[] = [
  // Crypto — only match identical thresholds
  { label: 'BTC above $150K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:above|reach).*\\$?150', kalshiMatch: 'KXBTCMAXY.*150|bitcoin.*above.*150' },
  { label: 'BTC above $200K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:above|reach).*\\$?200', kalshiMatch: 'KXBTC.*200|bitcoin.*above.*200' },
  { label: 'ETH above $2500', category: 'Crypto', polymarketMatch: 'ethereum.*(?:above|reach).*2.?500', kalshiMatch: 'KXETHMAXMON.*2500|ETH.*above.*2500' },
  { label: 'ETH below $1500', category: 'Crypto', polymarketMatch: 'ethereum.*below.*1.?500', kalshiMatch: 'KXETHMINY.*1500' },
  { label: 'ETH below $1000', category: 'Crypto', polymarketMatch: 'ethereum.*below.*1.?000', kalshiMatch: 'KXETHMINY.*1000' },

  // Politics
  { label: 'Government shutdown', category: 'Politics', polymarketMatch: 'government.*shutdown', kalshiMatch: 'GOVSHUT|government.*shutdown' },
  { label: 'Trump Moscow visit', category: 'Politics', polymarketMatch: 'trump.*moscow', kalshiMatch: 'KXTRUMPMOSCOW|trump.*moscow' },
  { label: 'Trump Zelenskyy meeting', category: 'Politics', polymarketMatch: 'trump.*zelenskyy|trump.*zelensky', kalshiMatch: 'KXTRUMPZELENSKYY|trump.*zelenskyy' },
  { label: 'Iran nuclear deal', category: 'Politics', polymarketMatch: 'iran.*(?:deal|agreement|nuclear)', kalshiMatch: 'KXUSAIRANAGREEMENT|iran.*(?:deal|agreement|nuclear)' },
  { label: 'Tariffs on China', category: 'Politics', polymarketMatch: 'tariff.*china|china.*tariff', kalshiMatch: 'KXTARIFFRATEPRC|tariff.*china' },
  { label: 'Tariffs on EU', category: 'Politics', polymarketMatch: 'tariff.*eu(?:rope)?', kalshiMatch: 'KXTARIFFSEU|tariff.*eu' },
  { label: 'Tariffs on Mexico', category: 'Politics', polymarketMatch: 'tariff.*mexico', kalshiMatch: 'KXTARIFFSMEX|tariff.*mexico' },

  // Tech / AI
  { label: 'OpenAI profit conversion', category: 'Tech', polymarketMatch: 'openai.*(?:profit|for.profit)', kalshiMatch: 'KXOPENAIPROFIT|openai.*profit' },
  { label: 'OpenAI vs Anthropic IPO', category: 'Tech', polymarketMatch: 'openai.*anthropic.*ipo|anthropic.*ipo.*openai', kalshiMatch: 'KXOAIANTH' },
  { label: 'DeepSeek R2 release', category: 'Tech', polymarketMatch: 'deepseek.*r2', kalshiMatch: 'KXDEEPSEEKR2|deepseek.*r2' },
  { label: 'AGI / Turing test', category: 'Tech', polymarketMatch: 'turing.*test|artificial.*general.*intelligence', kalshiMatch: 'AITURING|turing.*test' },

  // World events
  { label: 'Next Pope', category: 'World', polymarketMatch: 'next.*pope|new.*pope', kalshiMatch: 'KXNEWPOPE|next.*pope' },
  { label: 'Elon Musk Mars', category: 'World', polymarketMatch: 'elon.*mars|musk.*mars', kalshiMatch: 'KXELONMARS|elon.*mars' },

  // Economics
  { label: 'US recession', category: 'Economics', polymarketMatch: 'recession.*202[56]|us.*recession', kalshiMatch: 'RECESSION|recession' },
  { label: 'Inflation CPI', category: 'Economics', polymarketMatch: '\\bcpi\\b|consumer.*price.*index', kalshiMatch: 'CPIYOY|\\bCPI\\b' },
  { label: 'Average tariff rate', category: 'Economics', polymarketMatch: 'average.*tariff', kalshiMatch: 'KXAVGTARIFF|average.*tariff' },
  { label: 'Trump Fed chair', category: 'Economics', polymarketMatch: 'trump.*(?:fed.*chair|nominate.*fed)', kalshiMatch: 'KXPRESNOMFEDCHAIR|fed.*chair.*nomin' },
];

const STOP_WORDS = new Set([
  'the', 'will', 'be', 'before', 'after', 'above', 'below',
  'by', 'on', 'in', 'at', 'for', 'and', 'or', 'not', 'yes', 'no',
  'this', 'that', 'what', 'when', 'how', 'end', 'price', 'prices', 'market', 'markets',
  'does', 'than', 'more', 'less', 'any', 'each', 'all', 'from',
  'with', 'about', 'into', 'over', 'under', 'between', 'during',
  'its', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'can', 'could', 'would', 'should', 'may', 'might', 'shall',
  'win', 'won', 'game', 'match', 'team', 'play',
  // Months — temporal noise that inflates false matches
  'january', 'february', 'march', 'april', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  // Years — same reason
  '2024', '2025', '2026', '2027', '2028', '2029', '2030',
  // Generic verbs that don't distinguish questions
  'happen', 'released', 'release', 'announced', 'announce',
]);

export function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// Extract significant numbers (prices, thresholds — skip years)
export function extractNumbers(question: string): number[] {
  const nums: number[] = [];
  const re = /\$?([\d,]+\.?\d*)\s*([kKmMbBtT])?/g;
  let m;
  while ((m = re.exec(question)) !== null) {
    let val = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(val) || val <= 0) continue;
    const suffix = (m[2] || '').toLowerCase();
    if (suffix === 'k') val *= 1_000;
    else if (suffix === 'm') val *= 1_000_000;
    else if (suffix === 'b') val *= 1_000_000_000;
    else if (suffix === 't') val *= 1_000_000_000_000;
    // Skip years
    if (val >= 2020 && val <= 2035) continue;
    // Skip tiny numbers (dates, counts, not thresholds)
    if (val < 10) continue;
    nums.push(val);
  }
  return nums;
}

// Check if two questions have opposite price direction (above vs below)
export function hasConflictingPolarity(qA: string, qB: string): boolean {
  const up = /\b(above|over|reach|exceed|hit|surpass|higher|rise)\b/i;
  const down = /\b(below|under|dip|fall|drop|crash|lower|decline)\b/i;
  const aUp = up.test(qA), aDown = down.test(qA);
  const bUp = up.test(qB), bDown = down.test(qB);
  return (aUp && !aDown && bDown && !bUp) || (aDown && !aUp && bUp && !bDown);
}

// Jaccard similarity between two keyword sets
export function keywordSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = Array.from(setA).filter(x => setB.has(x)).length;
  const combined = new Set(a.concat(b));
  return combined.size === 0 ? 0 : intersection / combined.size;
}
