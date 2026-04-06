/**
 * Whale trade detection engine.
 * Detects DEX swaps for tracked wallets by querying Blockscout (EVM) and Solana RPCs.
 *
 * Detection heuristic: A transaction is a swap if the watched address has both
 * an inbound and outbound ERC-20 token transfer in the same tx hash.
 */

// ─── Chain configuration (mirrors wallet/multichain route) ─────────────────

export interface ChainConfig {
  id: string;
  name: string;
  blockscoutUrl: string;
  explorerTxUrl: string;
}

export const EVM_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    id: 'ethereum', name: 'Ethereum',
    blockscoutUrl: 'https://eth.blockscout.com',
    explorerTxUrl: 'https://etherscan.io/tx/',
  },
  base: {
    id: 'base', name: 'Base',
    blockscoutUrl: 'https://base.blockscout.com',
    explorerTxUrl: 'https://basescan.org/tx/',
  },
  arbitrum: {
    id: 'arbitrum', name: 'Arbitrum',
    blockscoutUrl: 'https://arbitrum.blockscout.com',
    explorerTxUrl: 'https://arbiscan.io/tx/',
  },
  optimism: {
    id: 'optimism', name: 'Optimism',
    blockscoutUrl: 'https://optimism.blockscout.com',
    explorerTxUrl: 'https://optimistic.etherscan.io/tx/',
  },
  polygon: {
    id: 'polygon', name: 'Polygon',
    blockscoutUrl: 'https://polygon.blockscout.com',
    explorerTxUrl: 'https://polygonscan.com/tx/',
  },
};

const SOLANA_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
];

// Known DEX router addresses (lowercase) → DEX name
const DEX_ROUTERS: Record<string, string> = {
  // Uniswap V3
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3',
  // Uniswap Universal Router
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap',
  '0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b': 'Uniswap',
  // 1inch
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch',
  '0x111111125421ca6dc452d289314280a0f8842a65': '1inch V6',
  // SushiSwap
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap',
  // 0x Protocol
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x',
  // Paraswap
  '0xdef171fe48cf0115b1d80b88dc8eab59176fee57': 'Paraswap',
  // CoW Protocol
  '0x9008d19f58aabd9ed0d60971565aa8510560ab41': 'CoW Swap',
};

// Jupiter program ID (Solana)
const JUPITER_PROGRAM = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

// Well-known Solana token mints → symbols
const SOLANA_TOKENS: Record<string, string> = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': 'POPCAT',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 'WIF',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'PYTH',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH (Wormhole)',
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': 'RENDER',
};

export interface DetectedTrade {
  address: string;
  chain: string;
  txHash: string;
  logIndex: number;
  dex: string;
  action: string;
  tokenIn?: string;
  tokenInSymbol?: string;
  amountIn?: number;
  tokenOut?: string;
  tokenOutSymbol?: string;
  amountOut?: number;
  valueUsd?: number;
  blockNumber?: number;
  blockTime: Date;
}

// ─── EVM trade detection via Blockscout ────────────────────────────────────

interface BlockscoutTransfer {
  tx_hash: string;
  log_index: string;
  block_number: string;
  timestamp: string;
  from: { hash: string };
  to: { hash: string };
  token: {
    address: string;
    symbol: string;
    name: string;
    decimals: string;
    exchange_rate?: string;
  };
  total: { value: string; decimals: string };
  method?: string;
}

export async function detectEVMSwaps(
  address: string,
  chain: string,
): Promise<DetectedTrade[]> {
  const config = EVM_CHAINS[chain];
  if (!config) return [];

  const addr = address.toLowerCase();
  const url = `${config.blockscoutUrl}/api/v2/addresses/${addr}/token-transfers?type=ERC-20&limit=50`;

  let transfers: BlockscoutTransfer[];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const json = await res.json();
    transfers = json.items || [];
  } catch {
    return [];
  }

  if (transfers.length === 0) return [];

  // Group transfers by tx_hash
  const byTx = new Map<string, BlockscoutTransfer[]>();
  for (const t of transfers) {
    const existing = byTx.get(t.tx_hash) || [];
    existing.push(t);
    byTx.set(t.tx_hash, existing);
  }

  const trades: DetectedTrade[] = [];

  for (const [txHash, txTransfers] of Array.from(byTx)) {
    // Separate inbound and outbound transfers for the watched address
    const outgoing = txTransfers.filter(t => t.from.hash.toLowerCase() === addr);
    const incoming = txTransfers.filter(t => t.to.hash.toLowerCase() === addr);

    // A swap = at least one outgoing + one incoming token transfer
    if (outgoing.length === 0 || incoming.length === 0) continue;

    const tokenOut = outgoing[0]; // what they sent
    const tokenIn = incoming[0];  // what they received

    const decimalsOut = parseInt(tokenOut.total.decimals || tokenOut.token.decimals || '18');
    const decimalsIn = parseInt(tokenIn.total.decimals || tokenIn.token.decimals || '18');
    const amountOut = parseFloat(tokenOut.total.value) / Math.pow(10, decimalsOut);
    const amountIn = parseFloat(tokenIn.total.value) / Math.pow(10, decimalsIn);

    // Estimate USD value from exchange_rate if available
    let valueUsd: number | undefined;
    const rateIn = parseFloat(tokenIn.token.exchange_rate || '0');
    const rateOut = parseFloat(tokenOut.token.exchange_rate || '0');
    if (rateIn > 0) valueUsd = amountIn * rateIn;
    else if (rateOut > 0) valueUsd = amountOut * rateOut;

    // Try to identify DEX from tx "to" addresses in the transfers
    let dex = 'Unknown DEX';
    for (const t of txTransfers) {
      const toAddr = t.to.hash.toLowerCase();
      const fromAddr = t.from.hash.toLowerCase();
      if (DEX_ROUTERS[toAddr]) { dex = DEX_ROUTERS[toAddr]; break; }
      if (DEX_ROUTERS[fromAddr]) { dex = DEX_ROUTERS[fromAddr]; break; }
    }

    trades.push({
      address: addr,
      chain,
      txHash,
      logIndex: parseInt(tokenIn.log_index || '0'),
      dex,
      action: 'swap',
      tokenIn: tokenIn.token.address,
      tokenInSymbol: tokenIn.token.symbol,
      amountIn,
      tokenOut: tokenOut.token.address,
      tokenOutSymbol: tokenOut.token.symbol,
      amountOut,
      valueUsd,
      blockNumber: parseInt(tokenOut.block_number || '0'),
      blockTime: new Date(tokenOut.timestamp),
    });
  }

  return trades;
}

// ─── Solana trade detection ────────────────────────────────────────────────

export async function detectSolanaSwaps(address: string): Promise<DetectedTrade[]> {
  // Get recent signatures
  let signatures: Array<{ signature: string; blockTime: number | null }> = [];

  for (const rpc of SOLANA_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getSignaturesForAddress',
          params: [address, { limit: 20 }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.result && json.result.length > 0) {
        signatures = json.result;
        break;
      }
    } catch { continue; }
  }

  if (signatures.length === 0) return [];

  // Fetch parsed transactions to detect Jupiter/Raydium swaps
  const trades: DetectedTrade[] = [];

  for (const sig of signatures.slice(0, 10)) {
    for (const rpc of SOLANA_RPCS) {
      try {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'getParsedTransaction',
            params: [sig.signature, { maxSupportedTransactionVersion: 0 }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const json = await res.json();
        const tx = json.result;
        if (!tx?.meta || tx.meta.err) break; // failed tx or no data

        // Check if Jupiter is in the program list
        const programIds: string[] = (tx.transaction?.message?.accountKeys || [])
          .map((k: any) => typeof k === 'string' ? k : k.pubkey)
          .filter(Boolean);
        const isJupiter = programIds.includes(JUPITER_PROGRAM);
        if (!isJupiter) break;

        // Parse token balance changes for the wallet
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];

        const changes: Array<{ mint: string; symbol: string; delta: number }> = [];
        for (const post of postBalances) {
          if (post.owner !== address) continue;
          const pre = preBalances.find((p: any) => p.accountIndex === post.accountIndex);
          const preAmount = parseFloat(pre?.uiTokenAmount?.uiAmountString || '0');
          const postAmount = parseFloat(post.uiTokenAmount?.uiAmountString || '0');
          const delta = postAmount - preAmount;
          if (Math.abs(delta) > 0.0001) {
            changes.push({
              mint: post.mint,
              symbol: SOLANA_TOKENS[post.mint] || `${post.mint.slice(0, 4)}...${post.mint.slice(-4)}`,
              delta,
            });
          }
        }

        if (changes.length >= 2) {
          const sent = changes.find(c => c.delta < 0);
          const received = changes.find(c => c.delta > 0);
          if (sent && received) {
            trades.push({
              address,
              chain: 'solana',
              txHash: sig.signature,
              logIndex: 0,
              dex: 'Jupiter',
              action: 'swap',
              tokenOut: sent.mint,
              tokenOutSymbol: sent.symbol,
              amountOut: Math.abs(sent.delta),
              tokenIn: received.mint,
              tokenInSymbol: received.symbol,
              amountIn: received.delta,
              blockTime: new Date((sig.blockTime || 0) * 1000),
            });
          }
        }
        break; // got the tx data, no need to try other RPCs
      } catch { continue; }
    }
  }

  return trades;
}

// ─── Unified detection ─────────────────────────────────────────────────────

export async function detectTrades(
  address: string,
  chain: string,
): Promise<DetectedTrade[]> {
  if (chain === 'solana') return detectSolanaSwaps(address);
  return detectEVMSwaps(address, chain);
}

// ─── Chain detection helper ────────────────────────────────────────────────

export function detectChain(address: string): string {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'ethereum';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'solana';
  return 'ethereum'; // default
}

// ─── Format helpers ────────────────────────────────────────────────────────

export function formatTradeValue(value: number | null | undefined): string {
  if (!value || value <= 0) return '';
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatTradeMessage(
  trade: DetectedTrade,
  label?: string | null,
): string {
  const who = label || `${trade.address.slice(0, 6)}...${trade.address.slice(-4)}`;
  const chain = EVM_CHAINS[trade.chain]?.name || trade.chain;
  const tokenIn = trade.tokenInSymbol || '???';
  const tokenOut = trade.tokenOutSymbol || '???';
  const amtOut = trade.amountOut ? trade.amountOut.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '?';
  const amtIn = trade.amountIn ? trade.amountIn.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '?';
  const usd = formatTradeValue(trade.valueUsd);
  const usdStr = usd ? ` | ${usd}` : '';

  return `${who} swapped ${amtOut} ${tokenOut} → ${amtIn} ${tokenIn} on ${trade.dex} (${chain})${usdStr}`;
}
