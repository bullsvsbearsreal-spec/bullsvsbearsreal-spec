/**
 * GET /api/insider-transfers
 *
 * Recent ERC-20 outflows from the curated insider-wallet directory.
 * Uses Etherscan's free V2 unified API (one key works across ETH +
 * Arbitrum + Base + Avalanche + BSC).
 *
 * Set the env var ETHERSCAN_API_KEY to enable live data. Without it,
 * the endpoint returns the directory only and the page shows static
 * deep-links to block explorers.
 *
 * L1 cached 5 min — these wallets don't move often, no need to hammer.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { INSIDER_WALLETS, type InsiderWallet } from '@/lib/insider-wallets';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Transfer {
  walletLabel: string;
  walletAddress: string;
  chain: string;
  project: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;          // unix ms
  /** From / to (raw, not always insider→external since wallet can be either side). */
  from: string;
  to: string;
  /** Token contract addr. */
  contract: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  amount: number;             // human-readable
  /** True when transfer is OUT of the insider wallet (suspicious / sale-like). */
  isOutflow: boolean;
}

interface ApiResponse {
  walletsTracked: number;
  transfers: Transfer[];
  hasApiKey: boolean;
  ts: number;
}

const TIMEOUT = 8000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 5 * 60 * 1000;

/**
 * Etherscan V2 chainid mapping (https://docs.etherscan.io/etherscan-v2/getting-started/v2-quickstart).
 */
const CHAIN_ID: Partial<Record<InsiderWallet['chain'], number>> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  avalanche: 43114,
  bsc: 56,
};

interface EtherscanTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimal: string;
  value: string;
}

async function fetchTokenTransfersForWallet(w: InsiderWallet, apiKey: string): Promise<Transfer[]> {
  const chainId = CHAIN_ID[w.chain];
  if (!chainId) return [];
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&address=${w.address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, TIMEOUT);
    if (!res.ok) return [];
    const json = await res.json() as { status?: string; result?: EtherscanTx[] | string };
    if (json.status !== '1' || !Array.isArray(json.result)) return [];
    const lowerAddr = w.address.toLowerCase();
    return json.result.map(t => {
      const decimals = parseInt(t.tokenDecimal || '0', 10) || 0;
      const raw = t.value || '0';
      // Convert via BigInt to avoid precision loss
      let amount = 0;
      try {
        const bi = BigInt(raw);
        if (decimals > 0) {
          // Avoid bigint exponent (** isn't allowed pre-es2016) — use repeated mul.
          let div = BigInt(1);
          for (let i = 0; i < decimals; i++) div = div * BigInt(10);
          const whole = bi / div;
          const frac = bi % div;
          amount = Number(whole) + Number(frac) / Number(div);
        } else {
          amount = Number(bi);
        }
      } catch { amount = 0; }
      return {
        walletLabel: w.label,
        walletAddress: w.address,
        chain: w.chain,
        project: w.project,
        txHash: t.hash,
        blockNumber: parseInt(t.blockNumber || '0', 10) || 0,
        timestamp: parseInt(t.timeStamp || '0', 10) * 1000,
        from: (t.from || '').toLowerCase(),
        to: (t.to || '').toLowerCase(),
        contract: (t.contractAddress || '').toLowerCase(),
        tokenSymbol: t.tokenSymbol || '?',
        tokenName: t.tokenName || '',
        tokenDecimals: decimals,
        amount,
        isOutflow: (t.from || '').toLowerCase() === lowerAddr,
      };
    });
  } catch {
    return [];
  }
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=240, stale-while-revalidate=600' },
    });
  }

  const apiKey = process.env.ETHERSCAN_API_KEY?.trim();
  const walletsTracked = INSIDER_WALLETS.length;

  if (!apiKey) {
    // No key → return empty transfers, page falls back to static directory.
    // Important: do NOT cache this response. If the operator sets the env var
    // mid-deploy, the next request should pick it up immediately rather than
    // serving the no-key body for the full TTL window.
    const body: ApiResponse = {
      walletsTracked,
      transfers: [],
      hasApiKey: false,
      ts: Date.now(),
    };
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'BYPASS', 'Cache-Control': 'no-store' },
    });
  }

  // Only EVM-chain wallets can use the V2 Etherscan API
  const evmWallets = INSIDER_WALLETS.filter(w => CHAIN_ID[w.chain] != null);

  // Polite rate limit: free tier is 5 req/sec. We have ~12 EVM wallets so
  // batches of 4 with 250ms gaps stay safely under.
  const all: Transfer[] = [];
  const BATCH = 4;
  for (let i = 0; i < evmWallets.length; i += BATCH) {
    const batch = evmWallets.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map(w => fetchTokenTransfersForWallet(w, apiKey)));
    for (const s of settled) {
      if (s.status === 'fulfilled') all.push(...s.value);
    }
    if (i + BATCH < evmWallets.length) await new Promise(r => setTimeout(r, 250));
  }

  // Sort newest first, dedupe by txHash (some bridge transfers show up across two wallets).
  all.sort((a, b) => b.timestamp - a.timestamp);
  const seen = new Set<string>();
  const deduped: Transfer[] = [];
  for (const t of all) {
    if (seen.has(t.txHash)) continue;
    seen.add(t.txHash);
    deduped.push(t);
  }

  const body: ApiResponse = {
    walletsTracked,
    transfers: deduped.slice(0, 100),
    hasApiKey: true,
    ts: Date.now(),
  };
  l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=240, stale-while-revalidate=600' },
  });
}
