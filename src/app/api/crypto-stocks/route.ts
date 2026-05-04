/**
 * GET /api/crypto-stocks
 *
 * Crypto-related stocks live quotes + 90d history vs BTC. Quotes from Yahoo
 * Finance (`query1.finance.yahoo.com/v8/finance/chart`). For each ticker we
 * compute beta and correlation vs BTC over the same window.
 *
 * Free, no auth. L1 cached 2 minutes — these move on equity-market hours
 * so a tighter cache during US trading sessions is OK.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface StockMeta {
  ticker: string;
  name: string;
  category: 'exchange' | 'miner' | 'treasury' | 'etf' | 'broker' | 'infra';
}

interface YahooBar {
  date: string;
  close: number;
}

interface StockRow extends StockMeta {
  price: number | null;
  change24h: number | null;
  /** 90d return % */
  return90d: number | null;
  /** Pearson correlation with BTC daily returns over window */
  correlationToBtc: number | null;
  /** Beta vs BTC: cov(stock, btc) / var(btc) */
  betaToBtc: number | null;
}

interface ApiResponse {
  rows: StockRow[];
  windowDays: number;
  btc: { price: number | null; return90d: number | null };
  ts: number;
}

const STOCKS: StockMeta[] = [
  { ticker: 'COIN',  name: 'Coinbase Global',          category: 'exchange' },
  { ticker: 'HOOD',  name: 'Robinhood Markets',        category: 'broker'   },
  { ticker: 'GLXY',  name: 'Galaxy Digital',           category: 'broker'   },
  { ticker: 'IBIT',  name: 'iShares Bitcoin Trust',    category: 'etf'      },
  { ticker: 'FBTC',  name: 'Fidelity Bitcoin Trust',   category: 'etf'      },
  { ticker: 'ETHA',  name: 'iShares Ethereum Trust',   category: 'etf'      },
  { ticker: 'ETHE',  name: 'Grayscale Ethereum Trust', category: 'etf'      },
  { ticker: 'MSTR',  name: 'MicroStrategy',            category: 'treasury' },
  { ticker: 'SMLR',  name: 'Semler Scientific',        category: 'treasury' },
  { ticker: 'MARA',  name: 'MARA Holdings',            category: 'miner'    },
  { ticker: 'RIOT',  name: 'Riot Platforms',           category: 'miner'    },
  { ticker: 'CLSK',  name: 'CleanSpark',               category: 'miner'    },
  { ticker: 'WULF',  name: 'TeraWulf',                 category: 'miner'    },
  { ticker: 'BITF',  name: 'Bitfarms',                 category: 'miner'    },
  { ticker: 'CIFR',  name: 'Cipher Mining',            category: 'miner'    },
  { ticker: 'BTBT',  name: 'Bit Digital',              category: 'miner'    },
  { ticker: 'CORZ',  name: 'Core Scientific',          category: 'miner'    },
  { ticker: 'IREN',  name: 'IREN (Iris Energy)',       category: 'miner'    },
];

const BTC_TICKER = 'BTC-USD';
const TIMEOUT = 8000;

let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 2 * 60 * 1000;

async function fetchYahoo90d(ticker: string): Promise<YahooBar[]> {
  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=3mo&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0' } },
      TIMEOUT,
    );
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const ts = result?.timestamp as number[] | undefined;
    const closes = result?.indicators?.quote?.[0]?.close as Array<number | null> | undefined;
    if (!Array.isArray(ts) || !Array.isArray(closes)) return [];
    const bars: YahooBar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const close = closes[i];
      if (close == null) continue;
      bars.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close });
    }
    return bars;
  } catch {
    return [];
  }
}

function dailyReturns(bars: YahooBar[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    if (prev > 0) r.push((bars[i].close - prev) / prev);
  }
  return r;
}

function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  const av = a.slice(-n);
  const bv = b.slice(-n);
  const meanA = av.reduce((s, x) => s + x, 0) / n;
  const meanB = bv.reduce((s, x) => s + x, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = av[i] - meanA;
    const db = bv[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 0 ? num / den : null;
}

function beta(stockRet: number[], btcRet: number[]): number | null {
  const n = Math.min(stockRet.length, btcRet.length);
  if (n < 5) return null;
  const s = stockRet.slice(-n);
  const b = btcRet.slice(-n);
  const meanS = s.reduce((x, y) => x + y, 0) / n;
  const meanB = b.reduce((x, y) => x + y, 0) / n;
  let cov = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (s[i] - meanS) * (b[i] - meanB);
    varB += (b[i] - meanB) ** 2;
  }
  return varB > 0 ? cov / varB : null;
}

function totalReturn(bars: YahooBar[]): number | null {
  if (bars.length < 2) return null;
  const first = bars[0].close;
  const last = bars[bars.length - 1].close;
  if (first <= 0) return null;
  return (last - first) / first;
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=300' },
    });
  }

  // Fetch BTC + all stocks in parallel
  const [btcBars, ...stockBars] = await Promise.all([
    fetchYahoo90d(BTC_TICKER),
    ...STOCKS.map(s => fetchYahoo90d(s.ticker)),
  ]);

  const btcRet = dailyReturns(btcBars);
  const btcPrice = btcBars.length > 0 ? btcBars[btcBars.length - 1].close : null;
  const btcReturn90d = totalReturn(btcBars);

  const rows: StockRow[] = STOCKS.map((meta, i) => {
    const bars = stockBars[i];
    const ret = dailyReturns(bars);
    const price = bars.length > 0 ? bars[bars.length - 1].close : null;
    const prev = bars.length > 1 ? bars[bars.length - 2].close : null;
    const change24h = price != null && prev != null && prev > 0 ? (price - prev) / prev : null;
    return {
      ...meta,
      price,
      change24h,
      return90d: totalReturn(bars),
      correlationToBtc: pearson(ret, btcRet),
      betaToBtc: beta(ret, btcRet),
    };
  });

  // Sort by 90d return desc by default
  rows.sort((a, b) => (b.return90d ?? -999) - (a.return90d ?? -999));

  const body: ApiResponse = {
    rows,
    windowDays: 90,
    btc: { price: btcPrice, return90d: btcReturn90d },
    ts: Date.now(),
  };

  if (rows.some(r => r.price != null)) l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': rows.some(r => r.price != null)
        ? 'public, s-maxage=90, stale-while-revalidate=300'
        : 'no-store',
    },
  });
}
