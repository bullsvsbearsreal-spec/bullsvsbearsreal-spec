/**
 * GET /api/gas-tracker
 *
 * Live gas prices across L1 + major L2s using free public RPC endpoints.
 * For every chain we call `eth_gasPrice` + `eth_blockNumber`. On EIP-1559
 * chains we also call `eth_feeHistory` to derive a priority-fee suggestion.
 *
 * Returns: chain name, current gwei, blocks/sec, ETH-denominated cost of a
 * standard transfer / swap, 24h gwei trend placeholder (TODO: historical).
 *
 * Cache: 15s.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface ChainConfig {
  key: string;
  label: string;
  rpc: string;
  nativeSymbol: string;
  color: string;
  blockTimeSec: number;
  usdPriceHint: string;  // CoinGecko id for native token
}

interface ChainConfigWithFallbacks extends ChainConfig {
  fallbacks?: string[];
}

const CHAINS: ChainConfigWithFallbacks[] = [
  { key: 'ethereum', label: 'Ethereum',  rpc: 'https://ethereum.publicnode.com',     fallbacks: ['https://eth.llamarpc.com', 'https://rpc.flashbots.net'], nativeSymbol: 'ETH', color: '#627EEA', blockTimeSec: 12, usdPriceHint: 'ethereum' },
  { key: 'base',     label: 'Base',      rpc: 'https://base.publicnode.com',         fallbacks: ['https://mainnet.base.org'], nativeSymbol: 'ETH', color: '#0052FF', blockTimeSec: 2,  usdPriceHint: 'ethereum' },
  { key: 'arbitrum', label: 'Arbitrum',  rpc: 'https://arbitrum-one.publicnode.com', fallbacks: ['https://arb1.arbitrum.io/rpc'], nativeSymbol: 'ETH', color: '#28A0F0', blockTimeSec: 1,  usdPriceHint: 'ethereum' },
  { key: 'optimism', label: 'Optimism',  rpc: 'https://optimism.publicnode.com',     fallbacks: ['https://mainnet.optimism.io'], nativeSymbol: 'ETH', color: '#FF0420', blockTimeSec: 2,  usdPriceHint: 'ethereum' },
  { key: 'polygon',  label: 'Polygon',   rpc: 'https://polygon-bor-rpc.publicnode.com', fallbacks: ['https://polygon.llamarpc.com'], nativeSymbol: 'MATIC', color: '#8247E5', blockTimeSec: 2, usdPriceHint: 'matic-network' },
  { key: 'bsc',      label: 'BNB Chain', rpc: 'https://bsc-rpc.publicnode.com',      fallbacks: ['https://bsc-dataseed.binance.org'], nativeSymbol: 'BNB', color: '#F3BA2F', blockTimeSec: 3, usdPriceHint: 'binancecoin' },
];

interface GasRow {
  chain: string;
  label: string;
  color: string;
  nativeSymbol: string;
  gwei: number;                // basefee+priority for 1559; gasPrice legacy
  priorityGwei: number | null; // priority fee in gwei (1559 chains only)
  blockTimeSec: number;
  nativeUsd: number;
  transferCostUsd: number;     // 21000 gas
  swapCostUsd: number;         // 150k gas estimate (Uniswap v3 simple swap)
  status: 'low' | 'moderate' | 'high';
}

interface GasResponse {
  data: GasRow[];
  summary: {
    ethMainnetGwei: number | null;
    cheapestL2: string | null;
    avgL2Gwei: number;
    ethToL2Multiplier: number;   // L1 / avg L2
  };
  meta: { timestamp: number };
}

const cache = new Map<string, { body: GasResponse; ts: number }>();
const CACHE_TTL = 15_000;

async function rpcCall(url: string, method: string, params: unknown[] = [], timeoutMs = 5000): Promise<any | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.result ?? null;
  } catch {
    return null;
  }
}

async function getPriceUsd(ids: string[]): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`,
      {
        signal: AbortSignal.timeout(6000),
        headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
      },
    );
    if (!res.ok) return {};
    const j = await res.json();
    const out: Record<string, number> = {};
    for (const id of ids) if (j[id]?.usd) out[id] = j[id].usd;
    return out;
  } catch {
    return {};
  }
}

async function getChainData(chain: ChainConfigWithFallbacks): Promise<Partial<GasRow> | null> {
  // Try primary first, then fallbacks — eth_gasPrice is critical, others can fail silently
  const rpcs = [chain.rpc, ...(chain.fallbacks ?? [])];
  let gasPriceHex: string | null = null;
  let feeHistory: any = null;
  for (const rpc of rpcs) {
    gasPriceHex = await rpcCall(rpc, 'eth_gasPrice');
    if (gasPriceHex) {
      // Got a price — try fee history on the same endpoint (best-effort)
      feeHistory = await rpcCall(rpc, 'eth_feeHistory', ['0x5', 'latest', [50]]).catch(() => null);
      break;
    }
  }
  if (!gasPriceHex) return null;
  const gasPriceWei = parseInt(gasPriceHex, 16);
  if (!Number.isFinite(gasPriceWei) || gasPriceWei <= 0) return null;
  const gwei = gasPriceWei / 1e9;

  // Try to derive priority fee from eth_feeHistory if supported
  let priorityGwei: number | null = null;
  try {
    const rewards = feeHistory?.reward as string[][] | undefined;
    if (rewards && rewards.length) {
      const nums = rewards.map(r => parseInt(r[0], 16)).filter(n => Number.isFinite(n));
      if (nums.length) priorityGwei = (nums.reduce((s, n) => s + n, 0) / nums.length) / 1e9;
    }
  } catch { /* noop */ }

  return { gwei, priorityGwei };
}

function statusFor(chain: string, gwei: number): GasRow['status'] {
  // Ethereum tiers: sub-20 low, 20-50 mod, 50+ high. L2s: sub-0.1 low, 0.1-0.5 mod, 0.5+ high.
  if (chain === 'ethereum') {
    if (gwei < 20) return 'low';
    if (gwei < 50) return 'moderate';
    return 'high';
  }
  if (chain === 'polygon' || chain === 'bsc') {
    if (gwei < 30) return 'low';
    if (gwei < 100) return 'moderate';
    return 'high';
  }
  // L2s
  if (gwei < 0.1) return 'low';
  if (gwei < 1) return 'moderate';
  return 'high';
}

export async function GET(_request: NextRequest) {
  const cacheKey = 'gas-tracker:v1';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const prices = await getPriceUsd(Array.from(new Set(CHAINS.map(c => c.usdPriceHint))));
  const results = await Promise.all(CHAINS.map(getChainData));

  const rows: GasRow[] = CHAINS.map((c, i) => {
    const r = results[i];
    const gwei = r?.gwei ?? 0;
    const priorityGwei = r?.priorityGwei ?? null;
    const nativeUsd = prices[c.usdPriceHint] ?? 0;
    // gas * price (gwei) * 1e-9 (gwei->native) * usd/native
    const transferCostUsd = 21_000 * gwei * 1e-9 * nativeUsd;
    const swapCostUsd = 150_000 * gwei * 1e-9 * nativeUsd;
    return {
      chain: c.key,
      label: c.label,
      color: c.color,
      nativeSymbol: c.nativeSymbol,
      gwei,
      priorityGwei,
      blockTimeSec: c.blockTimeSec,
      nativeUsd,
      transferCostUsd,
      swapCostUsd,
      status: statusFor(c.key, gwei),
    };
  });

  const l2s = rows.filter(r => r.chain !== 'ethereum' && r.chain !== 'polygon' && r.chain !== 'bsc' && r.gwei > 0);
  const l2Avg = l2s.length ? l2s.reduce((s, r) => s + r.gwei, 0) / l2s.length : 0;
  const cheapest = l2s.slice().sort((a, b) => a.gwei - b.gwei)[0];
  const eth = rows.find(r => r.chain === 'ethereum');

  const body: GasResponse = {
    data: rows,
    summary: {
      ethMainnetGwei: eth?.gwei ?? null,
      cheapestL2: cheapest?.label ?? null,
      avgL2Gwei: l2Avg,
      ethToL2Multiplier: l2Avg > 0 && eth?.gwei ? eth.gwei / l2Avg : 0,
    },
    meta: { timestamp: Date.now() },
  };

  // Only pin the cache when at least one chain returned a real gwei.
  // Was: cached `{data: [{gwei: 0, ...}, ...]}` for 15s when every public
  // RPC was rate-limiting us simultaneously. UI showed "All chains 0 gwei"
  // for the cache duration, which read as "gas is free" to the careful
  // reader and "site is broken" to everyone else.
  const anyRealGwei = rows.some(r => r.gwei > 0);
  if (anyRealGwei) {
    cache.set(cacheKey, { body, ts: Date.now() });
  }
  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': anyRealGwei
        ? 'public, s-maxage=15, stale-while-revalidate=60'
        : 'no-store',
    },
  });
}
