/**
 * Bybit V5 Unified Trading client (Linear / USDT perps).
 *
 * Endpoints used (read-only):
 *   GET /v5/user/query-api          API-key permissions snapshot
 *   GET /v5/position/list?category=linear&settleCoin=USDT
 *
 * Auth (HMAC-SHA256):
 *   sign_payload = timestamp + apiKey + recvWindow + queryString
 *   X-BAPI-SIGN: hmac_sha256(apiSecret, sign_payload)
 *   X-BAPI-API-KEY, X-BAPI-TIMESTAMP, X-BAPI-RECV-WINDOW headers required
 *
 * Docs: https://bybit-exchange.github.io/docs/v5/intro
 */
import { createHmac } from 'crypto';
import type { ExchangeClient, ExchangeCredentials, KeyValidation, NormalizedPosition, NormalizedExchangeTrade } from './types';

/**
 * Strip USDT/USDC quote + 1000/1M multipliers + SHIB1000 suffix to get the
 * canonical base symbol Bybit uses elsewhere (and that funding_snapshots
 * stores). Same logic as fetchPositions inline-strip but factored out so
 * fetchTradeHistory can reuse it.
 */
function bybitToBase(s: string): string {
  let sym = s.replace(/USDT$|USDC$/, '');
  if (sym.startsWith('1000')) sym = sym.slice(4);
  if (sym.startsWith('1M')) sym = sym.slice(2);
  if (/^[A-Z]+1000$/.test(sym)) sym = sym.slice(0, -4);
  return sym;
}

const BASE = 'https://api.bybit.com';
const TIMEOUT_MS = 12_000;
const RECV_WINDOW_MS = '5000';

async function signedGet<T>(
  path: string,
  params: Record<string, string>,
  creds: ExchangeCredentials,
): Promise<T> {
  const ts = Date.now().toString();
  const qs = new URLSearchParams(params).toString();
  // Bybit V5 sign payload: timestamp + apiKey + recvWindow + queryString
  const signPayload = ts + creds.apiKey + RECV_WINDOW_MS + qs;
  const signature = createHmac('sha256', creds.apiSecret).update(signPayload).digest('hex');

  const url = qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'X-BAPI-API-KEY': creds.apiKey,
      'X-BAPI-TIMESTAMP': ts,
      'X-BAPI-RECV-WINDOW': RECV_WINDOW_MS,
      'X-BAPI-SIGN': signature,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bybit ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  // Bybit always returns 200 with retCode in body — translate non-zero to error
  if (json?.retCode !== 0) {
    throw new Error(`Bybit ${path} retCode=${json?.retCode}: ${json?.retMsg ?? 'unknown'}`);
  }
  return json as T;
}

interface BybitApiKeyInfoResponse {
  result: {
    id: string;
    note: string;
    apiKey: string;
    readOnly: number;       // 0 = read-write, 1 = read-only
    permissions: {
      ContractTrade: string[];
      Spot: string[];
      Wallet: string[];
      Options: string[];
      Derivatives: string[];
      CopyTrading: string[];
      BlockTrade: string[];
      Exchange: string[];
      NFT: string[];
      Affiliate: string[];
    };
    expiredAt: string;
    createdAt: string;
    type: number;           // 1 = personal, 2 = sub
  };
}

interface BybitPositionListResponse {
  result: {
    list: Array<{
      symbol: string;
      side: 'Buy' | 'Sell' | '';
      size: string;
      avgPrice: string;
      markPrice: string;
      positionValue: string;
      unrealisedPnl: string;
      liqPrice: string;
      leverage: string;
      positionIM: string;
      positionMM: string;
      takeProfit: string;
      stopLoss: string;
      cumRealisedPnl: string;
    }>;
    nextPageCursor: string;
  };
}

export const bybitClient: ExchangeClient = {
  exchange: 'Bybit',

  async validateKey(creds): Promise<KeyValidation> {
    try {
      const info = await signedGet<BybitApiKeyInfoResponse>('/v5/user/query-api', {}, creds);
      const r = info.result;
      const perms = {
        readOnly: r.readOnly === 1,
        contractTrade: r.permissions?.ContractTrade ?? [],
        wallet: r.permissions?.Wallet ?? [],
        spot: r.permissions?.Spot ?? [],
      };
      const dangerous: string[] = [];
      if (r.readOnly !== 1) dangerous.push('write-enabled');
      if ((r.permissions?.Wallet ?? []).some(p => p.toLowerCase().includes('withdraw'))) {
        dangerous.push('Wallet: withdraw');
      }
      const warning = dangerous.length > 0
        ? `Key has dangerous scopes: ${dangerous.join(', ')}. Set to read-only on Bybit.`
        : undefined;
      return { ok: true, permissions: perms, warning };
    } catch (err) {
      return { ok: false, permissions: {}, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async fetchPositions(creds): Promise<NormalizedPosition[]> {
    const out: NormalizedPosition[] = [];
    // settleCoin=USDT covers the vast majority of perp positions for retail users
    const json = await signedGet<BybitPositionListResponse>('/v5/position/list', {
      category: 'linear',
      settleCoin: 'USDT',
      limit: '200',
    }, creds);
    for (const p of json.result?.list ?? []) {
      const size = parseFloat(p.size);
      if (!Number.isFinite(size) || size === 0) continue;
      // Bybit returns side='' for closed positions; skip just in case
      const side: 'long' | 'short' | null =
        p.side === 'Buy' ? 'long' : p.side === 'Sell' ? 'short' : null;
      if (!side) continue;

      const entry = parseFloat(p.avgPrice) || 0;
      const mark = parseFloat(p.markPrice) || 0;
      const value = parseFloat(p.positionValue);
      const pnl = parseFloat(p.unrealisedPnl);
      const liq = parseFloat(p.liqPrice);
      const lev = parseFloat(p.leverage);
      const margin = parseFloat(p.positionIM);
      const tp = parseFloat(p.takeProfit);
      const sl = parseFloat(p.stopLoss);

      let symbol = p.symbol.replace(/USDT$|USDC$/, '');
      if (symbol.startsWith('1000')) symbol = symbol.slice(4);
      if (symbol.startsWith('1M')) symbol = symbol.slice(2);
      // Bybit historical quirk: SHIB has the 1000-multiplier as a SUFFIX
      // ("SHIB1000USDT") instead of the usual prefix. Without stripping
      // here, a Bybit SHIB position lands as symbol="SHIB1000" and never
      // joins funding_snapshots (which stores it as plain "SHIB" because
      // /api/funding's Bybit fetcher already normalises).
      if (/^[A-Z]+1000$/.test(symbol)) symbol = symbol.slice(0, -4);

      out.push({
        symbol,
        side,
        size,
        entryPrice: entry,
        markPrice: mark > 0 ? mark : null,
        positionValue: Number.isFinite(value) && value > 0 ? value : null,
        unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
        leverage: Number.isFinite(lev) && lev > 0 ? lev : null,
        marginUsed: Number.isFinite(margin) && margin > 0 ? margin : null,
        liquidationPrice: Number.isFinite(liq) && liq > 0 ? liq : null,
        tpPrice: Number.isFinite(tp) && tp > 0 ? tp : null,
        slPrice: Number.isFinite(sl) && sl > 0 ? sl : null,
        cumulativeFunding: null, // populated by sync cron via fetchCumulativeFunding
      });
    }
    return out;
  },

  async fetchCumulativeFunding(creds, sinceMs?: number): Promise<Map<string, number>> {
    const since = sinceMs ?? Date.now() - 30 * 86400_000;
    const map = new Map<string, number>();
    // Bybit V5 transaction-log: type=SETTLEMENT entries are funding payments.
    // Pagination via cursor — keep going until empty or 5 pages (= 250 rows max).
    let cursor: string | undefined = undefined;
    for (let page = 0; page < 5; page++) {
      const params: Record<string, string> = {
        category: 'linear',
        type: 'SETTLEMENT',
        startTime: String(since),
        limit: '50',
      };
      if (cursor) params.cursor = cursor;
      const json: { result: { list: Array<{ symbol: string; funding: string; cashFlow: string; type: string }>; nextPageCursor: string } } =
        await signedGet('/v5/account/transaction-log', params, creds);
      const list = json.result?.list ?? [];
      if (list.length === 0) break;
      for (const r of list) {
        if (r.type !== 'SETTLEMENT') continue;
        // Bybit reports funding as `funding` (signed; negative = paid out).
        // Fall back to `cashFlow` if the field shape changes.
        const v = parseFloat(r.funding) || parseFloat(r.cashFlow) || 0;
        if (!Number.isFinite(v) || v === 0) continue;
        let sym = r.symbol.replace(/USDT$|USDC$/, '');
        if (sym.startsWith('1000')) sym = sym.slice(4);
        if (sym.startsWith('1M')) sym = sym.slice(2);
        if (/^[A-Z]+1000$/.test(sym)) sym = sym.slice(0, -4); // SHIB1000 → SHIB
        map.set(sym, (map.get(sym) ?? 0) + v);
      }
      cursor = json.result?.nextPageCursor;
      if (!cursor) break;
    }
    return map;
  },

  /**
   * Bybit V5 execution list — every fill the account has settled.
   *   GET /v5/execution/list?category=linear&startTime=...&limit=100
   *
   * Realised PnL is in `closedPnl` (only on closing fills). Fee in
   * `execFee` (signed: negative = received). `side` = 'Buy' | 'Sell'.
   * `closedSize` > 0 indicates a closing fill (Bybit reports the qty
   * being closed by this fill).
   */
  async fetchTradeHistory(creds, sinceMs?: number): Promise<NormalizedExchangeTrade[]> {
    const since = sinceMs ?? Date.now() - 30 * 86400_000;
    interface BybitExec {
      execId: string;
      symbol: string;
      side: 'Buy' | 'Sell';
      execPrice: string;
      execQty: string;
      execValue: string;
      execFee: string;
      feeCurrency: string;
      closedSize: string;
      closedPnl?: string;
      execTime: string;       // ms timestamp as string
      execType: string;        // Trade | Funding | BustTrade | Settle | ...
    }
    const out: NormalizedExchangeTrade[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const params: Record<string, string> = {
        category: 'linear',
        startTime: String(since),
        limit: '100',
      };
      if (cursor) params.cursor = cursor;
      const json: { result: { list: BybitExec[]; nextPageCursor: string } } =
        await signedGet('/v5/execution/list', params, creds);
      const list = json.result?.list ?? [];
      if (list.length === 0) break;
      for (const r of list) {
        if (r.execType !== 'Trade') continue; // ignore funding / settle / bust rows
        const price = parseFloat(r.execPrice);
        const qty = parseFloat(r.execQty);
        if (!Number.isFinite(price) || !Number.isFinite(qty) || qty === 0) continue;
        const closed = parseFloat(r.closedSize);
        const pnl = r.closedPnl ? parseFloat(r.closedPnl) : NaN;
        const fee = parseFloat(r.execFee);
        const direction: NormalizedExchangeTrade['direction'] | undefined =
          Number.isFinite(closed) && closed > 0 ? 'close' : 'open';
        out.push({
          symbol: bybitToBase(r.symbol),
          side: r.side === 'Buy' ? 'buy' : 'sell',
          direction,
          size: Math.abs(qty),
          price,
          valueUsd: parseFloat(r.execValue) || price * Math.abs(qty),
          // Bybit fees are usually USDT (~$1) on linear contracts.
          feeUsd: Number.isFinite(fee) ? Math.abs(fee) : null,
          realizedPnlUsd: Number.isFinite(pnl) && pnl !== 0 ? pnl : null,
          venueTradeId: r.execId,
          ts: new Date(parseInt(r.execTime, 10)),
        });
      }
      cursor = json.result?.nextPageCursor;
      if (!cursor) break;
    }
    return out;
  },
};
