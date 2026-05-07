/**
 * OKX V5 client (perpetual SWAP positions, USDT-margined).
 *
 * Endpoints used (read-only):
 *   GET /api/v5/account/config       account/permissions snapshot
 *   GET /api/v5/account/positions    open positions
 *
 * Auth (HMAC-SHA256, base64-encoded):
 *   prehash   = timestamp + method + requestPath + body
 *   signature = base64(hmac_sha256(apiSecret, prehash))
 *   timestamp = ISO8601 with millisecond precision
 *
 * Headers:
 *   OK-ACCESS-KEY, OK-ACCESS-SIGN, OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE
 *
 * Docs: https://www.okx.com/docs-v5/en/
 */
import { createHmac } from 'crypto';
import type { ExchangeClient, ExchangeCredentials, KeyValidation, NormalizedPosition, NormalizedExchangeTrade } from './types';

const BASE = 'https://www.okx.com';
const TIMEOUT_MS = 12_000;

function sign(prehash: string, secret: string): string {
  return createHmac('sha256', secret).update(prehash).digest('base64');
}

async function signedGet<T>(path: string, query: string, creds: ExchangeCredentials): Promise<T> {
  if (!creds.passphrase) {
    throw new Error('OKX requires passphrase');
  }
  const ts = new Date().toISOString();
  const requestPath = query ? `${path}?${query}` : path;
  const prehash = `${ts}GET${requestPath}`;
  const signature = sign(prehash, creds.apiSecret);

  const url = `${BASE}${requestPath}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'OK-ACCESS-KEY': creds.apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': ts,
      'OK-ACCESS-PASSPHRASE': creds.passphrase,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OKX ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  // OKX returns 200 + code:"0" on success; non-zero code = error
  if (json?.code && json.code !== '0') {
    throw new Error(`OKX ${path} code=${json.code}: ${json.msg ?? 'unknown'}`);
  }
  return json as T;
}

interface OkxAccountConfigResponse {
  code: string;
  data: Array<{
    uid: string;
    acctLv: string;
    posMode: string;
    autoLoan: boolean;
    greeksType: string;
    level: string;
    perm: string;       // pipe-separated permission flags
    spotOffsetType: string;
    enableSpotBorrow: boolean;
    label: string;
    ip: string;
  }>;
}

interface OkxPositionsResponse {
  code: string;
  data: Array<{
    instId: string;
    instType: string;
    posSide: string;        // 'long' | 'short' | 'net'
    pos: string;
    avgPx: string;
    markPx: string;
    last: string;
    upl: string;
    liqPx: string;
    lever: string;
    margin: string;
    notionalUsd: string;
    closeOrderAlgo: Array<{ tpTriggerPx: string; slTriggerPx: string; algoId: string; algoOrdType: string }>;
  }>;
}

function instIdToSymbol(instId: string): string {
  // BTC-USDT-SWAP -> BTC ; 1000PEPE-USDT-SWAP -> PEPE
  let sym = instId.split('-')[0];
  if (sym.startsWith('1000')) sym = sym.slice(4);
  if (sym.startsWith('1M')) sym = sym.slice(2);
  return sym;
}

export const okxClient: ExchangeClient = {
  exchange: 'OKX',

  async validateKey(creds): Promise<KeyValidation> {
    try {
      const cfg = await signedGet<OkxAccountConfigResponse>('/api/v5/account/config', '', creds);
      const row = cfg.data?.[0];
      const permFlags = (row?.perm ?? '').split(',').map(s => s.trim()).filter(Boolean);
      const perms = {
        accountLevel: row?.acctLv,
        permFlags,
        ip: row?.ip,
      };
      const dangerous: string[] = [];
      for (const p of permFlags) {
        const lower = p.toLowerCase();
        if (lower === 'trade' || lower === 'withdraw') dangerous.push(p);
      }
      const warning = dangerous.length > 0
        ? `Key has dangerous scopes: ${dangerous.join(', ')}. Set to read-only on OKX.`
        : undefined;
      return { ok: true, permissions: perms, warning };
    } catch (err) {
      return { ok: false, permissions: {}, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async fetchPositions(creds): Promise<NormalizedPosition[]> {
    const out: NormalizedPosition[] = [];
    // instType=SWAP -> perpetual contracts only (excludes spot, futures-dated, options)
    const json = await signedGet<OkxPositionsResponse>('/api/v5/account/positions', 'instType=SWAP', creds);
    for (const p of json.data ?? []) {
      const posSize = parseFloat(p.pos);
      if (!Number.isFinite(posSize) || posSize === 0) continue;

      // OKX uses posSide for hedge mode; in net mode posSide is 'net' and pos sign indicates direction
      let side: 'long' | 'short';
      if (p.posSide === 'long') side = 'long';
      else if (p.posSide === 'short') side = 'short';
      else side = posSize > 0 ? 'long' : 'short';

      const size = Math.abs(posSize);
      const entry = parseFloat(p.avgPx) || 0;
      const mark = parseFloat(p.markPx) || parseFloat(p.last) || 0;
      const pnl = parseFloat(p.upl);
      const liq = parseFloat(p.liqPx);
      const lev = parseFloat(p.lever);
      const margin = parseFloat(p.margin);
      const value = parseFloat(p.notionalUsd);

      // closeOrderAlgo carries TP/SL (first entry only — OKX allows multiple)
      const algo = Array.isArray(p.closeOrderAlgo) && p.closeOrderAlgo.length > 0 ? p.closeOrderAlgo[0] : null;
      const tp = algo ? parseFloat(algo.tpTriggerPx) : NaN;
      const sl = algo ? parseFloat(algo.slTriggerPx) : NaN;

      out.push({
        symbol: instIdToSymbol(p.instId),
        side,
        size,
        entryPrice: entry,
        markPrice: mark > 0 ? mark : null,
        positionValue: Number.isFinite(value) && value > 0 ? value : (mark > 0 ? size * mark : null),
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
    // OKX /api/v5/account/bills type=8 = funding fee. Pagination via `before`
    // (item id), but for a 30-day window single call usually suffices.
    // Cap at 5 pages (= 500 rows) so a degenerate account can't blow our budget.
    let beforeId: string | undefined = undefined;
    for (let page = 0; page < 5; page++) {
      const qs = ['type=8', 'instType=SWAP', `begin=${since}`, 'limit=100'];
      if (beforeId) qs.push(`before=${beforeId}`);
      const json: { code: string; data: Array<{ instId: string; bal: string; balChg: string; ts: string; billId: string }> } =
        await signedGet('/api/v5/account/bills', qs.join('&'), creds);
      const rows = json.data ?? [];
      if (rows.length === 0) break;
      for (const r of rows) {
        const v = parseFloat(r.balChg);
        if (!Number.isFinite(v) || v === 0) continue;
        map.set(instIdToSymbol(r.instId), (map.get(instIdToSymbol(r.instId)) ?? 0) + v);
      }
      // Walk backwards in time
      beforeId = rows[rows.length - 1].billId;
      if (rows.length < 100) break;
    }
    return map;
  },

  /**
   * OKX V5 fills history.
   *   GET /api/v5/trade/fills-history?instType=SWAP&begin=<ms>&limit=100
   *
   * `subType` indicates open/close: 1=open long, 2=open short, 3=close long,
   * 4=close short. `pnl` carries realized PnL on closing fills. `fee` is
   * negative when paid (we flip sign for our convention).
   */
  async fetchTradeHistory(creds, sinceMs?: number): Promise<NormalizedExchangeTrade[]> {
    const since = sinceMs ?? Date.now() - 30 * 86400_000;
    interface OkxFill {
      instId: string;
      tradeId: string;
      side: 'buy' | 'sell';
      fillSz: string;
      fillPx: string;
      fillPnl?: string;
      fee?: string;
      feeCcy?: string;
      ts: string;
      subType: string;
      execType?: string;
    }
    const out: NormalizedExchangeTrade[] = [];
    let afterId: string | undefined;
    for (let page = 0; page < 5; page++) {
      const qs = ['instType=SWAP', `begin=${since}`, 'limit=100'];
      if (afterId) qs.push(`after=${afterId}`);
      const json: { code: string; data: OkxFill[] } =
        await signedGet('/api/v5/trade/fills-history', qs.join('&'), creds);
      const rows = json.data ?? [];
      if (rows.length === 0) break;
      for (const r of rows) {
        const price = parseFloat(r.fillPx);
        const qty = parseFloat(r.fillSz);
        if (!Number.isFinite(price) || !Number.isFinite(qty) || qty === 0) continue;
        const pnl = r.fillPnl != null ? parseFloat(r.fillPnl) : NaN;
        const fee = r.fee != null ? parseFloat(r.fee) : NaN;
        let direction: NormalizedExchangeTrade['direction'] | undefined;
        if (r.subType === '1' || r.subType === '2') direction = 'open';
        else if (r.subType === '3' || r.subType === '4') direction = 'close';
        else direction = Number.isFinite(pnl) && pnl !== 0 ? 'close' : undefined;

        out.push({
          symbol: instIdToSymbol(r.instId),
          side: r.side === 'buy' ? 'buy' : 'sell',
          direction,
          size: Math.abs(qty),
          price,
          valueUsd: price * Math.abs(qty),
          // OKX fee is negative when paid → flip sign so feeUsd is positive cost.
          feeUsd: Number.isFinite(fee) ? Math.abs(fee) : null,
          realizedPnlUsd: Number.isFinite(pnl) && pnl !== 0 ? pnl : null,
          venueTradeId: r.tradeId,
          ts: new Date(parseInt(r.ts, 10)),
        });
      }
      // OKX paginates with `after` = last billId (move backwards in time).
      // Last item id = oldest in this page.
      const last = rows[rows.length - 1] as any;
      afterId = last.billId ?? last.tradeId;
      if (rows.length < 100) break;
    }
    return out;
  },
};
