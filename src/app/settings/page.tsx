'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Image from 'next/image';
import {
  Mail, Clock, Bell, Shield, Download, FileJson, FileSpreadsheet,
  ToggleLeft, ToggleRight, Check, Loader2, Lock, Trash2, AlertTriangle,
  Sun, Moon, Camera, User, Smartphone, Copy, KeyRound,
  Star, Activity, Link2, BarChart3,
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

const COOLDOWN_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
];

interface NotificationPrefs {
  email: boolean;
  cooldownMinutes: number;
}

export default function SettingsPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Notification prefs
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Change password
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // 2FA
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [email2faEnabled, setEmail2faEnabled] = useState(false);
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpQr, setTotpQr] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState('');
  const [totpSaving, setTotpSaving] = useState(false);
  const [totpError, setTotpError] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [twoFaLoading, setTwoFaLoading] = useState(true);

  // Account stats
  const [accountStats, setAccountStats] = useState<{
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
  } | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load prefs + theme + avatar + account stats
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

    // Theme from localStorage
    const savedTheme = localStorage.getItem('infohub-theme');
    if (savedTheme === 'light') setTheme('light');

    // Notification prefs from DB
    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) return;
        const json = await res.json();
        const prefs = json.notificationPrefs as NotificationPrefs | undefined;
        if (prefs) {
          setEmailEnabled(prefs.email ?? true);
          setCooldownMinutes(prefs.cooldownMinutes ?? 60);
        }
      } catch {}
    })();

    // 2FA status
    (async () => {
      try {
        const res = await fetch('/api/auth/2fa/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: session.user?.email }),
        });
        if (res.ok) {
          const data = await res.json();
          setTotpEnabled(data.methods?.includes('totp') || false);
          setEmail2faEnabled(data.methods?.includes('email') || false);
        }
      } catch {}
      setTwoFaLoading(false);
    })();
  }, [session]);

  /* ─── Handlers ────────────────────────────────────────────── */

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setAvatarError('Use JPG, PNG, WebP, or GIF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('File too large (max 10MB)');
      return;
    }

    // Resize to 256x256 via canvas
    setAvatarUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;

      // Center-crop: fit the shorter side to 256
      const size = Math.min(bitmap.width, bitmap.height);
      const sx = (bitmap.width - size) / 2;
      const sy = (bitmap.height - size) / 2;
      ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 256, 256);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas conversion failed'))), 'image/webp', 0.85);
      });

      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.webp');

      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setAvatarError(json.error || 'Upload failed');
      } else {
        setAvatarUrl(json.image);
        // Update NextAuth session so header shows new avatar
        await updateSession();
      }
    } catch {
      setAvatarError('Upload failed');
    }
    setAvatarUploading(false);
    // Reset file input
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const savePrefs = async (email: boolean, cooldown: number) => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPrefs: { email, cooldownMinutes: cooldown },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/user/data');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `infohub-data-${new Date().toISOString().split('T')[0]}.json`);
    } catch {}
    setExporting(false);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/user/data');
      if (!res.ok) throw new Error();
      const data = await res.json();

      // Build CSV with watchlist + portfolio
      const lines: string[] = ['Type,Symbol,Quantity,EntryPrice,Notes'];

      // Watchlist
      (data.watchlist || []).forEach((sym: string) => {
        lines.push(`Watchlist,${sym},,,`);
      });

      // Portfolio
      (data.portfolio || []).forEach((h: any) => {
        lines.push(`Portfolio,${h.symbol || ''},${h.quantity || ''},${h.entryPrice || ''},${h.notes || ''}`);
      });

      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      downloadBlob(blob, `infohub-data-${new Date().toISOString().split('T')[0]}.csv`);
    } catch {}
    setExporting(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('Passwords do not match');
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPwError(json.error || 'Failed to change password');
      } else {
        setPwSuccess(true);
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
        setTimeout(() => {
          setPwSuccess(false);
          setShowPwForm(false);
        }, 2000);
      }
    } catch {
      setPwError('Something went wrong');
    }
    setPwSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      if (res.ok) {
        // Clear local data
        const keysToRemove = ['ih_watchlist', 'ih_portfolio', 'ih_alerts', 'ih_screener_presets', 'ih_wallets', 'ih_notification_prefs'];
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        signOut({ callbackUrl: '/' });
      }
    } catch {}
    setDeleting(false);
  };

  const handleStartTotpSetup = async () => {
    setTotpError('');
    setTotpSaving(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error || 'Setup failed');
        return;
      }
      setTotpQr(data.qrCode);
      setTotpSecret(data.secret);
      setTotpBackupCodes(data.backupCodes);
      setShowTotpSetup(true);
    } catch {
      setTotpError('Setup failed');
    }
    setTotpSaving(false);
  };

  const handleVerifyTotp = async () => {
    if (totpCode.length !== 6) {
      setTotpError('Enter a 6-digit code');
      return;
    }
    setTotpError('');
    setTotpSaving(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error || 'Invalid code');
        setTotpSaving(false);
        return;
      }
      setTotpEnabled(true);
      setShowTotpSetup(false);
      setShowBackupCodes(true);
      setTotpCode('');
    } catch {
      setTotpError('Verification failed');
    }
    setTotpSaving(false);
  };

  const handleDisableTotp = async () => {
    setTotpSaving(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', { method: 'DELETE' });
      if (res.ok) {
        setTotpEnabled(false);
        setShowTotpSetup(false);
      }
    } catch {}
    setTotpSaving(false);
  };

  const handleToggleEmail2fa = async () => {
    setTotpSaving(true);
    try {
      if (email2faEnabled) {
        const res = await fetch('/api/auth/2fa/email', { method: 'DELETE' });
        if (res.ok) setEmail2faEnabled(false);
      } else {
        const res = await fetch('/api/auth/2fa/email', { method: 'POST' });
        if (res.ok) setEmail2faEnabled(true);
      }
    } catch {}
    setTotpSaving(false);
  };

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'light') {
      document.documentElement.dataset.theme = 'light';
      localStorage.setItem('infohub-theme', 'light');
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem('infohub-theme');
    }
  };

  /* ─── Render ──────────────────────────────────────────────── */

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

  if (!session) return null;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-6">
          {/* ─── Profile Hero ─────────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-5 mb-4">
            <div className="flex items-center gap-5">
              {/* Avatar — larger */}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="relative flex-shrink-0 w-20 h-20 rounded-full bg-white/[0.06] border-2 border-white/[0.08] hover:border-hub-yellow/50 transition-colors overflow-hidden group"
                title="Change profile picture"
              >
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Avatar" width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-neutral-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {avatarUploading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </div>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white truncate">{session.user?.name || 'User'}</h1>
                  {session.user?.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-hub-yellow/20 text-hub-yellow">
                      <Shield className="w-3 h-3" />
                      ADMIN
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

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3 mt-5">
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

          {/* ─── Recent Activity ───────────────────────────────── */}
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

          {/* ─── Connected Accounts ────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-hub-yellow" />
              Connected Accounts
            </h2>
            <div className="space-y-3">
              {[
                { id: 'google', name: 'Google', color: '#4285F4' },
                { id: 'discord', name: 'Discord', color: '#5865F2' },
                { id: 'twitter', name: 'Twitter', color: '#1DA1F2' },
              ].map((provider) => {
                const isConnected = accountStats?.connectedProviders?.includes(provider.id) ?? false;
                return (
                  <div key={provider.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: isConnected ? provider.color : 'rgba(255,255,255,0.04)' }}
                      >
                        {provider.name[0]}
                      </div>
                      <div>
                        <p className="text-sm text-white">{provider.name}</p>
                        <p className="text-xs text-neutral-600">
                          {isConnected ? 'Connected' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {isConnected ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-[10px] text-neutral-600">Sign in with {provider.name} to link</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Account Security ─────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-hub-yellow" />
              Account Security
            </h2>
            <div className="space-y-3">
              {/* Change Password */}
              <div>
                {!showPwForm ? (
                  <button
                    onClick={() => setShowPwForm(true)}
                    className="flex items-center gap-1.5 text-xs text-hub-yellow hover:text-hub-yellow-light transition-colors"
                  >
                    <Lock className="w-3 h-3" />
                    Change password
                  </button>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div>
                      <label className="text-xs text-neutral-500 block mb-1">Current password</label>
                      <input
                        type="password"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50"
                        placeholder="Enter current password"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 block mb-1">New password</label>
                      <input
                        type="password"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50"
                        placeholder="Min 8 characters"
                        minLength={8}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 block mb-1">Confirm new password</label>
                      <input
                        type="password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50"
                        placeholder="Repeat new password"
                        minLength={8}
                        required
                      />
                    </div>
                    {pwError && <p className="text-xs text-red-400">{pwError}</p>}
                    {pwSuccess && (
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Password changed
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={pwSaving}
                        className="px-4 py-2 rounded-lg bg-hub-yellow text-black text-xs font-semibold hover:bg-hub-yellow-light transition-colors disabled:opacity-50"
                      >
                        {pwSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Update Password'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPwForm(false);
                          setPwError('');
                          setCurrentPw('');
                          setNewPw('');
                          setConfirmPw('');
                        }}
                        className="px-4 py-2 rounded-lg bg-white/[0.04] text-neutral-400 text-xs hover:text-white hover:bg-white/[0.08] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* ─── Two-Factor Authentication ─────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <KeyRound className="w-4 h-4 text-hub-yellow" />
              Two-Factor Authentication
            </h2>

            {twoFaLoading ? (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Authenticator App */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-neutral-400" />
                    <div>
                      <p className="text-sm text-white">Authenticator app</p>
                      <p className="text-xs text-neutral-600">
                        {totpEnabled ? 'Enabled — using TOTP codes' : 'Use Google Authenticator, Authy, etc.'}
                      </p>
                    </div>
                  </div>
                  {totpEnabled ? (
                    <button
                      onClick={handleDisableTotp}
                      disabled={totpSaving}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={handleStartTotpSetup}
                      disabled={totpSaving}
                      className="px-3 py-1.5 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20 text-xs text-hub-yellow hover:bg-hub-yellow/20 transition-colors disabled:opacity-50"
                    >
                      {totpSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Enable'}
                    </button>
                  )}
                </div>

                {/* TOTP Setup Modal */}
                {showTotpSetup && (
                  <div className="rounded-lg bg-white/[0.02] border border-white/[0.08] p-4 space-y-4">
                    <p className="text-xs text-neutral-400">
                      Scan this QR code with your authenticator app, then enter the 6-digit code.
                    </p>
                    {totpQr && (
                      <div className="flex justify-center">
                        <img src={totpQr} alt="QR Code" className="w-48 h-48 rounded-lg" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-neutral-400 bg-white/[0.04] rounded px-2 py-1.5 font-mono truncate">
                        {totpSecret}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(totpSecret)}
                        className="p-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
                        title="Copy secret"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={totpCode}
                        onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 text-center font-mono tracking-widest"
                      />
                    </div>
                    {totpError && <p className="text-xs text-red-400">{totpError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleVerifyTotp}
                        disabled={totpSaving || totpCode.length !== 6}
                        className="px-4 py-2 rounded-lg bg-hub-yellow text-black text-xs font-semibold hover:bg-hub-yellow-light transition-colors disabled:opacity-50"
                      >
                        {totpSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify & Enable'}
                      </button>
                      <button
                        onClick={() => { setShowTotpSetup(false); setTotpCode(''); setTotpError(''); }}
                        className="px-4 py-2 rounded-lg bg-white/[0.04] text-neutral-400 text-xs hover:text-white hover:bg-white/[0.08] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Backup Codes Display */}
                {showBackupCodes && totpBackupCodes.length > 0 && (
                  <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-4 space-y-3">
                    <p className="text-xs text-yellow-500 font-semibold">Save your backup codes</p>
                    <p className="text-xs text-neutral-400">
                      Store these codes somewhere safe. Each code can only be used once.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {totpBackupCodes.map((c, i) => (
                        <code key={i} className="text-xs font-mono text-neutral-300 bg-white/[0.04] rounded px-2 py-1 text-center">
                          {c}
                        </code>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(totpBackupCodes.join('\n'));
                        setShowBackupCodes(false);
                      }}
                      className="flex items-center gap-1.5 text-xs text-hub-yellow hover:text-hub-yellow-light transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Copy all & dismiss
                    </button>
                  </div>
                )}

                {/* Email 2FA */}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-neutral-400" />
                    <div>
                      <p className="text-sm text-white">Email verification</p>
                      <p className="text-xs text-neutral-600">
                        Receive a code via email when signing in
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleEmail2fa}
                    disabled={totpSaving}
                    className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {email2faEnabled ? (
                      <ToggleRight className="w-6 h-6 text-hub-yellow" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── Notifications ───────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-hub-yellow" />
              Notifications
            </h2>
            <div className="space-y-4">
              {/* Email toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-neutral-400" />
                  <div>
                    <p className="text-sm text-white">Email notifications</p>
                    <p className="text-xs text-neutral-600">
                      Receive email alerts at {session.user?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !emailEnabled;
                    setEmailEnabled(next);
                    savePrefs(next, cooldownMinutes);
                  }}
                  disabled={saving}
                  className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  {emailEnabled ? (
                    <ToggleRight className="w-6 h-6 text-hub-yellow" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
              </div>

              {/* Cooldown selector */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-neutral-400" />
                  <div>
                    <p className="text-sm text-white">Alert cooldown</p>
                    <p className="text-xs text-neutral-600">
                      Min time between repeated notifications
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {COOLDOWN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setCooldownMinutes(opt.value);
                        savePrefs(emailEnabled, opt.value);
                      }}
                      disabled={saving}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                        cooldownMinutes === opt.value
                          ? 'bg-hub-yellow text-black'
                          : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save indicator */}
            {(saving || saved) && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                {saving ? (
                  <>
                    <Loader2 className="w-3 h-3 text-neutral-500 animate-spin" />
                    <span className="text-xs text-neutral-500">Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-500">Saved</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ─── Display ─────────────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-hub-yellow" /> : <Sun className="w-4 h-4 text-hub-yellow" />}
              Display
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Moon className="w-4 h-4 text-neutral-400" /> : <Sun className="w-4 h-4 text-neutral-400" />}
                <div>
                  <p className="text-sm text-white">Theme</p>
                  <p className="text-xs text-neutral-600">
                    {theme === 'dark' ? 'Dark mode' : 'Light mode'} &middot; saved locally
                  </p>
                </div>
              </div>
              <button
                onClick={handleThemeToggle}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                {theme === 'dark' ? (
                  <ToggleLeft className="w-6 h-6" />
                ) : (
                  <ToggleRight className="w-6 h-6 text-hub-yellow" />
                )}
              </button>
            </div>
          </div>

          {/* ─── Data Export ──────────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Download className="w-4 h-4 text-hub-yellow" />
              Export Data
            </h2>
            <p className="text-xs text-neutral-600 mb-3">
              Download your watchlists, alerts, portfolio, wallets, and screener presets.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleExportJSON}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileJson className="w-4 h-4" />
                )}
                JSON
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                CSV
              </button>
            </div>
          </div>

          {/* ─── Danger Zone ─────────────────────────────────── */}
          <div className="bg-hub-darker border border-red-500/20 rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h2>
            <p className="text-xs text-neutral-600 mb-3">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>

          {/* Info */}
          <div className="p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            <p className="text-neutral-500 text-xs leading-relaxed">
              Your profile and settings are synced to the cloud across all devices.
              Alerts are checked server-side every 5 minutes.
            </p>
          </div>
        </div>
      </main>

      {/* ─── Delete Account Modal ────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-hub-darker border border-white/[0.08] rounded-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Delete Account
            </h3>
            <p className="text-sm text-neutral-400 mb-4">
              This will permanently delete your account, watchlists, alerts, portfolio, and all
              synced data. This cannot be undone.
            </p>
            <div className="mb-4">
              <label className="text-xs text-neutral-500 block mb-1">
                Type <span className="text-red-400 font-mono font-bold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-red-500/50"
                placeholder="DELETE"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Forever
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirm('');
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] text-neutral-400 text-sm hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
