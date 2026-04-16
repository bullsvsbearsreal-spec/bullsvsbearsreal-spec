'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import { TokenIconSimple } from '@/components/TokenIcon';
import { RefreshCw, Search, X, ExternalLink, ArrowUpRight, ArrowDownLeft, Copy, Check, AlertTriangle, Wallet, Coins, TrendingUp, ChevronDown, Star, Activity, CircleDollarSign, ArrowRightLeft, BarChart3, Globe, Clock, Bell, BellOff } from 'lucide-react';
import { useSession } from 'next-auth/react';
import DataFreshness from '@/components/DataFreshness';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getSavedWallets, addWallet, removeWallet, detectChain, SavedWallet } from '@/lib/storage/wallets';
import { useApi } from '@/hooks/useSWRApi';
import { formatRelativeTime, formatUSD, formatPrice } from '@/lib/utils/format';
import { FAMOUS_WALLETS, WALLET_CATEGORIES, getQuickAddWallets, type FamousWallet, type WalletCategory } from '@/lib/constants/famous-wallets';

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
  balanceUsd?: number;
  tokenPrice?: number;
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
  marginType?: 'cross' | 'isolated';
  maxLeverage?: number;
  fundingSinceOpen?: number;
  fundingAllTime?: number;
}

interface HLOrder {
  coin: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  value: number;
  oid: number;
  timestamp: number;
  reduceOnly: boolean;
  triggerPx?: number;
}

interface HLFill {
  coin: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  value: number;
  time: number;
  fee: number;
  closedPnl: number;
  crossed: boolean;
}

interface HLFundingPayment {
  coin: string;
  amount: number;
  rate: number;
  positionSize: number;
  time: number;
}

interface HLSpotBalance {
  coin: string;
  total: number;
  hold: number;
  available: number;
}

interface PositionsData {
  // Multi-DEX response (new format)
  exchanges?: { name: string; accountValue: number; totalMarginUsed: number; positionCount: number; withdrawable?: number }[];
  totalAccountValue?: number;
  totalPositions?: number;
  // Legacy single-exchange format (backwards compat)
  exchange?: string;
  accountValue?: number;
  totalMarginUsed: number;
  positions: DexPosition[];
  hlOpenOrders?: HLOrder[];
  hlFills?: HLFill[];
  hlFundingPayments?: HLFundingPayment[];
  hlSpotBalances?: HLSpotBalance[];
  hlPortfolio?: Record<string, { equity: [number, number][]; pnl: [number, number][]; volume: number }>;
  hlUserFees?: { makerRate: number; takerRate: number; dailyVolume: { date: string; taker: number; maker: number }[] };
  hlLedger?: { type: string; amount: number; fee: number; time: number; token?: string; destination?: string }[];
  errors?: string[];
}

interface MultichainSummary {
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

// Explorer TX URLs for whale-trades chain IDs
const TRADE_EXPLORER_TX: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  optimism: 'https://optimistic.etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/',
};

const QUICK_ADD_WALLETS = getQuickAddWallets(6);

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
  const { data: session } = useSession();
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([]);
  const [addressInput, setAddressInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [activeAddress, setActiveAddress] = useState('');
  const [activeChain, setActiveChain] = useState<'eth' | 'btc' | 'sol' | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [inputError, setInputError] = useState('');
  const [activeTab, setActiveTab] = useState<'tokens' | 'transactions' | 'positions' | 'trades'>('tokens');
  const [featuredCategory, setFeaturedCategory] = useState<WalletCategory | 'all'>('all');
  const [featuredSearch, setFeaturedSearch] = useState('');
  const [showFeatured, setShowFeatured] = useState(true);

  /* ---- Trade alert tracking state --------------------------------- */
  const [isTracked, setIsTracked] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackMinValue, setTrackMinValue] = useState(1000);
  const [trackChannels, setTrackChannels] = useState<string[]>(['push']);
  const [showTrackPanel, setShowTrackPanel] = useState(false);

  // Auto-collapse featured wallets when tracking an address
  useEffect(() => {
    if (activeAddress) setShowFeatured(false);
  }, [activeAddress]);

  // Check if active wallet is already tracked for trade alerts
  useEffect(() => {
    if (!session?.user || !activeAddress) { setIsTracked(false); setShowTrackPanel(false); return; }
    setShowTrackPanel(false); // Reset panel when switching wallets
    let cancelled = false;
    fetch('/api/whale-trades/tracked')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (cancelled || !json?.wallets) return;
        const found = json.wallets.some((w: any) => w.address?.toLowerCase() === activeAddress.toLowerCase());
        setIsTracked(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.user, activeAddress]);

  const handleTrackWallet = useCallback(async () => {
    if (!activeAddress || !activeChain) return;
    setTrackLoading(true);
    try {
      const res = await fetch('/api/whale-trades/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: activeAddress,
          chain: activeChain,
          label: null, // will use saved wallet label if available
          notifyChannels: trackChannels,
          minValueUsd: trackMinValue,
        }),
      });
      if (res.ok) { setIsTracked(true); setShowTrackPanel(false); }
    } catch {}
    setTrackLoading(false);
  }, [activeAddress, activeChain, trackChannels, trackMinValue]);

  const handleUntrackWallet = useCallback(async () => {
    if (!activeAddress) return;
    setTrackLoading(true);
    try {
      const res = await fetch('/api/whale-trades/track', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: activeAddress, chain: activeChain }),
      });
      if (res.ok) { setIsTracked(false); setShowTrackPanel(false); }
    } catch {}
    setTrackLoading(false);
  }, [activeAddress, activeChain]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: FAMOUS_WALLETS.length };
    for (const w of FAMOUS_WALLETS) counts[w.category] = (counts[w.category] || 0) + 1;
    return counts;
  }, []);

  const filteredFamousWallets = useMemo(() => {
    let list = FAMOUS_WALLETS;
    if (featuredCategory !== 'all') list = list.filter((w) => w.category === featuredCategory);
    if (featuredSearch.trim()) {
      const q = featuredSearch.toLowerCase();
      list = list.filter((w) =>
        w.label.toLowerCase().includes(q) ||
        w.address.toLowerCase().includes(q) ||
        w.description?.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [featuredCategory, featuredSearch]);

  const isWalletSaved = useCallback((address: string) => {
    return savedWallets.some((w) => w.address.toLowerCase() === address.toLowerCase());
  }, [savedWallets]);

  // Resolve wallet label from saved wallets or famous wallets
  const activeWalletLabel = useMemo(() => {
    if (!activeAddress) return null;
    const addrLower = activeAddress.toLowerCase();
    const saved = savedWallets.find((w) => w.address.toLowerCase() === addrLower);
    if (saved?.label) return saved.label;
    const famous = FAMOUS_WALLETS.find((w) => w.address.toLowerCase() === addrLower);
    return famous?.label ?? null;
  }, [activeAddress, savedWallets]);

  const activeWalletDescription = useMemo(() => {
    if (!activeAddress) return null;
    const famous = FAMOUS_WALLETS.find((w) => w.address.toLowerCase() === activeAddress.toLowerCase());
    return famous?.description ?? null;
  }, [activeAddress]);

  // Hydrate saved wallets from localStorage
  useEffect(() => {
    setSavedWallets(getSavedWallets());
  }, []);

  // Read ?address= URL param on mount and auto-track
  const searchParams = useSearchParams();
  const urlParamHandled = useRef(false);
  useEffect(() => {
    if (urlParamHandled.current) return;
    const urlAddr = searchParams.get('address');
    if (urlAddr && urlAddr.trim()) {
      const chain = detectChain(urlAddr.trim());
      if (chain) {
        urlParamHandled.current = true;
        setAddressInput(urlAddr.trim());
        setActiveAddress(urlAddr.trim());
        setActiveChain(chain);
      }
    }
  }, [searchParams]);

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
    () => fetch('/api/tickers').then((r) => r.json()).then((j: TickerEntry[] | { data?: TickerEntry[] }) => (Array.isArray(j) ? j : j.data ?? [])) as Promise<TickerEntry[]>,
    [],
  );

  const { data: tickers } = useApi({
    key: 'wallet-prices',
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
  } = useApi<WalletData | null>({
    key: activeAddress && activeChain ? `wallet-${activeChain}-${activeAddress}` : null,
    fetcher: walletFetcher,
    refreshInterval: 120_000,
  });

  /* ---- fetch DEX positions (Hyperliquid + GMX + dYdX) ---------------- */
  const positionsFetcher = useCallback(async () => {
    if (!activeAddress || activeChain !== 'eth') return null;
    const res = await fetch(`/api/wallet/positions?address=${encodeURIComponent(activeAddress)}&exchange=all`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json as PositionsData;
  }, [activeAddress, activeChain]);

  const {
    data: positionsData,
    isLoading: positionsLoading,
  } = useApi<PositionsData | null>({
    key: activeAddress && activeChain === 'eth' ? `wallet-oi-${activeAddress}` : null,
    fetcher: positionsFetcher,
    refreshInterval: 60_000,
  });

  /* ---- fetch DEX trades for active wallet ----------------------------- */
  const tradesFetcher = useCallback(async () => {
    if (!activeAddress) return null;
    const chain = activeChain === 'eth' ? 'ethereum' : activeChain === 'sol' ? 'solana' : null;
    if (!chain) return null;
    const res = await fetch(`/api/whale-trades?address=${encodeURIComponent(activeAddress)}&chain=${chain}&limit=20`);
    const json = await res.json();
    if (json.error) return null;
    return json.trades as Array<{
      txHash: string; dex: string; action: string;
      tokenInSymbol: string | null; amountIn: number | null;
      tokenOutSymbol: string | null; amountOut: number | null;
      valueUsd: number | null; blockTime: string; chain: string;
    }>;
  }, [activeAddress, activeChain]);

  const {
    data: tradesData,
    isLoading: tradesLoading,
  } = useApi<any[] | null>({
    key: activeAddress && (activeChain === 'eth' || activeChain === 'sol') ? `wallet-trades-${activeAddress}` : null,
    fetcher: tradesFetcher,
    refreshInterval: 120_000,
  });

  /* ---- fetch multichain portfolio (EVM addresses only) --------------- */
  const isEvmAddress = activeAddress && /^0x[a-fA-F0-9]{40}$/i.test(activeAddress);

  const multichainFetcher = useCallback(async () => {
    if (!activeAddress || !isEvmAddress) return null;
    const res = await fetch(`/api/wallet/multichain?address=${encodeURIComponent(activeAddress)}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.chains as MultichainSummary[];
  }, [activeAddress, isEvmAddress]);

  const {
    data: multichainData,
    isLoading: multichainLoading,
  } = useApi<MultichainSummary[] | null>({
    key: isEvmAddress ? `wallet-multichain-${activeAddress}` : null,
    fetcher: multichainFetcher,
    refreshInterval: 300_000, // 5 min
  });

  const multichainTotal = useMemo(() => {
    if (!multichainData) return 0;
    return multichainData.reduce((sum, c) => sum + c.totalValueUsd, 0);
  }, [multichainData]);

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
      // Spam filters: absurd balances (airdrop dust attacks)
      if (token.balance > 1e11) continue;  // >100B tokens is always spam
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
        // Prefer Blockscout price (contract-specific) over ticker price (symbol match only)
        // Ticker symbol match can be wrong (e.g. ERC-20 MOODENG != Solana MOODENG)
        const price = (token.tokenPrice && token.tokenPrice > 0) ? token.tokenPrice
          : priceMap[sym] || priceMap[stripped] || null;
        // Prefer Blockscout USD value when available (most accurate)
        const usdValue = (token.balanceUsd && token.balanceUsd > 0) ? token.balanceUsd
          : price ? token.balance * price : null;
        return { ...token, price, usdValue };
      })
      .filter((token) => {
        // Spam filter: only extreme airdrops (billions of tokens at sub-penny prices)
        if (token.balance > 1e9 && token.price !== null && token.price < 0.0001) return false;
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
    const dexAcct = positionsData?.totalAccountValue ?? positionsData?.accountValue ?? 0;
    const total = base + tokens + dexAcct;
    return isNaN(total) ? 0 : total;
  }, [balanceUSD, totalTokenUSD, positionsData]);

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

  const handlePreset = (preset: { label: string; address: string; chain: 'eth' | 'btc' | 'sol' }) => {
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

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
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
            {activeAddress && <DataFreshness exchangeCount={1} lastUpdated={lastUpdate} />}
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
              {QUICK_ADD_WALLETS.map((pw) => (
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
                    tabIndex={0}
                    aria-label="Remove wallet"
                    onClick={(e) => { e.stopPropagation(); handleRemoveWallet(w.address); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleRemoveWallet(w.address); } }}
                    className="p-0.5 rounded hover:bg-white/[0.1] text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Featured Wallets -------------------------------- */}
        {(!activeAddress || showFeatured) && (
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Header — clickable to collapse when wallet is active */}
            <button
              onClick={() => activeAddress && setShowFeatured(!showFeatured)}
              className={`w-full flex items-center justify-between px-5 py-4 ${activeAddress ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-default'} transition-colors`}
            >
              <div className="flex items-center gap-2.5">
                <Star className="w-4 h-4 text-hub-yellow" />
                <h2 className="text-sm font-semibold text-white">Featured Wallets</h2>
                <span className="text-[11px] text-neutral-600 bg-white/[0.04] px-2 py-0.5 rounded-full">
                  {filteredFamousWallets.length}
                </span>
              </div>
              {activeAddress && (
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${showFeatured ? '' : '-rotate-90'}`} />
              )}
            </button>

            {/* Collapsible content */}
            {showFeatured && (
              <div className="px-5 pb-5">
                {/* Filter row: categories + search */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                  <div className="flex items-center gap-1.5 flex-wrap flex-1">
                    <button
                      onClick={() => setFeaturedCategory('all')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        featuredCategory === 'all'
                          ? 'bg-hub-yellow text-black shadow-sm shadow-hub-yellow/20'
                          : 'bg-white/[0.06] text-neutral-400 hover:bg-white/[0.1] hover:text-white'
                      }`}
                    >
                      All <span className="opacity-60">{categoryCounts.all}</span>
                    </button>
                    {(Object.entries(WALLET_CATEGORIES) as [WalletCategory, { label: string }][]).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setFeaturedCategory(key)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          featuredCategory === key
                            ? 'bg-hub-yellow text-black shadow-sm shadow-hub-yellow/20'
                            : 'bg-white/[0.06] text-neutral-400 hover:bg-white/[0.1] hover:text-white'
                        }`}
                      >
                        {val.label} <span className="opacity-60">{categoryCounts[key] || 0}</span>
                      </button>
                    ))}
                  </div>

                  {/* Search with icon */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                    <input
                      type="text"
                      placeholder="Search by name, chain, or address..."
                      value={featuredSearch}
                      onChange={(e) => setFeaturedSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40"
                    />
                    {featuredSearch && (
                      <button
                        onClick={() => setFeaturedSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Wallet grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredFamousWallets.map((w) => {
                    const chainColor = CHAIN_CONFIG[w.chain].color;
                    const saved = isWalletSaved(w.address);
                    const isActive = activeAddress.toLowerCase() === w.address.toLowerCase();
                    return (
                      <button
                        key={w.address}
                        onClick={() => handlePreset(w)}
                        className={`relative flex items-start gap-3 p-3.5 rounded-xl text-left group transition-all duration-200 border ${
                          isActive
                            ? 'bg-hub-yellow/[0.08] border-hub-yellow/30 shadow-sm shadow-hub-yellow/10'
                            : saved
                              ? 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]'
                              : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.08]'
                        }`}
                      >
                        {/* Chain color accent */}
                        <div
                          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
                          style={{ backgroundColor: chainColor }}
                        />

                        <div className="flex-1 min-w-0 pl-1.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-semibold text-white truncate">{w.label}</span>
                            <ChainBadge chain={w.chain} />
                            {saved && !isActive && (
                              <span className="text-[9px] text-neutral-500 bg-white/[0.06] px-1.5 py-0.5 rounded-full">saved</span>
                            )}
                          </div>
                          {w.description && (
                            <p className="text-[11px] text-neutral-500 mb-1.5 leading-relaxed">{w.description}</p>
                          )}
                          <div className="flex items-center gap-1.5">
                            <p className="text-[10px] font-mono text-neutral-600 truncate">{truncateAddress(w.address, 8)}</p>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); handleCopy(w.address); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleCopy(w.address); } }}
                              className="p-0.5 text-neutral-700 hover:text-neutral-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Copy address"
                            >
                              {copiedHash === w.address ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[11px] font-medium whitespace-nowrap mt-0.5 transition-colors ${
                          isActive
                            ? 'text-hub-yellow'
                            : 'text-neutral-700 group-hover:text-hub-yellow'
                        }`}>
                          {isActive ? 'Active' : 'Track →'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {filteredFamousWallets.length === 0 && (
                  <p className="text-sm text-neutral-500 text-center py-8">No wallets match your search.</p>
                )}
              </div>
            )}
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
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl relative overflow-hidden">
                {/* Chain-colored accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{
                    background: `linear-gradient(to right, ${CHAIN_CONFIG[activeChain].color}00, ${CHAIN_CONFIG[activeChain].color}80, ${CHAIN_CONFIG[activeChain].color}00)`,
                  }}
                />

                {/* Main content */}
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: identity + value */}
                    <div className="min-w-0 flex-1">
                      {/* Wallet name + chain */}
                      <div className="flex items-center gap-2.5 mb-1">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold border border-white/[0.08] flex-shrink-0"
                          style={{
                            backgroundColor: `${CHAIN_CONFIG[activeChain].color}15`,
                            color: CHAIN_CONFIG[activeChain].color,
                          }}
                        >
                          {CHAIN_CONFIG[activeChain].symbol.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          {activeWalletLabel ? (
                            <div className="flex items-center gap-2">
                              <h2 className="text-white font-semibold text-base truncate">{activeWalletLabel}</h2>
                              <ChainBadge chain={activeChain} />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <ChainBadge chain={activeChain} />
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-neutral-500 text-xs font-mono truncate max-w-[240px]">
                              {truncateAddress(activeAddress, 8)}
                            </span>
                            <button
                              onClick={() => handleCopy(activeAddress)}
                              className="p-0.5 text-neutral-600 hover:text-neutral-400 transition-colors"
                              title="Copy address"
                            >
                              {copiedHash === activeAddress ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <a
                              href={getExplorerAddressUrl(activeChain, activeAddress)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-0.5 text-neutral-600 hover:text-neutral-400 transition-colors"
                              title="View on explorer"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Description if famous wallet */}
                      {activeWalletDescription && (
                        <p className="text-neutral-600 text-xs ml-[46px] -mt-0.5 mb-2">{activeWalletDescription}</p>
                      )}

                      {/* Total portfolio value */}
                      <div className="ml-[46px] mt-3">
                        <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Total Value</div>
                        <div className="text-3xl sm:text-4xl font-bold text-white font-mono tabular-nums leading-none">
                          {totalPortfolioUSD > 0
                            ? `$${totalPortfolioUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : balanceUSD !== null
                              ? `$${balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '--'
                          }
                        </div>

                        {/* Unrealized PnL */}
                        {positionsData && positionsData.positions.length > 0 && (() => {
                          const totalPnl = positionsData.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
                          return (
                            <div className={`mt-1 text-xs font-mono ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              PnL: {totalPnl >= 0 ? '+' : ''}{formatUSD(totalPnl)}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Right: refresh */}
                    <button
                      onClick={() => refreshWallet()}
                      className="p-2 rounded-lg text-neutral-600 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0"
                      title="Refresh wallet"
                    >
                      <RefreshCw className={`w-4 h-4 ${walletLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Stat cards row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/[0.06]">
                  {/* Native balance */}
                  <div className="px-4 py-3 border-r border-white/[0.06]">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1 flex items-center gap-1">
                      <CircleDollarSign className="w-3 h-3" />
                      {CHAIN_CONFIG[activeChain].symbol} Balance
                    </div>
                    <div className="text-sm font-mono text-neutral-300 truncate">
                      {walletData.balance}
                    </div>
                    {balanceUSD !== null && (
                      <div className="text-[11px] font-mono text-neutral-600">
                        ${balanceUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    )}
                  </div>

                  {/* Token count */}
                  <div className="px-4 py-3 sm:border-r border-white/[0.06]">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1 flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      Tokens
                    </div>
                    <div className="text-sm font-mono text-neutral-300">
                      {enrichedTokens.length}
                    </div>
                    {totalTokenUSD > 0 && (
                      <div className="text-[11px] font-mono text-neutral-600">
                        ${totalTokenUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    )}
                  </div>

                  {/* Transaction count */}
                  <div className="px-4 py-3 border-r border-white/[0.06] border-t sm:border-t-0">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1 flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" />
                      Transactions
                    </div>
                    <div className="text-sm font-mono text-neutral-300">
                      {walletData.transactions.length}
                    </div>
                  </div>

                  {/* Positions / chain */}
                  <div className="px-4 py-3 border-t sm:border-t-0">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      {activeChain === 'eth' ? 'Positions' : 'Chain'}
                    </div>
                    <div className="text-sm font-mono text-neutral-300">
                      {activeChain === 'eth'
                        ? (positionsData?.positions.length ?? (positionsLoading ? '...' : '0'))
                        : CHAIN_CONFIG[activeChain].name
                      }
                    </div>
                    {positionsData && (positionsData.totalAccountValue ?? positionsData.accountValue ?? 0) > 0 && (
                      <div className="text-[11px] font-mono text-neutral-600">
                        ${(positionsData.totalAccountValue ?? positionsData.accountValue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* ========== TRADE ALERT TRACKING ============================ */}
            {activeAddress && activeChain && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    if (!session?.user) return;
                    if (isTracked) handleUntrackWallet();
                    else setShowTrackPanel(!showTrackPanel);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isTracked ? (
                      <Bell className="w-4 h-4 text-green-400" />
                    ) : (
                      <BellOff className="w-4 h-4 text-neutral-500" />
                    )}
                    <span className="text-sm font-semibold text-white">Trade Alerts</span>
                    {isTracked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">Active</span>
                    )}
                  </div>
                  {!session?.user ? (
                    <span className="text-[11px] text-neutral-600">Sign in to enable</span>
                  ) : isTracked ? (
                    <span className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors">
                      {trackLoading ? 'Removing...' : 'Remove'}
                    </span>
                  ) : (
                    <span className="text-[11px] text-hub-yellow">
                      {showTrackPanel ? 'Cancel' : 'Set up'}
                    </span>
                  )}
                </button>

                {showTrackPanel && session?.user && !isTracked && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
                    {/* Min value threshold */}
                    <div>
                      <label className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5 block">
                        Min Trade Value (USD)
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[100, 1000, 10000, 50000, 100000].map(val => (
                          <button
                            key={val}
                            onClick={() => setTrackMinValue(val)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              trackMinValue === val
                                ? 'bg-hub-yellow text-black'
                                : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                            }`}
                          >
                            {val >= 1000 ? `$${val / 1000}K` : `$${val}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Channel selection */}
                    <div>
                      <label className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5 block">
                        Notify via
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                          { key: 'push', label: 'Push' },
                          { key: 'email', label: 'Email' },
                          { key: 'telegram', label: 'Telegram' },
                          { key: 'discord', label: 'Discord' },
                        ].map(ch => {
                          const active = trackChannels.includes(ch.key);
                          return (
                            <button
                              key={ch.key}
                              onClick={() => setTrackChannels(prev =>
                                active ? prev.filter(c => c !== ch.key) : [...prev, ch.key]
                              )}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                active
                                  ? 'bg-hub-yellow/10 border-hub-yellow/30 text-hub-yellow'
                                  : 'bg-white/[0.04] border-white/[0.06] text-neutral-500 hover:text-white'
                              }`}
                            >
                              {ch.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Track button */}
                    <button
                      onClick={handleTrackWallet}
                      disabled={trackLoading || trackChannels.length === 0}
                      className="w-full py-2 rounded-lg text-sm font-semibold bg-hub-yellow text-black hover:bg-hub-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {trackLoading ? 'Tracking...' : 'Track Trades'}
                    </button>
                    <p className="text-[10px] text-neutral-600 leading-relaxed">
                      Get notified when this wallet makes trades above ${trackMinValue.toLocaleString()} USD.
                      Alerts are deduplicated — you won&apos;t get spammed.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ========== MULTICHAIN PORTFOLIO ============================ */}
            {isEvmAddress && (multichainLoading || (multichainData && multichainData.length > 1)) && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-hub-yellow" />
                    Multichain Portfolio
                    {multichainData && (
                      <span className="text-neutral-500 font-normal text-xs">
                        | {multichainData.length} Chain{multichainData.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </h3>
                  {multichainTotal > 0 && (
                    <span className="text-neutral-400 text-xs font-mono">
                      ${multichainTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>

                {multichainLoading && !multichainData ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-white/[0.04] p-px">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-hub-darker p-3 animate-pulse">
                        <div className="h-4 w-24 bg-white/[0.06] rounded mb-2" />
                        <div className="h-6 w-16 bg-white/[0.06] rounded mb-1" />
                        <div className="h-3 w-12 bg-white/[0.06] rounded" />
                      </div>
                    ))}
                  </div>
                ) : multichainData && multichainData.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                    {multichainData.map((chain) => {
                      const pct = multichainTotal > 0
                        ? ((chain.totalValueUsd / multichainTotal) * 100)
                        : 0;
                      return (
                        <div
                          key={chain.id}
                          className="px-3.5 py-3 border-r border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: chain.color }}
                            />
                            <span className="text-xs font-medium text-neutral-300 truncate">
                              {chain.name}
                            </span>
                            {chain.tokenCount > 0 && (
                              <span className="text-[10px] text-neutral-600">
                                ({chain.tokenCount})
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-mono font-semibold text-white">
                            ${chain.totalValueUsd >= 1000
                              ? chain.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })
                              : chain.totalValueUsd.toFixed(2)
                            }
                          </div>
                          <div className="text-[10px] text-neutral-600 font-mono">
                            {pct >= 1 ? `${pct.toFixed(0)}%` : '<1%'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            {/* ========== TAB BAR ======================================== */}
            <div className="flex items-center gap-1 p-1 bg-hub-darker border border-white/[0.06] rounded-xl">
              {([
                'tokens' as const,
                'transactions' as const,
                ...(activeChain === 'eth' ? ['positions' as const] : []),
                ...((activeChain === 'eth' || activeChain === 'sol') ? ['trades' as const] : []),
              ]).map((tab) => {
                const isActive = activeTab === tab;
                const count = tab === 'tokens' ? enrichedTokens.length
                  : tab === 'transactions' ? (walletData?.transactions.length ?? 0)
                  : tab === 'trades' ? (tradesData?.length ?? 0)
                  : (positionsData?.positions.length ?? 0);
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-lg ${
                      isActive
                        ? 'bg-white/[0.08] text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    {tab === 'tokens' && <Coins className="w-3.5 h-3.5" />}
                    {tab === 'transactions' && <ArrowRightLeft className="w-3.5 h-3.5" />}
                    {tab === 'positions' && <TrendingUp className="w-3.5 h-3.5" />}
                    {tab === 'trades' && <Activity className="w-3.5 h-3.5" />}
                    {tab === 'tokens' ? 'Tokens' : tab === 'transactions' ? 'Transactions' : tab === 'trades' ? 'DEX Trades' : 'Positions'}
                    {count > 0 && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/[0.1] text-neutral-300' : 'bg-white/[0.04] text-neutral-600'
                      }`}>{count}</span>
                    )}
                  </button>
                );
              })}
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
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-10 text-center">
                <Coins className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500 text-sm font-medium">
                  {activeChain === 'btc' ? 'Bitcoin wallets don\u2019t hold ERC-20 tokens' : 'No tokens found for this wallet'}
                </p>
                <p className="text-neutral-700 text-xs mt-1">
                  {activeChain === 'btc' ? 'Switch to the Transactions tab to see activity' : 'This wallet may only hold the native asset'}
                </p>
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
                <div className="p-10 text-center">
                  <ArrowRightLeft className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-neutral-500 text-sm font-medium">No transactions found</p>
                  <p className="text-neutral-700 text-xs mt-1">Recent activity will appear here</p>
                </div>
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
              <div className="space-y-3">
                {/* ── Account Summary Bar ── */}
                {positionsData && (positionsData.totalAccountValue ?? positionsData.accountValue ?? 0) > 0 && (
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      {(() => {
                        const acctVal = positionsData.totalAccountValue ?? positionsData.accountValue ?? 0;
                        const margin = positionsData.totalMarginUsed;
                        const totalPnl = positionsData.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
                        const totalFunding = positionsData.positions.reduce((s, p) => s + (p.fundingSinceOpen ?? 0), 0);
                        const hlExchange = positionsData.exchanges?.find(e => e.name === 'Hyperliquid');
                        const withdrawable = hlExchange?.withdrawable ?? 0;
                        const marginRatio = acctVal > 0 ? (margin / acctVal) * 100 : 0;
                        return (
                          <>
                            <div>
                              <div className="text-[10px] text-neutral-600 uppercase tracking-wider">Account</div>
                              <div className="text-sm font-mono font-semibold text-white">{formatUSD(acctVal)}</div>
                            </div>
                            {margin > 0 && (
                              <div>
                                <div className="text-[10px] text-neutral-600 uppercase tracking-wider">Margin Used</div>
                                <div className="text-sm font-mono text-neutral-300">{formatUSD(margin)} <span className="text-[10px] text-neutral-600">({marginRatio.toFixed(1)}%)</span></div>
                              </div>
                            )}
                            {withdrawable > 0 && (
                              <div>
                                <div className="text-[10px] text-neutral-600 uppercase tracking-wider">Available</div>
                                <div className="text-sm font-mono text-neutral-300">{formatUSD(withdrawable)}</div>
                              </div>
                            )}
                            <div>
                              <div className="text-[10px] text-neutral-600 uppercase tracking-wider">Unrealized PnL</div>
                              <div className={`text-sm font-mono font-semibold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {totalPnl >= 0 ? '+' : ''}{formatUSD(totalPnl)}
                              </div>
                            </div>
                            {Math.abs(totalFunding) > 0.01 && (
                              <div>
                                <div className="text-[10px] text-neutral-600 uppercase tracking-wider">Funding Paid</div>
                                <div className={`text-sm font-mono ${totalFunding >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                  {totalFunding >= 0 ? '-' : '+'}{formatUSD(Math.abs(totalFunding))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {/* Per-exchange breakdown */}
                    {positionsData.exchanges && positionsData.exchanges.filter(e => e.positionCount > 0).length > 1 && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.04]">
                        {positionsData.exchanges.filter(e => e.positionCount > 0).map(e => (
                          <span key={e.name} className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                            <ExchangeLogo exchange={e.name} size={12} />
                            {e.name}: {e.positionCount} ({formatUSD(e.accountValue)})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Open Positions ── */}
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-hub-yellow" />
                    <h3 className="text-sm font-semibold text-white">Open Positions</h3>
                    {positionsData && <span className="text-[11px] text-neutral-600 font-mono">{positionsData.positions.length}</span>}
                  </div>

                  {positionsLoading && !positionsData ? (
                    <div>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse border-b border-white/[0.04]">
                          <div className="w-7 h-7 rounded-full bg-white/[0.06]" />
                          <div className="flex-1 h-4 bg-white/[0.06] rounded" />
                          <div className="w-16 h-4 bg-white/[0.06] rounded" />
                          <div className="w-20 h-4 bg-white/[0.06] rounded" />
                        </div>
                      ))}
                    </div>
                  ) : positionsData && positionsData.positions.length > 0 ? (
                    <>
                      <div className="hidden sm:grid grid-cols-[minmax(140px,1.5fr)_95px_95px_95px_110px_90px_80px] items-center px-4 py-2 border-b border-white/[0.06] text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                        <div>Symbol</div>
                        <div className="text-right">Size</div>
                        <div className="text-right">Entry</div>
                        <div className="text-right">Mark</div>
                        <div className="text-right">PnL</div>
                        <div className="text-right">Leverage</div>
                        <div className="text-right">Funding</div>
                      </div>
                      <div className="divide-y divide-white/[0.04]">
                        {positionsData.positions.map((pos) => (
                          <div key={`${pos.exchange}-${pos.symbol}-${pos.side}`}>
                            {/* Desktop row */}
                            <div className="hidden sm:grid grid-cols-[minmax(140px,1.5fr)_95px_95px_95px_110px_90px_80px] items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <TokenIconSimple symbol={pos.symbol} size={28} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium text-white">{pos.symbol}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pos.side === 'long' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                                      {pos.side === 'long' ? 'LONG' : 'SHORT'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <ExchangeLogo exchange={pos.exchange} size={14} />
                                    <span className="text-[10px] text-neutral-600">{pos.exchange}</span>
                                    {pos.marginType && <span className="text-[9px] text-neutral-700 ml-1">{pos.marginType}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[13px] font-mono text-neutral-300">
                                  {pos.size < 1 ? pos.size.toFixed(4) : pos.size < 100 ? pos.size.toFixed(2) : pos.size.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </div>
                                <div className="text-[10px] font-mono text-neutral-600">{formatUSD(pos.positionValue)}</div>
                              </div>
                              <div className="text-right text-[13px] font-mono text-neutral-400">{formatPrice(pos.entryPrice)}</div>
                              <div className="text-right text-[13px] font-mono text-neutral-300">{formatPrice(pos.markPrice)}</div>
                              <div className="text-right">
                                <div className={`text-[13px] font-mono font-semibold ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {pos.unrealizedPnl >= 0 ? '+' : ''}{formatUSD(pos.unrealizedPnl)}
                                </div>
                                <div className={`text-[10px] font-mono ${pos.roe >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                  {pos.roe >= 0 ? '+' : ''}{pos.roe.toFixed(2)}%
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[13px] font-mono text-hub-yellow font-semibold">{pos.leverage > 0 ? `${pos.leverage}x` : '—'}</div>
                                {pos.liquidationPrice && <div className="text-[10px] font-mono text-neutral-600">Liq {formatPrice(pos.liquidationPrice)}</div>}
                              </div>
                              <div className="text-right">
                                {pos.fundingSinceOpen != null && Math.abs(pos.fundingSinceOpen) > 0.001 ? (
                                  <div className={`text-[12px] font-mono ${pos.fundingSinceOpen >= 0 ? 'text-red-400/80' : 'text-green-400/80'}`}>
                                    {pos.fundingSinceOpen >= 0 ? '-' : '+'}{formatUSD(Math.abs(pos.fundingSinceOpen))}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-neutral-700">—</span>
                                )}
                              </div>
                            </div>
                            {/* Mobile row */}
                            <div className="sm:hidden px-4 py-3 hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <TokenIconSimple symbol={pos.symbol} size={28} />
                                  <span className="text-sm font-medium text-white">{pos.symbol}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pos.side === 'long' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                                    {pos.side === 'long' ? 'LONG' : 'SHORT'}
                                  </span>
                                  <span className="text-[11px] font-mono text-hub-yellow">{pos.leverage > 0 ? `${pos.leverage}x` : ''}</span>
                                </div>
                                <ExchangeLogo exchange={pos.exchange} size={14} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`text-[13px] font-mono font-semibold ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {pos.unrealizedPnl >= 0 ? '+' : ''}{formatUSD(pos.unrealizedPnl)}
                                  <span className={`ml-1.5 text-[11px] ${pos.roe >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                    ({pos.roe >= 0 ? '+' : ''}{pos.roe.toFixed(1)}%)
                                  </span>
                                </span>
                                <span className="text-xs font-mono text-neutral-500">{formatUSD(pos.positionValue)}</span>
                              </div>
                              {pos.fundingSinceOpen != null && Math.abs(pos.fundingSinceOpen) > 0.001 && (
                                <div className="mt-1 text-[10px] font-mono text-neutral-600">
                                  Funding: <span className={pos.fundingSinceOpen >= 0 ? 'text-red-400/70' : 'text-green-400/70'}>{pos.fundingSinceOpen >= 0 ? '-' : '+'}{formatUSD(Math.abs(pos.fundingSinceOpen))}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-neutral-600 text-sm">
                      No open positions found (Hyperliquid, GMX, dYdX)
                    </div>
                  )}
                </div>

                {/* ── Open Orders (Hyperliquid) ── */}
                {positionsData?.hlOpenOrders && positionsData.hlOpenOrders.length > 0 && (
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-hub-yellow" />
                      <h3 className="text-sm font-semibold text-white">Open Orders</h3>
                      <span className="text-[11px] text-neutral-600 font-mono">{positionsData.hlOpenOrders.length}</span>
                      <span className="text-[10px] text-neutral-700 ml-auto">Hyperliquid</span>
                    </div>
                    <div className="hidden sm:grid grid-cols-[minmax(120px,1.5fr)_80px_90px_90px_90px_60px] items-center px-4 py-2 border-b border-white/[0.06] text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                      <div>Coin</div>
                      <div className="text-right">Side</div>
                      <div className="text-right">Price</div>
                      <div className="text-right">Size</div>
                      <div className="text-right">Value</div>
                      <div className="text-right">Type</div>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {positionsData.hlOpenOrders.map((o) => (
                        <div key={o.oid}>
                          {/* Desktop */}
                          <div className="hidden sm:grid grid-cols-[minmax(120px,1.5fr)_80px_90px_90px_90px_60px] items-center px-4 py-2 hover:bg-white/[0.02] transition-colors text-[13px] font-mono">
                            <div className="flex items-center gap-2">
                              <TokenIconSimple symbol={o.coin} size={22} />
                              <span className="text-white">{o.coin}</span>
                            </div>
                            <div className={`text-right font-bold ${o.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                              {o.side === 'buy' ? 'BUY' : 'SELL'}
                            </div>
                            <div className="text-right text-neutral-300">{formatPrice(o.price)}</div>
                            <div className="text-right text-neutral-400">{o.size < 1 ? o.size.toFixed(4) : o.size.toFixed(2)}</div>
                            <div className="text-right text-neutral-400">{formatUSD(o.value)}</div>
                            <div className="text-right">
                              {o.reduceOnly && <span className="text-[9px] text-orange-400/80">TP/SL</span>}
                              {o.triggerPx && <span className="text-[9px] text-neutral-600 block">@{formatPrice(o.triggerPx)}</span>}
                            </div>
                          </div>
                          {/* Mobile */}
                          <div className="sm:hidden px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <TokenIconSimple symbol={o.coin} size={22} />
                                <span className="text-sm font-medium text-white">{o.coin}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${o.side === 'buy' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                                  {o.side === 'buy' ? 'BUY' : 'SELL'}
                                </span>
                                {o.reduceOnly && <span className="text-[9px] text-orange-400/80">TP/SL</span>}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-neutral-400">{formatPrice(o.price)} × {o.size < 1 ? o.size.toFixed(4) : o.size.toFixed(2)}</span>
                              <span className="text-neutral-500">{formatUSD(o.value)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Recent Fills (Hyperliquid) ── */}
                {positionsData?.hlFills && positionsData.hlFills.length > 0 && (
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-hub-yellow" />
                      <h3 className="text-sm font-semibold text-white">Recent Fills</h3>
                      <span className="text-[11px] text-neutral-600 font-mono">{positionsData.hlFills.length}</span>
                      <span className="text-[10px] text-neutral-700 ml-auto">Hyperliquid</span>
                    </div>
                    <div className="hidden sm:grid grid-cols-[minmax(120px,1.2fr)_70px_90px_80px_90px_80px_90px] items-center px-4 py-2 border-b border-white/[0.06] text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                      <div>Coin</div>
                      <div className="text-right">Side</div>
                      <div className="text-right">Price</div>
                      <div className="text-right">Size</div>
                      <div className="text-right">Value</div>
                      <div className="text-right">PnL</div>
                      <div className="text-right">Time</div>
                    </div>
                    <div className="divide-y divide-white/[0.04] max-h-[400px] overflow-y-auto">
                      {positionsData.hlFills.map((f, i) => (
                        <div key={`${f.time}-${i}`}>
                          {/* Desktop */}
                          <div className="hidden sm:grid grid-cols-[minmax(120px,1.2fr)_70px_90px_80px_90px_80px_90px] items-center px-4 py-2 hover:bg-white/[0.02] transition-colors text-[13px] font-mono">
                            <div className="flex items-center gap-2">
                              <TokenIconSimple symbol={f.coin} size={20} />
                              <span className="text-white text-sm">{f.coin}</span>
                            </div>
                            <div className={`text-right font-bold ${f.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                              {f.side === 'buy' ? 'BUY' : 'SELL'}
                            </div>
                            <div className="text-right text-neutral-300">{formatPrice(f.price)}</div>
                            <div className="text-right text-neutral-400">{f.size < 1 ? f.size.toFixed(4) : f.size.toFixed(2)}</div>
                            <div className="text-right text-neutral-400">{formatUSD(f.value)}</div>
                            <div className="text-right">
                              {Math.abs(f.closedPnl) > 0.01 ? (
                                <span className={f.closedPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                  {f.closedPnl >= 0 ? '+' : ''}{formatUSD(f.closedPnl)}
                                </span>
                              ) : <span className="text-neutral-700">—</span>}
                            </div>
                            <div className="text-right text-neutral-600 text-[11px]">
                              {new Date(f.time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {/* Mobile */}
                          <div className="sm:hidden px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <TokenIconSimple symbol={f.coin} size={20} />
                                <span className="text-sm text-white">{f.coin}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.side === 'buy' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                                  {f.side === 'buy' ? 'BUY' : 'SELL'}
                                </span>
                              </div>
                              <span className="text-[10px] text-neutral-600 font-mono">
                                {new Date(f.time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-neutral-400">{formatPrice(f.price)} × {f.size < 1 ? f.size.toFixed(4) : f.size.toFixed(2)}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-neutral-500">{formatUSD(f.value)}</span>
                                {Math.abs(f.closedPnl) > 0.01 && (
                                  <span className={`font-semibold ${f.closedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {f.closedPnl >= 0 ? '+' : ''}{formatUSD(f.closedPnl)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Funding Payments (Hyperliquid, last 7 days) ── */}
                {positionsData?.hlFundingPayments && positionsData.hlFundingPayments.length > 0 && (
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                      <CircleDollarSign className="w-4 h-4 text-hub-yellow" />
                      <h3 className="text-sm font-semibold text-white">Funding Payments</h3>
                      <span className="text-[10px] text-neutral-700 ml-auto">Last 7 days</span>
                    </div>
                    {(() => {
                      const payments = positionsData.hlFundingPayments!;
                      const totalFunding = payments.reduce((s, p) => s + p.amount, 0);
                      // Group by coin
                      const byCoin = new Map<string, number>();
                      for (const p of payments) {
                        byCoin.set(p.coin, (byCoin.get(p.coin) || 0) + p.amount);
                      }
                      const coinSummary = Array.from(byCoin.entries())
                        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                        .slice(0, 10);
                      return (
                        <>
                          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                            <span className="text-xs text-neutral-500">7d Total</span>
                            <span className={`text-sm font-mono font-semibold ${totalFunding >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {totalFunding >= 0 ? '+' : ''}{formatUSD(totalFunding)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-px bg-white/[0.04]">
                            {coinSummary.map(([coin, total]) => (
                              <div key={coin} className="bg-hub-darker px-3 py-2">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <TokenIconSimple symbol={coin} size={16} />
                                  <span className="text-[11px] text-neutral-400">{coin}</span>
                                </div>
                                <div className={`text-[13px] font-mono font-semibold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {total >= 0 ? '+' : ''}{formatUSD(total)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* ── Spot Balances (Hyperliquid) ── */}
                {positionsData?.hlSpotBalances && positionsData.hlSpotBalances.length > 0 && (
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                      <Coins className="w-4 h-4 text-hub-yellow" />
                      <h3 className="text-sm font-semibold text-white">Spot Balances</h3>
                      <span className="text-[11px] text-neutral-600 font-mono">{positionsData.hlSpotBalances.length}</span>
                      <span className="text-[10px] text-neutral-700 ml-auto">Hyperliquid</span>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {positionsData.hlSpotBalances.map((b) => (
                        <div key={b.coin} className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-2">
                            <TokenIconSimple symbol={b.coin} size={22} />
                            <span className="text-sm text-white">{b.coin}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-[13px] font-mono text-neutral-300">
                              {b.total < 1 ? b.total.toFixed(6) : b.total < 1000 ? b.total.toFixed(4) : b.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                            {b.hold > 0 && (
                              <div className="text-[10px] font-mono text-neutral-600">
                                {b.available.toFixed(4)} avail
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Equity Curve (Hyperliquid) ── */}
                {positionsData?.hlPortfolio && (() => {
                  const periods = positionsData.hlPortfolio!;
                  // Pick best available: day → week → month → allTime
                  const periodKey = periods.day?.equity?.length > 2 ? 'day'
                    : periods.week?.equity?.length > 2 ? 'week'
                    : periods.month?.equity?.length > 2 ? 'month'
                    : periods.allTime?.equity?.length > 2 ? 'allTime' : null;
                  if (!periodKey) return null;
                  const data = periods[periodKey];
                  const equity = data.equity;
                  if (equity.length < 2) return null;
                  const minVal = Math.min(...equity.map(p => p[1]));
                  const maxVal = Math.max(...equity.map(p => p[1]));
                  const range = maxVal - minVal || 1;
                  const startVal = equity[0][1];
                  const endVal = equity[equity.length - 1][1];
                  const change = endVal - startVal;
                  const changePct = startVal > 0 ? (change / startVal) * 100 : 0;
                  const isUp = change >= 0;
                  // Build SVG sparkline
                  const w = 600, h = 80;
                  const points = equity.map((p, i) => {
                    const x = (i / (equity.length - 1)) * w;
                    const y = h - ((p[1] - minVal) / range) * (h - 8) - 4;
                    return `${x},${y}`;
                  }).join(' ');
                  const allTimeVol = periods.allTime?.volume || 0;
                  const labels: Record<string, string> = { day: '24h', week: '7d', month: '30d', allTime: 'All Time' };
                  return (
                    <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-hub-yellow" />
                          <h3 className="text-sm font-semibold text-white">Equity Curve</h3>
                          <span className="text-[10px] text-neutral-700">{labels[periodKey]}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className={isUp ? 'text-green-400' : 'text-red-400'}>
                            {isUp ? '+' : ''}{formatUSD(change)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                          </span>
                          {allTimeVol > 0 && (
                            <span className="text-neutral-600">Vol: {formatUSD(allTimeVol)}</span>
                          )}
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity="0.2" />
                              <stop offset="100%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#eqGrad)" />
                          <polyline points={points} fill="none" stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        </svg>
                        <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-neutral-700">
                          <span>{new Date(equity[0][0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          <span>{formatUSD(endVal)}</span>
                          <span>{new Date(equity[equity.length - 1][0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Fee Tier & Volume (Hyperliquid) ── */}
                {positionsData?.hlUserFees && (
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-hub-yellow" />
                      <h3 className="text-sm font-semibold text-white">Fee Tier</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs font-mono">
                      <div>
                        <span className="text-neutral-600">Maker: </span>
                        <span className={positionsData.hlUserFees.makerRate < 0 ? 'text-green-400' : 'text-neutral-300'}>
                          {(positionsData.hlUserFees.makerRate * 100).toFixed(4)}%
                          {positionsData.hlUserFees.makerRate < 0 && ' (rebate)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-600">Taker: </span>
                        <span className="text-neutral-300">{(positionsData.hlUserFees.takerRate * 100).toFixed(4)}%</span>
                      </div>
                      {positionsData.hlUserFees.dailyVolume.length > 0 && (() => {
                        const last7 = positionsData.hlUserFees!.dailyVolume.slice(-7);
                        const totalVol = last7.reduce((s, d) => s + d.taker + d.maker, 0);
                        return (
                          <div>
                            <span className="text-neutral-600">7d Vol: </span>
                            <span className="text-neutral-300">{formatUSD(totalVol)}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* ── Account Ledger (Hyperliquid) ── */}
                {positionsData?.hlLedger && positionsData.hlLedger.length > 0 && (
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-hub-yellow" />
                      <h3 className="text-sm font-semibold text-white">Account Ledger</h3>
                      <span className="text-[10px] text-neutral-700 ml-auto">Last 30 days</span>
                    </div>
                    <div className="divide-y divide-white/[0.04] max-h-[300px] overflow-y-auto">
                      {positionsData.hlLedger.map((entry, i) => (
                        <div key={`${entry.time}-${i}`} className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              entry.type === 'deposit' ? 'bg-green-500/15 text-green-400'
                                : entry.type === 'withdraw' ? 'bg-red-500/15 text-red-400'
                                : 'bg-blue-500/15 text-blue-400'
                            }`}>
                              {entry.type === 'deposit' ? '↓' : entry.type === 'withdraw' ? '↑' : '⇄'}
                            </div>
                            <div>
                              <div className="text-sm text-white capitalize">{entry.type}</div>
                              <div className="text-[10px] text-neutral-600 font-mono">
                                {new Date(entry.time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-[13px] font-mono font-semibold ${
                              entry.type === 'deposit' ? 'text-green-400' : entry.type === 'withdraw' ? 'text-red-400' : 'text-neutral-300'
                            }`}>
                              {entry.type === 'deposit' ? '+' : entry.type === 'withdraw' ? '-' : ''}{formatUSD(Math.abs(entry.amount))}
                            </div>
                            {entry.fee > 0 && (
                              <div className="text-[10px] text-neutral-600 font-mono">fee: {formatUSD(entry.fee)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── API Errors Banner ── */}
                {positionsData?.errors && positionsData.errors.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-500/10">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-400/80">
                      {positionsData.errors.join(' · ')} — some data may be incomplete
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ========== DEX TRADES TAB ================================ */}
            {activeTab === 'trades' && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                {tradesLoading && !tradesData ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-12 bg-white/[0.04] rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : tradesData && tradesData.length > 0 ? (
                  <>
                    <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                      <h3 className="text-sm font-medium text-neutral-400">Recent DEX Trades</h3>
                      <span className="text-[11px] text-neutral-600">{tradesData.length} trades</span>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {tradesData.map((trade: any, i: number) => {
                        const usd = trade.valueUsd
                          ? trade.valueUsd >= 1e6 ? `$${(trade.valueUsd / 1e6).toFixed(2)}M`
                            : trade.valueUsd >= 1e3 ? `$${(trade.valueUsd / 1e3).toFixed(1)}K`
                            : `$${trade.valueUsd.toFixed(0)}`
                          : null;
                        return (
                          <div key={trade.txHash || i} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center flex-shrink-0">
                              <ArrowRightLeft className="w-4 h-4 text-hub-yellow" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">
                                  {trade.amountOut ? Number(trade.amountOut).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '?'}{' '}
                                  <span className="text-neutral-400">{trade.tokenOutSymbol || '???'}</span>
                                </span>
                                <span className="text-neutral-600">&rarr;</span>
                                <span className="text-sm font-medium text-white">
                                  {trade.amountIn ? Number(trade.amountIn).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '?'}{' '}
                                  <span className="text-neutral-400">{trade.tokenInSymbol || '???'}</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-neutral-600">{trade.dex || 'DEX'}</span>
                                <span className="text-[11px] text-neutral-700">&middot;</span>
                                <span className="text-[11px] text-neutral-600">
                                  {trade.blockTime ? new Date(trade.blockTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {usd && (
                                <span className="text-xs font-mono text-hub-yellow">{usd}</span>
                              )}
                              {trade.txHash && (
                                <a
                                  href={`${TRADE_EXPLORER_TX[trade.chain] || 'https://etherscan.io/tx/'}${trade.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-neutral-600 hover:text-neutral-400 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-neutral-600 text-sm">
                    No DEX trades found for this wallet.
                    <br />
                    <span className="text-neutral-700 text-xs">Trades are detected from token transfer patterns on Blockscout.</span>
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

      <ReferralBanner />
      <Footer />
    </div>
  );
}
