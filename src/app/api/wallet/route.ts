import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EthTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  gasUsed: string;
  gasPrice: string;
}

interface BtcTx {
  hash: string;
  time: number;
  result: number;
  inputs: Array<{ prev_out?: { addr?: string; value: number } }>;
  out: Array<{ addr?: string; value: number }>;
}

interface WalletResult {
  chain: 'eth' | 'btc' | 'sol';
  address: string;
  balance: string;
  balanceRaw: number;
  transactions: Array<{
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
    direction: string;
    isError?: boolean;
    error?: boolean;
  }>;
  tokens: Array<{
    symbol: string;
    name: string;
    balance: number;
    decimals: number;
    contractAddress?: string;
    balanceUsd?: number;
    tokenPrice?: number;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const CACHE_TTL = 120; // 2 minutes in seconds

// L1: In-memory cache
const memCache = new Map<string, { data: WalletResult; time: number }>();
const MEM_CACHE_TTL = 2 * 60 * 1000; // 2 min

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonOk(data: unknown) {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

/* ------------------------------------------------------------------ */
/*  ETH: Balance via Ankr public RPC (no key, no rate limit)           */
/* ------------------------------------------------------------------ */

async function fetchEthBalanceViaRPC(address: string): Promise<number> {
  // Try multiple free RPC endpoints as fallbacks
  const rpcEndpoints = [
    'https://rpc.ankr.com/eth',
    'https://eth.llamarpc.com',
    'https://1rpc.io/eth',
    'https://ethereum-rpc.publicnode.com',
  ];

  for (const rpc of rpcEndpoints) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;
      const json = await res.json() as { result?: string; error?: { message: string } };
      if (json.error || !json.result) continue;

      // Convert hex wei to ETH
      const wei = BigInt(json.result);
      return Number(wei) / 1e18;
    } catch {
      continue; // Try next RPC
    }
  }

  return -1; // All RPCs failed
}

/* ------------------------------------------------------------------ */
/*  ETH: Token balances via Blockscout V2 (free, actual balances)      */
/* ------------------------------------------------------------------ */

interface BlockscoutTokenItem {
  token: {
    symbol: string;
    name: string;
    decimals: string;
    exchange_rate: string | null;
    circulating_market_cap: string | null;
    address_hash: string;
  };
  value: string;
}

const MIN_MARKET_CAP = 500_000; // Filter out spam tokens below $500K mcap

async function fetchTokenBalancesViaBlockscout(address: string) {
  try {
    const res = await fetch(
      `https://eth.blockscout.com/api/v2/addresses/${address}/tokens?type=ERC-20`,
      { signal: AbortSignal.timeout(15000) },
    );

    if (!res.ok) return [];
    const json = await res.json() as { items?: BlockscoutTokenItem[] };
    if (!json.items || !Array.isArray(json.items)) return [];

    return json.items
      .filter((item) => {
        const mcap = parseFloat(item.token.circulating_market_cap || '0');
        const rate = parseFloat(item.token.exchange_rate || '0');
        return mcap > MIN_MARKET_CAP && rate > 0;
      })
      .map((item) => {
        const decimals = parseInt(item.token.decimals) || 18;
        const balance = Number(BigInt(item.value || '0')) / Math.pow(10, decimals);
        const price = parseFloat(item.token.exchange_rate || '0');
        const usd = balance * price;
        return {
          symbol: item.token.symbol,
          name: item.token.name,
          balance,
          decimals,
          contractAddress: item.token.address_hash || '',
          balanceUsd: usd,
          tokenPrice: price,
        };
      })
      .filter((t) => t.balance > 0 && t.balanceUsd > 1) // Remove dust
      .sort((a, b) => (b.balanceUsd || 0) - (a.balanceUsd || 0))
      .slice(0, 100);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  ETH: Transactions via Etherscan (with API key support)             */
/* ------------------------------------------------------------------ */

async function fetchEtherscanTxns(address: string): Promise<EthTransaction[]> {
  const base = 'https://api.etherscan.io/api';
  const apiKeyParam = ETHERSCAN_API_KEY ? `&apikey=${ETHERSCAN_API_KEY}` : '';

  try {
    const txRes = await fetch(
      `${base}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc${apiKeyParam}`,
      { signal: AbortSignal.timeout(10000) },
    );
    const raw = await txRes.json();
    if (raw.status === '1' && Array.isArray(raw.result)) {
      return raw.result;
    }
  } catch { /* swallow */ }

  return [];
}

/* ------------------------------------------------------------------ */
/*  ETH: Transactions via Blockscout (free, no key, datacenter-ok)     */
/* ------------------------------------------------------------------ */

async function fetchBlockscoutTxns(address: string): Promise<EthTransaction[]> {
  try {
    const txRes = await fetch(
      `https://eth.blockscout.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`,
      { signal: AbortSignal.timeout(12000) },
    );
    const raw = await txRes.json();
    if (raw.status === '1' && Array.isArray(raw.result)) {
      return raw.result;
    }
  } catch { /* swallow */ }

  return [];
}

/* ------------------------------------------------------------------ */
/*  ETH wallet handler (multi-provider)                                */
/* ------------------------------------------------------------------ */

async function fetchEthWallet(address: string): Promise<WalletResult> {
  // 1. Get balance via free RPC (reliable from datacenters)
  const balanceEth = await fetchEthBalanceViaRPC(address);

  if (balanceEth < 0) {
    throw new Error('Unable to fetch ETH balance — all RPC endpoints failed');
  }

  // 2. Get transactions + token balances in parallel
  const [etherscanTxns, tokens] = await Promise.all([
    fetchEtherscanTxns(address),
    fetchTokenBalancesViaBlockscout(address),
  ]);

  // Fall back to Blockscout if Etherscan returned nothing
  const rawTxns = etherscanTxns.length > 0
    ? etherscanTxns
    : await fetchBlockscoutTxns(address);

  // Parse transactions
  const transactions = rawTxns.map((tx) => ({
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: (Number(BigInt(tx.value || '0')) / 1e18).toFixed(6),
    timestamp: Number(tx.timeStamp) * 1000,
    isError: tx.isError === '1',
    direction: tx.to?.toLowerCase() === address.toLowerCase() ? 'in' : 'out',
    gasUsed: tx.gasUsed || undefined,
    gasPrice: tx.gasPrice || undefined,
  }));

  return {
    chain: 'eth' as const,
    address,
    balance: balanceEth.toFixed(6),
    balanceRaw: balanceEth,
    transactions,
    tokens,
  };
}

/* ------------------------------------------------------------------ */
/*  BTC wallet handler                                                 */
/* ------------------------------------------------------------------ */

async function fetchBtcWallet(address: string): Promise<WalletResult> {
  // Try blockchain.info first, then blockchair as fallback
  let data: { final_balance: number; txs: BtcTx[] } | null = null;

  try {
    const res = await fetch(`https://blockchain.info/rawaddr/${address}?limit=20`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      data = await res.json();
    }
  } catch { /* try fallback */ }

  if (!data) {
    // Fallback: mempool.space API
    try {
      const addrRes = await fetch(`https://mempool.space/api/address/${address}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (addrRes.ok) {
        const addrData = await addrRes.json() as {
          chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
        };
        const balance = (addrData.chain_stats.funded_txo_sum - addrData.chain_stats.spent_txo_sum);

        const txRes = await fetch(`https://mempool.space/api/address/${address}/txs`, {
          signal: AbortSignal.timeout(10000),
        });
        const txsRaw = txRes.ok ? await txRes.json() as Array<{
          txid: string;
          status: { block_time?: number };
          vin: Array<{ prevout?: { scriptpubkey_address?: string; value: number } }>;
          vout: Array<{ scriptpubkey_address?: string; value: number }>;
        }> : [];

        const balanceBtc = balance / 1e8;
        const transactions = txsRaw.slice(0, 20).map((tx) => {
          const isOutgoing = tx.vin.some(
            (inp) => inp.prevout?.scriptpubkey_address?.toLowerCase() === address.toLowerCase(),
          );
          const totalOut = tx.vout.reduce((s, o) => s + (o.value || 0), 0);
          return {
            hash: tx.txid,
            from: isOutgoing ? address : tx.vin[0]?.prevout?.scriptpubkey_address || 'unknown',
            to: isOutgoing ? (tx.vout[0]?.scriptpubkey_address || 'unknown') : address,
            value: (totalOut / 1e8).toFixed(8),
            timestamp: (tx.status.block_time ?? 0) * 1000,
            direction: isOutgoing ? 'out' : 'in',
          };
        });

        return {
          chain: 'btc' as const,
          address,
          balance: balanceBtc.toFixed(8),
          balanceRaw: balanceBtc,
          transactions,
          tokens: [],
        };
      }
    } catch { /* both failed */ }

    throw new Error('Unable to fetch BTC wallet data — all providers failed');
  }

  // Parse blockchain.info response
  const balanceBtc = (data.final_balance ?? 0) / 1e8;

  const transactions = (data.txs ?? []).map((tx) => {
    const isOutgoing = tx.inputs.some(
      (inp) => inp.prev_out?.addr?.toLowerCase() === address.toLowerCase(),
    );
    const valueSats = Math.abs(tx.result ?? 0);
    return {
      hash: tx.hash,
      from: isOutgoing ? address : tx.inputs[0]?.prev_out?.addr || 'unknown',
      to: isOutgoing ? (tx.out[0]?.addr || 'unknown') : address,
      value: (valueSats / 1e8).toFixed(8),
      timestamp: (tx.time ?? 0) * 1000,
      direction: isOutgoing ? 'out' : 'in',
    };
  });

  return {
    chain: 'btc' as const,
    address,
    balance: balanceBtc.toFixed(8),
    balanceRaw: balanceBtc,
    transactions,
    tokens: [],
  };
}

/* ------------------------------------------------------------------ */
/*  SOL wallet handler                                                 */
/* ------------------------------------------------------------------ */

async function fetchSolWallet(address: string): Promise<WalletResult> {
  // Try multiple Solana RPC endpoints
  const rpcEndpoints = [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-rpc.publicnode.com',
  ];

  let balanceSol = -1;
  let signatures: Array<{
    signature: string;
    blockTime: number | null;
    err: unknown;
  }> = [];

  for (const rpc of rpcEndpoints) {
    try {
      const [balRes, sigRes] = await Promise.all([
        fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [address],
          }),
          signal: AbortSignal.timeout(8000),
        }),
        fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'getSignaturesForAddress',
            params: [address, { limit: 20 }],
          }),
          signal: AbortSignal.timeout(8000),
        }),
      ]);

      const balJson = await balRes.json() as {
        result?: { value: number };
        error?: { message: string };
      };
      const sigJson = await sigRes.json() as {
        result?: Array<{
          signature: string;
          blockTime: number | null;
          err: unknown;
        }>;
        error?: { message: string };
      };

      if (!balJson.error && balJson.result) {
        balanceSol = (balJson.result.value ?? 0) / 1e9;
        signatures = sigJson.result ?? [];
        break; // Success, stop trying other RPCs
      }
    } catch {
      continue; // Try next RPC
    }
  }

  if (balanceSol < 0) {
    throw new Error('Unable to fetch SOL balance — all RPC endpoints failed');
  }

  const transactions = signatures.map((sig) => ({
    hash: sig.signature,
    from: address,
    to: '',
    value: '',
    timestamp: (sig.blockTime ?? 0) * 1000,
    direction: 'unknown' as const,
    error: sig.err !== null,
  }));

  return {
    chain: 'sol' as const,
    address,
    balance: balanceSol.toFixed(6),
    balanceRaw: balanceSol,
    transactions,
    tokens: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim();
  const chain = searchParams.get('chain') as 'eth' | 'btc' | 'sol' | null;

  if (!address) {
    return errorResponse('Missing address parameter');
  }
  if (!chain || !['eth', 'btc', 'sol'].includes(chain)) {
    return errorResponse('Invalid or missing chain parameter. Use eth, btc, or sol.');
  }

  const cacheKey = `wallet:${chain}:${address.toLowerCase()}`;

  // L1: In-memory cache
  const memCached = memCache.get(cacheKey);
  if (memCached && Date.now() - memCached.time < MEM_CACHE_TTL) {
    return jsonOk(memCached.data);
  }

  // L2: DB cache
  if (isDBConfigured()) {
    try {
      const dbData = await getCache<WalletResult>(cacheKey);
      if (dbData) {
        memCache.set(cacheKey, { data: dbData, time: Date.now() });
        return jsonOk(dbData);
      }
    } catch { /* DB miss — proceed to fetch */ }
  }

  try {
    let data: WalletResult;
    switch (chain) {
      case 'eth':
        data = await fetchEthWallet(address);
        break;
      case 'btc':
        data = await fetchBtcWallet(address);
        break;
      case 'sol':
        data = await fetchSolWallet(address);
        break;
    }

    // Store in caches
    memCache.set(cacheKey, { data, time: Date.now() });
    if (isDBConfigured()) {
      setCache(cacheKey, data, CACHE_TTL).catch(() => {});
    }

    return jsonOk(data);
  } catch (err) {
    // On error, return stale cache if available
    if (memCached) {
      return jsonOk(memCached.data);
    }

    const message = err instanceof Error ? err.message : 'Unknown error fetching wallet data';
    return errorResponse(message, 502);
  }
}
