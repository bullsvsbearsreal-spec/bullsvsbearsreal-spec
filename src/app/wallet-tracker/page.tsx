'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TokenIconSimple } from '@/components/TokenIcon';
import { RefreshCw, Search, X, ExternalLink, ArrowUpRight, ArrowDownLeft, Copy, Check, AlertTriangle, Wallet, Coins, TrendingUp } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getSavedWallets, addWallet, removeWallet, detectChain, SavedWallet } from '@/lib/storage/wallets';
import { useApiData } from '@/hooks/useApiData';
import { formatRelativeTime, formatUSD, formatPrice } from '@/lib/utils/format';

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
  gasUsed?: string;
  gasPrice?: string;
}

interface WalletToken {
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  contractAddress?: string;
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

interface EnrichedToken extends WalletToken {
  price: number | null;
  usdValue: number | null;
}

interface DexPosition {
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  positionValue: number;
  unrealizedPnl: number;
  roe: number;
  leverage: number;
  liquidationPrice: number | null;
  marginUsed: number;
}

interface PositionsData {
  exchange: string;
  accountValue: number;
  totalMarginUsed: number;
  positions: DexPosition[];
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

function PortfolioSkeleton() {
  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-6 relative overflow-hidden animate-pulse">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-5 bg-white/[0.06] rounded-full" />
        <div className="h-4 w-40 bg-white/[0.06] rounded" />
      </div>
      <div className="h-12 w-56 bg-white/[0.06] rounded mb-3" />
      <div className="h-5 w-36 bg-white/[0.06] rounded" />
    </div>
  );
}

function TokenSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
      <div className="w-7 h-7 rounded-full bg-white/[0.06]" />
      <div className="flex-1 h-4 bg-white/[0.06] rounded" />
      <div className="w-16 h-4 bg-white/[0.06] rounded" />
      <div className="w-20 h-4 bg-white/[0.06] rounded" />
      <div className="w-20 h-4 bg-white/[0.06] rounded" />
    </div>
  );
}

function TxSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.04] animate-pulse">
      <div className="w-16 h-5 bg-white/[0.06] rounded-full" />
      <div className="flex-1 h-4 bg-white/[0.06] rounded" />
      <div className="w-20 h-4 bg-white/[0.06] rounded" />
      <div className="w-16 h-4 bg-white/[0.06] rounded" />
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
  const [activeTab, setActiveTab] = useState<'tokens' | 'transactions' | 'positions'>('tokens');

  // Hydrate saved wallets from localStorage
  useEffect(() => {
    setSavedWallets(getSavedWallets());
  }, []);

  // Reset to tokens tab when switching to a non-ETH wallet while on positions tab
  useEffect(() => {
    if (activeTab === 'positions' && activeChain !== 'eth') {
      setActiveTab('tokens');
    }
  }, [activeChain, activeTab]);

  // Detect chain as user types
  const detectedChain = useMemo(() => detectChain(addressInput), [addressInput]);

  /* ---- fetch prices for USD conversion ------------------------------ */
  const priceFetcher = useCallback(
    () => fetch('/api/tickers').then((r) => r.json()).then((j: any) => (Array.isArray(j) ? j : j.data ?? [])) as Promise<TickerEntry[]>,
    [],
  );

  const { data: tickers } = useApiData({
    fetcher: priceFetcher,
    refreshInterval: 60_000,
  });

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    (Array.isArray(tickers) ? tickers : []).forEach((t) => {
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

  /* ---- fetch DEX positions (Hyperliquid) ----------------------------- */
  const positionsFetcher = useCallback(async () => {
    if (!activeAddress || activeChain !== 'eth') return null;
    const res = await fetch(`/api/wallet/positions?address=${encodeURIComponent(activeAddress)}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json as PositionsData;
  }, [activeAddress, activeChain]);

  const {
    data: positionsData,
    isLoading: positionsLoading,
  } = useApiData<PositionsData | null>({
    fetcher: positionsFetcher,
    refreshInterval: 60_000,
    enabled: !!activeAddress && activeChain === 'eth',
  });

  /* ---- derived values ---------------------------------------------- */
  const balanceUSD = useMemo(() => {
    if (!walletData || !activeChain) return null;
    const chainSymbol = CHAIN_CONFIG[activeChain].symbol;
    const price = priceMap[chainSymbol];
    if (!price) return null;
    const val = walletData.balanceRaw * price;
    return isNaN(val) ? null : val;
  }, [walletData, activeChain, priceMap]);

  const enrichedTokens: EnrichedToken[] = useMemo(() => {
    if (!walletData?.tokens) return [];
    const nativeSymbol = activeChain ? CHAIN_CONFIG[activeChain].symbol : '';

    // Deduplicate by symbol (keep highest balance) and filter spam
    const deduped = new Map<string, WalletToken & { contractAddress?: string }>();
    for (const token of walletData.tokens) {
      const sym = token.symbol.toUpperCase();
      // Skip tokens matching native symbol (already counted in native balance)
      if (sym === nativeSymbol) continue;
      // Spam filters: absurd balances, suspicious names
      if (token.balance > 1e12) continue;
      if (token.balance <= 0) continue;

      const existing = deduped.get(sym);
      if (!existing || token.balance > existing.balance) {
        deduped.set(sym, token);
      }
    }

    return Array.from(deduped.values())
      .map((token) => {
        const sym = token.symbol.toUpperCase();
        const stripped = sym.replace(/^W/, ''); // WETH → ETH
        const price = priceMap[sym] || priceMap[stripped] || null;
        const usdValue = price ? token.balance * price : null;
        return { ...token, price, usdValue };
      })
      .filter((token) => {
        // Keep all tokens with a known price
        if (token.usdValue !== null) return true;
        // Hide unpriced tokens with suspiciously high balances (airdrop spam)
        if (token.balance > 1_000_000) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.usdValue !== null && b.usdValue !== null) return b.usdValue - a.usdValue;
        if (a.usdValue !== null) return -1;
        if (b.usdValue !== null) return 1;
        return b.balance - a.balance;
      });
  }, [walletData, priceMap, activeChain]);

  const totalTokenUSD = useMemo(() => {
    return enrichedTokens.reduce((sum, t) => sum + (t.usdValue ?? 0), 0);
  }, [enrichedTokens]);

  const totalPortfolioUSD = useMemo(() => {
    const base = balanceUSD ?? 0;
    const tokens = totalTokenUSD ?? 0;
    const total = base + tokens;
    return isNaN(total) ? 0 : total;
  }, [balanceUSD, totalTokenUSD]);

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

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(text);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch { /* fallback */ }
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
    <div className="min-h-screen bg-hub-black text-white">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* ---------- title bar --------------------------------------- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="heading-page flex items-center gap-2">
              <Wallet className="w-5 h-5 text-hub-yellow" />
              Wallet Tracker
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Track balances, tokens, and transactions for ETH, BTC &amp; SOL wallets
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
        <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={addressInput}
                    onChange={(e) => { setAddressInput(e.target.value); setInputError(''); }}
                    placeholder="Enter wallet address (0x..., 1..., bc1..., or Solana)"
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 font-mono"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTrack(); }}
                  />
                  {detectedChain && <ChainBadge chain={detectedChain} />}
                </div>
                {inputError && <p className="text-red-400 text-xs mt-1.5">{inputError}</p>}
              </div>

              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Label (optional)"
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 w-full sm:w-40"
                onKeyDown={(e) => { if (e.key === 'Enter') handleTrack(); }}
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
                    onClick={(e) => { e.stopPropagation(); handleRemoveWallet(w.address); }}
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
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-12 text-center">
            <Wallet className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-neutral-300 mb-2">
              Enter a wallet address to track
            </h2>
            <p className="text-neutral-600 text-sm mb-6 max-w-md mx-auto">
              Paste an Ethereum, Bitcoin, or Solana address above to view portfolio value, token holdings, and transactions.
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

        {/* ============================================================ */}
        {/*  WALLET DATA SECTIONS                                         */}
        {/* ============================================================ */}
        {activeAddress && activeChain && (
          <div className="space-y-5">

            {/* ========== PORTFOLIO OVERVIEW CARD ======================== */}
            {walletLoading && !walletData ? (
              <PortfolioSkeleton />
            ) : walletError ? (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-6">
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {walletError}
                </div>
              </div>
            ) : walletData ? (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-6 relative overflow-hidden">
                {/* Accent gradient top line */}
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{
                    background: `linear-gradient(to right, transparent, ${CHAIN_CONFIG[activeChain].color}60, transparent)`,
                  }}
                />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: value */}
                  <div className="min-w-0">
                    {/* Address row */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <ChainBadge chain={activeChain} />
                      <span className="text-neutral-500 text-sm font-mono truncate max-w-[280px]">
                        {truncateAddress(activeAddress, 8)}
                      </span>
                      <button
                        onClick={() => handleCopy(activeAddress)}
                        className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors"
                        title="Copy address"
                      >
                        {copiedHash === activeAddress ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={getExplorerAddressUrl(activeChain, activeAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors"
                        title="View on explorer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Total portfolio value */}
                    <div className="text-4xl sm:text-5xl font-bold text-white font-mono tabular-nums leading-tight">
                      {totalPortfolioUSD > 0
                        ? `$${totalPortfolioUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : balanceUSD !== null
                          ? `$${balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '--'
                      }
                    </div>

                    {/* Native balance */}
                    <div className="flex items-center gap-3 mt-2 text-neutral-400 text-sm">
                      <span className="font-mono">
                        {walletData.balance} {CHAIN_CONFIG[activeChain].symbol}
                      </span>
                      {balanceUSD !== null && enrichedTokens.length > 0 && (
                        <span className="text-neutral-600">
                          (${balanceUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>

                    {/* Unrealized PnL from DEX positions */}
                    {positionsData && positionsData.positions.length > 0 && (() => {
                      const totalPnl = positionsData.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
                      return (
                        <div className={`mt-1.5 text-xs font-mono ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          Unrealized PnL: {totalPnl >= 0 ? '+' : ''}{formatUSD(totalPnl)}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right: badges + chain icon */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {enrichedTokens.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-neutral-400 text-xs">
                        <Coins className="w-3.5 h-3.5" />
                        {enrichedTokens.length} token{enrichedTokens.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {walletData.transactions.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-neutral-400 text-xs">
                        {walletData.transactions.length} txs
                      </div>
                    )}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold border border-white/[0.1]"
                      style={{
                        backgroundColor: `${CHAIN_CONFIG[activeChain].color}20`,
                        color: CHAIN_CONFIG[activeChain].color,
                        boxShadow: `0 4px 12px ${CHAIN_CONFIG[activeChain].color}20`,
                      }}
                    >
                      {CHAIN_CONFIG[activeChain].symbol.charAt(0)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* ========== TAB BAR ======================================== */}
            <div className="flex items-center bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
              {([
                'tokens' as const,
                'transactions' as const,
                ...(activeChain === 'eth' ? ['positions' as const] : []),
              ]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {tab === 'tokens' && <Coins className="w-4 h-4" />}
                  {tab === 'transactions' && <ArrowUpRight className="w-4 h-4" />}
                  {tab === 'positions' && <TrendingUp className="w-4 h-4" />}
                  {tab === 'tokens' ? 'Tokens' : tab === 'transactions' ? 'Transactions' : 'Positions'}
                  {tab === 'tokens' && enrichedTokens.length > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-neutral-400">{enrichedTokens.length}</span>
                  )}
                  {tab === 'transactions' && walletData && walletData.transactions.length > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-neutral-400">{walletData.transactions.length}</span>
                  )}
                  {tab === 'positions' && positionsData && positionsData.positions.length > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-neutral-400">{positionsData.positions.length}</span>
                  )}
                  {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-hub-yellow" />}
                </button>
              ))}
            </div>

            {/* ========== TOKEN HOLDINGS TABLE =========================== */}
            {activeTab === 'tokens' && (<>
            {walletLoading && !walletData ? (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse" />
                </div>
                {Array.from({ length: 4 }).map((_, i) => <TokenSkeleton key={i} />)}
              </div>
            ) : enrichedTokens.length > 0 ? (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-hub-yellow" />
                    Token Holdings
                  </h3>
                  {totalTokenUSD > 0 && (
                    <span className="text-neutral-500 text-xs font-mono">
                      ${totalTokenUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                {/* Desktop table header */}
                <div className="hidden sm:grid grid-cols-[40px_1fr_100px_120px_120px] items-center px-4 py-2 border-b border-white/[0.06] text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                  <div />
                  <div>Token</div>
                  <div className="text-right">Price</div>
                  <div className="text-right">Balance</div>
                  <div className="text-right">Value</div>
                </div>

                {/* Token rows */}
                <div className="divide-y divide-white/[0.04]">
                  {enrichedTokens.map((token, idx) => (
                    <div key={`${token.symbol}-${token.contractAddress || idx}`}>
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-[40px_1fr_100px_120px_120px] items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                        <div>
                          <TokenIconSimple symbol={token.symbol} size={28} />
                        </div>
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{token.symbol}</span>
                          <span className="text-neutral-600 text-xs truncate">{token.name}</span>
                        </div>
                        <div className="text-right text-[13px] font-mono text-neutral-400">
                          {token.price !== null ? formatPrice(token.price) : <span className="text-neutral-700">--</span>}
                        </div>
                        <div className="text-right text-[13px] font-mono text-neutral-300">
                          {token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </div>
                        <div className="text-right text-[13px] font-mono text-white font-semibold">
                          {token.usdValue !== null
                            ? `$${token.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : <span className="text-neutral-700">--</span>
                          }
                          {token.usdValue !== null && totalPortfolioUSD > 0 && (
                            <div className="text-[10px] text-neutral-600 font-normal">
                              {((token.usdValue / totalPortfolioUSD) * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Mobile row */}
                      <div className="sm:hidden flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TokenIconSimple symbol={token.symbol} size={32} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white">{token.symbol}</div>
                            <div className="text-xs text-neutral-600 truncate">{token.name}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <div className="text-sm font-mono text-white font-semibold">
                            {token.usdValue !== null ? formatUSD(token.usdValue) : '--'}
                          </div>
                          <div className="text-xs text-neutral-500 font-mono">
                            {token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            {token.usdValue !== null && totalPortfolioUSD > 0 && (
                              <span className="text-neutral-600 ml-1">
                                ({((token.usdValue / totalPortfolioUSD) * 100).toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : walletData ? (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-8 text-center text-neutral-600 text-sm">
                No tokens found for this wallet
              </div>
            ) : null}
            </>)}

            {/* ========== TRANSACTION HISTORY ============================ */}
            {activeTab === 'transactions' && (
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
              </div>

              {walletLoading && !walletData ? (
                <div>
                  {Array.from({ length: 5 }).map((_, i) => <TxSkeleton key={i} />)}
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
                    <div className="w-20">Type</div>
                    <div className="flex-[2]">Hash</div>
                    <div className="flex-[2]">From / To</div>
                    <div className="flex-1 text-right">Value</div>
                    <div className="flex-1 text-right">Time</div>
                    <div className="w-14" />
                  </div>

                  <div className="divide-y divide-white/[0.04]">
                    {walletData.transactions.map((tx) => {
                      const isIn = tx.direction === 'in';
                      const isOut = tx.direction === 'out';
                      const gasCostEth = tx.gasUsed && tx.gasPrice
                        ? (Number(tx.gasUsed) * Number(tx.gasPrice) / 1e18)
                        : null;

                      return (
                        <div key={tx.hash}>
                          {/* Desktop row */}
                          <div className="hidden sm:flex items-center px-4 py-3 hover:bg-white/[0.02] transition-colors">
                            {/* Type badge */}
                            <div className="w-20">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                isIn
                                  ? 'bg-green-500/10 text-green-400'
                                  : isOut
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-neutral-500/10 text-neutral-400'
                              }`}>
                                {isIn ? <ArrowDownLeft className="w-3 h-3" /> : isOut ? <ArrowUpRight className="w-3 h-3" /> : null}
                                {isIn ? 'In' : isOut ? 'Out' : '?'}
                              </span>
                            </div>

                            {/* Hash */}
                            <div className="flex-[2] flex items-center gap-1.5">
                              <span className="text-[13px] font-mono text-neutral-300">
                                {truncateHash(tx.hash)}
                              </span>
                              <button
                                onClick={() => handleCopy(tx.hash)}
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
                            <div className="flex-1 text-right">
                              <div className={`text-[13px] font-mono ${
                                isIn ? 'text-green-400' : isOut ? 'text-red-400' : 'text-neutral-400'
                              }`}>
                                {tx.value ? (
                                  <>
                                    {isIn ? '+' : isOut ? '-' : ''}{tx.value}
                                    <span className="text-neutral-600 ml-1 text-[11px]">{CHAIN_CONFIG[activeChain].symbol}</span>
                                  </>
                                ) : (
                                  <span className="text-neutral-700">--</span>
                                )}
                              </div>
                              {gasCostEth !== null && gasCostEth > 0 && (
                                <div className="text-[10px] text-neutral-700 font-mono hidden lg:block">
                                  Gas: {gasCostEth.toFixed(5)} ETH
                                </div>
                              )}
                            </div>

                            {/* Time */}
                            <div className="flex-1 text-right text-[12px] text-neutral-500">
                              {tx.timestamp > 0 ? formatRelativeTime(tx.timestamp) : '--'}
                            </div>

                            {/* Explorer link */}
                            <div className="w-14 text-right">
                              <a
                                href={getExplorerTxUrl(activeChain, tx.hash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-neutral-600 hover:text-hub-yellow transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>

                          {/* Mobile row */}
                          <div className="sm:hidden px-4 py-3 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  isIn
                                    ? 'bg-green-500/10 text-green-400'
                                    : isOut
                                      ? 'bg-red-500/10 text-red-400'
                                      : 'bg-neutral-500/10 text-neutral-400'
                                }`}>
                                  {isIn ? <ArrowDownLeft className="w-3 h-3" /> : isOut ? <ArrowUpRight className="w-3 h-3" /> : null}
                                  {isIn ? 'Receive' : isOut ? 'Send' : 'Unknown'}
                                </span>
                                <span className="text-[11px] text-neutral-600">
                                  {tx.timestamp > 0 ? formatRelativeTime(tx.timestamp) : ''}
                                </span>
                              </div>
                              <a
                                href={getExplorerTxUrl(activeChain, tx.hash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-neutral-600 hover:text-hub-yellow transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-mono text-neutral-500 truncate">
                                {truncateHash(tx.hash, 6)}
                              </span>
                              <span className={`text-[13px] font-mono font-medium ${
                                isIn ? 'text-green-400' : isOut ? 'text-red-400' : 'text-neutral-400'
                              }`}>
                                {tx.value ? (
                                  <>{isIn ? '+' : isOut ? '-' : ''}{tx.value} {CHAIN_CONFIG[activeChain].symbol}</>
                                ) : '--'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
            )}

            {/* ========== DEX POSITIONS =================================== */}
            {activeTab === 'positions' && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                {/* Header with account summary */}
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-hub-yellow" />
                      Open Positions
                    </h3>
                    {positionsData && positionsData.positions.length > 0 && (
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-neutral-500">
                          Acct: <span className="text-neutral-300">{formatUSD(positionsData.accountValue)}</span>
                        </span>
                        <span className="text-neutral-500">
                          Margin: <span className="text-neutral-300">{formatUSD(positionsData.totalMarginUsed)}</span>
                        </span>
                        {(() => {
                          const totalPnl = positionsData.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
                          return (
                            <span className={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                              PnL: {totalPnl >= 0 ? '+' : ''}{formatUSD(totalPnl)}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {positionsLoading && !positionsData ? (
                  /* Skeleton */
                  <div>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse border-b border-white/[0.04]">
                        <div className="w-7 h-7 rounded-full bg-white/[0.06]" />
                        <div className="flex-1 h-4 bg-white/[0.06] rounded" />
                        <div className="w-16 h-4 bg-white/[0.06] rounded" />
                        <div className="w-20 h-4 bg-white/[0.06] rounded" />
                        <div className="w-20 h-4 bg-white/[0.06] rounded" />
                        <div className="w-16 h-4 bg-white/[0.06] rounded" />
                      </div>
                    ))}
                  </div>
                ) : positionsData && positionsData.positions.length > 0 ? (
                  <>
                    {/* Desktop table header */}
                    <div className="hidden sm:grid grid-cols-[minmax(140px,1.5fr)_100px_100px_100px_120px_100px] items-center px-4 py-2 border-b border-white/[0.06] text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                      <div>Symbol</div>
                      <div className="text-right">Size</div>
                      <div className="text-right">Entry</div>
                      <div className="text-right">Mark</div>
                      <div className="text-right">PnL</div>
                      <div className="text-right">Leverage</div>
                    </div>

                    <div className="divide-y divide-white/[0.04]">
                      {positionsData.positions.map((pos) => (
                        <div key={`${pos.exchange}-${pos.symbol}-${pos.side}`}>
                          {/* Desktop row */}
                          <div className="hidden sm:grid grid-cols-[minmax(140px,1.5fr)_100px_100px_100px_120px_100px] items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                            {/* Symbol + side + exchange */}
                            <div className="flex items-center gap-2 min-w-0">
                              <TokenIconSimple symbol={pos.symbol} size={28} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium text-white">{pos.symbol}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    pos.side === 'long' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                                  }`}>
                                    {pos.side === 'long' ? 'LONG' : 'SHORT'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <ExchangeLogo exchange={pos.exchange} size={14} />
                                  <span className="text-[10px] text-neutral-600 capitalize">{pos.exchange}</span>
                                </div>
                              </div>
                            </div>

                            {/* Size */}
                            <div className="text-right">
                              <div className="text-[13px] font-mono text-neutral-300">
                                {pos.size < 1 ? pos.size.toFixed(4) : pos.size < 100 ? pos.size.toFixed(2) : pos.size.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </div>
                              <div className="text-[10px] font-mono text-neutral-600">
                                {formatUSD(pos.positionValue)}
                              </div>
                            </div>

                            {/* Entry price */}
                            <div className="text-right text-[13px] font-mono text-neutral-400">
                              {formatPrice(pos.entryPrice)}
                            </div>

                            {/* Mark price */}
                            <div className="text-right text-[13px] font-mono text-neutral-300">
                              {formatPrice(pos.markPrice)}
                            </div>

                            {/* PnL */}
                            <div className="text-right">
                              <div className={`text-[13px] font-mono font-semibold ${
                                pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {pos.unrealizedPnl >= 0 ? '+' : ''}{formatUSD(pos.unrealizedPnl)}
                              </div>
                              <div className={`text-[10px] font-mono ${
                                pos.roe >= 0 ? 'text-green-400/70' : 'text-red-400/70'
                              }`}>
                                {pos.roe >= 0 ? '+' : ''}{pos.roe.toFixed(2)}%
                              </div>
                            </div>

                            {/* Leverage + liq */}
                            <div className="text-right">
                              <div className="text-[13px] font-mono text-hub-yellow font-semibold">
                                {pos.leverage}x
                              </div>
                              {pos.liquidationPrice && (
                                <div className="text-[10px] font-mono text-neutral-600">
                                  Liq {formatPrice(pos.liquidationPrice)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Mobile row */}
                          <div className="sm:hidden px-4 py-3 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <TokenIconSimple symbol={pos.symbol} size={28} />
                                <span className="text-sm font-medium text-white">{pos.symbol}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  pos.side === 'long' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                                }`}>
                                  {pos.side === 'long' ? 'LONG' : 'SHORT'}
                                </span>
                                <span className="text-[11px] font-mono text-hub-yellow">{pos.leverage}x</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ExchangeLogo exchange={pos.exchange} size={14} />
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`text-[13px] font-mono font-semibold ${
                                pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {pos.unrealizedPnl >= 0 ? '+' : ''}{formatUSD(pos.unrealizedPnl)}
                                <span className={`ml-1.5 text-[11px] ${
                                  pos.roe >= 0 ? 'text-green-400/70' : 'text-red-400/70'
                                }`}>
                                  ({pos.roe >= 0 ? '+' : ''}{pos.roe.toFixed(1)}%)
                                </span>
                              </span>
                              <span className="text-xs font-mono text-neutral-500">
                                {formatUSD(pos.positionValue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-neutral-600 text-sm">
                    No open positions on Hyperliquid
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------- wallet count + info footer ----------------------- */}
        {savedWallets.length > 0 && (
          <div className="mt-3 text-neutral-600 text-xs text-right">
            {savedWallets.length}/10 wallet{savedWallets.length !== 1 ? 's' : ''} saved
          </div>
        )}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            Wallet Tracker supports Ethereum (0x addresses), Bitcoin (1/3/bc1 addresses), and Solana (base58 addresses). ETH balances are fetched via public RPC nodes, transactions via Etherscan and Blockscout. Token USD values are matched against live market prices. BTC data comes from Blockchain.info and Mempool.space. SOL data from Solana mainnet RPC. Data caches for 2 minutes. Saved wallets are stored locally in your browser (max 10).
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
