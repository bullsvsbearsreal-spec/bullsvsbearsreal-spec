/**
 * CME Bitcoin + Ether futures basis calculation.
 *
 * Shared between /api/cme-basis and /api/v1/basis so both surfaces
 * see identical numbers from the same warm cache.
 *
 * Annualised basis = (cmePrice − spotPrice) / spotPrice × (365 / daysToExpiry)
 *
 * Persistent positive basis = institutional risk-on (cash-and-carry yields
 * are profitable). Backwardation is rare and often marks deleveraging.
 */
import { fetchWithTimeout } from '@/app/api/_shared/fetch';

const TIMEOUT = 8000;

export interface BasisRow {
  asset: 'BTC' | 'ETH';
  spot: number;
  cmeFront: number;
  daysToExpiry: number;
  /** Raw basis = (cme − spot) / spot. */
  basisPct: number;
  /** Annualized basis = basis × (365 / daysToExpiry). */
  annualizedPct: number;
  cmeSource: string;
  spotSource: string;
}

interface YahooQuote { price: number; nextExpiryDate?: number | null }
interface CGSimple { [key: string]: { usd: number } }

async function fetchYahooQuote(ticker: string): Promise<YahooQuote | null> {
  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0' } },
      TIMEOUT,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return { price: meta.regularMarketPrice ?? 0, nextExpiryDate: null };
  } catch { return null; }
}

async function fetchBinanceSpot(symbol: string): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`,
      {}, TIMEOUT,
    );
    if (!res.ok) return null;
    const j = await res.json() as { price: string };
    const n = Number(j.price);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

async function fetchSpot(coingeckoIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const res = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(',')}&vs_currencies=usd`,
      { headers: { Accept: 'application/json' } },
      TIMEOUT,
    );
    if (res.ok) {
      const json = await res.json() as CGSimple;
      for (const id of coingeckoIds) {
        if (json[id]?.usd) out[id] = json[id].usd;
      }
    }
  } catch { /* fall through */ }

  const idToBinance: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH' };
  await Promise.all(coingeckoIds.map(async id => {
    if (out[id]) return;
    const sym = idToBinance[id];
    if (!sym) return;
    const price = await fetchBinanceSpot(sym);
    if (price != null) out[id] = price;
  }));
  return out;
}

/**
 * Approximate days to expiry of the front-month CME contract. CME BTC
 * monthlies expire on the last Friday of the contract month. Yahoo's
 * `BTC=F` rolls automatically, so we just approximate the next last-Friday.
 */
export function approxDaysToCmeExpiry(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  let d = lastDay.getUTCDate();
  while (new Date(Date.UTC(year, month, d)).getUTCDay() !== 5) d--;
  let expiryMs = new Date(Date.UTC(year, month, d)).getTime();
  if (expiryMs < now.getTime()) {
    const nextMonth = month + 1;
    const nextLast = new Date(Date.UTC(year, nextMonth + 1, 0));
    let d2 = nextLast.getUTCDate();
    while (new Date(Date.UTC(year, nextMonth, d2)).getUTCDay() !== 5) d2--;
    expiryMs = new Date(Date.UTC(year, nextMonth, d2)).getTime();
  }
  return Math.max(1, Math.round((expiryMs - now.getTime()) / 86_400_000));
}

// L1 cache shared across both /api/cme-basis and /api/v1/basis callers.
let l1Cache: { rows: BasisRow[]; ts: number } | null = null;
const L1_TTL = 5 * 60 * 1000;

export interface CmeBasisResult {
  rows: BasisRow[];
  ts: number;
  fromCache: boolean;
}

/**
 * Fetch CME basis rows. Hits the warm cache when fresh; otherwise pulls
 * Yahoo + spot prices in parallel. Returns whatever rows resolved
 * successfully — partial success is fine.
 */
export async function getCmeBasis(): Promise<CmeBasisResult> {
  if (l1Cache && Date.now() - l1Cache.ts < L1_TTL) {
    return { rows: l1Cache.rows, ts: l1Cache.ts, fromCache: true };
  }
  const [btcCme, ethCme, spotPrices] = await Promise.all([
    fetchYahooQuote('BTC=F'),
    fetchYahooQuote('ETH=F'),
    fetchSpot(['bitcoin', 'ethereum']),
  ]);

  const days = approxDaysToCmeExpiry();
  const rows: BasisRow[] = [];
  if (btcCme && spotPrices.bitcoin && btcCme.price > 0) {
    const basisPct = (btcCme.price - spotPrices.bitcoin) / spotPrices.bitcoin;
    rows.push({
      asset: 'BTC',
      spot: spotPrices.bitcoin,
      cmeFront: btcCme.price,
      daysToExpiry: days,
      basisPct,
      annualizedPct: basisPct * (365 / days),
      cmeSource: 'Yahoo BTC=F',
      spotSource: 'CoinGecko + Binance fallback',
    });
  }
  if (ethCme && spotPrices.ethereum && ethCme.price > 0) {
    const basisPct = (ethCme.price - spotPrices.ethereum) / spotPrices.ethereum;
    rows.push({
      asset: 'ETH',
      spot: spotPrices.ethereum,
      cmeFront: ethCme.price,
      daysToExpiry: days,
      basisPct,
      annualizedPct: basisPct * (365 / days),
      cmeSource: 'Yahoo ETH=F',
      spotSource: 'CoinGecko + Binance fallback',
    });
  }

  const ts = Date.now();
  if (rows.length > 0) l1Cache = { rows, ts };
  return { rows, ts, fromCache: false };
}
