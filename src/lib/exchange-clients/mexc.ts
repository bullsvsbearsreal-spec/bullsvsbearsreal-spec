/**
 * MEXC Futures (Contract) client — USDT-margined perp positions.
 *
 * Endpoints used (read-only):
 *   GET /api/v1/contract/detail               (public) contract metadata — contract size per symbol
 *   GET /api/v1/private/account/assets        list wallet assets — used for key validation
 *   GET /api/v1/private/position/open_positions   open perp positions
 *   GET /api/v1/private/position/funding_records  per-position funding paid/received (history)
 *
 * Auth (HMAC-SHA256, hex-encoded):
 *   prehash   = apiKey + timestamp + paramString
 *   signature = hex(hmac_sha256(apiSecret, prehash))
 *   timestamp = ms since epoch
 *
 * Where `paramString` is:
 *   - GET: the canonical query string (caller passes whatever it'd put after `?`),
 *          empty string when there are no params
 *   - POST: the raw JSON body string (we don't call any POST endpoints today)
 *
 * Headers:
 *   ApiKey, Request-Time, Signature, Content-Type
 *
 * Response envelope:
 *   { success: bool, code: number, data: any, message?: string }
 *   success=true AND code=0 = OK. Anything else throws.
 *
 * Per-contract notional gotcha: MEXC quotes futures position size in
 * CONTRACT UNITS, not base-asset units. e.g. for BTC_USDT one contract
 * is typically 0.0001 BTC. We have to multiply `holdVol` by the
 * per-symbol `contractSize` from /api/v1/contract/detail to get the
 * base-asset size that the rest of the platform expects. The contract
 * detail endpoint is public and cheap (~3KB JSON), so we cache it for
 * 24h and refresh lazily.
 *
 * Docs: https://mexcdevelop.github.io/apidocs/contract_v1_en/
 */
import { createHmac } from 'crypto';
import type {
  ExchangeClient, ExchangeCredentials, KeyValidation,
  NormalizedPosition, NormalizedExchangeTrade, NormalizedAccountBalance,
} from './types';

const BASE = 'https://contract.mexc.com';
const TIMEOUT_MS = 12_000;
const CONTRACT_TTL_MS = 24 * 60 * 60 * 1000;

function sign(prehash: string, secret: string): string {
  return createHmac('sha256', secret).update(prehash).digest('hex');
}

async function signedGet<T>(path: string, query: string, creds: ExchangeCredentials): Promise<T> {
  const ts = Date.now().toString();
  const prehash = `${creds.apiKey}${ts}${query}`;
  const signature = sign(prehash, creds.apiSecret);
  const url = query ? `${BASE}${path}?${query}` : `${BASE}${path}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'ApiKey': creds.apiKey,
      'Request-Time': ts,
      'Signature': signature,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MEXC ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json() as { success?: boolean; code?: number; data?: unknown; message?: string };
  // MEXC returns 200 with success:false on auth/permission errors —
  // the body contains the real failure reason.
  if (json.success === false || (typeof json.code === 'number' && json.code !== 0)) {
    throw new Error(`MEXC ${path} code=${json.code ?? '?'}: ${json.message ?? 'unknown'}`);
  }
  return json as T;
}

/* ─── Contract metadata cache ────────────────────────────────────── */

interface ContractDetail {
  symbol: string;            // e.g. "BTC_USDT"
  baseCoin: string;          // e.g. "BTC"
  quoteCoin: string;
  contractSize: number;      // base-asset units per contract (e.g. 0.0001)
  state: number;             // 0 = enabled
}

interface ContractDetailResponse {
  success: boolean;
  code: number;
  data: Array<{
    symbol: string;
    baseCoin: string;
    quoteCoin: string;
    contractSize: number;
    state: number;
  }>;
}

let contractCache: { bySymbol: Map<string, ContractDetail>; ts: number } | null = null;

/**
 * Lazy-load contract metadata once per 24h. Public endpoint, no auth.
 * Returns an empty map on transient fetch failures so callers degrade
 * gracefully (positions still render, sizes just come back as raw
 * contract counts — not great, but better than failing the whole
 * fetchPositions call).
 */
async function getContractSizes(): Promise<Map<string, ContractDetail>> {
  if (contractCache && Date.now() - contractCache.ts < CONTRACT_TTL_MS) {
    return contractCache.bySymbol;
  }
  try {
    const res = await fetch(`${BASE}/api/v1/contract/detail`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return contractCache?.bySymbol ?? new Map();
    const json = await res.json() as ContractDetailResponse;
    if (!json.success || !Array.isArray(json.data)) return contractCache?.bySymbol ?? new Map();
    const map = new Map<string, ContractDetail>();
    for (const c of json.data) {
      if (!c.symbol) continue;
      map.set(c.symbol, {
        symbol: c.symbol,
        baseCoin: c.baseCoin,
        quoteCoin: c.quoteCoin,
        contractSize: Number(c.contractSize) || 0,
        state: c.state,
      });
    }
    contractCache = { bySymbol: map, ts: Date.now() };
    return map;
  } catch {
    // Network blip — keep serving the old cache if we have one.
    return contractCache?.bySymbol ?? new Map();
  }
}

/* ─── Response shapes ────────────────────────────────────────────── */

interface MexcAssetsResponse {
  success: boolean;
  code: number;
  data: Array<{
    currency: string;
    positionMargin: string;
    availableBalance: string;
    cashBalance: string;
    frozenBalance: string;
    equity: string;
    unrealized: string;
    bonus: string;
  }>;
}

interface MexcOpenPositionsResponse {
  success: boolean;
  code: number;
  data: Array<{
    positionId: number;
    symbol: string;            // "BTC_USDT"
    positionType: 1 | 2;       // 1 = long, 2 = short
    openType: 1 | 2;           // 1 = isolated, 2 = cross
    state: number;             // 1 = hold
    holdVol: number;           // size IN CONTRACTS (not base asset)
    frozenVol: number;
    closeVol: number;
    holdAvgPrice: number;      // entry
    openAvgPrice: number;
    closeAvgPrice: number;
    liquidatePrice: number;
    oim: number;               // original initial margin (USD)
    im: number;                // current initial margin (USD)
    holdFee: number;           // accumulated funding fee paid (USD)
    realised: number;
    leverage: number;
    createTime: number;
    updateTime: number;
    autoAddIm: boolean;
    marketPrice?: number;      // present on newer API revisions
  }>;
}

interface MexcFundingRecord {
  id: number;
  symbol: string;            // "BTC_USDT"
  positionType: 1 | 2;
  funding: number;           // sign-positive = received, negative = paid (in USDT)
  rate: number;              // rate snapshot at settlement
  settleTime: number;
}

interface MexcFundingRecordsResponse {
  success: boolean;
  code: number;
  data: {
    pageSize: number;
    totalCount: number;
    totalPage: number;
    currentPage: number;
    resultList: MexcFundingRecord[];
  };
}

/* ─── Symbol normalization ───────────────────────────────────────── */

/**
 * MEXC perp symbols look like "BTC_USDT" / "PEPE_USDT" / "1000PEPE_USDT".
 * Strip the quote half and the "1000"/"1M" front-multipliers the same way
 * binance.ts handles them so downstream funding/OI joins work.
 */
function symbolToBase(s: string): string {
  let sym = s.split('_')[0] || s;
  if (sym.startsWith('1000')) sym = sym.slice(4);
  else if (sym.startsWith('1M')) sym = sym.slice(2);
  return sym;
}

/* ─── Client implementation ──────────────────────────────────────── */

export const mexcClient: ExchangeClient = {
  exchange: 'MEXC',

  async validateKey(creds): Promise<KeyValidation> {
    try {
      // /assets is the lightest authenticated call MEXC futures exposes.
      // Success means the key parses + has the contract-read scope.
      // MEXC doesn't expose granular permission flags on this endpoint,
      // so the `permissions` object is intentionally minimal — we record
      // that the key works, and let the user manage scopes on MEXC.
      const json = await signedGet<MexcAssetsResponse>('/api/v1/private/account/assets', '', creds);
      const usdt = json.data.find(a => a.currency === 'USDT');
      const perms = {
        assets: json.data.length,
        equityUsdt: usdt ? Number(usdt.equity) || 0 : null,
      };
      // MEXC doesn't surface canTrade/canWithdraw on this endpoint —
      // the user has to inspect the key permissions on MEXC itself.
      // Surface a generic warning so users know to disable trade/withdraw
      // for safety, matching the tone of the Binance/Bybit warnings.
      const warning = 'MEXC API key permissions aren\'t inspectable here — make sure trade/withdraw scopes are off in MEXC\'s key management.';
      return { ok: true, permissions: perms, warning };
    } catch (err) {
      return { ok: false, permissions: {}, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async fetchPositions(creds): Promise<NormalizedPosition[]> {
    // Fetch open positions + contract metadata in parallel — contract
    // sizes are cached after first call so subsequent ticks skip the
    // second request entirely.
    const [posResp, contracts] = await Promise.all([
      signedGet<MexcOpenPositionsResponse>('/api/v1/private/position/open_positions', '', creds),
      getContractSizes(),
    ]);
    const out: NormalizedPosition[] = [];
    for (const p of posResp.data) {
      if (!p.holdVol || p.holdVol <= 0) continue;
      const side: 'long' | 'short' = p.positionType === 1 ? 'long' : 'short';
      const meta = contracts.get(p.symbol);
      // contractSize is base-units-per-contract. If metadata fetch failed
      // (empty cache) we fall back to treating holdVol as base-asset size,
      // which is wrong but lets the UI render *something* with a non-zero
      // value rather than dropping the row entirely.
      const contractSize = meta?.contractSize && meta.contractSize > 0 ? meta.contractSize : 1;
      const size = p.holdVol * contractSize;
      const mark = Number(p.marketPrice) > 0 ? Number(p.marketPrice) : null;
      const entry = Number(p.holdAvgPrice) || 0;
      const positionValue = mark != null ? size * mark : (entry > 0 ? size * entry : null);
      const symbol = symbolToBase(p.symbol);

      out.push({
        symbol,
        side,
        size,
        entryPrice: entry,
        markPrice: mark,
        positionValue,
        // MEXC's `realised` is closed-position PnL; for the open position
        // we surface the implied unrealised = (mark - entry) * size * direction.
        // Only computed when mark is available — otherwise null so the UI
        // shows "—" rather than a phantom zero.
        unrealizedPnl: mark != null && entry > 0
          ? (mark - entry) * size * (side === 'long' ? 1 : -1)
          : null,
        leverage: p.leverage > 0 ? p.leverage : null,
        marginUsed: Number(p.im) > 0 ? Number(p.im) : (Number(p.oim) > 0 ? Number(p.oim) : null),
        liquidationPrice: Number(p.liquidatePrice) > 0 ? Number(p.liquidatePrice) : null,
        // MEXC bundles TP/SL into stop orders which aren't on the position
        // payload — leaving these null for now (same as we do on
        // exchanges where the trigger fetch isn't wired up yet).
        tpPrice: null,
        slPrice: null,
        // holdFee is already in USD (USDT) and sign-negative on payment.
        // The sync cron's fetchCumulativeFunding takes over for the 30d
        // window; this field is the lifetime-of-position accumulator.
        cumulativeFunding: Number.isFinite(p.holdFee) ? -Number(p.holdFee) : null,
      });
    }
    return out;
  },

  async fetchCumulativeFunding(creds, sinceMs?: number): Promise<Map<string, number>> {
    const since = sinceMs ?? Date.now() - 30 * 86400_000;
    const map = new Map<string, number>();
    // MEXC's funding-records endpoint is paginated. page_size caps at 100
    // and we walk forward until we hit a record older than `since` or the
    // page is empty / smaller than the page size. 10-page hard cap keeps
    // the sync cron bounded for very active accounts.
    let page = 1;
    const pageSize = 100;
    for (let i = 0; i < 10; i++) {
      const query = `page_num=${page}&page_size=${pageSize}`;
      let resp: MexcFundingRecordsResponse;
      try {
        resp = await signedGet<MexcFundingRecordsResponse>(
          '/api/v1/private/position/funding_records',
          query,
          creds,
        );
      } catch {
        break;
      }
      const rows = resp.data?.resultList ?? [];
      if (rows.length === 0) break;
      let crossedWindow = false;
      for (const r of rows) {
        if (r.settleTime < since) { crossedWindow = true; continue; }
        const v = Number(r.funding);
        if (!Number.isFinite(v)) continue;
        // MEXC reports funding sign-positive when the position RECEIVED
        // funding — matches the NormalizedPosition convention.
        const sym = symbolToBase(r.symbol);
        map.set(sym, (map.get(sym) ?? 0) + v);
      }
      if (crossedWindow || rows.length < pageSize) break;
      page++;
    }
    return map;
  },

  // Trade-history fetching is intentionally not implemented in v1.
  // MEXC has a /api/v1/private/order/list/history_orders endpoint with
  // a similar pagination model — we'll wire it in once we have a user
  // with a populated MEXC futures account who can verify the realizedPnl
  // mapping. Same conservative ship-without-it approach as the
  // exchanges where fetchTradeHistory isn't wired up either. The sync
  // cron treats a missing fetchTradeHistory as "no trade history
  // contribution" and proceeds normally.

  async fetchAccountBalance(creds): Promise<NormalizedAccountBalance | null> {
    // /assets returns one row per currency held. For USDT-M perps we use
    // the USDT row's equity (cash + uPnL across all positions) +
    // positionMargin (margin tied up) + availableBalance (free).
    try {
      const json = await signedGet<MexcAssetsResponse>('/api/v1/private/account/assets', '', creds);
      const usdt = json.data.find(a => a.currency === 'USDT');
      if (!usdt) return { equityUsd: 0, availableUsd: 0, marginUsedUsd: 0 };
      const equity = Number(usdt.equity);
      const available = Number(usdt.availableBalance);
      const margin = Number(usdt.positionMargin);
      return {
        equityUsd: Number.isFinite(equity) ? equity : 0,
        availableUsd: Number.isFinite(available) ? available : 0,
        marginUsedUsd: Number.isFinite(margin) ? margin : 0,
      };
    } catch {
      // Auth failure / network blip — null tells /positions to fall back
      // to the margin-sum equity rather than break the whole render.
      return null;
    }
  },
};

/** Test-only export of the canonical signing function so unit tests can
 *  pin the spec without going through fetch. Keep out of production
 *  call paths. */
export const __mexcSignForTests = sign;

/** Test-only export of the symbol normalizer so the test suite can
 *  cover the 1000PEPE / 1MBABYDOGE edge cases without touching the
 *  client object. */
export const __mexcSymbolToBaseForTests = symbolToBase;
