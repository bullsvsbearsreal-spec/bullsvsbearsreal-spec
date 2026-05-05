/**
 * gTrade (Gains Network) wallet position fetcher — STUB.
 *
 * Status: NOT WIRED INTO PRODUCTION. Probed gTrade's public backends
 * (backend-arbitrum.gains.trade, backend-global.gains.trade) and none of
 * the typical REST shapes (/personal-trading-stats, /account, /users,
 * /trader-stats, /api/trader-stats, /api/open-trades) return per-wallet
 * open trades — they all 404. Per-user open trades are stored on-chain
 * in their TradingStorage contract and require a direct RPC read via
 * Alchemy / Infura, which is a follow-up commit.
 *
 * Until then, this client returns an empty array. The router still
 * registers it so the architecture is in place for the on-chain version.
 *
 * Reference for the future RPC implementation:
 *   - Arbitrum TradingStorage: 0xcFa6ebD475d89dB04cAd5a756fff1cb2BC5bE33c
 *   - Polygon TradingStorage: 0xaee4d11a16b2bc65edd6416fb626eb404a6d65bd
 *   - Method: openTrades(address, pairIndex, tradeIndex) returns Trade struct
 *   - Iteration: openTradesCount(address, pairIndex) tells us how many to read
 */
import type { NormalizedPosition, WalletClient } from './types';

export const gtradeWalletClient: WalletClient = {
  chain: 'arbitrum',
  displayName: 'gTrade',
  async fetchPositions(_address: string): Promise<NormalizedPosition[]> {
    // Returns empty until we implement the on-chain reader. See file header
    // for the contract addresses + method signatures we'll need.
    return [];
  },
};
