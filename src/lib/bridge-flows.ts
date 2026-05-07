/**
 * Cross-chain bridge flow aggregator using Wormhole as the primary source.
 *
 * Wormhole is the most widely-used cross-chain messaging protocol; their
 * public Wormholescan API exposes volume, transfers, and corridor data for
 * every supported chain pair, with no auth required.
 *
 * What we surface:
 *   - Total cross-chain volume + message count over 24h / 7d / 30d
 *   - Top chain pairs by transfer count (Source → Destination matrix)
 *   - Top assets being bridged (WBTC, WETH, USDC, ...)
 *   - Top corridors (specific token + chain-pair combos)
 *
 * Source: api.wormholescan.io. Cached 5 min — bridges move slowly so a
 * stale-by-minutes read is fine.
 */

const WORMHOLE_BASE = 'https://api.wormholescan.io/api/v1';
const TIMEOUT_MS = 10_000;

/** Wormhole chain id → human name. Covers every chain the bridge supports. */
export const WORMHOLE_CHAINS: Record<number, string> = {
  1: 'Solana',
  2: 'Ethereum',
  3: 'Terra',
  4: 'BNB Chain',
  5: 'Polygon',
  6: 'Avalanche',
  7: 'Oasis',
  8: 'Algorand',
  9: 'Aurora',
  10: 'Fantom',
  11: 'Karura',
  12: 'Acala',
  13: 'Klaytn',
  14: 'Celo',
  15: 'Near',
  16: 'Moonbeam',
  17: 'Neon',
  18: 'Terra2',
  19: 'Injective',
  20: 'Osmosis',
  21: 'Sui',
  22: 'Aptos',
  23: 'Arbitrum',
  24: 'Optimism',
  25: 'Gnosis',
  26: 'Pythnet',
  28: 'XPLA',
  29: 'Btc',
  30: 'Base',
  32: 'Sei',
  33: 'Rootstock',
  34: 'Scroll',
  35: 'Mantle',
  36: 'Blast',
  37: 'X Layer',
  38: 'Linea',
  39: 'Berachain',
  40: 'Seievm',
  44: 'Snaxchain',
  46: 'Celestia',
  47: 'HyperEVM',
  48: 'Monad',
  50: 'Plume',
  51: 'Movement',
};

export function chainName(id: number): string {
  return WORMHOLE_CHAINS[id] ?? `Chain ${id}`;
}

export interface BridgeScorecard {
  msgs24h: number;
  msgs7d: number;
  msgs30d: number;
  vol24hUsd: number;
  vol7dUsd: number;
  vol30dUsd: number;
  totalVolUsd: number;
  totalMessages: number;
}

export interface ChainPairFlow {
  source: number;
  sourceName: string;
  destination: number;
  destinationName: string;
  transfers: number;
  /** Aggregate USD volume from corridors when available. */
  volumeUsd?: number;
}

export interface TopAsset {
  symbol: string;
  emitterChain: number;
  emitterChainName: string;
  tokenChain: number;
  tokenChainName: string;
  volumeUsd: number;
}

export interface TopCorridor {
  source: number;
  sourceName: string;
  destination: number;
  destinationName: string;
  tokenChain: number;
  tokenChainName: string;
  symbol?: string;
  txs: number;
}

export interface BridgeFlowFeed {
  ts: number;
  scorecard: BridgeScorecard | null;
  chainPairs: ChainPairFlow[];
  topAssets: TopAsset[];
  topCorridors: TopCorridor[];
}

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface RawScorecard {
  '24h_messages'?: string;
  '7d_messages'?: string;
  '30d_messages'?: string;
  '24h_volume'?: string;
  '7d_volume'?: string;
  '30d_volume'?: string;
  total_volume?: string;
  total_messages?: string;
}

interface RawChainPair {
  emitterChain: number;
  destinationChain: number;
  numberOfTransfers: string;
}

interface RawAsset {
  symbol: string;
  emitterChain: number;
  tokenChain: number;
  tokenAddress: string;
  volume: string;
}

interface RawCorridor {
  emitter_chain: number;
  target_chain: number;
  token_chain: number;
  token_address: string;
  symbol?: string;
  txs: number;
}

/** x-chain-activity returns per-source-chain destinations matrix —
 *  way richer than top-chain-pairs (capped at 7 by the API). */
interface RawChainActivity {
  txs: Array<{
    chain: number;
    volume: string;
    percentage: number;
    destinations: Array<{
      chain: number;
      volume: string;
      percentage: number;
    }>;
  }>;
}

/**
 * Build the bridge-flow feed by fanning out to several Wormholescan
 * endpoints in parallel. Each is independent — a single endpoint failing
 * just leaves that field null. Total budget: ~10s worst case.
 */
export async function buildBridgeFlowFeed(opts: { timeSpan?: '1d' | '7d' | '30d' } = {}): Promise<BridgeFlowFeed> {
  const ts = Date.now();
  const span = opts.timeSpan ?? '7d';

  const [scoreRaw, pairsRaw, activityRaw, assetsRaw, corridorsRaw] = await Promise.all([
    safeJson<RawScorecard>(`${WORMHOLE_BASE}/scorecards`),
    // top-chain-pairs is capped at 7 results by the API. Keep it as a
    // primary source for the most-active corridors, but supplement with
    // x-chain-activity which returns the full source→destination matrix.
    safeJson<{ chainPairs?: RawChainPair[] }>(`${WORMHOLE_BASE}/top-chain-pairs-by-num-transfers?timeSpan=${span}`),
    safeJson<RawChainActivity>(`${WORMHOLE_BASE}/x-chain-activity?timeSpan=${span}&by=tx`),
    safeJson<{ assets?: RawAsset[] }>(`${WORMHOLE_BASE}/top-assets-by-volume?timeSpan=${span}`),
    safeJson<{ corridors?: RawCorridor[] }>(`${WORMHOLE_BASE}/top-100-corridors?timeSpan=${span}`),
  ]);

  let scorecard: BridgeScorecard | null = null;
  if (scoreRaw) {
    scorecard = {
      msgs24h: parseFloat(scoreRaw['24h_messages'] ?? '0') || 0,
      msgs7d: parseFloat(scoreRaw['7d_messages'] ?? '0') || 0,
      msgs30d: parseFloat(scoreRaw['30d_messages'] ?? '0') || 0,
      vol24hUsd: parseFloat(scoreRaw['24h_volume'] ?? '0') || 0,
      vol7dUsd: parseFloat(scoreRaw['7d_volume'] ?? '0') || 0,
      vol30dUsd: parseFloat(scoreRaw['30d_volume'] ?? '0') || 0,
      totalVolUsd: parseFloat(scoreRaw.total_volume ?? '0') || 0,
      totalMessages: parseFloat(scoreRaw.total_messages ?? '0') || 0,
    };
  }

  // Build chain-pair list from x-chain-activity (rich) + top-chain-pairs
  // (sparse but ranked). x-chain-activity returns one row per source chain
  // with destination breakdowns — flatten and dedup.
  const pairsByKey = new Map<string, ChainPairFlow>();
  for (const p of pairsRaw?.chainPairs ?? []) {
    const key = `${p.emitterChain}-${p.destinationChain}`;
    pairsByKey.set(key, {
      source: p.emitterChain,
      sourceName: chainName(p.emitterChain),
      destination: p.destinationChain,
      destinationName: chainName(p.destinationChain),
      transfers: parseInt(p.numberOfTransfers, 10) || 0,
    });
  }
  for (const row of activityRaw?.txs ?? []) {
    for (const dest of row.destinations ?? []) {
      const key = `${row.chain}-${dest.chain}`;
      const existing = pairsByKey.get(key);
      const txs = parseInt(dest.volume, 10) || 0;
      if (txs <= 0) continue;
      // Prefer existing (top-chain-pairs is the canonical ranked source);
      // only insert when missing.
      if (!existing) {
        pairsByKey.set(key, {
          source: row.chain,
          sourceName: chainName(row.chain),
          destination: dest.chain,
          destinationName: chainName(dest.chain),
          transfers: txs,
        });
      }
    }
  }
  const chainPairs: ChainPairFlow[] = Array.from(pairsByKey.values())
    .filter(p => p.transfers > 0)
    .sort((a, b) => b.transfers - a.transfers);

  const topAssets: TopAsset[] = (assetsRaw?.assets ?? []).map(a => ({
    symbol: a.symbol,
    emitterChain: a.emitterChain,
    emitterChainName: chainName(a.emitterChain),
    tokenChain: a.tokenChain,
    tokenChainName: chainName(a.tokenChain),
    volumeUsd: parseFloat(a.volume) || 0,
  })).sort((a, b) => b.volumeUsd - a.volumeUsd).slice(0, 30);

  const topCorridors: TopCorridor[] = (corridorsRaw?.corridors ?? []).map(c => ({
    source: c.emitter_chain,
    sourceName: chainName(c.emitter_chain),
    destination: c.target_chain,
    destinationName: chainName(c.target_chain),
    tokenChain: c.token_chain,
    tokenChainName: chainName(c.token_chain),
    symbol: c.symbol,
    txs: c.txs ?? 0,
  })).sort((a, b) => b.txs - a.txs).slice(0, 30);

  return { ts, scorecard, chainPairs, topAssets, topCorridors };
}
