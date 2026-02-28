'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { useUserData } from '../useUserData';
import WidgetSkeleton from '../WidgetSkeleton';

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
        <p className="text-xs text-neutral-500 mb-0.5">Monitor on-chain wallets</p>
        <p className="text-[10px] text-neutral-600 mb-2">Paste an address to track balances and activity</p>
        <Link href="/wallet-tracker" className="text-[10px] text-hub-yellow hover:underline font-medium">+ Track wallet</Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-lg font-bold text-white mb-2">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</p>
      <div className="space-y-1">
        {wallets.slice(0, 3).map((w, i) => (
          <div key={w.address || i} className="text-xs text-neutral-500 truncate font-mono">
            {w.label || `${w.address?.slice(0, 6)}...${w.address?.slice(-4)}`}
          </div>
        ))}
        {wallets.length > 3 && (
          <div className="text-[10px] text-neutral-600">+{wallets.length - 3} more</div>
        )}
      </div>
    </div>
  );
}
