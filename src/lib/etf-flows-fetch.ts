/**
 * Shared Farside ETF flow fetcher + parser. Imported by both
 * /api/etf-flows and /api/etf-counterfactual so the latter doesn't have
 * to round-trip through the former (which would create a serial fetch
 * chain that hits DO's gateway timeout when Farside throttles).
 */

export interface FlowDay {
  date: string;
  perIssuer: (number | null)[];
  total: number;
}

export interface FarsideResult {
  asset: 'btc' | 'eth';
  issuers: string[];
  days: FlowDay[];
  /** True when upstream returned usable data this fetch. */
  dataAvailable: boolean;
  /** True when the data is from the Wayback Machine archive (real but
   *  stale). UI should surface a "Last updated <date>" notice so users
   *  know not to treat the latest day as fresh. */
  stale?: boolean;
  /** Source label for telemetry / UI. */
  source?: 'direct' | 'proxy' | 'wayback';
  /** Human-readable note if data unavailable / stale. */
  note?: string;
}

const TIMEOUT = 7_000;

export function farsideUrl(asset: 'btc' | 'eth'): string {
  return asset === 'btc'
    ? 'https://farside.co.uk/bitcoin-etf-flow-all-data/'
    : 'https://farside.co.uk/ethereum-etf-flow-all-data/';
}

/**
 * Try a single URL — direct or proxied — and parse the resulting HTML.
 * Returns null when the response was a CF challenge, missing the table,
 * or HTTP-failed. Caller chains direct → proxy fallback.
 */
async function tryFetchAndParse(
  url: string,
): Promise<{ issuers: string[]; days: FlowDay[] } | { error: string }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) {
      // Surface the upstream's own error body when it's a small JSON payload —
      // this is how we caught the silent "proxy returns 'Domain not allowed'
      // for farside.co.uk because it's not on the allowlist" config bug
      // that left ETF flows empty in production indefinitely.
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json') && res.headers.get('content-length') !== null
          && parseInt(res.headers.get('content-length')!, 10) < 500) {
        try {
          const j = await res.json();
          const detail = typeof j?.error === 'string' ? j.error : JSON.stringify(j).slice(0, 100);
          return { error: `HTTP ${res.status}: ${detail}` };
        } catch { /* fall through */ }
      }
      return { error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    if (/just a moment|cf-browser-verification|cf-challenge|attention required/i.test(html)) {
      return { error: 'Bot-protection page returned' };
    }
    const parsed = parseFarsideTable(html);
    if (!parsed || parsed.days.length === 0) {
      return { error: 'Could not parse Farside table — HTML may have changed' };
    }
    return parsed;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'fetch error' };
  }
}

export async function fetchFarsideFlows(asset: 'btc' | 'eth'): Promise<FarsideResult> {
  const empty: FarsideResult = {
    asset,
    issuers: [],
    days: [],
    dataAvailable: false,
    note: 'Source temporarily unreachable from this datacenter.',
  };

  const directUrl = farsideUrl(asset);

  // Try direct first — fastest path when DO IPs aren't being blocked.
  const direct = await tryFetchAndParse(directUrl);
  if ('issuers' in direct) {
    return { asset, issuers: direct.issuers, days: direct.days, dataAvailable: true, source: 'direct' };
  }

  // Direct failed — most commonly Farside's Cloudflare blocks DO datacenter
  // IPs with a 403. Same pattern we use for Binance: route through PROXY_URL
  // (the InfoHub aggregator droplet) which lives on a clean IP. Skipped
  // when no proxy configured.
  let proxyError: string | undefined;
  const proxyUrlRaw = (process.env.PROXY_URL || '').trim();
  if (proxyUrlRaw && proxyUrlRaw.startsWith('https://')) {
    const proxyBase = proxyUrlRaw.replace(/\/$/, '');
    const proxied = await tryFetchAndParse(`${proxyBase}/?url=${encodeURIComponent(directUrl)}`);
    if ('issuers' in proxied) {
      return { asset, issuers: proxied.issuers, days: proxied.days, dataAvailable: true, source: 'proxy' };
    }
    proxyError = proxied.error;
  }

  // Tertiary fallback: Wayback Machine. Returns the latest archived
  // snapshot — typically a few weeks stale but still has real flow data.
  // Better than rendering the page completely empty. Only used when
  // direct + proxy both failed, so we accept the staleness penalty.
  // The /web/3/ path tells Wayback to redirect to the latest snapshot.
  const waybackUrl = `https://web.archive.org/web/3/${directUrl}`;
  const wayback = await tryFetchAndParse(waybackUrl);
  if ('issuers' in wayback && wayback.days.length > 0) {
    const latest = wayback.days[wayback.days.length - 1]?.date ?? 'unknown';
    return {
      asset,
      issuers: wayback.issuers,
      days: wayback.days,
      dataAvailable: true,
      stale: true,
      source: 'wayback',
      note: `Showing archived data through ${latest}. Live source unreachable from this datacenter.`,
    };
  }

  // Everything failed — return graceful empty state.
  const errors = [
    `Farside ${direct.error}`,
    proxyError ? `proxy ${proxyError}` : null,
    `archive ${'error' in wayback ? wayback.error : 'no data'}`,
  ].filter(Boolean).join('; ');
  return { ...empty, note: errors + '.' };
}

/* ─── HTML parsing ────────────────────────────────────────────────────── */

function parseFarsideTable(html: string): { issuers: string[]; days: FlowDay[] } | null {
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;
  const tableHtml = tableMatch[1];

  const headerRowMatch = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!headerRowMatch) return null;
  const headerCells = Array.from(headerRowMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi))
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
    .filter(Boolean);
  let issuers = headerCells.slice(1);
  if (/^total$/i.test(issuers[issuers.length - 1] ?? '')) {
    issuers = issuers.slice(0, -1);
  }

  const bodyRows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))
    .slice(1)
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

  days.reverse();
  return { issuers, days };
}

/**
 * Parse a single Farside flow cell into a millions-USD number.
 *
 * Farside uses parens to denote negatives (`(33.4)` → -33.4M outflow).
 * A regression that drops the paren-detection would silently invert
 * outflows into inflows and corrupt the entire /etf-flows page.
 *
 * Returns null for empty cells / em-dashes / unparseable values.
 */
export function parseFlowCell(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed || trimmed === '-' || trimmed === '–') return null;
  const isNegative = /^\(/.test(trimmed);
  const numStr = trimmed.replace(/[(),]/g, '').trim();
  const n = parseFloat(numStr);
  if (!Number.isFinite(n)) return null;
  return isNegative ? -n : n;
}

/**
 * Parse a Farside date label like "05 May 2026" into ISO YYYY-MM-DD.
 * Returns null if the format doesn't match (silently skip the row;
 * Farside uses non-date rows for "Average", "Minimum", "Maximum").
 */
export function parseFarsideDate(s: string): string | null {
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
