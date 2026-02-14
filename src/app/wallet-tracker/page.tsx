'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { RefreshCw, Search, X, ExternalLink, ArrowUpRight, ArrowDownLeft, Copy, Check, AlertTriangle } from 'lucide-react';
import { getSavedWallets, addWallet, removeWallet, detectChain, SavedWallet } from '@/lib/storage/wallets';
import { useApiData } from '@/hooks/useApiData';
import { formatRelativeTime } from '@/lib/utils/format';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WalletTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  direction: 'in' | 'out' | 'unknown';
  isError?: boolean;
  error?: boolean;
}

interface WalletToken {
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
}

interface WalletData {
  chain: 'eth' | 'btc' | 'sol';
  address: string;
  balance: string;
  balanceRaw: number;
  transactions: WalletTransaction[];
  tokens: WalletToken[];
  error?: string;
}

interface TickerEntry {
  symbol: string;
  lastPrice: number;
  exchange: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CHAIN_CONFIG = {
  eth: {
    name: 'Ethereum',
    symbol: 'ETH',
    color: '#627EEA',
    explorer: 'https://etherscan.io',
    txPath: '/tx/',
    addrPath: '/address/',
  },
  btc: {
    name: 'Bitcoin',
    symbol: 'BTC',
    color: '#F7931A',
    explorer: 'https://www.blockchain.com',
    txPath: '/btc/tx/',
    addrPath: '/btc/address/',
  },
  sol: {
    name: 'Solana',
    symbol: 'SOL',
    color: '#9945FF',
    explorer: 'https://solscan.io',
    txPath: '/tx/',
    addrPath: '/account/',
  },
} as const;

const PRESET_WALLETS = [
  { label: 'Vitalik', address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', chain: 'eth' as const },
  { label: 'Binance Hot', address: '0x28C6c06298d514Db089934071355E5743bf21d60', chain: 'eth' as const },
  { label: 'BTC Genesis', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', chain: 'btc' as const },
  { label: 'SOL Whale', address: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', chain: 'sol' as const },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function truncateAddress(addr: string, chars = 6): string {
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

function truncateHash(hash: string, chars = 8): string {
  if (hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

function ChainBadge({ chain }: { chain: 'eth' | 'btc' | 'sol' }) {
  const cfg = CHAIN_CONFIG[chain];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase"
      style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
    >
      {cfg.symbol}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton loaders                                                   */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.04] animate-pulse">
      <div className="w-16 h-4 bg-white/[0.06] rounded" />
      <div className="flex-1 h-4 bg-white/[0.06] rounded" />
      <div className="w-20 h-4 bg-white/[0.06] rounded" />
      <div className="w-16 h-4 bg-white/[0.06] rounded" />
    </div>
  );
}

function BalanceSkeleton() {
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-white/[0.06]" />
        <div>
          <div className="h-3 w-24 bg-white/[0.06] rounded mb-2" />
          <div className="h-3 w-40 bg-white/[0.06] rounded" />
        </div>
      </div>
      <div className="h-10 w-48 bg-white/[0.06] rounded mb-2" />
      <div className="h-5 w-32 bg-white/[0.06] rounded" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function WalletTrackerPage() {
  /* ---- local state ------------------------------------------------ */
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([]);
  const [addressInput, setAddressInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [activeAddress, setActiveAddress] = useState('');
  const [activeChain, setActiveChain] = useState<'eth' | 'btc' | 'sol' | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [inputError, setInputError] = useState('');

  // Hydrate saved wallets from localStorage
  useEffect(() => {
    setSavedWallets(getSavedWallets());
  }, []);

  // Detect chain as user types
  const detectedChain = useMemo(() => detectChain(addressInput), [addressInput]);

  /* ---- fetch prices for USD conversion ------------------------------ */
  const priceFetcher = useCallback(
    () => fetch('/api/tickers').then((r) => r.json()) as Promise<TickerEntry[]>,
    [],
  );

  const { data: tickers } = useApiData({
    fetcher: priceFetcher,
    refreshInterval: 60_000,
  });

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    (tickers ?? []).forEach((t) => {
      const sym = t.symbol.toUpperCase().replace(/(USDT|USD|USDC|BUSD|PERP|SWAP)$/i, '');
      if (!map[sym] || t.lastPrice > map[sym]) {
        map[sym] = t.lastPrice;
      }
    });
    return map;
  }, [tickers]);

  /* ---- fetch wallet data ------------------------------------------- */
  const walletFetcher = useCallback(async () => {
    if (!activeAddress || !activeChain) return null;
    const res = await fetch(`/api/wallet?address=${encodeURIComponent(activeAddress)}&chain=${activeChain}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    // Ensure arrays are always present
    return {
      ...json,
      transactions: json.transactions ?? [],
      tokens: json.tokens ?? [],
    } as WalletData;
  }, [activeAddress, activeChain]);

  const {
    data: walletData,
    isLoading: walletLoading,
    error: walletError,
    lastUpdate,
    refresh: refreshWallet,
  } = useApiData<WalletData | null>({
    fetcher: walletFetcher,
    refreshInterval: 120_000,
    enabled: !!activeAddress && !!activeChain,
  });

  /* ---- derived values ---------------------------------------------- */
  const balanceUSD = useMemo(() => {
    if (!walletData || !activeChain) return null;
    const chainSymbol = CHAIN_CONFIG[activeChain].symbol;
    const price = priceMap[chainSymbol];
    if (!price) return null;
    return walletData.balanceRaw * price;
  }, [walletData, activeChain, priceMap]);

  /* ---- handlers ---------------------------------------------------- */
  const handleTrack = () => {
    const addr = addressInput.trim();
    if (!addr) return;

    const chain = detectedChain;
    if (!chain) {
      setInputError('Could not detect chain. Enter a valid ETH, BTC, or SOL address.');
      return;
    }

    setInputError('');
    setActiveAddress(addr);
    setActiveChain(chain);

    // Auto-save if not already saved
    addWallet(addr, chain, labelInput.trim() || undefined);
    setSavedWallets(getSavedWallets());
    setLabelInput('');
  };

  const handleSelectWallet = (wallet: SavedWallet) => {
    setActiveAddress(wallet.address);
    setActiveChain(wallet.chain);
    setAddressInput(wallet.address);
    setInputError('');
  };

  const handlePreset = (preset: typeof PRESET_WALLETS[number]) => {
    setAddressInput(preset.address);
    setActiveAddress(preset.address);
    setActiveChain(preset.chain);
    addWallet(preset.address, preset.chain, preset.label);
    setSavedWallets(getSavedWallets());
    setInputError('');
  };

  const handleRemoveWallet = (address: string) => {
    removeWallet(address);
    setSavedWallets(getSavedWallets());
    if (activeAddress.toLowerCase() === address.toLowerCase()) {
      setActiveAddress('');
      setActiveChain(null);
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {
      // fallback
    }
  };

  const getExplorerTxUrl = (chain: 'eth' | 'btc' | 'sol', hash: string) => {
    const cfg = CHAIN_CONFIG[chain];
    return `${cfg.explorer}${cfg.txPath}${hash}`;
  };

  const getExplorerAddressUrl = (chain: 'eth' | 'btc' | 'sol', addr: string) => {
    const cfg = CHAIN_CONFIG[chain];
    return `${cfg.explorer}${cfg.addrPath}${addr}`;
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 page-enter">
        {/* ---------- title bar --------------------------------------- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-hub-yellow" />
              Wallet Tracker
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Track balances and transactions for ETH, BTC, and SOL wallets
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeAddress && (
              <button
                onClick={() => refreshWallet()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-white/[0.06] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
            {lastUpdate && (
              <span className="text-[11px] text-neutral-600 hidden sm:inline">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* ---------- address input ----------------------------------- */}
        <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={addressInput}
                    onChange={(e) => {
                      setAddressInput(e.target.value);
                      setInputError('');
                    }}
                    placeholder="Enter wallet address (0x..., 1..., bc1..., or Solana)"
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTrack();
                    }}
                  />
                  {detectedChain && (
                    <ChainBadge chain={detectedChain} />
                  )}
                </div>
                {inputError && (
                  <p className="text-red-400 text-xs mt-1.5">{inputError}</p>
                )}
              </div>

              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Label (optional)"
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 w-full sm:w-40"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTrack();
                }}
              />

              <button
                onClick={handleTrack}
                disabled={!addressInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-hub-yellow text-black hover:bg-hub-yellow/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                Track
              </button>
            </div>

            {/* Quick-add presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-neutral-600 text-xs">Quick add:</span>
              {PRESET_WALLETS.map((pw) => (
                <button
                  key={pw.address}
                  onClick={() => handlePreset(pw)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
                >
                  {pw.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- saved wallets ----------------------------------- */}
        {savedWallets.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
              Saved Wallets
            </h2>
            <div className="flex flex-wrap gap-2">
              {savedWallets.map((w) => (
                <button
                  key={w.address}
                  onClick={() => handleSelectWallet(w)}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    activeAddress.toLowerCase() === w.address.toLowerCase()
                      ? 'bg-hub-yellow/20 text-hub-yellow border border-hub-yellow/30'
                      : 'bg-white/[0.06] text-neutral-400 hover:bg-white/[0.1] hover:text-white border border-transparent'
                  }`}
                >
                  <ChainBadge chain={w.chain} />
                  <span className="font-mono text-xs">
                    {w.label || truncateAddress(w.address)}
                  </span>
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveWallet(w.address);
                    }}
                    className="p-0.5 rounded hover:bg-white/[0.1] text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- empty state -------------------------------------- */}
        {!activeAddress && (
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-12 text-center">
            <Search className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-neutral-300 mb-2">
              Enter a wallet address to track
            </h2>
            <p className="text-neutral-600 text-sm mb-6 max-w-md mx-auto">
              Paste an Ethereum, Bitcoin, or Solana address above to view balances, transactions, and token holdings.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {PRESET_WALLETS.map((pw) => (
                <button
                  key={pw.address}
                  onClick={() => handlePreset(pw)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
                >
                  {pw.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- wallet data -------------------------------------- */}
        {activeAddress && activeChain && (
          <div className="space-y-6">
            {/* Balance card */}
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  {walletLoading && !walletData ? (
                    <BalanceSkeleton />
                  ) : walletError ? (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {walletError}
                    </div>
                  ) : walletData ? (
                    <>
                      <div className="flex items-center gap-3 mb-1">
                        <ChainBadge chain={activeChain} />
                        <span className="text-neutral-500 text-sm font-mono">
                          {truncateAddress(activeAddress, 8)}
                        </span>
                        <a
                          href={getExplorerAddressUrl(activeChain, activeAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral-600 hover:text-neutral-400 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="text-3xl font-bold text-white mt-2">
                        {walletData.balance} {CHAIN_CONFIG[activeChain].symbol}
                      </div>
                      {balanceUSD !== null && (
                        <div className="text-neutral-400 text-lg mt-1">
                          ${balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </div>
                      )}
                    </>
                  ) : null}
                </div>

                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold border border-white/[0.1]"
                  style={{ backgroundColor: `${CHAIN_CONFIG[activeChain].color}20`, color: CHAIN_CONFIG[activeChain].color, boxShadow: `0 4px 12px ${CHAIN_CONFIG[activeChain].color}20` }}
                >
                  {CHAIN_CONFIG[activeChain].symbol.charAt(0)}
                </div>
              </div>
            </div>

            {/* Token balances (ETH only) */}
            {activeChain === 'eth' && walletData && walletData.tokens && walletData.tokens.length > 0 && (
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-white">ERC-20 Tokens</h3>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {walletData.tokens.map((token) => (
                    <div
                      key={token.symbol}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-bold text-neutral-400">
                          {token.symbol.charAt(0)}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white">{token.symbol}</span>
                          <span className="text-neutral-600 text-xs ml-2">{token.name}</span>
                        </div>
                      </div>
                      <span className="text-sm font-mono text-white">
                        {token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions */}
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
              </div>

              {walletLoading && !walletData ? (
                <div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </div>
              ) : walletError ? (
                <div className="p-4">
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {walletError}
                  </div>
                </div>
              ) : walletData && (!walletData.transactions || walletData.transactions.length === 0) ? (
                <div className="p-8 text-center text-neutral-600 text-sm">No transactions found</div>
              ) : walletData ? (
                <>
                  {/* Desktop table header */}
                  <div className="hidden sm:flex items-center px-4 py-2 border-b border-white/[0.06] text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                    <div className="w-8" />
                    <div className="flex-[2]">Hash</div>
                    <div className="flex-[2]">From / To</div>
                    <div className="flex-1 text-right">Value</div>
                    <div className="flex-1 text-right">Time</div>
                    <div className="w-16" />
                  </div>

                  <div className="divide-y divide-white/[0.04]">
                    {walletData.transactions.map((tx) => {
                      const isIn = tx.direction === 'in';
                      const isOut = tx.direction === 'out';
                      return (
                        <div
                          key={tx.hash}
                          className="flex flex-col sm:flex-row sm:items-center px-4 py-3 hover:bg-white/[0.02] transition-colors gap-1 sm:gap-0"
                        >
                          {/* Direction icon */}
                          <div className="hidden sm:flex w-8 items-center">
                            {isIn ? (
                              <ArrowDownLeft className="w-4 h-4 text-green-400" />
                            ) : isOut ? (
                              <ArrowUpRight className="w-4 h-4 text-red-400" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-neutral-700" />
                            )}
                          </div>

                          {/* Hash */}
                          <div className="flex-[2] flex items-center gap-1.5">
                            <span className="sm:hidden">
                              {isIn ? (
                                <ArrowDownLeft className="w-3.5 h-3.5 text-green-400 inline mr-1" />
                              ) : isOut ? (
                                <ArrowUpRight className="w-3.5 h-3.5 text-red-400 inline mr-1" />
                              ) : null}
                            </span>
                            <span className="text-[13px] font-mono text-neutral-300">
                              {truncateHash(tx.hash)}
                            </span>
                            <button
                              onClick={() => handleCopyHash(tx.hash)}
                              className="p-0.5 text-neutral-600 hover:text-neutral-400 transition-colors"
                            >
                              {copiedHash === tx.hash ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>

                          {/* From / To */}
                          <div className="flex-[2] text-[12px] font-mono text-neutral-500">
                            {tx.from && tx.to ? (
                              <span>
                                <span className={isOut ? 'text-red-400/60' : 'text-neutral-500'}>
                                  {truncateAddress(tx.from, 4)}
                                </span>
                                <span className="text-neutral-700 mx-1">&rarr;</span>
                                <span className={isIn ? 'text-green-400/60' : 'text-neutral-500'}>
                                  {truncateAddress(tx.to, 4)}
                                </span>
                              </span>
                            ) : (
                              <span className="text-neutral-700">--</span>
                            )}
                          </div>

                          {/* Value */}
                          <div className={`flex-1 text-right text-[13px] font-mono ${
                            isIn ? 'text-green-400' : isOut ? 'text-red-400' : 'text-neutral-400'
                          }`}>
                            {tx.value ? (
                              <>
                                {isIn ? '+' : isOut ? '-' : ''}{tx.value} {CHAIN_CONFIG[activeChain].symbol}
                              </>
                            ) : (
                              <span className="text-neutral-700">--</span>
                            )}
                          </div>

                          {/* Time */}
                          <div className="flex-1 text-right text-[12px] text-neutral-500">
                            {tx.timestamp > 0 ? formatRelativeTime(tx.timestamp) : '--'}
                          </div>

                          {/* Explorer link */}
                          <div className="w-16 text-right">
                            <a
                              href={getExplorerTxUrl(activeChain, tx.hash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-neutral-600 hover:text-hub-yellow transition-colors"
                            >
                              View
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* ---------- wallet count ------------------------------------- */}
        {savedWallets.length > 0 && (
          <div className="mt-3 text-neutral-600 text-xs text-right">
            {savedWallets.length}/10 wallet{savedWallets.length !== 1 ? 's' : ''} saved
          </div>
        )}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            Wallet Tracker supports Ethereum (0x addresses), Bitcoin (1/3/bc1 addresses), and Solana (base58 addresses). ETH balances are fetched via public RPC nodes, transactions via Etherscan and Blockscout. BTC data comes from Blockchain.info and Mempool.space. SOL data from Solana mainnet RPC. Data caches for 2 minutes. Saved wallets are stored locally in your browser (max 10).
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
