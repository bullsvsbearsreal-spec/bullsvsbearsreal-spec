'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Sun, Moon, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import ProfileHeroSection from './components/ProfileHeroSection';
import ConnectedAccountsSection from './components/ConnectedAccountsSection';
import SecuritySection from './components/SecuritySection';
import TwoFactorSection from './components/TwoFactorSection';
import NotificationsSection from './components/NotificationsSection';
import DataExportSection from './components/DataExportSection';
import DangerZoneSection from './components/DangerZoneSection';

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

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const avatar = useAvatarUpload();
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (!session?.user) return;

    if (session.user.image) avatar.setUrl(session.user.image);

    (async () => {
      try {
        const res = await fetch('/api/user/stats');
        if (res.ok) setAccountStats(await res.json());
      } catch {}
    })();

    const savedTheme = localStorage.getItem('infohub-theme');
    if (savedTheme === 'light') setTheme('light');
  }, [session]);

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

  if (!session) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="flex flex-col items-center justify-center py-20 text-white">
          <div className="text-neutral-400 text-sm mb-3">Log in to access settings</div>
          <a href="/login" className="px-4 py-2 rounded-lg bg-hub-yellow text-black text-sm font-medium hover:brightness-110 transition-all">
            Log In
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  const email = session.user?.email || '';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-6">
          <ProfileHeroSection session={session} avatar={avatar} accountStats={accountStats} />
          <ConnectedAccountsSection connectedProviders={accountStats?.connectedProviders ?? []} />
          <SecuritySection />
          <TwoFactorSection email={email} />
          <NotificationsSection email={email} />

          {/* Display (theme toggle — tiny, kept inline) */}
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
              <button onClick={handleThemeToggle} className="text-neutral-400 hover:text-white transition-colors">
                {theme === 'dark' ? <ToggleLeft className="w-6 h-6" /> : <ToggleRight className="w-6 h-6 text-hub-yellow" />}
              </button>
            </div>
          </div>

          <DataExportSection />
          <DangerZoneSection />

          <div className="p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            <p className="text-neutral-500 text-xs leading-relaxed">
              Your profile and settings are synced to the cloud across all devices.
              Alerts are checked server-side every 5 minutes.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
