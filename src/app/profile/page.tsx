'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Image from 'next/image';
import {
  User, Camera, Loader2, Trash2, Shield, Star, Bell, BarChart3,
  Activity, Clock, Save, Check, ChevronDown,
} from 'lucide-react';

function formatTimeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

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

interface DisplayPrefs {
  currency: string;
  defaultExchange: string;
  fundingDisplay: string;
}

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP'];
const FUNDING_DISPLAY_OPTIONS = [
  { label: '1-hour rate', value: '1h' },
  { label: '8-hour rate', value: '8h' },
  { label: 'Annualized', value: 'annualized' },
];

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Bio
  const [bio, setBio] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);

  // Display prefs
  const [displayPrefs, setDisplayPrefs] = useState<DisplayPrefs>({
    currency: 'USD',
    defaultExchange: '',
    fundingDisplay: '8h',
  });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Account stats
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);

  // Load data
  useEffect(() => {
    if (!session?.user) return;

    if (session.user.image) setAvatarUrl(session.user.image);

    // Load account stats
    (async () => {
      try {
        const res = await fetch('/api/user/stats');
        if (res.ok) setAccountStats(await res.json());
      } catch {}
    })();

    // Load user data (bio + display prefs)
    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) return;
        const data = await res.json();
        if (data.bio) setBio(data.bio);
        if (data.displayPrefs) {
          setDisplayPrefs(prev => ({ ...prev, ...data.displayPrefs }));
        }
      } catch {}
    })();
  }, [session]);

  // Avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setAvatarError('Use JPG, PNG, WebP, or GIF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('File too large (max 10MB)');
      return;
    }

    setAvatarUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      const size = Math.min(bitmap.width, bitmap.height);
      const sx = (bitmap.width - size) / 2;
      const sy = (bitmap.height - size) / 2;
      ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 256, 256);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas failed'))), 'image/webp', 0.85);
      });

      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.webp');
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setAvatarError(json.error || 'Upload failed');
      } else {
        setAvatarUrl(json.image);
        await updateSession();
      }
    } catch {
      setAvatarError('Upload failed');
    }
    setAvatarUploading(false);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleAvatarRemove = async () => {
    if (!avatarUrl) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const res = await fetch('/api/user/avatar', { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        setAvatarError(json.error || 'Remove failed');
      } else {
        setAvatarUrl(null);
        await updateSession();
      }
    } catch {
      setAvatarError('Remove failed');
    }
    setAvatarUploading(false);
  };

  // Save bio
  const handleSaveBio = async () => {
    setBioSaving(true);
    setBioSaved(false);
    try {
      await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      });
      setBioSaved(true);
      setTimeout(() => setBioSaved(false), 2000);
    } catch {}
    setBioSaving(false);
  };

  // Save display prefs
  const handleSavePrefs = async () => {
    setPrefsSaving(true);
    setPrefsSaved(false);
    try {
      await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayPrefs }),
      });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch {}
    setPrefsSaving(false);
  };

  // Loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="flex flex-col items-center justify-center py-20 text-white">
          <div className="text-neutral-400 text-sm mb-3">Log in to access your profile</div>
          <a href="/login" className="px-4 py-2 rounded-lg bg-hub-yellow text-black text-sm font-medium hover:brightness-110 transition-all">
            Log In
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  const initials = (session.user?.name || session.user?.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const daysActive = accountStats?.memberSince
    ? Math.max(1, Math.floor((Date.now() - new Date(accountStats.memberSince).getTime()) / 86400000))
    : 0;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-6">

          {/* ─── Profile Header ─────────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-5 mb-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="relative w-20 h-20 rounded-full bg-white/[0.06] border-2 border-white/[0.08] hover:border-hub-yellow/50 transition-colors overflow-hidden group"
                  title="Change profile picture"
                >
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={`${session.user?.name || 'User'}'s avatar`} width={80} height={80} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-hub-yellow/20 text-hub-yellow text-xl font-bold">
                      {initials}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {avatarUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                  </div>
                </button>
                {avatarUrl && !avatarUploading && (
                  <button
                    onClick={handleAvatarRemove}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center z-10 transition-colors"
                    title="Remove avatar"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl font-bold text-white truncate">{session.user?.name || 'User'}</h1>
                  {session.user?.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-hub-yellow/20 text-hub-yellow">
                      <Shield className="w-3 h-3" /> ADMIN
                    </span>
                  )}
                  {session.user?.role === 'advisor' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-400">
                      <Shield className="w-3 h-3" /> ADVISOR
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-500 truncate">{session.user?.email}</p>
                {accountStats?.memberSince && (
                  <p className="text-xs text-neutral-600 mt-1">
                    Member since {new Date(accountStats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                )}
                {avatarError && <p className="text-xs text-red-400 mt-1">{avatarError}</p>}
              </div>
            </div>
          </div>

          {/* ─── Bio ────────────────────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-hub-yellow" />
              Bio
            </h2>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 280))}
              placeholder="Tell us about yourself..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-hub-yellow/40 transition-colors"
              rows={3}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-neutral-600">{bio.length}/280</span>
              <button
                onClick={handleSaveBio}
                disabled={bioSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-hub-yellow/10 text-hub-yellow hover:bg-hub-yellow/20 disabled:opacity-50 transition-colors"
              >
                {bioSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : bioSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                {bioSaved ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>

          {/* ─── Display Preferences ───────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <ChevronDown className="w-4 h-4 text-hub-yellow" />
              Display Preferences
            </h2>
            <div className="space-y-3">
              {/* Currency */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs text-neutral-400">Default Currency</label>
                <div className="flex gap-1">
                  {CURRENCY_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setDisplayPrefs(p => ({ ...p, currency: c }))}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        displayPrefs.currency === c
                          ? 'bg-hub-yellow/20 text-hub-yellow'
                          : 'bg-white/[0.04] text-neutral-500 hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Exchange */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs text-neutral-400">Default Exchange Filter</label>
                <input
                  type="text"
                  value={displayPrefs.defaultExchange}
                  onChange={e => setDisplayPrefs(p => ({ ...p, defaultExchange: e.target.value }))}
                  placeholder="All exchanges"
                  className="w-36 bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/40 transition-colors"
                />
              </div>

              {/* Funding Display */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs text-neutral-400">Funding Rate Display</label>
                <div className="flex flex-wrap gap-1">
                  {FUNDING_DISPLAY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDisplayPrefs(p => ({ ...p, fundingDisplay: opt.value }))}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        displayPrefs.fundingDisplay === opt.value
                          ? 'bg-hub-yellow/20 text-hub-yellow'
                          : 'bg-white/[0.04] text-neutral-500 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={handleSavePrefs}
                disabled={prefsSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-hub-yellow/10 text-hub-yellow hover:bg-hub-yellow/20 disabled:opacity-50 transition-colors"
              >
                {prefsSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : prefsSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                {prefsSaved ? 'Saved' : 'Save Preferences'}
              </button>
            </div>
          </div>

          {/* ─── Activity Summary ──────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-hub-yellow" />
              Activity Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Watchlist', value: accountStats?.watchlistCount ?? 0, icon: Star, color: 'text-hub-yellow' },
                { label: 'Alerts', value: accountStats?.alertCount ?? 0, icon: Bell, color: 'text-blue-400' },
                { label: 'Portfolio', value: accountStats?.portfolioCount ?? 0, icon: BarChart3, color: 'text-green-400' },
                { label: 'Days Active', value: daysActive, icon: Clock, color: 'text-purple-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/[0.03] rounded-lg p-3 text-center">
                  <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1.5`} />
                  <p className="text-lg font-bold text-white">{stat.value}</p>
                  <p className="text-[10px] text-neutral-600 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Recent Activity Feed ──────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-hub-yellow" />
              Recent Activity
            </h2>
            {!accountStats || accountStats.recentNotifications.length === 0 ? (
              <p className="text-xs text-neutral-600 py-2">No recent activity yet. Set up alerts to start tracking.</p>
            ) : (
              <div className="space-y-2">
                {accountStats.recentNotifications.map((n, i) => {
                  const metricLabel =
                    n.metric === 'price' ? 'Price' :
                    n.metric === 'fundingRate' ? 'Funding' :
                    n.metric === 'openInterest' ? 'OI' :
                    n.metric === 'change24h' ? '24h %' : n.metric;
                  const ago = formatTimeAgo(n.sentAt);
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Bell className="w-3 h-3 text-blue-400 flex-shrink-0" />
                        <span className="text-xs text-white font-medium">{n.symbol}</span>
                        <span className="text-xs text-neutral-500">{metricLabel} triggered</span>
                      </div>
                      <span className="text-[11px] text-neutral-600 flex-shrink-0 ml-2">{ago}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
