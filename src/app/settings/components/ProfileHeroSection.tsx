'use client';

import Image from 'next/image';
import { Camera, Loader2, Trash2, User, Shield, Star, Bell, BarChart3, Link2, Activity } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils/format';
import type { UseAvatarUploadReturn } from '@/hooks/useAvatarUpload';

interface AccountStats {
  memberSince: string | null;
  watchlistCount: number;
  alertCount: number;
  portfolioCount: number;
  connectedProviders: string[];
  recentNotifications: Array<{
    symbol: string;
    metric: string;
    threshold: number;
    actualValue: number;
    channel: string;
    sentAt: string;
  }>;
}

interface Props {
  session: { user?: { name?: string | null; email?: string | null; image?: string | null; role?: string } };
  avatar: UseAvatarUploadReturn;
  accountStats: AccountStats | null;
}

export default function ProfileHeroSection({ session, avatar, accountStats }: Props) {
  return (
    <>
      <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-5 mb-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => avatar.inputRef.current?.click()}
              disabled={avatar.uploading}
              className="relative w-20 h-20 rounded-full bg-white/[0.06] border-2 border-white/[0.08] hover:border-hub-yellow/50 transition-colors overflow-hidden group"
              title="Change profile picture"
            >
              {avatar.url ? (
                <Image src={avatar.url} alt={`${session.user?.name || 'User'}'s avatar`} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-neutral-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {avatar.uploading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
            </button>
            {avatar.url && !avatar.uploading && (
              <button
                onClick={avatar.handleRemove}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center z-10 transition-colors"
                title="Remove avatar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <input
            ref={avatar.inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={avatar.handleUpload}
            className="hidden"
          />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl font-bold text-white truncate">{session.user?.name || 'User'}</h1>
              {session.user?.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-hub-yellow/20 text-hub-yellow">
                  <Shield className="w-3 h-3" />
                  ADMIN
                </span>
              )}
              {session.user?.role === 'advisor' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-400">
                  <Shield className="w-3 h-3" />
                  ADVISOR
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500 truncate">{session.user?.email}</p>
            {accountStats?.memberSince && (
              <p className="text-xs text-neutral-600 mt-1">
                Member since {new Date(accountStats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            )}
            {avatar.error && <p className="text-xs text-red-400 mt-1">{avatar.error}</p>}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Watchlist', value: accountStats?.watchlistCount ?? 0, icon: Star, color: 'text-hub-yellow' },
            { label: 'Alerts', value: accountStats?.alertCount ?? 0, icon: Bell, color: 'text-blue-400' },
            { label: 'Portfolio', value: accountStats?.portfolioCount ?? 0, icon: BarChart3, color: 'text-green-400' },
            { label: 'Connected', value: accountStats?.connectedProviders?.length ?? 0, icon: Link2, color: 'text-purple-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] rounded-lg p-3 text-center">
              <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1.5`} />
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-[10px] text-neutral-600 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-hub-yellow" />
          Recent Activity
        </h2>
        {!accountStats || accountStats.recentNotifications.length === 0 ? (
          <p className="text-xs text-neutral-600 py-2">No recent notifications</p>
        ) : (
          <div className="space-y-2">
            {accountStats.recentNotifications.slice(0, 8).map((n, i) => {
              const metricLabel =
                n.metric === 'price' ? 'Price' :
                n.metric === 'fundingRate' ? 'Funding' :
                n.metric === 'openInterest' ? 'OI' :
                n.metric === 'change24h' ? '24h %' : n.metric;
              const ago = formatTimeAgo(n.sentAt);
              return (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
                  <Bell className="w-3.5 h-3.5 text-hub-yellow flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">
                      <span className="font-semibold">{n.symbol}</span>
                      {' '}{metricLabel} alert triggered
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-neutral-600 bg-white/[0.04] px-1.5 py-0.5 rounded">{n.channel}</span>
                    <span className="text-[10px] text-neutral-600">{ago}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
