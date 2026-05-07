/**
 * Pre-Listing Leak Tracker — aggregate CEX listing announcements so users
 * can front-run the pump that historically follows. Listings move price
 * 30-200% in the first 24h; catching them 1-12h before the public catches
 * on is real alpha.
 *
 * Source matrix (free / public / no auth):
 *   - Binance announcements API (the gold standard — they pre-announce
 *     spot listings and futures listings hours in advance)
 *   - Coinbase asset-page roadmap (separate fetch helper)
 *
 * We classify each announcement into:
 *   - type:    'spot' | 'futures' | 'perp' | 'option' | 'delisting' | 'other'
 *   - venue:   'Binance' | 'Coinbase' | ...
 *   - tickers: extracted from the title
 *
 * Cached 5 min — listings update slowly enough.
 */

const TIMEOUT_MS = 10_000;

export interface ListingEvent {
  /** Stable id (venue:articleId). */
  id: string;
  venue: 'Binance' | 'Coinbase';
  type: 'spot' | 'futures' | 'perp' | 'option' | 'delisting' | 'other';
  /** Tickers extracted from the title. */
  tickers: string[];
  title: string;
  /** Publish timestamp (ms). */
  publishedAt: number;
  /** Hours since publish — useful for sorting freshness. */
  ageHours: number;
  /** Optional URL to the announcement. */
  url: string;
  /** Hot flag: published in last 6h. Strong "front-run window" signal. */
  hot: boolean;
}

export interface ListingRadarFeed {
  ts: number;
  events: ListingEvent[];
  summary: {
    total: number;
    last24h: number;
    last6h: number;
    byVenue: Record<string, number>;
    byType: Record<string, number>;
  };
}

// Binance announcement catalog IDs.
const BINANCE_CATALOG_NEW_LISTING = 48;     // "New Cryptocurrency Listing"
const BINANCE_CATALOG_DELISTING = 161;      // Delisting announcements

interface BinanceArticleListResponse {
  code: string;
  data?: {
    catalogs?: Array<{
      catalogId: number;
      catalogName: string;
      articles: Array<{ id: number; code: string; title: string; releaseDate: number; type: number }>;
    }>;
  };
}

/**
 * Pull a Binance announcement catalog. Tries direct first; on 4xx/5xx
 * (or any failure) falls back to PROXY_URL — same pattern we use for
 * Binance Futures funding when binance.com geo-blocks DO IPs.
 */
async function fetchBinanceCatalog(catalogId: number): Promise<Array<{ id: number; code: string; title: string; releaseDate: number }>> {
  const directUrl = `https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=${catalogId}&pageNo=1&pageSize=30`;
  const proxyUrlRaw = (process.env.PROXY_URL || '').trim();
  const proxiedUrl = proxyUrlRaw && proxyUrlRaw.startsWith('https://')
    ? `${proxyUrlRaw.replace(/\/$/, '')}/?url=${encodeURIComponent(directUrl)}`
    : null;

  for (const url of [directUrl, proxiedUrl].filter(Boolean) as string[]) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as BinanceArticleListResponse;
      const articles = json.data?.catalogs?.[0]?.articles ?? [];
      if (articles.length === 0) continue;
      return articles.map(a => ({ id: a.id, code: a.code, title: a.title, releaseDate: a.releaseDate }));
    } catch {
      continue;
    }
  }
  return [];
}

/**
 * Title parsers. Run in order; first match wins.
 *
 * Examples we handle:
 *   "Binance Futures Will Launch USDⓈ-Margined BILLUSDT Perpetual Contract (2026-05-07)"
 *     → type=perp, tickers=[BILL]
 *   "Binance Will Add OPENUSDT, OPEN spot trading (2026-05-06)"
 *     → type=spot, tickers=[OPEN]
 *   "Binance Will Delist FORM, FORMUSDT etc. (2026-05-12)"
 *     → type=delisting, tickers=[FORM]
 */
const TICKER_RE = /\b([A-Z][A-Z0-9]{1,9})USDT?\b|\b([A-Z][A-Z0-9]{1,9})USDC?\b|\b([A-Z][A-Z0-9]{1,9})BUSD?\b/g;

function extractTickers(title: string): string[] {
  const found = new Set<string>();
  // Prefer the structured forms first (XXXUSDT) which appear in titles.
  let m: RegExpExecArray | null;
  TICKER_RE.lastIndex = 0;
  while ((m = TICKER_RE.exec(title)) != null) {
    const t = m[1] || m[2] || m[3];
    if (!t) continue;
    if (t === 'USDT' || t === 'USDC' || t === 'BUSD' || t === 'USD') continue;
    found.add(t);
  }
  // Fallback: bare uppercase tokens that look like tickers, but only when
  // we found nothing above (avoids picking up acronyms in regular sentences).
  if (found.size === 0) {
    const fallbackRe = /\b([A-Z]{2,8})\b/g;
    let f: RegExpExecArray | null;
    while ((f = fallbackRe.exec(title)) != null) {
      const t = f[1];
      // Filter common false positives.
      if (/^(USD|USDT|USDC|EUR|GBP|UTC|API|CEX|DEX|ETF|TBA)$/.test(t)) continue;
      if (/^(NEW|WILL|ADD|LAUNCH|FUTURES|SPOT|MARGIN|PERP|OPEN|CLOSE)$/.test(t)) continue;
      found.add(t);
    }
  }
  return Array.from(found).slice(0, 5);
}

function classifyTitle(title: string): ListingEvent['type'] {
  const t = title.toLowerCase();
  if (/delist|removing|will remove/.test(t)) return 'delisting';
  if (/perpetual|perp /.test(t)) return 'perp';
  if (/futures/.test(t)) return 'futures';
  if (/option/.test(t)) return 'option';
  if (/spot trading|will add|will list/.test(t)) return 'spot';
  return 'other';
}

/**
 * Coinbase doesn't expose a clean machine-readable listing roadmap, but
 * their Twitter / blog posts via their RSS feed work. For now we skip
 * Coinbase ingestion and document as a follow-up. Binance is by far the
 * most price-impactful listing source anyway (historically 50-200% pump
 * on first listing, 10-30% on subsequent listings).
 *
 * Future: add Coinbase Asset Page roadmap scrape, OKX announcements API.
 */

function buildBinanceEvents(
  articles: Array<{ id: number; code: string; title: string; releaseDate: number }>,
  defaultType?: ListingEvent['type'],
): ListingEvent[] {
  const now = Date.now();
  return articles.map(a => {
    const ageHours = Math.max(0, (now - a.releaseDate) / 3_600_000);
    const type = defaultType ?? classifyTitle(a.title);
    const tickers = extractTickers(a.title);
    return {
      id: `binance:${a.id}`,
      venue: 'Binance',
      type,
      tickers,
      title: a.title,
      publishedAt: a.releaseDate,
      ageHours: Math.round(ageHours * 10) / 10,
      url: `https://www.binance.com/en/support/announcement/${a.code}`,
      hot: ageHours < 6,
    };
  });
}

/**
 * Build the listing radar feed: pull Binance's "New Listing" + "Delisting"
 * catalogs in parallel, normalise, sort newest-first.
 */
export async function buildListingRadar(): Promise<ListingRadarFeed> {
  const [newList, delist] = await Promise.all([
    fetchBinanceCatalog(BINANCE_CATALOG_NEW_LISTING),
    fetchBinanceCatalog(BINANCE_CATALOG_DELISTING),
  ]);

  const events: ListingEvent[] = [
    ...buildBinanceEvents(newList),
    ...buildBinanceEvents(delist, 'delisting'),
  ];

  // Dedup by id (overlap between catalogs is rare but defensive).
  const byId = new Map<string, ListingEvent>();
  for (const e of events) byId.set(e.id, e);
  const unique = Array.from(byId.values()).sort((a, b) => b.publishedAt - a.publishedAt);

  const last24h = unique.filter(e => e.ageHours < 24).length;
  const last6h = unique.filter(e => e.hot).length;
  const byVenue: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const e of unique) {
    byVenue[e.venue] = (byVenue[e.venue] ?? 0) + 1;
    byType[e.type] = (byType[e.type] ?? 0) + 1;
  }

  return {
    ts: Date.now(),
    events: unique,
    summary: { total: unique.length, last24h, last6h, byVenue, byType },
  };
}
