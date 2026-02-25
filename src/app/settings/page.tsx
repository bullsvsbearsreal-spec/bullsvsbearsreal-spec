'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Settings, Mail, Clock, Bell, Shield, Download,
  ToggleLeft, ToggleRight, Check, Loader2,
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

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load prefs from DB
  useEffect(() => {
    if (!session?.user) return;
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/user/data');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `infohub-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    setExporting(false);
  };

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
              Manage your notification preferences and account settings.
            </p>
          </div>

          {/* Account Info */}
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
              <div className="pt-2 border-t border-white/[0.06]">
                <a
                  href="/forgot-password"
                  className="text-xs text-hub-yellow hover:text-hub-yellow-light transition-colors"
                >
                  Change password
                </a>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
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

          {/* Data Export */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Download className="w-4 h-4 text-hub-yellow" />
              Data
            </h2>
            <p className="text-xs text-neutral-600 mb-3">
              Export your watchlists, alerts, portfolio, and preferences as a JSON file.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export Data
            </button>
          </div>

          {/* Info */}
          <div className="p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            <p className="text-neutral-500 text-xs leading-relaxed">
              Your settings are synced to the cloud and apply across all devices. Alert conditions are checked server-side every 5 minutes.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
