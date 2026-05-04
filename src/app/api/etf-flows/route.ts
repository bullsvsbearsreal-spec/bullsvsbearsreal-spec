/**
 * GET /api/etf-flows?asset=btc|eth
 *
 * Spot-ETF daily NET FLOW timeseries scraped from farside.co.uk's
 * publicly-published HTML tables. Farside aggregates daily creation/
 * redemption from each issuer's filings — they're the canonical source
 * everyone screenshots.
 *
 * Free, no auth. L1 cached 30 min — Farside updates once per US trading
 * day after market close so a long cache is appropriate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface FlowDay {
  date: string;          // ISO YYYY-MM-DD
  /** Per-issuer net flows in $M. Same column order as `issuers` below. */
  perIssuer: (number | null)[];
  /** Total net flow that day in $M. Positive = inflow. */
  total: number;
}

interface ApiResponse {
  asset: 'btc' | 'eth';
  issuers: string[];
  /** Most recent day first */
  days: FlowDay[];
  /** 7d / 30d cumulative net flow ($M) */
  cumulative7d: number;
  cumulative30d: number;
  /** Yesterday's net flow */
  latestDay: FlowDay | null;
  ts: number;
}

const TIMEOUT = 12_000;
const l1Cache = new Map<string, { body: ApiResponse; ts: number }>();
const L1_TTL = 30 * 60 * 1000;

function farsideUrl(asset: 'btc' | 'eth'): string {
  return asset === 'btc'
    ? 'https://farside.co.uk/bitcoin-etf-flow-all-data/'
    : 'https://farside.co.uk/ethereum-etf-flow-all-data/';
}

/**
 * Parse a Farside HTML table dump. Rows look like:
 * <tr><td>02 May 2026</td><td>123.4</td><td>56.7</td>...<td>987.6</td></tr>
 *
 * Numbers are in $M. Dashes (`-`) and empty strings mean "no creation",
 * which we represent as `null` (not 0 — issuer didn't trade that day).
 */
function parseFarsideTable(html: string): { issuers: string[]; days: FlowDay[] } | null {
  // Find the main `data-table` table block (Farside uses a CSS class `etf-flow-table` historically,
  // but the structure is just <table>…<thead><tr>…header cells…</tr></thead><tbody>…</tbody>…</table>).
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;
  const tableHtml = tableMatch[1];

  // Issuer column headers — they're in the first <tr> with <th> tags.
  // Skip the leftmost "Date" header.
  const headerRowMatch = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!headerRowMatch) return null;
  const headerCells = Array.from(headerRowMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi))
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
    .filter(Boolean);
  // Drop the first ("Date") + last column ("Total") if present
  let issuers = headerCells.slice(1);
  // Farside totals column varies — sometimes "Total", sometimes empty header.
  if (/^total$/i.test(issuers[issuers.length - 1] ?? '')) {
    issuers = issuers.slice(0, -1);
  }

  // Body rows
  const bodyRows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))
    .slice(1) // skip header
    .map(m => m[1]);

  const days: FlowDay[] = [];
  for (const row of bodyRows) {
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi))
      .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    if (cells.length === 0) continue;

    const dateRaw = cells[0];
    if (!dateRaw || /^total/i.test(dateRaw) || /^minimum|^maximum|^average/i.test(dateRaw)) continue;
    const isoDate = parseFarsideDate(dateRaw);
    if (!isoDate) continue;

    const issuerCells = cells.slice(1, 1 + issuers.length);
    const perIssuer: (number | null)[] = issuerCells.map(parseFlowCell);
    const total = perIssuer.reduce<number>((s, x) => s + (x ?? 0), 0);

    days.push({ date: isoDate, perIssuer, total: Math.round(total * 10) / 10 });
  }

  // Reverse so most recent is first (Farside renders chronologically)
  days.reverse();

  return { issuers, days };
}

/** Parse "(123.4)" as -123.4, "123.4" as 123.4, "-" / "" as null. */
function parseFlowCell(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed || trimmed === '-' || trimmed === '–') return null;
  // Parens denote negative
  const isNegative = /^\(/.test(trimmed);
  const numStr = trimmed.replace(/[(),]/g, '').trim();
  const n = parseFloat(numStr);
  if (!Number.isFinite(n)) return null;
  return isNegative ? -n : n;
}

/** "02 May 2026" → "2026-05-02" */
function parseFarsideDate(s: string): string | null {
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthName = m[2].toLowerCase();
  const year = parseInt(m[3], 10);
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const monthIdx = monthMap[monthName.slice(0, 3)];
  if (monthIdx == null) return null;
  const d = new Date(Date.UTC(year, monthIdx, day));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const asset = (searchParams.get('asset') || 'btc').toLowerCase() as 'btc' | 'eth';
  if (asset !== 'btc' && asset !== 'eth') {
    return NextResponse.json({ error: 'asset must be btc or eth' }, { status: 400 });
  }

  const cacheKey = `etf_flows_${asset}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  try {
    const res = await fetchWithTimeout(
      farsideUrl(asset),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      TIMEOUT,
    );
    if (!res.ok) {
      if (cached) return NextResponse.json(cached.body, { headers: { 'X-Cache': 'STALE' } });
      return NextResponse.json({ error: `Farside HTTP ${res.status}` }, { status: 502 });
    }
    const html = await res.text();
    const parsed = parseFarsideTable(html);
    if (!parsed || parsed.days.length === 0) {
      if (cached) return NextResponse.json(cached.body, { headers: { 'X-Cache': 'STALE' } });
      return NextResponse.json({ error: 'failed to parse Farside table', hint: 'Their HTML structure may have changed.' }, { status: 502 });
    }

    const last7 = parsed.days.slice(0, 7);
    const last30 = parsed.days.slice(0, 30);
    const cumulative7d = Math.round(last7.reduce((s, d) => s + d.total, 0) * 10) / 10;
    const cumulative30d = Math.round(last30.reduce((s, d) => s + d.total, 0) * 10) / 10;

    const body: ApiResponse = {
      asset,
      issuers: parsed.issuers,
      days: parsed.days.slice(0, 90),
      cumulative7d,
      cumulative30d,
      latestDay: parsed.days[0] ?? null,
      ts: Date.now(),
    };

    l1Cache.set(cacheKey, { body, ts: Date.now() });

    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  } catch (e) {
    if (cached) return NextResponse.json(cached.body, { headers: { 'X-Cache': 'STALE' } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 502 },
    );
  }
}
