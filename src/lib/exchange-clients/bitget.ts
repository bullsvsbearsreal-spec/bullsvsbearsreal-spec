/**
 * Bitget V2 Mix (USDT-M perp futures) client.
 *
 * Endpoints used (read-only):
 *   GET /api/v2/user/api-keys         API key permissions snapshot
 *   GET /api/v2/mix/position/all-position?productType=USDT-FUTURES&marginCoin=USDT
 *
 * Auth (HMAC-SHA256, base64-encoded):
 *   prehash = timestamp + method + requestPath + body
 *   signature = base64(hmac_sha256(apiSecret, prehash))
 *   timestamp = millisecond unix as string
 *
 * Headers:
 *   ACCESS-KEY, ACCESS-SIGN, ACCESS-TIMESTAMP, ACCESS-PASSPHRASE, locale=en-US
 *
 * Docs: https://www.bitget.com/api-doc/contract/intro
 */
import { createHmac } from 'crypto';
import type { ExchangeClient, ExchangeCredentials, KeyValidation, NormalizedPosition, NormalizedAccountBalance } from './types';

const BASE = 'https://api.bitget.com';
const TIMEOUT_MS = 12_000;

function sign(prehash: string, secret: string): string {
  return createHmac('sha256', secret).update(prehash).digest('base64');
}

async function signedGet<T>(path: string, query: string, creds: ExchangeCredentials): Promise<T> {
  if (!creds.passphrase) {
    throw new Error('Bitget requires passphrase');
  }
  const ts = Date.now().toString();
  const requestPath = query ? `${path}?${query}` : path;
  const prehash = `${ts}GET${requestPath}`;
  const signature = sign(prehash, creds.apiSecret);

  const url = `${BASE}${requestPath}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'ACCESS-KEY': creds.apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': ts,
      'ACCESS-PASSPHRASE': creds.passphrase,
      'locale': 'en-US',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bitget ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json?.code && json.code !== '00000') {
    throw new Error(`Bitget ${path} code=${json.code}: ${json.msg ?? 'unknown'}`);
  }
  return json as T;
}

interface BitgetApiKeysResponse {
  code: string;
  data: Array<{
    user_id: string;
    inviter_id: string;
    agent_inviter_code: string;
    channel: string;
    ips: string;
    auths: string[];     // e.g. ["read"], ["read","trade"], ["read","trade","withdraw"]
    parentId: string;
    trader: boolean;
    channel_code: string;
    regis_time: string;
  }>;
}

interface BitgetPositionsResponse {
  code: string;
  data: Array<{
    marginCoin: string;
    symbol: string;
    holdSide: 'long' | 'short';
    openDelegateSize: string;
    marginSize: string;
    available: string;
    locked: string;
    total: string;
    leverage: string;
    achievedProfits: string;
    openPriceAvg: string;
    marginMode: string;
    posMode: string;
    unrealizedPL: string;
    liquidationPrice: string;
    keepMarginRate: string;
    markPrice: string;
    breakEvenPrice: string;
    totalFee: string;
    deductedFee: string;
    cTime: string;
    uTime: string;
    autoMargin: string;
  }>;
}

interface BitgetPlanOrder {
  symbol: string;
  /** profit_plan / pos_profit (TP) | loss_plan / pos_loss (SL) | normal_plan / moving_plan / track_plan */
  planType: string;
  triggerPrice: string;
  /** "long" | "short" — direction of the position the trigger covers */
  posSide?: string;
  /** "buy" | "sell" — order direction (used when posSide is missing) */
  side?: string;
  triggerType?: string;
  orderType?: string;
}

interface BitgetPlanOrdersResponse {
  code: string;
  data: { entrustedList?: BitgetPlanOrder[] };
}

function symbolToBase(symbol: string): string {
  // BTCUSDT -> BTC, 1000PEPEUSDT -> PEPE
  let s = symbol.replace(/USDT$|USDC$/, '');
  if (s.startsWith('1000')) s = s.slice(4);
  if (s.startsWith('1M')) s = s.slice(2);
  return s;
}

export const bitgetClient: ExchangeClient = {
  exchange: 'Bitget',

  async validateKey(creds): Promise<KeyValidation> {
    try {
      const resp = await signedGet<BitgetApiKeysResponse>('/api/v2/user/api-keys', '', creds);
      const row = resp.data?.[0];
      const auths = (row?.auths ?? []).map(a => a.toLowerCase());
      const perms = {
        auths,
        ips: row?.ips,
      };
      const dangerous: string[] = [];
      if (auths.includes('trade')) dangerous.push('trade');
      if (auths.includes('withdraw')) dangerous.push('withdraw');
      const warning = dangerous.length > 0
        ? `Key has dangerous scopes: ${dangerous.join(', ')}. Set to read-only on Bitget.`
        : undefined;
      return { ok: true, permissions: perms, warning };
    } catch (err) {
      return { ok: false, permissions: {}, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async fetchPositions(creds): Promise<NormalizedPosition[]> {
    // Pull positions + pending plan orders in parallel. The plan orders
    // endpoint surfaces both position-attached TP/SL (planType=profit_plan
    // / loss_plan / pos_profit / pos_loss) and standalone trigger orders;
    // we keep only the position-closing kinds. Plan-orders failure is
    // non-fatal — a transient HTTP error there shouldn't blank positions.
    const [posResp, planResp] = await Promise.all([
      signedGet<BitgetPositionsResponse>(
        '/api/v2/mix/position/all-position',
        'productType=USDT-FUTURES&marginCoin=USDT',
        creds,
      ),
      signedGet<BitgetPlanOrdersResponse>(
        '/api/v2/mix/order/orders-plan-pending',
        'productType=USDT-FUTURES',
        creds,
      ).catch(() => ({ code: '00000', data: { entrustedList: [] } } as BitgetPlanOrdersResponse)),
    ]);

    const triggersByKey = new Map<string, { tp: number | null; sl: number | null }>();
    const trigKey = (rawSym: string, side: 'long' | 'short') => `${rawSym}|${side}`;
    for (const o of planResp.data?.entrustedList ?? []) {
      const px = parseFloat(o.triggerPrice);
      if (!Number.isFinite(px) || px <= 0) continue;
      const t = (o.planType ?? '').toLowerCase();
      const isTp = t === 'profit_plan' || t === 'pos_profit';
      const isSl = t === 'loss_plan' || t === 'pos_loss';
      if (!isTp && !isSl) continue;

      let posSide: 'long' | 'short';
      const ps = (o.posSide ?? '').toLowerCase();
      const sd = (o.side ?? '').toLowerCase();
      if (ps === 'long') posSide = 'long';
      else if (ps === 'short') posSide = 'short';
      else if (sd === 'sell') posSide = 'long';
      else if (sd === 'buy') posSide = 'short';
      // Both posSide AND side missing → can't tell which position the
      // trigger covers. Skip rather than default to a guess that would
      // attach the trigger to the wrong position.
      else continue;

      const key = trigKey(o.symbol, posSide);
      const slot = triggersByKey.get(key) ?? { tp: null, sl: null };
      if (isTp && slot.tp === null) slot.tp = px;
      else if (isSl && slot.sl === null) slot.sl = px;
      triggersByKey.set(key, slot);
    }

    const out: NormalizedPosition[] = [];
    for (const p of posResp.data ?? []) {
      const size = parseFloat(p.total);
      if (!Number.isFinite(size) || size === 0) continue;

      const entry = parseFloat(p.openPriceAvg) || 0;
      const mark = parseFloat(p.markPrice) || 0;
      const pnl = parseFloat(p.unrealizedPL);
      const liq = parseFloat(p.liquidationPrice);
      const lev = parseFloat(p.leverage);
      const margin = parseFloat(p.marginSize);

      const triggers = triggersByKey.get(trigKey(p.symbol, p.holdSide)) ?? { tp: null, sl: null };

      out.push({
        symbol: symbolToBase(p.symbol),
        side: p.holdSide,
        size,
        entryPrice: entry,
        markPrice: mark > 0 ? mark : null,
        positionValue: mark > 0 ? size * mark : null,
        unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
        leverage: Number.isFinite(lev) && lev > 0 ? lev : null,
        marginUsed: Number.isFinite(margin) && margin > 0 ? margin : null,
        liquidationPrice: Number.isFinite(liq) && liq > 0 ? liq : null,
        tpPrice: triggers.tp,
        slPrice: triggers.sl,
        cumulativeFunding: null, // populated by sync cron via fetchCumulativeFunding
      });
    }
    return out;
  },

  async fetchCumulativeFunding(creds, sinceMs?: number): Promise<Map<string, number>> {
    const since = sinceMs ?? Date.now() - 30 * 86400_000;
    const map = new Map<string, number>();
    // Bitget V2 /api/v2/mix/account/bill returns up to 100 rows, paginated by
    // `idLessThan` (cursor on bill id). Filter by businessType=funding.
    let idLessThan: string | undefined = undefined;
    for (let page = 0; page < 5; page++) {
      const qs = [
        'productType=USDT-FUTURES',
        'businessType=funding',
        `startTime=${since}`,
        'limit=100',
      ];
      if (idLessThan) qs.push(`idLessThan=${idLessThan}`);
      const json: { code: string; data: { bills: Array<{ symbol: string; amount: string; businessType: string; billId: string }>; endId?: string } } =
        await signedGet('/api/v2/mix/account/bill', qs.join('&'), creds);
      const rows = json.data?.bills ?? [];
      if (rows.length === 0) break;
      for (const r of rows) {
        if (r.businessType !== 'funding') continue;
        const v = parseFloat(r.amount);
        if (!Number.isFinite(v) || v === 0) continue;
        map.set(symbolToBase(r.symbol), (map.get(symbolToBase(r.symbol)) ?? 0) + v);
      }
      idLessThan = json.data?.endId;
      if (!idLessThan || rows.length < 100) break;
    }
    return map;
  },

  async fetchAccountBalance(creds): Promise<NormalizedAccountBalance | null> {
    // /api/v2/mix/account/accounts?productType=USDT-FUTURES returns one
    // row per coin holding for the USDT-margined futures wallet.
    // For a USDT-only account this is a single row: USDT. accountEquity
    // is the headline (USDT cash + uPnL across cross-margin positions).
    try {
      const json = await signedGet<{
        data: Array<{
          marginCoin: string;
          accountEquity?: string;
          usdtEquity?: string;
          available?: string;
          locked?: string;
          crossedMaxAvailable?: string;
        }>;
      }>('/api/v2/mix/account/accounts', 'productType=USDT-FUTURES', creds);
      const rows = json.data ?? [];
      if (rows.length === 0) return { equityUsd: 0, availableUsd: 0, marginUsedUsd: 0 };
      // Sum USDT-equivalent equity across all margin coins (Bitget can
      // have BTC + ETH + USDT all credited to the same futures account).
      let equity = 0;
      let available = 0;
      let locked = 0;
      for (const r of rows) {
        // Prefer usdtEquity when present (already USD-normalised);
        // accountEquity may be in the coin's native units for non-USDT coins.
        const eq = Number(r.usdtEquity ?? r.accountEquity ?? '0');
        if (Number.isFinite(eq)) equity += eq;
        const av = Number(r.crossedMaxAvailable ?? r.available ?? '0');
        if (Number.isFinite(av)) available += av;
        const lk = Number(r.locked ?? '0');
        if (Number.isFinite(lk)) locked += lk;
      }
      return {
        equityUsd: equity,
        availableUsd: available,
        marginUsedUsd: locked,
      };
    } catch {
      return null;
    }
  },
};
