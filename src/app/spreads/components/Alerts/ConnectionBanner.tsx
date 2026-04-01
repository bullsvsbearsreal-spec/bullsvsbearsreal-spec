'use client';

import { memo } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import type { ConnectionStatus } from '@/hooks/useMultiExchangeWS';

interface ConnectionBannerProps {
  status: ConnectionStatus;
  wsCount: number;
  selCount: number;
}

function ConnectionBannerInner({ status, wsCount, selCount }: ConnectionBannerProps) {
  if (status === 'connected') return null;

  const config = {
    connecting: {
      bg: 'bg-blue-500/[0.06] border-blue-500/20',
      icon: <Wifi className="w-3.5 h-3.5 text-blue-400 animate-pulse" />,
      text: 'Connecting to price feed...',
      sub: 'Establishing WebSocket connection',
      textColor: 'text-blue-400',
    },
    degraded: {
      bg: 'bg-yellow-500/[0.06] border-yellow-500/20',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />,
      text: `Using polling fallback (${wsCount}/${selCount} exchanges)`,
      sub: 'WebSocket unavailable \u2014 prices update every 1s instead of real-time',
      textColor: 'text-yellow-400',
    },
    disconnected: {
      bg: 'bg-red-500/[0.06] border-red-500/20',
      icon: <WifiOff className="w-3.5 h-3.5 text-red-400" />,
      text: 'Price feed disconnected',
      sub: 'Attempting to reconnect... Prices may be stale',
      textColor: 'text-red-400',
    },
  }[status];

  if (!config) return null;

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border mb-4 ${config.bg}`}>
      {config.icon}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-medium ${config.textColor}`}>{config.text}</span>
        <span className="text-[10px] text-neutral-500">{config.sub}</span>
      </div>
      {status === 'disconnected' && (
        <div className="ml-auto flex gap-1">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1 h-1 rounded-full bg-red-400/60 animate-pulse" style={{ animationDelay: `${i * 300}ms` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export const ConnectionBanner = memo(ConnectionBannerInner);
