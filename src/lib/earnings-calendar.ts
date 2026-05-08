/**
 * Crypto Earnings Calendar — aggregate every upcoming protocol event
 * that historically moves price into a single timeline.
 *
 * Sources:
 *   - Token unlocks (existing /api/token-unlocks; cliff vesting events
 *     materially affect supply)
 *   - TGE / Token-generation events (existing /api/tge-calendar; new
 *     listings often pump 30-200%)
 *   - BTC / halving cycle (computed)
 *   - Governance votes (Snapshot.org public API)
 *
 * Each entry tagged with: type, date, description, optional impact
 * estimate (USD-equivalent of supply unlocked). Sorted by date asc.
 */

export type EarningsEventType = 'unlock' | 'tge' | 'halving' | 'governance' | 'mainnet';

export interface EarningsEvent {
  id: string;                     // stable id for dedupe
  type: EarningsEventType;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Days from now. Negative = past. */
  daysFromNow: number;
  symbol: string | null;
  name: string;
  description: string;
  /** USD value of the event's economic impact, when computable. */
  usdImpact: number | null;
  /** Source label for UI attribution. */
  source: string;
  /** Optional URL to canonical source. */
  url?: string;
}

export interface EarningsCalendar {
  ts: number;
  events: EarningsEvent[];
  summary: {
    next7Days: number;
    next30Days: number;
    totalUsdImpact7d: number;
    biggestUpcoming: EarningsEvent | null;
  };
}

const TIMEOUT = 8_000;

async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { Accept: 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function daysFromNow(isoDate: string): number {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  const now = Date.now();
  return Math.round((d.getTime() - now) / 86_400_000);
}

/** BTC halving every 210,000 blocks ≈ 4 years. Fixed schedule (deterministic). */
function nextBtcHalving(): EarningsEvent {
  // Last halving April 19, 2024 → next ~April 17, 2028.
  // Approximate; chain re-targets keep ~4-year cadence.
  const date = '2028-04-17';
  return {
    id: 'btc-halving-2028',
    type: 'halving',
    date,
    daysFromNow: daysFromNow(date),
    symbol: 'BTC',
    name: 'Bitcoin halving',
    description: 'Block subsidy drops from 3.125 BTC to 1.5625 BTC. Historically marks supply-shock cycles.',
    usdImpact: null, // hard to quantify; flag as high importance via type
    source: 'Bitcoin protocol',
  };
}

/**
 * Pure: map a single raw unlock row from /api/token-unlocks into the
 * EarningsEvent shape used by the calendar UI. Exported for testability.
 *
 * /api/token-unlocks returns:
 *   coinSymbol / coinName (not symbol / name)
 *   unlockAmount (not tokensUnlocked)
 *   unlockValue (already pre-computed in USD; not tokensUnlocked * priceUsd)
 *   source (URL string; not a label)
 *
 * Earlier this used the wrong field names → every unlock surfaced as
 * "unknown" with usdImpact=null, breaking the calendar's headline
 * "Unlocks Impact 7d" stat ($0) and "Biggest Upcoming" widget (—).
 */
export function mapUnlockToEvent(u: any): EarningsEvent {
  const symbol: string | null = u.coinSymbol ?? u.symbol ?? null;
  const name: string = u.coinName ?? u.name ?? symbol ?? 'unknown';
  const amount: number | undefined = u.unlockAmount ?? u.tokensUnlocked;
  const usd: number | null = typeof u.unlockValue === 'number'
    ? u.unlockValue
    : (typeof u.tokensUnlocked === 'number' && typeof u.priceUsd === 'number'
        ? u.tokensUnlocked * u.priceUsd
        : null);
  return {
    id: `unlock-${u.coinId ?? symbol}-${u.unlockDate}`,
    type: 'unlock',
    date: String(u.unlockDate).slice(0, 10),
    daysFromNow: daysFromNow(u.unlockDate),
    symbol,
    name,
    description: u.description ?? `${amount?.toLocaleString() ?? '?'} ${symbol ?? ''} unlocking`,
    usdImpact: usd,
    source: 'TokenUnlocks',
    url: typeof u.source === 'string' && u.source.startsWith('http') ? u.source : u.url,
  };
}

/** Pull token unlocks via the existing internal endpoint. */
async function fetchUnlocks(origin: string): Promise<EarningsEvent[]> {
  const json = await safeFetchJson<{ unlocks?: Array<any> }>(`${origin}/api/token-unlocks`);
  if (!json?.unlocks) return [];
  return json.unlocks
    .filter((u: any) => u.unlockDate)
    .map(mapUnlockToEvent);
}

/** Pull TGE events. */
async function fetchTges(origin: string): Promise<EarningsEvent[]> {
  // /api/tge-calendar returns { upcoming, recent, ts } — NOT { tges: [...] }.
  // Each entry has fdvUsd (not fdv) and website (not url). The earlier code
  // read `json.tges` which was always undefined, returning 0 TGE events
  // (calendar UI showed "TGE (0)" while real upcoming TGEs existed).
  const json = await safeFetchJson<{ upcoming?: Array<any>; recent?: Array<any>; tges?: Array<any> }>(
    `${origin}/api/tge-calendar`,
  );
  const all = [...(json?.upcoming ?? []), ...(json?.recent ?? []), ...(json?.tges ?? [])];
  return all
    .filter((t: any) => t.date)
    .map((t: any): EarningsEvent => ({
      id: `tge-${t.symbol ?? t.name}-${t.date}`,
      type: 'tge',
      date: String(t.date).slice(0, 10),
      daysFromNow: daysFromNow(t.date),
      symbol: t.symbol ?? null,
      name: t.name ?? t.symbol ?? 'TGE',
      description: t.description ?? `${t.name ?? 'token'} generation event`,
      usdImpact: typeof t.fdvUsd === 'number' ? t.fdvUsd : (typeof t.fdv === 'number' ? t.fdv : null),
      source: 'TGE Calendar',
      url: t.website ?? t.url,
    }));
}

/**
 * Pull active governance votes from Snapshot. Free public GraphQL.
 * Top 30 spaces by total proposal count to keep the working set small.
 */
async function fetchSnapshotVotes(): Promise<EarningsEvent[]> {
  const query = `
    query {
      proposals(
        first: 50,
        skip: 0,
        where: { state: "active" }
        orderBy: "end",
        orderDirection: asc
      ) {
        id
        title
        body
        end
        space { id name }
        link
      }
    }
  `;
  try {
    const res = await fetch('https://hub.snapshot.org/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const proposals: Array<any> = json?.data?.proposals ?? [];
    return proposals
      .filter(p => p.end)
      .map((p): EarningsEvent => {
        const dateMs = p.end * 1000;
        const dateIso = new Date(dateMs).toISOString().slice(0, 10);
        return {
          id: `gov-${p.id}`,
          type: 'governance',
          date: dateIso,
          daysFromNow: Math.round((dateMs - Date.now()) / 86_400_000),
          symbol: null,
          name: p.space?.name ?? 'Governance',
          description: (p.title ?? '').slice(0, 140),
          usdImpact: null,
          source: 'Snapshot',
          url: p.link ?? `https://snapshot.org/#/${p.space?.id ?? ''}/proposal/${p.id}`,
        };
      });
  } catch {
    return [];
  }
}

export async function buildEarningsCalendar(origin: string): Promise<EarningsCalendar> {
  // Fetch everything in parallel.
  const [unlocks, tges, votes] = await Promise.all([
    fetchUnlocks(origin),
    fetchTges(origin),
    fetchSnapshotVotes(),
  ]);
  const halving = nextBtcHalving();

  let events: EarningsEvent[] = [...unlocks, ...tges, ...votes, halving];

  // Drop past events (>1 day old) and far-future (>2 years out).
  events = events.filter(e => e.daysFromNow >= -1 && e.daysFromNow <= 730);

  // Dedupe by id (in case two sources collided).
  const byId = new Map<string, EarningsEvent>();
  for (const e of events) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  events = Array.from(byId.values()).sort((a, b) => a.daysFromNow - b.daysFromNow);

  const next7 = events.filter(e => e.daysFromNow >= 0 && e.daysFromNow <= 7);
  const next30 = events.filter(e => e.daysFromNow >= 0 && e.daysFromNow <= 30);
  const totalUsd7 = next7.reduce((s, e) => s + (e.usdImpact ?? 0), 0);
  const biggest = events
    .filter(e => e.daysFromNow >= 0 && e.usdImpact != null)
    .sort((a, b) => (b.usdImpact ?? 0) - (a.usdImpact ?? 0))[0] ?? null;

  return {
    ts: Date.now(),
    events,
    summary: {
      next7Days: next7.length,
      next30Days: next30.length,
      totalUsdImpact7d: totalUsd7,
      biggestUpcoming: biggest,
    },
  };
}
