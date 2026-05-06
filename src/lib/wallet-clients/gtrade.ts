/**
 * gTrade (Gains Network) wallet position fetcher.
 *
 * Queries the on-chain `getTrades(address)` view function on the
 * GNSMultiCollatDiamond contract on Arbitrum. Returns every open trade
 * for the address, including pair index, collateral index, leverage,
 * open price, TP / SL.
 *
 * Architecture:
 *   1. ONE eth_call to the diamond — gets the full Trade[] for the user.
 *   2. ONE fetch to /trading-variables — gets the pairIndex → symbol map
 *      (cached 5 min at module level, shared across requests).
 *   3. Resolve mark prices via Binance fapi /fapi/v1/ticker/price for the
 *      handful of symbols this user actually has positions in (one
 *      batched request).
 *
 * gTrade fixed-point conventions:
 *   - openPrice / tp / sl       : 1e10 (USD per token)
 *   - leverage                  : 1e3 (5x = 5000)
 *   - collateralAmount          : per-token native decimals (DAI/WETH=18,
 *                                  USDC=6, ARB=18 — see COLLATERALS table)
 *
 * Diamond address (Arbitrum 42161):
 *   0xFF162c694eAA571f685030649814282eA457f169
 */
import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import type { NormalizedPosition, WalletClient } from './types';

const ARBITRUM_RPC =
  process.env.ARBITRUM_RPC_URL?.trim() ||
  'https://arb1.arbitrum.io/rpc';
const DIAMOND_ARBITRUM = '0xFF162c694eAA571f685030649814282eA457f169';

// gTrade collateral index → token metadata. Stable-coin collaterals have
// usdRef:'stable'; volatile (WETH, ARB) need a runtime spot lookup to
// convert collateralAmount × decimals to USD.
const COLLATERALS: Record<number, { symbol: string; decimals: number; usdRef: 'stable' | 'crypto' }> = {
  1: { symbol: 'DAI',  decimals: 18, usdRef: 'stable' },
  2: { symbol: 'ETH',  decimals: 18, usdRef: 'crypto' }, // WETH on Arb
  3: { symbol: 'USDC', decimals: 6,  usdRef: 'stable' },
  4: { symbol: 'ARB',  decimals: 18, usdRef: 'crypto' },
};

const TRADE_TUPLE =
  'tuple(address user, uint32 index, uint16 pairIndex, uint24 leverage, ' +
  'bool long, bool isOpen, uint8 collateralIndex, uint8 tradeType, ' +
  'uint120 collateralAmount, uint64 openPrice, uint64 tp, uint64 sl, ' +
  'bool isCounterTrade, uint160 positionSizeToken, uint24 placeholder)[]';
const ABI = [`function getTrades(address _trader) view returns (${TRADE_TUPLE})`];

const PREC_PRICE = 1e10;
const PREC_LEVERAGE = 1e3;

const iface = new Interface(ABI);

interface GTradePair { from: string; to: string }

let pairsCache: { rows: GTradePair[]; ts: number } | null = null;
const PAIRS_TTL_MS = 5 * 60 * 1000;

async function getPairs(): Promise<GTradePair[]> {
  if (pairsCache && Date.now() - pairsCache.ts < PAIRS_TTL_MS) return pairsCache.rows;
  try {
    const res = await fetch('https://backend-arbitrum.gains.trade/trading-variables', {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return pairsCache?.rows ?? [];
    const json = await res.json() as { pairs?: GTradePair[] };
    const rows = Array.isArray(json.pairs) ? json.pairs : [];
    if (rows.length > 0) pairsCache = { rows, ts: Date.now() };
    return rows;
  } catch {
    return pairsCache?.rows ?? [];
  }
}

/**
 * Best-effort mark-price lookup for a small set of symbols against
 * Binance fapi. Symbols not tradable on Binance fall back to
 * "use the on-chain entry price" downstream.
 */
async function fetchMarkPrices(symbols: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (symbols.length === 0) return out;
  try {
    const url = `https://fapi.binance.com/fapi/v1/ticker/price?symbols=${
      encodeURIComponent(JSON.stringify(symbols.map(s => `${s}USDT`)))
    }`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return out;
    const arr = await res.json() as Array<{ symbol: string; price: string }>;
    for (const r of arr) {
      const sym = r.symbol.replace(/USDT$/, '');
      const p = parseFloat(r.price);
      if (Number.isFinite(p) && p > 0) out.set(sym, p);
    }
  } catch { /* swallow */ }
  return out;
}

interface RawTrade {
  pairIndex: number;
  leverage: number;
  long: boolean;
  isOpen: boolean;
  collateralIndex: number;
  collateralAmount: BigNumber;
  openPrice: BigNumber;
  tp: BigNumber;
  sl: BigNumber;
}

async function callGetTrades(address: string): Promise<RawTrade[]> {
  const calldata = iface.encodeFunctionData('getTrades', [address]);
  const res = await fetch(ARBITRUM_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: DIAMOND_ARBITRUM, data: calldata }, 'latest'],
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Arbitrum RPC HTTP ${res.status}`);
  const json = await res.json() as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(`Arbitrum RPC error: ${json.error.message}`);
  if (!json.result || json.result === '0x') return [];

  const decoded = iface.decodeFunctionResult('getTrades', json.result);
  const trades = decoded?.[0] ?? [];
  return trades.map((t: any): RawTrade => ({
    pairIndex: Number(t.pairIndex),
    leverage: Number(t.leverage),
    long: t.long,
    isOpen: t.isOpen,
    collateralIndex: Number(t.collateralIndex),
    collateralAmount: BigNumber.from(t.collateralAmount),
    openPrice: BigNumber.from(t.openPrice),
    tp: BigNumber.from(t.tp),
    sl: BigNumber.from(t.sl),
  }));
}

function bigToNumber(bn: BigNumber, prec: number): number {
  try {
    return Number(bn.toBigInt()) / prec;
  } catch {
    return 0;
  }
}

export const gtradeWalletClient: WalletClient = {
  chain: 'arbitrum',
  displayName: 'gTrade',

  async fetchPositions(address: string): Promise<NormalizedPosition[]> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];

    let trades: RawTrade[] = [];
    try {
      trades = await callGetTrades(address);
    } catch (e) {
      console.warn('[gtrade] eth_call failed:', e instanceof Error ? e.message : e);
      return [];
    }

    const open = trades.filter(t => t.isOpen);
    if (open.length === 0) return [];

    const pairs = await getPairs();

    // Collect symbols to look up: every position's pair-base + every
    // volatile collateral type the user is using.
    const wantSymbols = new Set<string>();
    for (const t of open) {
      const p = pairs[t.pairIndex];
      if (p?.from) wantSymbols.add(p.from.toUpperCase());
    }
    for (const t of open) {
      const c = COLLATERALS[t.collateralIndex];
      if (c && c.usdRef === 'crypto') wantSymbols.add(c.symbol);
    }
    const markPrices = await fetchMarkPrices(Array.from(wantSymbols));

    const out: NormalizedPosition[] = [];
    for (const t of open) {
      const pair = pairs[t.pairIndex];
      if (!pair?.from) continue;
      const symbol = pair.from.toUpperCase();
      const col = COLLATERALS[t.collateralIndex];
      if (!col) continue;

      const colDec = Math.pow(10, col.decimals);
      const collateralUnits = bigToNumber(t.collateralAmount, colDec);
      const colUsdPrice = col.usdRef === 'stable' ? 1 : (markPrices.get(col.symbol) ?? 0);
      const marginUsed = collateralUnits * colUsdPrice;

      const leverage = bigToNumber(BigNumber.from(t.leverage), PREC_LEVERAGE);
      const entryPrice = bigToNumber(t.openPrice, PREC_PRICE);
      const markPrice = markPrices.get(symbol) ?? entryPrice;

      // Position size in USD = margin × leverage. Then size in tokens.
      const positionValueUsd = marginUsed * leverage;
      const sizeTokens = entryPrice > 0 ? positionValueUsd / entryPrice : 0;

      // Unrealized PnL.
      const direction = t.long ? 1 : -1;
      const pnl = sizeTokens * (markPrice - entryPrice) * direction;

      // Liquidation price approximation. gTrade default mmf ≈ 0.6%.
      const MMF = 0.006;
      let liqPrice: number | null = null;
      if (entryPrice > 0 && leverage > 0) {
        const ratio = (1 / leverage) * (1 - MMF);
        liqPrice = t.long
          ? entryPrice * Math.max(0, 1 - ratio)
          : entryPrice * (1 + ratio);
        if (!Number.isFinite(liqPrice) || liqPrice <= 0) liqPrice = null;
      }

      const tpRaw = bigToNumber(t.tp, PREC_PRICE);
      const slRaw = bigToNumber(t.sl, PREC_PRICE);

      out.push({
        symbol,
        side: t.long ? 'long' : 'short',
        size: sizeTokens,
        entryPrice,
        markPrice,
        positionValue: positionValueUsd > 0 ? positionValueUsd : null,
        unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
        leverage: leverage > 0 ? leverage : null,
        marginUsed: marginUsed > 0 ? marginUsed : null,
        liquidationPrice: liqPrice,
        tpPrice: tpRaw > 0 ? tpRaw : null,
        slPrice: slRaw > 0 ? slRaw : null,
        cumulativeFunding: null, // gTrade borrow fees accrue on close — read
                                  // separately via DataStore; deferred.
      });
    }
    return out;
  },
};
