/**
 * Hyperliquid wallet position fetcher.
 *
 * Hyperliquid is its own L1 — no API key needed for read-only position lookups.
 * Just POST a {type:'clearinghouseState', user:address} to /info and the API
 * returns the full account state including every open position.
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
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
import type { NormalizedPosition, WalletClient } from './types';

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

export const hyperliquidWalletClient: WalletClient = {
  chain: 'hyperliquid',

  async fetchPositions(address: string): Promise<NormalizedPosition[]> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];

    const res = await fetch(HL_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: address }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Hyperliquid clearinghouseState HTTP ${res.status}`);
    }
    const json = (await res.json()) as HLClearingHouseState;

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
      // mark price = positionValue / size (since HL gives both)
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
        tpPrice: null,   // HL TP/SL are separate "trigger" orders — Phase B+
        slPrice: null,
        cumulativeFunding: Number.isFinite(cumFunding) ? cumFunding : null,
      });
    }
    return out;
  },
};
