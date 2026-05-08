/**
 * Pull liquid-staking + restaking yields from DefiLlama and shape them
 * into the response payload `/api/validators` returns. Lives in lib/
 * so the route + the refresh cron can both call it without duplicating
 * the project filter list.
 */
import { fetchWithTimeout } from '@/app/api/_shared/fetch';

const TIMEOUT = 15_000;

// Slugs verified against the live yields.llama.fi/pools snapshot
// (May 2026). DefiLlama uses HYPHEN-separated slugs and does NOT use
// casual brand names. The previous list had several drops:
//  - 'ether-fi' / 'etherfi-stake' (real: 'ether.fi-stake', 'ether.fi-liquid')
//  - 'puffer-finance'             (real: 'puffer-stake')
//  - 'swell'                       (real: 'swell-earn', 'swell-liquid-restaking',
//                                  'swell-liquid-staking')
//  - 'kelp-dao'                    (real: 'kelp')
//  - 'jito' / 'marinade-finance'   (real: 'jito-liquid-staking',
//                                  'marinade-liquid-staking')
//  - 'sanctum'                     (real: 'sanctum-infinity')
const LST_PROJECTS = new Set([
  'lido', 'rocket-pool', 'rocketpool', 'frax-ether', 'mantle-lsp',
  'binance-staked-eth', 'coinbase-wrapped-staked-eth', 'stakewise-v3',
  'jito-liquid-staking', 'marinade-liquid-staking',
  'sanctum-infinity', 'blazestake', 'jpool',
]);

const RESTAKING_PROJECTS = new Set([
  'eigenlayer', 'symbiotic', 'karak',
  'ether.fi-stake', 'ether.fi-liquid',
  'renzo', 'kelp',
  'puffer-stake',
  'swell-earn', 'swell-liquid-restaking', 'swell-liquid-staking',
  'eigenpie',
  'bedrock-unieth',
]);

const ALLOW_PROJECTS = new Set<string>();
LST_PROJECTS.forEach(p => ALLOW_PROJECTS.add(p));
RESTAKING_PROJECTS.forEach(p => ALLOW_PROJECTS.add(p));

export interface LlamaPool {
  pool: string;
  project: string;
  symbol: string;
  chain: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
}

export interface ValidatorRow {
  project: string;
  symbol: string;
  chain: string;
  asset: string;
  apy: number;
  apyBase: number;
  apyReward: number;
  tvlUsd: number;
  category: 'liquid-staking' | 'restaking' | 'native-staking';
}

export interface ValidatorsResponse {
  byAsset: Record<string, ValidatorRow[]>;
  totalTvl: number;
  ts: number;
}

/**
 * Bucket a pool's symbol into a canonical underlying asset for the
 * /validators page's by-asset grouping. The page renders one column per
 * underlying (ETH / SOL / BTC / ...) with all LSTs/LRTs underneath, so
 * this mapping IS the column layout. A regression here would scatter
 * LSTs of the same asset into different columns or merge unrelated assets.
 *
 * Ordering matters: ETH and SOL checks run first because their LST/LRT
 * symbols frequently embed the underlying ticker (WSTETH includes STETH;
 * JITOSOL includes SOL), and we want the more specific match to win.
 */
export const ASSET_FROM_SYMBOL = (sym: string): string => {
  const u = sym.toUpperCase();
  if (u.includes('STETH') || u.includes('RETH') || u.includes('CBETH') || u.includes('WSTETH') || u.endsWith('ETH') || u === 'WETH' || u === 'ETH') return 'ETH';
  if (u.includes('JITOSOL') || u.includes('MSOL') || u.includes('BSOL') || u.includes('JSOL') || u.endsWith('SOL') || u === 'SOL') return 'SOL';
  if (u.includes('BTC')) return 'BTC';
  if (u.includes('MATIC') || u.includes('POL')) return 'POL';
  if (u.includes('AVAX')) return 'AVAX';
  if (u.includes('ATOM')) return 'ATOM';
  if (u.includes('NEAR')) return 'NEAR';
  return 'OTHER';
};

/**
 * Hit DefiLlama Yields and build the /api/validators payload.
 * Throws on upstream failure so callers can decide whether to serve
 * stale data or 502.
 */
export async function fetchValidatorsFresh(): Promise<ValidatorsResponse> {
  const res = await fetchWithTimeout(
    'https://yields.llama.fi/pools',
    { headers: { Accept: 'application/json' } },
    TIMEOUT,
  );
  if (!res.ok) throw new Error(`DefiLlama HTTP ${res.status}`);
  const json = await res.json() as { data?: LlamaPool[] };
  const pools = json.data ?? [];

  const filtered: ValidatorRow[] = [];
  for (const p of pools) {
    if (!ALLOW_PROJECTS.has(p.project)) continue;
    if (!Number.isFinite(p.apy) || (p.apy ?? 0) <= 0) continue;
    if ((p.tvlUsd ?? 0) < 5_000_000) continue;
    filtered.push({
      project: p.project,
      symbol: p.symbol,
      chain: p.chain,
      asset: ASSET_FROM_SYMBOL(p.symbol),
      apy: p.apy ?? 0,
      apyBase: p.apyBase ?? 0,
      apyReward: p.apyReward ?? 0,
      tvlUsd: p.tvlUsd,
      category: RESTAKING_PROJECTS.has(p.project) ? 'restaking' : 'liquid-staking',
    });
  }

  filtered.sort((a, b) => b.tvlUsd - a.tvlUsd);

  const byAsset: Record<string, ValidatorRow[]> = {};
  for (const r of filtered) {
    if (!byAsset[r.asset]) byAsset[r.asset] = [];
    byAsset[r.asset].push(r);
  }

  return {
    byAsset,
    totalTvl: filtered.reduce((s, r) => s + r.tvlUsd, 0),
    ts: Date.now(),
  };
}
