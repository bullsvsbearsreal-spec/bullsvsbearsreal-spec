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

const PROTOCOL_DISPLAY: Record<string, string> = {
  eigenlayer: 'EigenLayer',
  'eigenlayer-lst': 'EigenLayer',
  symbiotic: 'Symbiotic',
  karak: 'Karak',
  babylon: 'Babylon',
  renzo: 'Renzo',
  etherfi: 'EtherFi',
  kelp: 'Kelp',
  pendle: 'Pendle',
  'puffer-finance': 'Puffer',
  swell: 'Swell',
  ssvnetwork: 'SSV',
  'rio-network': 'Rio',
};

/** Heuristic: pool counts as "restaking" if its protocol matches our list
 *  OR if DeFi Llama's category contains "restaking" or "LRT". */
function isRestakingPool(p: any): boolean {
  const proto = (p.project ?? '').toLowerCase();
  if (PROTOCOL_DISPLAY[proto]) return true;
  const cat = (p.category ?? '').toLowerCase();
  if (cat.includes('restaking')) return true;
  if (cat.includes('lrt')) return true;
  // DeFi Llama tags some EigenLayer-aligned pools just as "Liquid Staking"
  // — we want LRTs (re-staked) but not vanilla LSTs. The symbol gives it
  // away: ezETH/rsETH/weETH/ankrETH/pufETH are LRTs.
  const sym = (p.symbol ?? '').toUpperCase();
  if (/^(EZ|RS|WE|PUF|RIO|EIGEN|MELLOW|CMETH|UNIBT|SOLVBT)/.test(sym)) return true;
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
