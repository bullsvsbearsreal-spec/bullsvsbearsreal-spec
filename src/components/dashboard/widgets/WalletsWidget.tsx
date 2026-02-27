'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Wallet } from 'lucide-react';

export default function WalletsWidget() {
  const [wallets, setWallets] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setWallets(data.wallets || []);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  if (wallets === null) {
    return <div className="h-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  if (wallets.length === 0) {
    return (
      <div className="text-center py-2">
        <Wallet className="w-5 h-5 text-neutral-700 mx-auto mb-1" />
        <p className="text-xs text-neutral-600">No wallets tracked</p>
        <Link href="/wallet-tracker" className="text-[10px] text-hub-yellow hover:underline">Track wallet</Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-lg font-bold text-white mb-2">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</p>
      <div className="space-y-1">
        {wallets.slice(0, 3).map((w: any, i: number) => (
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
