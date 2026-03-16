import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/* ------------------------------------------------------------------ */
/*  Chain definitions                                                   */
/* ------------------------------------------------------------------ */

interface ChainDef {
  id: string;
  name: string;
  symbol: string;
  color: string;
  blockscoutUrl: string;        // Blockscout V2 API base
  rpcUrl?: string;              // For native balance (EVM JSON-RPC)
  decimals: number;
}

// EVM chains with public Blockscout instances
const EVM_CHAINS: ChainDef[] = [
  {
    id: 'ethereum', name: 'Ethereum', symbol: 'ETH', color: '#627EEA',
    blockscoutUrl: 'https://eth.blockscout.com',
    rpcUrl: 'https://rpc.ankr.com/eth',
    decimals: 18,
  },
  {
    id: 'base', name: 'Base', symbol: 'ETH', color: '#0052FF',
    blockscoutUrl: 'https://base.blockscout.com',
    rpcUrl: 'https://mainnet.base.org',
    decimals: 18,
  },
  {
    id: 'optimism', name: 'Optimism', symbol: 'ETH', color: '#FF0420',
    blockscoutUrl: 'https://optimism.blockscout.com',
    rpcUrl: 'https://mainnet.optimism.io',
    decimals: 18,
  },
  {
    id: 'arbitrum', name: 'Arbitrum One', symbol: 'ETH', color: '#28A0F0',
    blockscoutUrl: 'https://arbitrum.blockscout.com',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    decimals: 18,
  },
  {
    id: 'polygon', name: 'Polygon', symbol: 'POL', color: '#8247E5',
    blockscoutUrl: 'https://polygon.blockscout.com',
    rpcUrl: 'https://polygon-rpc.com',
    decimals: 18,
  },
  {
    id: 'gnosis', name: 'Gnosis', symbol: 'xDAI', color: '#04795B',
    blockscoutUrl: 'https://gnosis.blockscout.com',
    rpcUrl: 'https://rpc.gnosischain.com',
    decimals: 18,
  },
  {
    id: 'scroll', name: 'Scroll', symbol: 'ETH', color: '#FFEEDA',
    blockscoutUrl: 'https://scroll.blockscout.com',
    rpcUrl: 'https://rpc.scroll.io',
    decimals: 18,
  },
  {
    id: 'linea', name: 'Linea', symbol: 'ETH', color: '#61DFFF',
    blockscoutUrl: 'https://linea.blockscout.com',
    rpcUrl: 'https://rpc.linea.build',
    decimals: 18,
  },
  {
    id: 'zksync', name: 'zkSync Era', symbol: 'ETH', color: '#8C8DFC',
    blockscoutUrl: 'https://zksync.blockscout.com',
    rpcUrl: 'https://mainnet.era.zksync.io',
    decimals: 18,
  },
];

/* ------------------------------------------------------------------ */
/*  Per-chain fetcher                                                   */
/* ------------------------------------------------------------------ */

interface ChainSummary {
  id: string;
  name: string;
  symbol: string;
  color: string;
  nativeBalance: number;
  nativeValueUsd: number;
  tokenCount: number;
  tokenValueUsd: number;
  totalValueUsd: number;
}

async function fetchChainSummary(chain: ChainDef, address: string, ethPrice: number): Promise<ChainSummary | null> {
  try {
    // Fetch native balance + token list in parallel via Blockscout V2
    const [addrRes, tokensRes] = await Promise.all([
      fetch(`${chain.blockscoutUrl}/api/v2/addresses/${address}`, {
        signal: AbortSignal.timeout(10000),
      }).catch(() => null),
      fetch(`${chain.blockscoutUrl}/api/v2/addresses/${address}/tokens?type=ERC-20`, {
        signal: AbortSignal.timeout(10000),
      }).catch(() => null),
    ]);

    // Parse native balance from Blockscout address endpoint
    let nativeBalance = 0;
    if (addrRes?.ok) {
      const addrData = await addrRes.json() as { coin_balance?: string; ens_domain_name?: string };
      if (addrData.coin_balance) {
        nativeBalance = Number(BigInt(addrData.coin_balance)) / Math.pow(10, chain.decimals);
      }
    }

    // If address not found on this chain (404 or no balance), skip
    if (nativeBalance === 0 && !addrRes?.ok) return null;

    // Parse tokens
    let tokenCount = 0;
    let tokenValueUsd = 0;

    if (tokensRes?.ok) {
      const tokensData = await tokensRes.json() as {
        items?: Array<{
          token: {
            symbol: string;
            decimals: string;
            exchange_rate: string | null;
            circulating_market_cap: string | null;
          };
          value: string;
        }>;
      };

      if (tokensData.items) {
        for (const item of tokensData.items) {
          const rate = parseFloat(item.token.exchange_rate || '0');
          if (rate <= 0) continue;

          const decimals = parseInt(item.token.decimals) || 18;
          const balance = Number(BigInt(item.value || '0')) / Math.pow(10, decimals);
          if (balance <= 0) continue;

          // Spam filter: only extreme airdrops (billions at sub-penny)
          if (balance > 1e9 && rate < 0.0001) continue;

          const usd = balance * rate;
          if (usd < 1) continue; // dust

          tokenCount++;
          tokenValueUsd += usd;
        }
      }
    }

    // Calculate native value (ETH-based chains use ethPrice, others need their own price)
    let nativeValueUsd = 0;
    if (chain.symbol === 'ETH') {
      nativeValueUsd = nativeBalance * ethPrice;
    } else if (chain.symbol === 'xDAI') {
      nativeValueUsd = nativeBalance; // xDAI ≈ $1
    } else if (chain.symbol === 'POL') {
      // We don't have POL price here; skip or estimate
      // Could be enhanced later with price lookup
      nativeValueUsd = 0;
    }

    const totalValueUsd = nativeValueUsd + tokenValueUsd;

    // Skip chains with negligible value
    if (totalValueUsd < 0.50 && tokenCount === 0) return null;

    return {
      id: chain.id,
      name: chain.name,
      symbol: chain.symbol,
      color: chain.color,
      nativeBalance,
      nativeValueUsd,
      tokenCount,
      tokenValueUsd,
      totalValueUsd,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

// L1: In-memory cache
const memCache = new Map<string, { data: ChainSummary[]; time: number }>();
const MEM_CACHE_TTL = 5 * 60 * 1000; // 5 min (multichain is expensive)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim();

  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
  }

  // Only support EVM addresses (0x...)
  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: 'Multichain portfolio requires an EVM address (0x...)' }, { status: 400 });
  }

  const cacheKey = `wallet:multichain:${address.toLowerCase()}`;

  // L1: In-memory cache
  const memCached = memCache.get(cacheKey);
  if (memCached && Date.now() - memCached.time < MEM_CACHE_TTL) {
    return NextResponse.json({ chains: memCached.data });
  }

  // L2: DB cache
  if (isDBConfigured()) {
    try {
      const dbData = await getCache<ChainSummary[]>(cacheKey);
      if (dbData && dbData.length > 0) {
        memCache.set(cacheKey, { data: dbData, time: Date.now() });
        return NextResponse.json({ chains: dbData });
      }
    } catch { /* miss */ }
  }

  // Get ETH price for native value calculation
  let ethPrice = 0;
  try {
    const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      signal: AbortSignal.timeout(5000),
    });
    if (priceRes.ok) {
      const priceData = await priceRes.json() as { ethereum?: { usd?: number } };
      ethPrice = priceData.ethereum?.usd ?? 0;
    }
  } catch { /* use 0 */ }

  // Query all chains in parallel
  const results = await Promise.all(
    EVM_CHAINS.map((chain) => fetchChainSummary(chain, address, ethPrice)),
  );

  const chains = results
    .filter((r): r is ChainSummary => r !== null)
    .sort((a, b) => b.totalValueUsd - a.totalValueUsd);

  // Cache results
  memCache.set(cacheKey, { data: chains, time: Date.now() });
  if (isDBConfigured()) {
    setCache(cacheKey, chains, 300).catch(() => {}); // 5 min
  }

  return NextResponse.json({ chains });
}
