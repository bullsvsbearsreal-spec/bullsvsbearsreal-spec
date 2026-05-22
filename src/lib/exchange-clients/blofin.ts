/**
 * Blofin USDT-margined perpetual futures client.
 *
 * Requested by christian (Telegram, 5/20 9:26): "now if you manage to
 * do blofin you've made me happy man 🙂".
 *
 * Endpoints used (read-only — no trade scope required):
 *   GET /api/v1/account/balance      account snapshot (totalEquity, available, totalImr)
 *   GET /api/v1/account/positions    open perp positions
 *   GET /api/v1/asset/bills           funding bills (cumulative funding lookback)
 *
 * Auth — quirky signing scheme (different from OKX/Bybit/Binance):
 *   prehash    = `${path}${method}${timestamp}${nonce}${body}`
 *   hmacHex    = HMAC-SHA256(secret, prehash).hex
 *   signature  = base64(utf8-bytes-of(hmacHex))
 *
 * Yes — the hex digest is treated as a UTF-8 string and base64'd
 * (not the raw bytes). This is the contract their docs specify; getting
 * it wrong gives a 401 "Sign verify failed".
 *
 * Headers:
 *   ACCESS-KEY        api key
 *   ACCESS-SIGN       signature (base64 of hex)
 *   ACCESS-TIMESTAMP  unix ms
 *   ACCESS-NONCE      random string (we use timestamp+rand for uniqueness)
 *   ACCESS-PASSPHRASE user-supplied passphrase (set when API key was created)
 *   Content-Type      application/json (always, even on GET with no body)
 *
 * Response envelope:
 *   { code: "0", msg: "", data: any }
 *   code === "0" means OK. Anything else throws.
 *
 * Docs: https://docs.blofin.com/index.html
 */
import { createHmac, randomBytes } from 'crypto';
import type {
  ExchangeClient, ExchangeCredentials, KeyValidation,
  NormalizedPosition, NormalizedAccountBalance,
} from './types';

const BASE = 'https://openapi.blofin.com';
const TIMEOUT_MS = 12_000;

/**
 * Blofin signing — exposed for tests so we can pin the spec against a
 * known input/output pair without going through `fetch`.
 */
export function blofinSign(
  path: string,
  method: 'GET' | 'POST',
  timestamp: string,
  nonce: string,
  body: string,
  secret: string,
): string {
  const prehash = `${path}${method}${timestamp}${nonce}${body}`;
  const hmacHex = createHmac('sha256', secret).update(prehash).digest('hex');
  // Quirk: base64-encode the hex STRING (UTF-8 bytes of the hex chars),
  // not the underlying digest bytes. Documented at Blofin auth spec.
  return Buffer.from(hmacHex, 'utf8').toString('base64');
}

async function signedRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  query: string,
  body: string,
  creds: ExchangeCredentials,
): Promise<T> {
  if (!creds.passphrase) {
    throw new Error('Blofin requires a passphrase (set when the API key was created)');
  }
  const timestamp = Date.now().toString();
  // Nonce: include a random component so two requests in the same ms
  // can't collide. Blofin accepts any non-empty string per request.
  const nonce = `${timestamp}${randomBytes(4).toString('hex')}`;
  const fullPath = query ? `${path}?${query}` : path;
  const signature = blofinSign(fullPath, method, timestamp, nonce, body, creds.apiSecret);

  const url = `${BASE}${fullPath}`;
  const res = await fetch(url, {
    method,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'ACCESS-KEY': creds.apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-NONCE': nonce,
      'ACCESS-PASSPHRASE': creds.passphrase,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: method === 'POST' ? body : undefined,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Blofin ${path} HTTP ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const json = await res.json() as { code?: string | number; msg?: string; data?: unknown };
  // Blofin returns 200 with code !== "0" on auth / parameter errors. The
  // body's `msg` field carries the human-readable failure reason.
  // Coerce to String first — Blofin documents `code` as a string but some
  // edge endpoints have returned it as a number historically; the
  // strict-equality check would then miss the success case and throw on
  // OK responses.
  if (json.code != null && String(json.code) !== '0') {
    throw new Error(`Blofin ${path} code=${json.code}: ${json.msg ?? 'unknown'}`);
  }
  return json as T;
}

/* ─── Response shapes ────────────────────────────────────────────── */

interface BlofinBalanceResponse {
  code: string;
  data: Array<{
    ts: string;
    totalEquity?: string;
    isolatedEquity?: string;
    /** Total amount of USD-equivalent currently available to open new
     *  positions (free cash, post-margin). */
    available?: string;
    /** Total initial margin currently allocated across all positions. */
    totalImr?: string;
    /** Per-currency breakdown — we only need USDT for USDT-M perps. */
    details?: Array<{
      currency: string;
      equity?: string;
      /** Blofin's per-currency USD-equivalent equity (post fx-conversion).
       *  Present even when the top-level `totalEquity` is missing /
       *  zero — verified live May 2026 against christian's key where
       *  totalEquity was 0 but details[].equityUsd was correct. */
      equityUsd?: string;
      available?: string;
      isolatedEquity?: string;
      availableEquity?: string;
      unrealizedPnl?: string;
      frozen?: string;
    }>;
  }>;
}

interface BlofinPositionsResponse {
  code: string;
  data: Array<{
    positionId: string;
    instId: string;            // e.g. "BTC-USDT"
    instType: string;          // "SWAP" for perps
    marginMode: 'cross' | 'isolated';
    positionSide: 'net' | 'long' | 'short';
    /**
     * Signed CONTRACT COUNT (NOT base-currency size). Each contract is
     * worth `instrument.contractValue` in the base asset, and contract
     * values vary per pair: BTC-USDT = 0.001, ETH-USDT = 0.001,
     * XRP-USDT = 100, DOGE-USDT = 1000, etc. Multiply by contractValue
     * to convert to base-currency quantity for cross-exchange display.
     * Christian reported this as "off by 10x/100x/1000x" — BTC showed
     * 0.27 when his Blofin position was 270 contracts, etc. (May 2026).
     */
    positions: string;
    /** Same as `positions` when populated; included for clarity. */
    availablePositions?: string;
    averagePrice: string;      // entry
    markPrice: string;
    marginRatio?: string;
    liquidationPrice?: string;
    unrealizedPnl: string;
    unrealizedPnlRatio?: string;
    leverage: string;
    margin: string;            // initial margin USD allocated
    createTime?: string;
    updateTime?: string;
  }>;
}

/**
 * Public market instruments endpoint — gives per-pair contract sizes
 * needed to convert raw contract counts (in /positions) into base
 * currency quantities. Cached in-process since these change very
 * rarely (a new pair listing is the only normal mutation).
 */
interface BlofinInstrumentsResponse {
  code: string;
  data: Array<{
    instId: string;
    baseCurrency: string;
    quoteCurrency: string;
    /** Base-currency amount per contract. Multiply raw `positions` × this. */
    contractValue: string;
    contractType: 'linear' | 'inverse';
    settleCurrency: string;
    instType: string;          // 'SWAP' for perps
    state: 'live' | string;
  }>;
}

let instrumentsCache: { map: Map<string, number>; ts: number } | null = null;
const INSTRUMENTS_TTL_MS = 30 * 60 * 1000; // 30 min — contract values change very rarely

/**
 * Fetch + cache the public instruments list so we can normalize raw
 * contract counts to base-currency size. Best-effort: if the fetch
 * fails we return an empty map and downstream defaults to contractValue=1
 * (equivalent to the old behaviour, which is wrong but no-worse).
 */
async function fetchInstrumentsMap(): Promise<Map<string, number>> {
  if (instrumentsCache && Date.now() - instrumentsCache.ts < INSTRUMENTS_TTL_MS) {
    return instrumentsCache.map;
  }
  try {
    const res = await fetch(`${BASE}/api/v1/market/instruments`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return instrumentsCache?.map ?? new Map();
    const json = (await res.json()) as BlofinInstrumentsResponse;
    if (String(json.code) !== '0' || !Array.isArray(json.data)) {
      return instrumentsCache?.map ?? new Map();
    }
    const map = new Map<string, number>();
    for (const inst of json.data) {
      if (!inst.instId || !inst.contractValue) continue;
      const cv = Number(inst.contractValue);
      if (Number.isFinite(cv) && cv > 0) map.set(inst.instId, cv);
    }
    instrumentsCache = { map, ts: Date.now() };
    return map;
  } catch {
    return instrumentsCache?.map ?? new Map();
  }
}

/* ─── Symbol normalization ───────────────────────────────────────── */

/**
 * Blofin perp instIds look like "BTC-USDT" / "PEPE-USDT" / "1000PEPE-USDT".
 * Strip the quote and the 1000/1M prefix the same way our other adapters
 * do so downstream funding / OI joins find the row.
 */
function instIdToBase(s: string): string {
  let sym = s.split('-')[0] || s;
  if (sym.startsWith('1000')) sym = sym.slice(4);
  else if (sym.startsWith('1M')) sym = sym.slice(2);
  return sym;
}

/* ─── Client implementation ──────────────────────────────────────── */

export const blofinClient: ExchangeClient = {
  exchange: 'Blofin',

  async validateKey(creds): Promise<KeyValidation> {
    try {
      // /balance is the cheapest authenticated call. Success = key works
      // and has the futures-read scope. Blofin doesn't expose granular
      // permission flags on a read endpoint, so we record the equity as
      // a sanity check and warn users to manage scopes on Blofin itself.
      const json = await signedRequest<BlofinBalanceResponse>(
        '/api/v1/account/balance', 'GET', '', '', creds,
      );
      const acct = json.data?.[0];
      const equityUsdt = acct?.totalEquity ? Number(acct.totalEquity) || 0 : null;
      return {
        ok: true,
        permissions: { equityUsdt },
        warning: 'Blofin API key permissions aren\'t inspectable here — make sure trade/withdraw scopes are off in Blofin\'s key management.',
      };
    } catch (err) {
      return { ok: false, permissions: {}, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async fetchPositions(creds): Promise<NormalizedPosition[]> {
    // Fire both calls in parallel — public instruments fetch caches
    // for 30 min, so it's typically a no-op after warmup.
    const [json, contractValueMap] = await Promise.all([
      signedRequest<BlofinPositionsResponse>(
        '/api/v1/account/positions', 'GET', '', '', creds,
      ),
      fetchInstrumentsMap(),
    ]);
    const out: NormalizedPosition[] = [];
    for (const p of json.data ?? []) {
      const szi = Number(p.positions);
      if (!Number.isFinite(szi) || szi === 0) continue;
      // Blofin uses `positionSide: 'net'` for one-way mode; the sign of
      // `positions` carries the direction. In hedge mode (long/short),
      // `positionSide` is the source of truth and `positions` is unsigned.
      let side: 'long' | 'short';
      if (p.positionSide === 'long') side = 'long';
      else if (p.positionSide === 'short') side = 'short';
      else side = szi > 0 ? 'long' : 'short';
      // Per-pair contract size — christian flagged BTC, BNB, TAO, ONDO,
      // HYPE, AAVE, XRP, DOGE, BONK, XLM all displayed wrong because
      // we were treating raw contract count as base-currency size.
      // Verified live (May 2026): BTC-USDT contractValue=0.001 → 270
      // contracts × 0.001 = 0.27 BTC. Without this, /positions inflated
      // BTC quantity by 1000x and XRP/DOGE by 100-1000x in the wrong
      // direction (contractValue > 1 for cheap tokens). Pairs with
      // contractValue=1 (LINK / S / FARTCOIN / SUI / PENGU per
      // christian's report) coincidentally appeared correct.
      const contractValue = contractValueMap.get(p.instId) ?? 1;
      const contractCount = Math.abs(szi);
      const size = contractCount * contractValue;
      const entry = Number(p.averagePrice) || 0;
      const mark = Number(p.markPrice);
      const positionValue = Number.isFinite(mark) && mark > 0
        ? size * mark
        : (entry > 0 ? size * entry : null);
      const lev = Number(p.leverage);
      const liq = Number(p.liquidationPrice);
      out.push({
        symbol: instIdToBase(p.instId),
        side,
        size,
        entryPrice: entry,
        markPrice: Number.isFinite(mark) && mark > 0 ? mark : null,
        positionValue,
        unrealizedPnl: Number.isFinite(Number(p.unrealizedPnl)) ? Number(p.unrealizedPnl) : null,
        leverage: Number.isFinite(lev) && lev > 0 ? lev : null,
        marginUsed: Number.isFinite(Number(p.margin)) && Number(p.margin) > 0 ? Number(p.margin) : null,
        liquidationPrice: Number.isFinite(liq) && liq > 0 ? liq : null,
        // Blofin doesn't bundle TP/SL on the position payload; they're
        // separate trigger orders we'd have to fetch via /trade/orders-tpsl-pending.
        // Leaving null for now (same conservative ship-without-it
        // approach as MEXC for trigger orders).
        tpPrice: null,
        slPrice: null,
        // Per-position cumulative funding isn't on the positions
        // payload either — would need to aggregate from /asset/bills.
        // Sync cron's fetchCumulativeFunding takes over for the 30d
        // window if/when we implement that below.
        cumulativeFunding: null,
      });
    }
    return out;
  },

  async fetchAccountBalance(creds): Promise<NormalizedAccountBalance | null> {
    // True equity = cash + uPnL + margin (covers cross-margin users
    // whose free balance dwarfs allocated margin — same fix as the
    // other CEX adapters). Without this, /positions would understate
    // their account by the value of free wallet cash.
    //
    // Christian flagged equity showing $0 on his Blofin connection
    // (May 2026) despite having ~270 BTC-contract worth of positions.
    // Root cause: Blofin's /account/balance response can return an
    // empty top-level totalEquity when the user's margin mode pushes
    // the value down into the per-currency `details[].equityUsd`
    // breakdown. Fall back to summing the breakdown when totalEquity
    // is missing or zero so accounts with the new margin mode still
    // get a non-zero figure on /positions.
    try {
      const json = await signedRequest<BlofinBalanceResponse>(
        '/api/v1/account/balance', 'GET', '', '', creds,
      );
      const acct = json.data?.[0];
      if (!acct) return { equityUsd: 0, availableUsd: 0, marginUsedUsd: 0 };
      let equity = Number(acct.totalEquity);
      // If totalEquity is missing/zero/NaN, derive from per-currency.
      // details[].equityUsd is preferred (already FX-normalized to USD);
      // fall back to .equity which for USDT is also ~1:1 USD.
      if (!Number.isFinite(equity) || equity === 0) {
        const fromDetails = (acct.details ?? []).reduce((acc, d) => {
          const v = Number(d.equityUsd ?? d.equity ?? '0');
          return acc + (Number.isFinite(v) ? v : 0);
        }, 0);
        if (fromDetails > 0) equity = fromDetails;
      }
      // available also has a per-currency fallback (USDT row's
      // availableEquity / available).
      let available = Number(acct.available);
      if (!Number.isFinite(available) || available === 0) {
        const fromDetails = (acct.details ?? []).reduce((acc, d) => {
          const v = Number(d.availableEquity ?? d.available ?? '0');
          return acc + (Number.isFinite(v) ? v : 0);
        }, 0);
        available = fromDetails;
      }
      const margin = Number(acct.totalImr ?? '0');
      return {
        equityUsd: Number.isFinite(equity) ? equity : 0,
        availableUsd: Number.isFinite(available) ? available : 0,
        marginUsedUsd: Number.isFinite(margin) ? margin : 0,
      };
    } catch (e) {
      // Surface the error in cron logs so we can debug per-user balance
      // failures without having to ssh + grep — the cron's outer
      // try/catch otherwise swallowed these silently.
      if (typeof console !== 'undefined') {
        console.warn('[blofin] fetchAccountBalance failed:', e instanceof Error ? e.message : e);
      }
      return null;
    }
  },

  // Trade history + cumulative funding intentionally omitted for v1.
  // Blofin has /asset/bills with billType filters (funding = type "8")
  // but the pagination model is awkward (after/before by billId) and
  // we'd want a christian-verified test fixture before shipping the
  // realizedPnl mapping. Same conservative ship-without-it approach
  // as MEXC fetchTradeHistory.
};

/** Test-only re-export of the symbol normaliser for unit tests. */
export const __blofinInstIdToBaseForTests = instIdToBase;
