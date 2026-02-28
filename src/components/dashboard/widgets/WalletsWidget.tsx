'use client';

import Link from 'next/link';
import { Wallet, ExternalLink } from 'lucide-react';
import { useUserData } from '../useUserData';
import WidgetSkeleton from '../WidgetSkeleton';

/** Shorten an address to 0x1234...abcd format */
function shortAddr(addr?: string): string {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Get a chain-appropriate explorer URL */
function explorerUrl(addr: string): string {
  // Simple heuristic: starts with 0x → Ethereum, otherwise assume Solana
  if (addr.startsWith('0x')) return `https://etherscan.io/address/${addr}`;
  return `https://solscan.io/account/${addr}`;
}

export default function WalletsWidget() {
  const userData = useUserData();
  const wallets = userData?.wallets ?? [];

  if (userData === null) return <WidgetSkeleton variant="list" rows={3} />;

  if (wallets.length === 0) {
    return (
      <div className="text-center py-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
          <Wallet className="w-4 h-4 text-blue-400/60" />
        </div>
        <p className="text-xs text-neutral-500 mb-0.5">Save wallet addresses</p>
        <p className="text-[10px] text-neutral-600 mb-2">Quick access to your wallets on block explorers</p>
        <Link href="/wallet-tracker" className="text-[10px] text-hub-yellow hover:underline font-medium">+ Add wallet</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-1">
        {wallets.slice(0, 4).map((w: any, i: number) => (
          <a
            key={w.address || i}
            href={explorerUrl(w.address || '')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-md hover:bg-white/[0.04] transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-2.5 h-2.5 text-blue-400/60" />
              </div>
              <div className="min-w-0">
                {w.label && <p className="text-[10px] text-neutral-400 truncate">{w.label}</p>}
                <p className="text-[10px] text-neutral-600 font-mono truncate">{shortAddr(w.address)}</p>
              </div>
            </div>
            <ExternalLink className="w-2.5 h-2.5 text-neutral-700 group-hover:text-neutral-400 transition-colors flex-shrink-0" />
          </a>
        ))}
        {wallets.length > 4 && (
          <Link href="/wallet-tracker" className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors">
            +{wallets.length - 4} more
          </Link>
        )}
      </div>
      <Link href="/wallet-tracker" className="block text-center mt-2 text-[10px] text-hub-yellow hover:underline">
        Manage wallets
      </Link>
    </div>
  );
}
