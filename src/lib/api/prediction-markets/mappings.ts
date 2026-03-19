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
  // Crypto — BTC price targets (match Polymarket "reach/dip" vs Kalshi "above/below")
  { label: 'BTC above $100K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:above|reach|hit).*(?:\\$?100,?000|\\$?100k)', kalshiMatch: 'KXBTCMAXY.*99999|bitcoin.*above.*99' },
  { label: 'BTC above $200K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:above|reach|hit).*(?:\\$?200,?000|\\$?200k)', kalshiMatch: 'KXBTC.*200|bitcoin.*above.*200' },
  { label: 'BTC above $150K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:above|reach|hit).*(?:\\$?150,?000|\\$?150k)', kalshiMatch: 'KXBTCMAXY.*150|bitcoin.*above.*150' },
  { label: 'BTC reach $75K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:reach|hit).*(?:\\$?75,?000|\\$?75k)', kalshiMatch: 'KXBTCMAXY.*75|bitcoin.*above.*75' },
  { label: 'BTC dip to $65K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:dip|fall|below|drop).*(?:\\$?65,?000|\\$?65k)', kalshiMatch: 'KXBTCMINY.*60|bitcoin.*below.*6[05]' },
  { label: 'BTC below $60K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:dip|fall|below|drop).*(?:\\$?60,?000|\\$?60k)', kalshiMatch: 'KXBTCMINY.*60000|bitcoin.*below.*60' },
  { label: 'BTC below $50K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:dip|fall|below|drop).*(?:\\$?50,?000|\\$?50k)', kalshiMatch: 'KXBTCMINY.*50000|bitcoin.*below.*50' },
  { label: 'BTC below $40K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:dip|fall|below|drop).*(?:\\$?40,?000|\\$?40k)', kalshiMatch: 'KXBTCMINY.*40000|bitcoin.*below.*40' },
  // ETH
  { label: 'ETH reach $2200', category: 'Crypto', polymarketMatch: 'ethereum.*(?:reach|hit|above).*(?:\\$?2,?200|\\$?2\\.?2k)', kalshiMatch: 'KXETHMAXMON.*2250|ethereum.*above.*2[12]' },
  { label: 'ETH below $1500', category: 'Crypto', polymarketMatch: 'ethereum.*(?:below|dip|fall).*(?:\\$?1,?500|\\$?1\\.?5k)', kalshiMatch: 'KXETHMINY.*1500|ethereum.*below.*1500' },
  { label: 'ETH below $1000', category: 'Crypto', polymarketMatch: 'ethereum.*(?:below|dip|fall).*(?:\\$?1,?000|\\$?1k)', kalshiMatch: 'KXETHMINY.*1000|ethereum.*below.*1000' },
  { label: 'ETH below $1750', category: 'Crypto', polymarketMatch: 'ethereum.*(?:below|dip|fall).*(?:\\$?1,?750)', kalshiMatch: 'KXETHMINY.*1750|ethereum.*below.*1750' },

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

  // Broader crypto matches — catch different price thresholds
  { label: 'BTC above $75K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:above|reach|hit).*\\$?75', kalshiMatch: 'KXBTC.*75|bitcoin.*above.*75' },
  { label: 'BTC above $100K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:above|reach|hit).*\\$?100', kalshiMatch: 'KXBTC.*100|bitcoin.*above.*(?:99|100)' },
  { label: 'BTC below $60K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:below|dip|fall).*\\$?6[05]', kalshiMatch: 'KXBTCMINY.*60|bitcoin.*below.*60' },
  { label: 'BTC below $50K', category: 'Crypto', polymarketMatch: 'bitcoin.*(?:below|dip|fall).*\\$?50', kalshiMatch: 'KXBTCMINY.*50|bitcoin.*below.*50' },
  { label: 'ETH above $5000', category: 'Crypto', polymarketMatch: 'ethereum.*(?:above|reach).*5.?000', kalshiMatch: 'KXETH.*5000|ethereum.*above.*5000' },
  { label: 'SOL above $500', category: 'Crypto', polymarketMatch: 'solana.*(?:above|reach).*500', kalshiMatch: 'KXSOL.*500|solana.*above.*500' },

  // Geopolitics — Iran (active in March 2026)
  { label: 'Iran regime fall', category: 'Geopolitics', polymarketMatch: 'iranian.*regime.*fall|regime.*fall.*iran', kalshiMatch: 'iran.*regime|regime.*iran|KXIRANREGIME' },
  { label: 'Iran Strait of Hormuz', category: 'Geopolitics', polymarketMatch: 'iran.*(?:hormuz|strait)|strait.*hormuz', kalshiMatch: 'iran.*(?:hormuz|strait)|KXIRANHORMUZ' },
  { label: 'US-Iran nuclear deal', category: 'Geopolitics', polymarketMatch: '(?:us|u\\.s\\.).*iran.*(?:deal|agreement|nuclear|ceasefire)|iran.*ceasefire', kalshiMatch: 'KXUSAIRANAGREEMENT|us.*agree.*iran.*nuclear' },
  { label: 'US invade/enter Iran', category: 'Geopolitics', polymarketMatch: '(?:us|u\\.s\\.).*(?:enter|invade|forces).*iran|invade.*iran', kalshiMatch: 'us.*(?:enter|invade|forces).*iran|KXUSIRAN' },
  { label: 'Iran supreme leader', category: 'Geopolitics', polymarketMatch: '(?:supreme.*leader|successor.*khamenei|next.*leader).*iran|iran.*(?:supreme.*leader|successor)', kalshiMatch: '(?:supreme.*leader|successor|khamenei)|KXIRANLEADER' },

  // Sports — FIFA 2026 World Cup winners
  { label: 'Brazil win FIFA 2026', category: 'Sports', polymarketMatch: 'brazil.*(?:win|2026.*(?:fifa|world.?cup))|(?:fifa|world.?cup).*2026.*brazil', kalshiMatch: 'brazil.*(?:win|world.?cup|fifa)|(?:fifa|world.?cup).*brazil' },
  { label: 'Germany win FIFA 2026', category: 'Sports', polymarketMatch: 'germany.*(?:win|2026.*(?:fifa|world.?cup))|(?:fifa|world.?cup).*2026.*germany', kalshiMatch: 'germany.*(?:win|world.?cup|fifa)|(?:fifa|world.?cup).*germany' },
  { label: 'Argentina win FIFA 2026', category: 'Sports', polymarketMatch: 'argentina.*(?:win|2026.*(?:fifa|world.?cup))|(?:fifa|world.?cup).*2026.*argentina', kalshiMatch: 'argentina.*(?:win|world.?cup|fifa)|(?:fifa|world.?cup).*argentina' },
  { label: 'Spain win FIFA 2026', category: 'Sports', polymarketMatch: 'spain.*(?:win|2026.*(?:fifa|world.?cup))|(?:fifa|world.?cup).*2026.*spain', kalshiMatch: 'spain.*(?:win|world.?cup|fifa)|(?:fifa|world.?cup).*spain' },
  { label: 'France win FIFA 2026', category: 'Sports', polymarketMatch: 'france.*(?:win|2026.*(?:fifa|world.?cup))|(?:fifa|world.?cup).*2026.*france', kalshiMatch: 'france.*(?:win|world.?cup|fifa)|(?:fifa|world.?cup).*france' },
  { label: 'England win FIFA 2026', category: 'Sports', polymarketMatch: 'england.*(?:win|2026.*(?:fifa|world.?cup))|(?:fifa|world.?cup).*2026.*england', kalshiMatch: 'england.*(?:win|world.?cup|fifa)|(?:fifa|world.?cup).*england' },

  // Sports — NBA
  { label: 'NBA Champion 2026', category: 'Sports', polymarketMatch: '(?:nba|basketball).*(?:champion|finals).*2026|2026.*nba.*champion', kalshiMatch: '(?:nba|basketball).*champion' },
  { label: 'Celtics win NBA 2026', category: 'Sports', polymarketMatch: 'celtics.*(?:win|nba|champion|finals)', kalshiMatch: 'celtics.*(?:win|nba|champion)' },
  { label: 'Thunder win NBA 2026', category: 'Sports', polymarketMatch: 'thunder.*(?:win|nba|champion|finals)', kalshiMatch: 'thunder.*(?:win|nba|champion)' },
  { label: 'Rockets win NBA 2026', category: 'Sports', polymarketMatch: 'rockets.*(?:win|nba|champion|finals)|houston.*(?:win|nba|finals)', kalshiMatch: 'rockets.*(?:win|nba|champion)|houston.*(?:nba|champion)' },

  // Sports — F1
  { label: 'F1 Champion 2026', category: 'Sports', polymarketMatch: '(?:f1|formula.?1).*(?:champion|driver).*2026|2026.*(?:f1|formula).*champion', kalshiMatch: '(?:f1|formula.?1).*(?:champion|driver)' },
  { label: 'Verstappen F1 2026', category: 'Sports', polymarketMatch: 'verstappen.*(?:2026|champion|f1)', kalshiMatch: 'verstappen.*(?:champion|f1)' },
  { label: 'Hülkenberg F1 2026', category: 'Sports', polymarketMatch: 'h(?:ü|u)lkenberg|hulkenberg', kalshiMatch: 'h(?:ü|u)lkenberg|hulkenberg' },

  // Sports — LoL esports
  { label: 'LPL 2026 Winner', category: 'Sports', polymarketMatch: 'lpl.*(?:2026|season|winner)', kalshiMatch: 'lpl.*(?:2026|season|winner)' },

  // Fed interest rates — broader
  { label: 'Fed rate cut April', category: 'Economics', polymarketMatch: 'fed.*(?:cut|decrease|lower).*(?:april|may|march)', kalshiMatch: 'KXFED|fed.*(?:cut|rate|decrease)' },
  { label: 'Fed rate decision March', category: 'Economics', polymarketMatch: 'fed.*(?:rate|funds|interest).*march|march.*fed.*(?:cut|hike)', kalshiMatch: 'KXFED.*MAR|fed.*march' },
  { label: 'Fed rate decision June', category: 'Economics', polymarketMatch: 'fed.*(?:rate|funds|interest).*june|june.*fed.*(?:cut|hike)', kalshiMatch: 'KXFED.*JUN|fed.*june' },
  { label: 'Number of rate cuts 2026', category: 'Economics', polymarketMatch: '(?:rate.?cut|cut.*rate).*(?:2026|year|end)', kalshiMatch: 'KXRATECUTCOUNT|rate.*cut.*count' },

  // Crypto token launches / FDV
  { label: 'Metamask FDV', category: 'Crypto', polymarketMatch: 'metamask.*(?:fdv|launch|valuation)', kalshiMatch: 'metamask.*(?:fdv|launch|valuation)' },
  { label: 'Predict.fun FDV', category: 'Crypto', polymarketMatch: 'predict\\.?fun.*(?:fdv|launch|valuation)', kalshiMatch: 'predict.*fun.*(?:fdv|launch|valuation)' },
  { label: 'StandX FDV', category: 'Crypto', polymarketMatch: 'standx.*(?:fdv|launch|valuation)', kalshiMatch: 'standx.*(?:fdv|launch|valuation)' },
  { label: 'Based FDV', category: 'Crypto', polymarketMatch: '\\bbased\\b.*(?:fdv|launch|valuation)', kalshiMatch: '\\bbased\\b.*(?:fdv|launch|valuation)' },

  // SOL / XRP thresholds
  { label: 'SOL above $200', category: 'Crypto', polymarketMatch: 'solana.*(?:above|reach).*200|sol.*(?:above|hit).*200', kalshiMatch: 'KXSOL.*200|solana.*above.*200' },
  { label: 'SOL above $300', category: 'Crypto', polymarketMatch: 'solana.*(?:above|reach).*300|sol.*(?:above|hit).*300', kalshiMatch: 'KXSOL.*300|solana.*above.*300' },
  { label: 'XRP above $5', category: 'Crypto', polymarketMatch: 'xrp.*(?:above|reach).*\\$?5', kalshiMatch: 'KXRP|xrp.*above.*5' },
  { label: 'DOGE above $1', category: 'Crypto', polymarketMatch: 'doge.*(?:above|reach).*\\$?1', kalshiMatch: 'doge.*above.*1' },

  // Gas prices
  { label: 'US gas price', category: 'Economics', polymarketMatch: 'gas.*price|gasoline', kalshiMatch: 'KXGASD|gas.*price' },
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
