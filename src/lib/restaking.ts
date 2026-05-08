/**
 * Restaking yield aggregator.
 *
 * Pulls EigenLayer + Symbiotic + Karak + Babylon yields (and any other
 * protocol DeFi Llama tags as `restaking`) into one ranked list with
 * APY, TVL, asset exposure, and protocol metadata.
 *
 * Source: yields.llama.fi/pools — free, comprehensive aggregator. Filter
 * by category=Liquid Restaking + restaking + LRT.
 */

const TIMEOUT = 12_000;

export interface RestakingPool {
  /** DeFi Llama pool id. */
  poolId: string;
  protocol: string;          // e.g. 'eigenlayer', 'symbiotic', 'karak'
  protocolDisplay: string;   // 'EigenLayer'
  chain: string;             // 'Ethereum', 'Arbitrum', ...
  symbol: string;            // 'ETH', 'EZETH', ...
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[] | null;
  apyDelta7d: number | null;
  apyDelta30d: number | null;
  /** Risk hints. */
  ilRisk: string | null;
  exposure: string | null;
  stablecoin: boolean;
  /** DeFi Llama outlier flag — high-variance pools to display with caution. */
  outlier: boolean;
}

/**
 * Allowlist of restaking-issuer protocols (the protocols that ISSUE the
 * restaking token). Plus a small set of restaking-aggregator protocols
 * whose pools are pure restaking products (Pendle PT-/YT- of LRTs).
 *
 * Previously we used a heuristic where any pool with an "LRT-like" symbol
 * prefix (EZ/RS/WE/...) counted as restaking. That swept up every
 * Uniswap V2/V3/V4, Balancer, Aerodrome, Sushi, Morpho LP pool whose
 * paired token happened to be an LRT — 2870 pools, 90% irrelevant.
 *
 * Restricting to issuer protocols only gives ~80 pools, every one
 * actually a restaking yield product.
 */
const PROTOCOL_DISPLAY: Record<string, string> = {
  eigenlayer: 'EigenLayer',
  'eigenlayer-lst': 'EigenLayer',
  symbiotic: 'Symbiotic',
  karak: 'Karak',
  babylon: 'Babylon',
  renzo: 'Renzo',
  etherfi: 'EtherFi',
  'ether.fi stake': 'EtherFi',
  'ether.fi liquid': 'EtherFi',
  'ether.fi liquid restaking': 'EtherFi',
  kelp: 'Kelp',
  'puffer-finance': 'Puffer',
  puffer: 'Puffer',
  swell: 'Swell',
  ssvnetwork: 'SSV',
  'rio-network': 'Rio',
  mellow: 'Mellow',
  'mellow-protocol': 'Mellow',
  bedrock: 'Bedrock',
  'bedrock-unibtc': 'Bedrock',
  fluid: 'Fluid',
};

/** A pool counts as "restaking" if its DeFi Llama project matches an
 *  issuer allowlist. We deliberately exclude general AMMs/lenders even
 *  when they hold LRT collateral — those are LP yield, not restaking. */
export function isRestakingPool(p: any): boolean {
  const proto = (p.project ?? '').toLowerCase();
  if (PROTOCOL_DISPLAY[proto]) return true;
  // DeFi Llama's category field — "Liquid Restaking" specifically
  // (not "Liquid Staking" which is vanilla ETH staking, not re-staked).
  const cat = (p.category ?? '').toLowerCase();
  if (cat === 'liquid restaking') return true;
  return false;
}

export interface RestakingFeed {
  ts: number;
  pools: RestakingPool[];
  summary: {
    totalTvlUsd: number;
    poolCount: number;
    medianApy: number;
    topByTvl: RestakingPool | null;
    topByApy: RestakingPool | null;
  };
}

export async function fetchRestakingPools(): Promise<RestakingFeed> {
  const ts = Date.now();
  let pools: RestakingPool[] = [];

  try {
    const res = await fetch('https://yields.llama.fi/pools', {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { Accept: 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (res.ok) {
      const json = await res.json();
      const raw: any[] = json?.data ?? [];
      pools = raw
        .filter(isRestakingPool)
        .filter(p => Number.isFinite(p.apy) && p.apy >= 0 && p.tvlUsd > 0)
        .map((p): RestakingPool => ({
          poolId: p.pool,
          protocol: p.project,
          protocolDisplay: PROTOCOL_DISPLAY[p.project] ?? (p.project ?? '').replace(/-/g, ' '),
          chain: p.chain,
          symbol: p.symbol,
          tvlUsd: p.tvlUsd,
          apyBase: typeof p.apyBase === 'number' ? p.apyBase : null,
          apyReward: typeof p.apyReward === 'number' ? p.apyReward : null,
          apy: p.apy,
          rewardTokens: Array.isArray(p.rewardTokens) ? p.rewardTokens : null,
          apyDelta7d: typeof p.apyPct7D === 'number' ? p.apyPct7D : null,
          apyDelta30d: typeof p.apyPct30D === 'number' ? p.apyPct30D : null,
          ilRisk: p.ilRisk ?? null,
          exposure: p.exposure ?? null,
          stablecoin: !!p.stablecoin,
          outlier: !!p.outlier,
        }));
    }
  } catch { /* keep empty */ }

  pools.sort((a, b) => b.tvlUsd - a.tvlUsd);

  const totalTvl = pools.reduce((s, p) => s + p.tvlUsd, 0);
  const apys = pools.map(p => p.apy).sort((a, b) => a - b);
  const medianApy = apys.length === 0
    ? 0
    : apys.length % 2 === 0
      ? (apys[apys.length / 2 - 1] + apys[apys.length / 2]) / 2
      : apys[Math.floor(apys.length / 2)];

  return {
    ts,
    pools,
    summary: {
      totalTvlUsd: totalTvl,
      poolCount: pools.length,
      medianApy,
      topByTvl: pools[0] ?? null,
      topByApy: [...pools].sort((a, b) => b.apy - a.apy)[0] ?? null,
    },
  };
}
