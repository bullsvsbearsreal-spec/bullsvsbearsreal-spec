/**
 * Hyperliquid wallet position fetcher.
 *
 * Hyperliquid is its own L1 — no API key needed for read-only position lookups.
 * Just POST a {type:'clearinghouseState', user:address} to /info and the API
 * returns the full account state including every open position.
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 *
 * We make TWO parallel calls per address:
 *   - clearinghouseState: open positions (size / entry / pnl / liq / funding)
 *   - frontendOpenOrders: trigger orders we then mine for TP/SL prices
 *     attached to each position.
 *
 * Position object fields used (HL returns positions denominated in the base
 * coin, e.g. SOL count, with USD values pre-computed alongside):
 *   coin            'SOL', 'BTC', etc.
 *   szi             signed size (positive=long, negative=short, zero=closed)
 *   entryPx         entry price
 *   positionValue   USD value of the position
 *   unrealizedPnl   in USD
 *   leverage.value  current leverage as a number
 *   liquidationPx   string or null
 *   marginUsed      USD margin allocated
 *   cumFunding.allTime / sinceOpen / sinceChange — funding paid/received in USD
 */
import type { NormalizedPosition, NormalizedTrade, WalletClient } from './types';

const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
const TIMEOUT_MS = 10_000;

interface HLPositionEntry {
  position: {
    coin: string;
    szi: string;
    entryPx?: string;
    positionValue?: string;
    unrealizedPnl?: string;
    returnOnEquity?: string;
    leverage?: { type: 'cross' | 'isolated'; value: number };
    liquidationPx?: string | null;
    marginUsed?: string;
    maxLeverage?: number;
    cumFunding?: {
      allTime: string;
      sinceOpen: string;
      sinceChange: string;
    };
  };
  type: string;
}

interface HLClearingHouseState {
  marginSummary?: { accountValue: string; totalNtlPos: string; totalRawUsd: string; totalMarginUsed: string };
  crossMaintenanceMarginUsed?: string;
  withdrawable?: string;
  assetPositions?: HLPositionEntry[];
  time?: number;
}

interface HLOpenOrder {
  coin: string;
  side: 'B' | 'A';                      // Buy or Ask
  limitPx: string;
  sz: string;
  triggerPx?: string;
  isTrigger?: boolean;
  isPositionTpsl?: boolean;
  reduceOnly?: boolean;
  orderType?: string;                   // 'Stop Loss' | 'Take Profit' | 'Limit' | 'Stop Limit' | …
  triggerCondition?: string;            // 'above' | 'below' | 'N/A'
}

/** Per-coin TP/SL values mined from frontendOpenOrders for a given side. */
interface TpsLPair {
  tp: number | null;
  sl: number | null;
}

async function fetchOpenOrders(address: string): Promise<HLOpenOrder[]> {
  try {
    const res = await fetch(HL_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ type: 'frontendOpenOrders', user: address }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? (json as HLOpenOrder[]) : [];
  } catch {
    return [];
  }
}

/**
 * Build a `coin → { tp, sl }` lookup from a flat list of open orders.
 * For each (coin, side) we keep the TP closest to mark and the SL closest
 * to mark — common for stacked exits.
 *
 * Side convention:
 *   long position  → TP triggers above entry, SL triggers below
 *   short position → TP triggers below entry, SL triggers above
 * We classify by `orderType` directly when present (HL labels them
 * "Take Profit Market" / "Stop Market" / etc.); otherwise we fall back to
 * the trigger-direction heuristic against the position side.
 */
function indexTpsl(orders: HLOpenOrder[], positions: HLPositionEntry[]): Map<string, TpsLPair> {
  const out = new Map<string, TpsLPair>();
  if (!orders.length) return out;

  // Build a coin → side map from positions so we can use the heuristic.
  const sideByCoin = new Map<string, 'long' | 'short'>();
  for (const e of positions) {
    const szi = parseFloat(e.position.szi);
    if (Number.isFinite(szi) && szi !== 0) {
      sideByCoin.set(e.position.coin, szi > 0 ? 'long' : 'short');
    }
  }

  for (const o of orders) {
    if (!o.isTrigger || !o.triggerPx) continue;
    if (!o.isPositionTpsl) continue;
    const px = parseFloat(o.triggerPx);
    if (!Number.isFinite(px) || px <= 0) continue;
    const positionSide = sideByCoin.get(o.coin);
    if (!positionSide) continue;

    // Decide TP vs SL.
    let kind: 'tp' | 'sl' | null = null;
    const ot = (o.orderType || '').toLowerCase();
    if (ot.includes('take profit') || ot.includes('takeprofit') || ot === 'tp') kind = 'tp';
    else if (ot.includes('stop loss') || ot.includes('stoploss') || ot === 'sl' || ot.includes('stop')) kind = 'sl';
    else {
      // Heuristic by trigger direction.
      const cond = (o.triggerCondition || '').toLowerCase();
      if (positionSide === 'long')  kind = cond === 'above' ? 'tp' : 'sl';
      else                           kind = cond === 'below' ? 'tp' : 'sl';
    }
    if (!kind) continue;

    const cur = out.get(o.coin) ?? { tp: null, sl: null };
    if (kind === 'tp') {
      // Keep the FIRST TP we see (typically the only one). If multiple, keep
      // the one closest to mark — but mark isn't on the order, so first wins.
      if (cur.tp === null) cur.tp = px;
    } else {
      if (cur.sl === null) cur.sl = px;
    }
    out.set(o.coin, cur);
  }
  return out;
}

export const hyperliquidWalletClient: WalletClient = {
  chain: 'hyperliquid',
  displayName: 'Hyperliquid',

  async fetchPositions(address: string): Promise<NormalizedPosition[]> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];

    // Two parallel calls: positions + open orders for TP/SL mining.
    const [stateRes, openOrders] = await Promise.all([
      fetch(HL_INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ type: 'clearinghouseState', user: address }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
      fetchOpenOrders(address),
    ]);

    if (!stateRes.ok) {
      throw new Error(`Hyperliquid clearinghouseState HTTP ${stateRes.status}`);
    }
    const json = (await stateRes.json()) as HLClearingHouseState;
    const tpslByCoin = indexTpsl(openOrders, json.assetPositions ?? []);

    const out: NormalizedPosition[] = [];
    for (const entry of json.assetPositions ?? []) {
      const p = entry.position;
      const szi = parseFloat(p.szi);
      if (!Number.isFinite(szi) || szi === 0) continue;

      const side: 'long' | 'short' = szi > 0 ? 'long' : 'short';
      const size = Math.abs(szi);
      const entry_ = parseFloat(p.entryPx ?? '0');
      const value = parseFloat(p.positionValue ?? '0');
      const pnl = parseFloat(p.unrealizedPnl ?? '0');
      const margin = parseFloat(p.marginUsed ?? '0');
      const liq = p.liquidationPx ? parseFloat(p.liquidationPx) : NaN;
      const lev = p.leverage?.value;
      const mark = size > 0 && value > 0 ? value / size : null;
      // Cumulative funding: sinceOpen is most useful.
      // HL convention: positive value = funding PAID BY this position.
      // Our convention (per NormalizedPosition.cumulativeFunding):
      //   positive = funding RECEIVED by user (good, green)
      //   negative = funding PAID by user (bad, red)
      // → Negate HL's value to align with our convention.
      const cumFundingStr = p.cumFunding?.sinceOpen;
      const cumFundingHl = cumFundingStr ? parseFloat(cumFundingStr) : NaN;
      const cumFunding = Number.isFinite(cumFundingHl) ? -cumFundingHl : NaN;

      const tpsl = tpslByCoin.get(p.coin);

      out.push({
        symbol: p.coin,
        side,
        size,
        entryPrice: entry_,
        markPrice: mark,
        positionValue: Number.isFinite(value) && value > 0 ? value : null,
        unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
        leverage: typeof lev === 'number' && lev > 0 ? lev : null,
        marginUsed: Number.isFinite(margin) && margin > 0 ? margin : null,
        liquidationPrice: Number.isFinite(liq) && liq > 0 ? liq : null,
        tpPrice: tpsl?.tp ?? null,
        slPrice: tpsl?.sl ?? null,
        cumulativeFunding: Number.isFinite(cumFunding) ? cumFunding : null,
      });
    }
    return out;
  },

  /**
   * Hyperliquid public API: POST /info { type: 'userFillsByTime', user, startTime }.
   * Returns every fill since startTime (exclusive). Realized PnL is reported
   * directly per-fill on closing trades, fees too. We keep the entire fill
   * payload for tax/journal purposes — startPosition + dir give us the full
   * trade context.
   *
   * Fill `side`: 'B' (buy) or 'A' (ask/sell).
   * Fill `dir`: 'Open Long' | 'Close Short' | 'Open Short' | 'Close Long' |
   *             'Long > Short' (flip) | 'Short > Long' (flip) — captures
   *             the position-level intent of each fill.
   */
  async fetchTradeHistory(address: string, sinceMs?: number): Promise<NormalizedTrade[]> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];
    // Default lookback: 90 days. HL caps response size; if more than that
    // exists we lose the oldest tail, but that's fine for a journal.
    const startTime = sinceMs ?? Date.now() - 90 * 86_400_000;

    const res = await fetch(HL_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ type: 'userFillsByTime', user: address, startTime }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Hyperliquid userFillsByTime HTTP ${res.status}`);
    }
    const fills: any[] = await res.json();
    if (!Array.isArray(fills)) return [];

    const out: NormalizedTrade[] = [];
    for (const f of fills) {
      const px = parseFloat(f.px ?? '0');
      const sz = parseFloat(f.sz ?? '0');
      if (!Number.isFinite(px) || !Number.isFinite(sz) || sz === 0) continue;

      // Position-level intent from `dir`. Closing trades carry realized PnL.
      const dir: string = f.dir ?? '';
      let direction: NormalizedTrade['direction'];
      if (/^Open /i.test(dir)) direction = 'open';
      else if (/^Close /i.test(dir)) direction = 'close';
      else if (/>/i.test(dir)) direction = 'close'; // position flip → treat as close
      else direction = undefined;

      const closedPnl = f.closedPnl != null ? parseFloat(f.closedPnl) : NaN;
      const fee = f.fee != null ? Math.abs(parseFloat(f.fee)) : NaN;
      const sideRaw = (f.side ?? '').toUpperCase();
      const side: NormalizedTrade['side'] = sideRaw === 'B' ? 'buy' : sideRaw === 'A' ? 'sell' : sideRaw;

      // Stable id: HL exposes hash + tid; use `${hash}-${tid}` for uniqueness
      // across multi-fill orders that share a tx hash.
      const venueTradeId = `${f.hash ?? ''}-${f.tid ?? ''}` || JSON.stringify({ t: f.time, c: f.coin, p: f.px, s: f.sz });

      out.push({
        symbol: f.coin,
        side,
        direction,
        size: Math.abs(sz),
        price: px,
        valueUsd: px * Math.abs(sz),
        feeUsd: Number.isFinite(fee) ? fee : null,
        realizedPnlUsd: direction === 'close' && Number.isFinite(closedPnl) ? closedPnl : null,
        venueTradeId,
        ts: new Date(Number(f.time)),
      });
    }
    return out;
  },
};
