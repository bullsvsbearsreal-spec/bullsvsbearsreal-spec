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
  // Uniswap V2/V3/Universal Router
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap',
  '0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b': 'Uniswap',
  // 1inch
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch',
  '0x111111125421ca6dc452d289314280a0f8842a65': '1inch V6',
  // SushiSwap
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap',
  '0x6bded42c6da8fbf0d2ba55b2fa120c5e0c8d7891': 'SushiSwap V3',
  // 0x Protocol
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x',
  // Paraswap
  '0xdef171fe48cf0115b1d80b88dc8eab59176fee57': 'Paraswap',
  // CoW Protocol
  '0x9008d19f58aabd9ed0d60971565aa8510560ab41': 'CoW Swap',
  // Curve Finance
  '0x99a58482bd75cbab83b27ec03ca68ff489b5788f': 'Curve',
  '0xf0d4c12a5768d806021f80a262b4d39d26c58b8d': 'Curve Router',
  // Balancer
  '0xba12222222228d8ba445958a75a0704d566bf2c8': 'Balancer',
  // Kyber Network (KyberSwap)
  '0x6131b5fae19ea4f9d964eac0408e4408b66337b5': 'KyberSwap',
  // DODO
  '0xa356867fdcea8e71aeaf87805808ab1d0aa39f8e': 'DODO',
  // Camelot (Arbitrum)
  '0xc873fecbd354f5a56e00e710b90ef4201db2448d': 'Camelot',
  // Trader Joe (Avalanche/Arbitrum)
  '0xb4315e873dbcf96ffd0acd8ea43f689d8c20fb30': 'Trader Joe',
  // PancakeSwap (BSC/Ethereum)
  '0x13f4ea83d0bd40e75c8222255bc855a974568dd4': 'PancakeSwap V3',
  '0xeff92a263d31888d860bd50809a8d171709b7b1c': 'PancakeSwap',
  // Odos
  '0xcf5540fffcdc3d510b18bfca6d2b9987b0772559': 'Odos',
  // OpenOcean
  '0x6352a56caadc4f1e25cd6c75970fa768a3304e64': 'OpenOcean',
  // Maverick
  '0x32aed3bce901da12ca8f29d3213f3c8e232f8692': 'Maverick',
};

// Solana DEX program IDs
const SOLANA_DEX_PROGRAMS: Record<string, string> = {
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB9': 'Jupiter V4',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
  'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS': 'Raydium V2',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium CLMM',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpools',
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca V2',
};

// Well-known Solana token mints → symbols
const SOLANA_TOKENS: Record<string, string> = {
  // Native / wrapped
  'So11111111111111111111111111111111111111112': 'SOL',
  // Stablecoins
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA': 'USDS',
  // LSTs
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 'bSOL',
  // DeFi
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'PYTH',
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 'ORCA',
  'RaijocabFdwX19w8RpiPBjNJdkHcYBSFKUX1ZY4paj1': 'RAY',
  'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey': 'MNDE',
  'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7': 'DRIFT',
  // Memecoins
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 'WIF',
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': 'POPCAT',
  'A8C3xuqscfmyLrte3VKj5YS4cGL1z1LRDWT3xkjYPump': 'FARTCOIN',
  '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv': 'PENGU',
  'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82': 'BOME',
  // AI / Infra
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': 'RENDER',
  'FtgGSFADXBtroxq8VCausXRr2of47QBf5AS1NtZCu4GD': 'IO',
  // Bridged
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH (Wormhole)',
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 'WBTC (Wormhole)',
  'A9mUU4qviSctJVPJdBGJuoSKRF7T6EKUZGQMbaVQ76M5': 'WETH (Wormhole)',
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

        // Check if any known DEX program is in the transaction
        const programIds: string[] = (tx.transaction?.message?.accountKeys || [])
          .map((k: any) => typeof k === 'string' ? k : k.pubkey)
          .filter(Boolean);
        let detectedDex: string | null = null;
        for (const pid of programIds) {
          if (SOLANA_DEX_PROGRAMS[pid]) { detectedDex = SOLANA_DEX_PROGRAMS[pid]; break; }
        }
        if (!detectedDex) break;

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
              dex: detectedDex,
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

// ─── Hyperliquid perp trade detection ─────────────────────────────────────

export async function detectHyperliquidTrades(address: string): Promise<DetectedTrade[]> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userFills', user: address }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const fills = await res.json();
    if (!Array.isArray(fills) || fills.length === 0) return [];

    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const trades: DetectedTrade[] = [];

    for (const fill of fills.slice(0, 50)) {
      const fillTime = fill.time ? new Date(fill.time).getTime() : 0;
      if (fillTime < tenMinAgo) continue;

      const coin = fill.coin || '';
      const sz = parseFloat(fill.sz || '0');
      const px = parseFloat(fill.px || '0');
      const valueUsd = sz * px;
      const side = fill.side === 'B' ? 'buy' : 'sell';

      trades.push({
        address,
        chain: 'arbitrum',
        // Synthetic txHash composition: prefer the real on-chain hash;
        // otherwise build one keyed on (address, time, coin) so dedup
        // works correctly. Was using `fill.tid` as a fallback hash —
        // tid is a per-user trade COUNTER, so two different addresses
        // with overlapping tids would collide and silently dedup.
        // Including the address fixes that.
        txHash: fill.hash || `hl-${address}-${fill.time}-${coin}`,
        logIndex: fill.tid ? parseInt(fill.tid) : 0,
        dex: 'Hyperliquid',
        action: side,
        tokenInSymbol: side === 'buy' ? coin : 'USDC',
        tokenOutSymbol: side === 'buy' ? 'USDC' : coin,
        amountIn: side === 'buy' ? sz : valueUsd,
        amountOut: side === 'buy' ? valueUsd : sz,
        valueUsd,
        blockTime: new Date(fillTime),
      });
    }
    return trades;
  } catch {
    return [];
  }
}

// ─── dYdX V4 perp trade detection ────────────────────────────────────────

export async function detectDydxTrades(address: string): Promise<DetectedTrade[]> {
  try {
    const res = await fetch(
      `https://indexer.dydx.trade/v4/fills?address=${address}&subaccountNumber=0&limit=50`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const json = await res.json();
    const fills = json.fills || [];
    if (fills.length === 0) return [];

    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const trades: DetectedTrade[] = [];

    for (const fill of fills) {
      const fillTime = fill.createdAt ? new Date(fill.createdAt).getTime() : 0;
      if (fillTime < tenMinAgo) continue;

      const symbol = (fill.market || '').replace(/-USD$/, '');
      const sz = parseFloat(fill.size || '0');
      const px = parseFloat(fill.price || '0');
      const valueUsd = sz * px;
      const side = fill.side === 'BUY' ? 'buy' : 'sell';

      trades.push({
        address,
        chain: 'ethereum',
        txHash: fill.id || `dydx-${fill.createdAt}-${symbol}`,
        logIndex: 0,
        dex: 'dYdX',
        action: side,
        tokenInSymbol: side === 'buy' ? symbol : 'USDC',
        tokenOutSymbol: side === 'buy' ? 'USDC' : symbol,
        amountIn: side === 'buy' ? sz : valueUsd,
        amountOut: side === 'buy' ? valueUsd : sz,
        valueUsd,
        blockTime: new Date(fillTime),
      });
    }
    return trades;
  } catch {
    return [];
  }
}

// ─── Drift Protocol trade detection (Solana) ─────────────────────────────

export async function detectDriftTrades(address: string): Promise<DetectedTrade[]> {
  try {
    const res = await fetch(
      `https://data.api.drift.trade/user/${address}/tradeHistory?limit=50`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const json = await res.json();
    const fills = json.records || json.data || json || [];
    if (!Array.isArray(fills) || fills.length === 0) return [];

    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const trades: DetectedTrade[] = [];

    for (const fill of fills) {
      const fillTime = fill.ts ? fill.ts * 1000 : (fill.filledAt ? new Date(fill.filledAt).getTime() : 0);
      if (fillTime < tenMinAgo) continue;

      const symbol = (fill.marketName || fill.symbol || '').replace(/-PERP$/, '').replace(/^1M/, '');
      const sz = parseFloat(fill.baseAssetAmount || fill.size || '0') / 1e9; // BASE_PRECISION
      const px = parseFloat(fill.oraclePrice || fill.price || '0') / 1e6; // PRICE_PRECISION
      const valueUsd = Math.abs(sz * px);
      const side = (fill.direction === 'long' || fill.takerSide === 'buy') ? 'buy' : 'sell';

      if (valueUsd < 1) continue;

      trades.push({
        address,
        chain: 'solana',
        txHash: fill.txSig || fill.txSignature || `drift-${fillTime}-${symbol}`,
        logIndex: fill.fillRecordId || 0,
        dex: 'Drift',
        action: side,
        tokenInSymbol: side === 'buy' ? symbol : 'USDC',
        tokenOutSymbol: side === 'buy' ? 'USDC' : symbol,
        amountIn: side === 'buy' ? Math.abs(sz) : valueUsd,
        amountOut: side === 'buy' ? valueUsd : Math.abs(sz),
        valueUsd,
        blockTime: new Date(fillTime),
      });
    }
    return trades;
  } catch {
    return [];
  }
}

// ─── Unified detection ─────────────────────────────────────────────────────

export async function detectTrades(
  address: string,
  chain: string,
): Promise<DetectedTrade[]> {
  // For EVM addresses, check DEX perps in parallel with on-chain swaps
  if (chain === 'solana') {
    const [solSwaps, drift] = await Promise.all([
      detectSolanaSwaps(address),
      detectDriftTrades(address),
    ]);
    return [...solSwaps, ...drift];
  }

  const [evmSwaps, hl, dydx] = await Promise.all([
    detectEVMSwaps(address, chain),
    detectHyperliquidTrades(address),
    detectDydxTrades(address),
  ]);
  return [...evmSwaps, ...hl, ...dydx];
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
  const usd = formatTradeValue(trade.valueUsd);
  const usdStr = usd ? ` | ${usd}` : '';

  // Perp DEX trades (buy/sell instead of swap)
  const isPerpDex = ['Hyperliquid', 'dYdX', 'Drift'].includes(trade.dex);
  if (isPerpDex) {
    const symbol = trade.action === 'buy' ? trade.tokenInSymbol : trade.tokenOutSymbol;
    const side = trade.action === 'buy' ? 'longed' : 'shorted';
    return `${who} ${side} ${symbol} on ${trade.dex}${usdStr}`;
  }

  const tokenIn = trade.tokenInSymbol || '???';
  const tokenOut = trade.tokenOutSymbol || '???';
  const amtOut = trade.amountOut ? trade.amountOut.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '?';
  const amtIn = trade.amountIn ? trade.amountIn.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '?';

  return `${who} swapped ${amtOut} ${tokenOut} → ${amtIn} ${tokenIn} on ${trade.dex} (${chain})${usdStr}`;
}
