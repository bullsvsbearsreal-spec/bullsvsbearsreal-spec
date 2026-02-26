'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Settings, Mail, Clock, Bell, Shield, Download, FileJson, FileSpreadsheet,
  ToggleLeft, ToggleRight, Check, Loader2, Lock, Trash2, AlertTriangle,
  Sun, Moon,
} from 'lucide-react';

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
  const { data: session, status } = useSession();
  const router = useRouter();

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

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load prefs + theme
  useEffect(() => {
    if (!session?.user) return;

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
  }, [session]);

  /* ─── Handlers ────────────────────────────────────────────── */

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
          {/* Title */}
          <div className="mb-6">
            <h1 className="heading-page flex items-center gap-2">
              <Settings className="w-6 h-6 text-hub-yellow" />
              Settings
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Manage your account, notifications, and preferences.
            </p>
          </div>

          {/* ─── Account ─────────────────────────────────────── */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-hub-yellow" />
              Account
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{session.user?.name || 'User'}</p>
                  <p className="text-xs text-neutral-600">{session.user?.email}</p>
                </div>
              </div>

              {/* Change Password */}
              <div className="pt-3 border-t border-white/[0.06]">
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
                    {theme === 'dark' ? 'Dark mode' : 'Light mode'} &middot; synced to your account
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
              Your settings are synced to the cloud and apply across all devices.
              Alert conditions are checked server-side every 5 minutes.
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
