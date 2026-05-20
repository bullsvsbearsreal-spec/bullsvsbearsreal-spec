/**
 * Binance USDⓈ-M Futures client.
 *
 * Endpoints used (read-only — no trade scope required):
 *   GET /fapi/v2/account            account snapshot + per-asset positions + permissions
 *   GET /fapi/v2/positionRisk       per-symbol open positions with liquidation, leverage, mark
 *
 * Auth: HMAC-SHA256 over the query string with the API secret.
 * Header: X-MBX-APIKEY: <apiKey>
 *
 * Docs: https://binance-docs.github.io/apidocs/futures/en/#account-information-v2-user_data
 */
import { createHmac } from 'crypto';
import type { ExchangeClient, ExchangeCredentials, KeyValidation, NormalizedPosition, NormalizedExchangeTrade, NormalizedAccountBalance } from './types';

const BASE = 'https://fapi.binance.com';
const TIMEOUT_MS = 12_000;
const RECV_WINDOW_MS = 5_000;

function sign(query: string, secret: string): string {
  return createHmac('sha256', secret).update(query).digest('hex');
}

async function signedGet<T>(path: string, params: Record<string, string | number>, creds: ExchangeCredentials): Promise<T> {
  const ts = Date.now();
  const usp = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: String(ts),
    recvWindow: String(RECV_WINDOW_MS),
  });
  const signature = sign(usp.toString(), creds.apiSecret);
  usp.append('signature', signature);
  const url = `${BASE}${path}?${usp.toString()}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'X-MBX-APIKEY': creds.apiKey,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Binance ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface BinanceAccountResponse {
  feeTier: number;
  canTrade: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  totalInitialMargin?: string;
  availableBalance?: string;
  positions: Array<{
    symbol: string;
    initialMargin: string;
    maintMargin: string;
    unrealizedProfit: string;
    positionInitialMargin: string;
    leverage: string;
    isolated: boolean;
    entryPrice: string;
    maxNotional: string;
    positionSide: string;
    positionAmt: string;
    notional: string;
    isolatedWallet: string;
    updateTime: number;
  }>;
}

interface BinancePositionRisk {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  isolatedMargin: string;
  positionSide: string;
  notional: string;
}

interface BinanceIncomeRow {
  symbol: string;
  incomeType: string;
  income: string;        // USD value as string (e.g. "-0.0125")
  time: number;
  info?: string;
}

interface BinanceOpenOrder {
  symbol: string;
  type: string;            // LIMIT, MARKET, STOP, STOP_MARKET, TAKE_PROFIT, TAKE_PROFIT_MARKET, TRAILING_STOP_MARKET
  origType?: string;       // original type (preserved across modifications)
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  stopPrice: string;       // trigger price for conditional orders
  reduceOnly: boolean;
  closePosition: boolean;  // true for "close-position" stops
  workingType: string;
}

/** Order types that act as Take-Profit triggers (vs market mark/last). */
const TP_TYPES = new Set(['TAKE_PROFIT', 'TAKE_PROFIT_MARKET']);
/** Order types that act as Stop-Loss / liquidation-prevention triggers. */
const SL_TYPES = new Set(['STOP', 'STOP_MARKET', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TRAILING_STOP_MARKET']);

function symbolToBase(s: string): string {
  let sym = s.replace(/USDT$|USDC$|BUSD$/, '');
  if (sym.startsWith('1000')) sym = sym.slice(4);
  if (sym.startsWith('1M')) sym = sym.slice(2);
  return sym;
}

export const binanceClient: ExchangeClient = {
  exchange: 'Binance',

  async validateKey(creds): Promise<KeyValidation> {
    try {
      const acct = await signedGet<BinanceAccountResponse>('/fapi/v2/account', {}, creds);
      const perms = {
        canTrade: acct.canTrade,
        canDeposit: acct.canDeposit,
        canWithdraw: acct.canWithdraw,
        feeTier: acct.feeTier,
      };
      const dangerous: string[] = [];
      if (acct.canTrade) dangerous.push('canTrade');
      if (acct.canWithdraw) dangerous.push('canWithdraw');
      const warning = dangerous.length > 0
        ? `Key has dangerous scopes: ${dangerous.join(', ')}. Disable on Binance for safety.`
        : undefined;
      return { ok: true, permissions: perms, warning };
    } catch (err) {
      return { ok: false, permissions: {}, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async fetchPositions(creds): Promise<NormalizedPosition[]> {
    // Pull positions + open conditional orders in parallel — TP/SL are
    // separate orders on Binance Futures (not stored on the position
    // itself), so we have to merge them by (symbol, positionSide).
    // openOrders failure is non-fatal: we still want positions to render
    // even if the trigger fetch hits a transient HTTP error.
    const [rows, openOrders] = await Promise.all([
      signedGet<BinancePositionRisk[]>('/fapi/v2/positionRisk', {}, creds),
      signedGet<BinanceOpenOrder[]>('/fapi/v1/openOrders', {}, creds).catch(() => [] as BinanceOpenOrder[]),
    ]);

    // Index TP/SL triggers by (rawSymbol, sideKey). For one-way mode the
    // server reports positionSide="BOTH" on every order — in that case we
    // map the order's `side` (BUY/SELL) to the position direction it
    // closes: SELL = closes a long, BUY = closes a short.
    //
    // When the user has multiple TP or SL orders on one position (e.g. a
    // partial-TP at 50% + a full-TP at 100%), keep the trigger CLOSEST to
    // mark — that's the one the user will hit first, matching how the
    // Binance UI displays it. Falling back to "first seen in the array"
    // (the previous behaviour) was non-deterministic since openOrders'
    // ordering isn't documented.
    const tpsByKey = new Map<string, number[]>();
    const slsByKey = new Map<string, number[]>();
    const markByRawSym = new Map<string, number>();
    for (const r of rows) markByRawSym.set(r.symbol, parseFloat(r.markPrice) || 0);

    const triggerKey = (rawSym: string, side: 'long' | 'short') => `${rawSym}|${side}`;
    for (const o of openOrders) {
      const stop = parseFloat(o.stopPrice);
      if (!Number.isFinite(stop) || stop <= 0) continue;
      const t = (o.origType ?? o.type ?? '').toUpperCase();
      const isTp = TP_TYPES.has(t);
      const isSl = SL_TYPES.has(t);
      if (!isTp && !isSl) continue;
      // Only count orders that actually close the position. A naked
      // stop-limit-buy unrelated to the open position would otherwise
      // pollute the column.
      if (!o.closePosition && !o.reduceOnly) continue;

      let posSide: 'long' | 'short';
      if (o.positionSide === 'LONG') posSide = 'long';
      else if (o.positionSide === 'SHORT') posSide = 'short';
      else posSide = o.side === 'SELL' ? 'long' : 'short';

      const key = triggerKey(o.symbol, posSide);
      if (isTp) {
        const arr = tpsByKey.get(key) ?? [];
        arr.push(stop);
        tpsByKey.set(key, arr);
      } else {
        const arr = slsByKey.get(key) ?? [];
        arr.push(stop);
        slsByKey.set(key, arr);
      }
    }

    /** Pick the trigger closest to mark — that's the one the user hits first. */
    const pickClosest = (arr: number[] | undefined, mark: number): number | null => {
      if (!arr || arr.length === 0) return null;
      if (!mark || mark <= 0) return arr[0]; // fall back to first when mark unknown
      let best = arr[0];
      let bestDist = Math.abs(arr[0] - mark);
      for (let i = 1; i < arr.length; i++) {
        const d = Math.abs(arr[i] - mark);
        if (d < bestDist) { best = arr[i]; bestDist = d; }
      }
      return best;
    };

    const out: NormalizedPosition[] = [];
    for (const r of rows) {
      const amt = parseFloat(r.positionAmt);
      if (!Number.isFinite(amt) || amt === 0) continue;

      const side: 'long' | 'short' = amt > 0 ? 'long' : 'short';
      const size = Math.abs(amt);
      const entry = parseFloat(r.entryPrice) || 0;
      const mark = parseFloat(r.markPrice) || 0;
      const pnl = parseFloat(r.unRealizedProfit);
      const liq = parseFloat(r.liquidationPrice);
      const lev = parseFloat(r.leverage);
      const margin = parseFloat(r.isolatedMargin);

      const symbol = symbolToBase(r.symbol);
      const tk = triggerKey(r.symbol, side);
      const tp = pickClosest(tpsByKey.get(tk), mark);
      const sl = pickClosest(slsByKey.get(tk), mark);

      out.push({
        symbol,
        side,
        size,
        entryPrice: entry,
        markPrice: mark > 0 ? mark : null,
        positionValue: mark > 0 ? size * mark : null,
        unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
        leverage: Number.isFinite(lev) && lev > 0 ? lev : null,
        marginUsed: Number.isFinite(margin) && margin > 0 ? margin : null,
        liquidationPrice: Number.isFinite(liq) && liq > 0 ? liq : null,
        tpPrice: tp,
        slPrice: sl,
        cumulativeFunding: null, // populated post-hoc by sync cron via fetchCumulativeFunding
      });
    }
    return out;
  },

  async fetchCumulativeFunding(creds, sinceMs?: number): Promise<Map<string, number>> {
    const since = sinceMs ?? Date.now() - 30 * 86400_000;
    const map = new Map<string, number>();
    // Binance /fapi/v1/income returns up to 1000 rows per call. For a 30-day
    // window even active traders rarely exceed this — single call is enough.
    const rows = await signedGet<BinanceIncomeRow[]>(
      '/fapi/v1/income',
      { incomeType: 'FUNDING_FEE', startTime: since, limit: 1000 },
      creds,
    );
    for (const r of rows) {
      if (r.incomeType !== 'FUNDING_FEE') continue;
      const v = parseFloat(r.income);
      if (!Number.isFinite(v)) continue;
      const sym = symbolToBase(r.symbol);
      map.set(sym, (map.get(sym) ?? 0) + v);
    }
    return map;
  },

  /**
   * Binance USDM Futures user trades. /fapi/v1/userTrades returns up to 1000
   * fills, paginated by `fromId` or `startTime`/`endTime`. We use startTime
   * for incremental sync (caller passes the high-water-mark timestamp).
   *
   * Realised PnL is reported per-fill on closing trades via the
   * `realizedPnl` field. Fee in `commission`, fee asset in `commissionAsset`.
   * For USDT-margined contracts the fee asset is usually USDT (≈ USD).
   */
  async fetchTradeHistory(creds, sinceMs?: number): Promise<NormalizedExchangeTrade[]> {
    const since = sinceMs ?? Date.now() - 30 * 86400_000;
    interface BinanceUserTrade {
      symbol: string;
      id: number;
      orderId: number;
      side: 'BUY' | 'SELL';
      price: string;
      qty: string;
      quoteQty: string;
      realizedPnl: string;
      commission: string;
      commissionAsset: string;
      time: number;
      positionSide: 'LONG' | 'SHORT' | 'BOTH';
      maker: boolean;
      buyer: boolean;
    }
    // Binance returns at most 1000 trades per page. Loop with `fromId` until
    // exhausted or we exceed a 5-page hard cap to keep the cron tick bounded.
    const all: BinanceUserTrade[] = [];
    let fromId: number | undefined;
    for (let page = 0; page < 5; page++) {
      const params: Record<string, string | number> = { startTime: since, limit: 1000 };
      if (fromId) params.fromId = fromId + 1;
      const rows = await signedGet<BinanceUserTrade[]>('/fapi/v1/userTrades', params, creds);
      if (rows.length === 0) break;
      all.push(...rows);
      if (rows.length < 1000) break;
      fromId = rows[rows.length - 1].id;
    }

    const out: NormalizedExchangeTrade[] = [];
    for (const r of all) {
      const price = parseFloat(r.price);
      const qty = parseFloat(r.qty);
      if (!Number.isFinite(price) || !Number.isFinite(qty) || qty === 0) continue;

      const realized = parseFloat(r.realizedPnl);
      const fee = parseFloat(r.commission);
      const symbol = symbolToBase(r.symbol);
      // Direction inference:
      //   - hedge mode (positionSide=LONG/SHORT): SELL on LONG = close, BUY on LONG = open. Same logic mirrored.
      //   - one-way mode (positionSide=BOTH): use realizedPnl != 0 as the close indicator.
      let direction: NormalizedExchangeTrade['direction'] | undefined;
      if (r.positionSide === 'LONG') direction = r.side === 'BUY' ? 'open' : 'close';
      else if (r.positionSide === 'SHORT') direction = r.side === 'SELL' ? 'open' : 'close';
      else direction = Number.isFinite(realized) && realized !== 0 ? 'close' : undefined;

      out.push({
        symbol,
        side: r.side === 'BUY' ? 'buy' : 'sell',
        direction,
        size: Math.abs(qty),
        price,
        valueUsd: parseFloat(r.quoteQty) || (price * Math.abs(qty)),
        // commissionAsset is usually USDT (~$1); we treat it as USD.
        feeUsd: Number.isFinite(fee) ? Math.abs(fee) : null,
        realizedPnlUsd: Number.isFinite(realized) && realized !== 0 ? realized : null,
        venueTradeId: String(r.id),
        ts: new Date(r.time),
      });
    }
    return out;
  },

  async fetchAccountBalance(creds): Promise<NormalizedAccountBalance | null> {
    // /fapi/v2/account is the single source of truth for the USDT-M
    // futures wallet: totalMarginBalance = wallet + uPnL = equity.
    try {
      const acct = await signedGet<BinanceAccountResponse>('/fapi/v2/account', {}, creds);
      const equity = Number(acct.totalMarginBalance);
      const wallet = Number(acct.totalWalletBalance);
      const uPnl = Number(acct.totalUnrealizedProfit);
      // availableBalance is what the user could open a new position with;
      // totalInitialMargin is what's already tied up in existing positions.
      // Both are optional on older API revisions — fall back to derivation.
      const available = acct.availableBalance != null
        ? Number(acct.availableBalance)
        : Number.isFinite(wallet) && Number.isFinite(uPnl)
          ? Math.max(0, wallet + uPnl) // best-effort fallback
          : 0;
      const margin = acct.totalInitialMargin != null
        ? Number(acct.totalInitialMargin)
        : Number.isFinite(equity) && Number.isFinite(available)
          ? Math.max(0, equity - available)
          : 0;
      return {
        equityUsd: Number.isFinite(equity) ? equity : 0,
        availableUsd: Number.isFinite(available) ? available : 0,
        marginUsedUsd: Number.isFinite(margin) ? margin : 0,
      };
    } catch {
      return null;
    }
  },
};
