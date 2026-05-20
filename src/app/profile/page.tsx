'use client';

/**
 * /profile — user account dashboard
 *
 * Tabbed layout that consolidates everything user-facing about an
 * InfoHub account: profile bio + avatar, account stats, exchange/wallet
 * connections, API keys, notification preferences, recent activity,
 * display + currency preferences, referrals, billing, and danger-zone
 * actions (sign out everywhere / delete account).
 *
 * The Connections and API Keys tabs link out to the existing dedicated
 * pages (/account/connections, /account/api-keys) since those are
 * already feature-rich; this page provides a unified entry point and
 * surface for everything else.
 *
 * URL state: ?tab=<id> persists active tab so links/back-button work.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
// Image import removed — switched to plain <img> for Vercel Blob avatar URLs
// (next/image throws on hosts not in next.config.js remotePatterns).
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  User, Camera, Loader2, Trash2, Shield, Star, Bell, BarChart3,
  Activity, Clock, Save, Check, ChevronDown, Wallet, KeyRound,
  Settings, Gift, CreditCard, Send, AlertTriangle, ArrowRight,
  ExternalLink, LogOut, Sparkles, ShieldCheck, Mail, Zap, Crown,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils/format';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import {
  resolveUserTier,
  TIER_BRANDING,
  TIER_LIMITS,
  TIER_PRICE_MONTHLY,
  type Tier,
} from '@/lib/constants/tiers';

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

type TabId =
  | 'overview' | 'connections' | 'api-keys' | 'notifications'
  | 'activity' | 'preferences' | 'referrals' | 'billing' | 'danger';

const TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
}> = [
  { id: 'overview',      label: 'Overview',      icon: User },
  { id: 'connections',   label: 'Connections',   icon: Wallet },
  { id: 'api-keys',      label: 'API Keys',      icon: KeyRound },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'activity',      label: 'Activity',      icon: Activity },
  { id: 'preferences',   label: 'Preferences',   icon: Settings },
  { id: 'referrals',     label: 'Referrals',     icon: Gift },
  { id: 'billing',       label: 'Billing',       icon: CreditCard },
  { id: 'danger',        label: 'Danger Zone',   icon: Trash2, danger: true },
];

function ProfilePageInner() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const avatar = useAvatarUpload();

  // Active tab from URL param, default 'overview'
  const tabParam = (searchParams.get('tab') as TabId) || 'overview';
  const activeTab: TabId = TABS.find(t => t.id === tabParam) ? tabParam : 'overview';

  const setActiveTab = useCallback((id: TabId) => {
    const url = id === 'overview' ? '/profile' : `/profile?tab=${id}`;
    router.push(url, { scroll: false });
  }, [router]);

  // Bio
  const [bio, setBio] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  // Display prefs
  const [displayPrefs, setDisplayPrefs] = useState<DisplayPrefs>({
    currency: 'USD', defaultExchange: '', fundingDisplay: '8h',
  });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  // Account stats
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);

  // Sync avatar URL from session (only when session image changes, not during local preview)
  const sessionImage = session?.user?.image ?? null;
  const avatarHasUnsaved = avatar.hasUnsaved;
  const avatarSetUrl = avatar.setUrl;
  useEffect(() => {
    if (sessionImage && !avatarHasUnsaved) avatarSetUrl(sessionImage);
  }, [sessionImage, avatarHasUnsaved, avatarSetUrl]);

  // Load account stats + user data once on mount
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/stats', { signal: AbortSignal.timeout(10000) });
        if (res.ok && mounted) setAccountStats(await res.json());
      } catch {}
    })();
    (async () => {
      try {
        const res = await fetch('/api/user/data', { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (data.bio) setBio(data.bio);
        if (data.displayPrefs) setDisplayPrefs(prev => ({ ...prev, ...data.displayPrefs }));
      } catch {}
    })();
    return () => { mounted = false; };
  }, [userId]);

  const handleSaveBio = async () => {
    setBioSaving(true); setBioSaved(false); setBioError(null);
    try {
      const res = await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBioSaved(true);
      setTimeout(() => setBioSaved(false), 2000);
    } catch (e) {
      setBioError(e instanceof Error ? e.message : 'Failed to save bio');
    }
    setBioSaving(false);
  };

  const handleSavePrefs = async () => {
    setPrefsSaving(true); setPrefsSaved(false); setPrefsError(null);
    try {
      const res = await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayPrefs }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch (e) {
      setPrefsError(e instanceof Error ? e.message : 'Failed to save prefs');
    }
    setPrefsSaving(false);
  };

  // Loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main id="main-content" className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Unauth
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main id="main-content" className="max-w-[640px] mx-auto px-4 sm:px-6 py-12">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
            <Shield className="w-10 h-10 text-hub-yellow mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Sign in to view your profile</h1>
            <p className="text-sm text-neutral-400 mb-5">Track your watchlist, alerts, portfolios, and connected accounts in one place.</p>
            <Link
              href="/login?callbackUrl=/profile"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-hub-yellow text-black font-semibold text-sm hover:bg-hub-yellow/90 transition-colors"
            >
              Sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Trader';
  const userEmail = session?.user?.email ?? '';
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="text-white">
        {/* ─── Hero ───────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-white/[0.04]">
          <div className="absolute inset-0 opacity-[0.06]"
            style={{ background: 'radial-gradient(circle at 30% 30%, #eab308, transparent 60%)' }} />
          <div className="relative max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-start gap-5 flex-wrap">
              {/* Avatar */}
              <AvatarBlock avatar={avatar} updateSession={updateSession} />

              {/* Identity */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
                    {userName}
                  </h1>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-400/30">
                      <ShieldCheck className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-400/30">
                    <Sparkles className="w-3 h-3" />
                    Free plan
                  </span>
                </div>
                <p className="text-sm text-neutral-500 mt-1">{userEmail}</p>
                {accountStats?.memberSince && (
                  <p className="text-[11px] text-neutral-600 font-mono mt-1.5">
                    Member since {new Date(accountStats.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <StatCell icon={<Star className="w-3.5 h-3.5" />} label="Watchlist" value={accountStats?.watchlistCount ?? 0} />
              <StatCell icon={<Bell className="w-3.5 h-3.5" />} label="Alerts" value={accountStats?.alertCount ?? 0} />
              <StatCell icon={<BarChart3 className="w-3.5 h-3.5" />} label="Portfolios" value={accountStats?.portfolioCount ?? 0} />
              <StatCell icon={<Wallet className="w-3.5 h-3.5" />} label="Connected" value={accountStats?.connectedProviders.length ?? 0} />
            </div>
          </div>
        </section>

        {/* ─── Tab strip ─────────────────────────────────────────────── */}
        <div className="sticky top-14 z-20 bg-hub-black/85 backdrop-blur-md border-b border-white/[0.04]">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 py-2">
              {TABS.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? t.danger
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-400/30'
                          : 'bg-hub-yellow/10 text-hub-yellow border border-hub-yellow/30'
                        : t.danger
                          ? 'text-neutral-500 hover:text-rose-400 border border-transparent'
                          : 'text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Tab content ───────────────────────────────────────────── */}
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 pb-12">
          {activeTab === 'overview' && (
            <OverviewTab
              bio={bio} setBio={setBio} bioSaving={bioSaving} bioSaved={bioSaved} bioError={bioError} onSaveBio={handleSaveBio}
              userEmail={userEmail}
            />
          )}
          {activeTab === 'connections' && <ExternalLinkTab
            title="Wallets + Exchanges"
            description="Track positions across Hyperliquid, GMX, gTrade, Binance, Bybit, OKX, and Bitget. Connect a wallet (read-only address) or an API key — InfoHub never asks for withdrawal scopes."
            href="/account/connections" buttonLabel="Manage connections"
            stats={accountStats?.connectedProviders ?? []}
          />}
          {activeTab === 'api-keys' && <ExternalLinkTab
            title="InfoHub API Keys"
            description="Issue personal access tokens for the InfoHub v1 API. Use these to wire your own dashboards, bots, or scripts to the same data the web app sees."
            href="/developers#api-keys" buttonLabel="Manage API keys"
          />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'activity' && <ActivityTab notifications={accountStats?.recentNotifications ?? []} />}
          {activeTab === 'preferences' && (
            <PreferencesTab
              displayPrefs={displayPrefs} setDisplayPrefs={setDisplayPrefs}
              saving={prefsSaving} saved={prefsSaved} error={prefsError} onSave={handleSavePrefs}
            />
          )}
          {activeTab === 'referrals' && <ReferralsTab />}
          {activeTab === 'billing' && <BillingTab />}
          {activeTab === 'danger' && <DangerZoneTab />}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-hub-black"><Header /><div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 text-neutral-500 animate-spin" /></div><Footer /></div>}>
      <ProfilePageInner />
    </Suspense>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1">
        <span className="text-neutral-500">{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold font-mono tabular-nums text-white">{value}</div>
    </div>
  );
}

function AvatarBlock({ avatar, updateSession }: { avatar: ReturnType<typeof useAvatarUpload>; updateSession: ReturnType<typeof useSession>['update'] }) {
  return (
    <div className="relative group flex-shrink-0">
      <label htmlFor="avatar-upload" className="cursor-pointer block">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-white/[0.08] bg-gradient-to-br from-hub-yellow/15 to-hub-orange/10 flex items-center justify-center group-hover:border-hub-yellow/40 transition-colors">
          {avatar.url ? (
            // Plain <img> — next/image throws on hosts not in
            // remotePatterns. Vercel Blob ('*.public.blob.vercel-storage.com')
            // isn't in our allowlist, so any user with a custom-uploaded
            // avatar saw an empty dark square. (Same fix shipped on
            // /dashboard hero in an earlier round.)
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatar.url} alt="Avatar" width={96} height={96} className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-hub-yellow/60" />
          )}
        </div>
        <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center pointer-events-none">
          <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </label>
      <input
        id="avatar-upload" ref={avatar.inputRef} type="file" accept="image/*" className="hidden"
        onChange={async (e) => {
          if (!e.target.files?.[0]) return;
          avatar.handlePick(e);
          await avatar.handleSave();
          await updateSession();
        }}
      />
      {avatar.uploading && (
        <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-hub-yellow animate-spin" />
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, description, icon: Icon, children }: {
  title: string; description?: string; icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4">
      <header className="mb-4">
        <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-hub-yellow" />}
          {title}
        </h2>
        {description && <p className="text-xs text-neutral-500 mt-1">{description}</p>}
      </header>
      {children}
    </section>
  );
}

function OverviewTab({
  bio, setBio, bioSaving, bioSaved, bioError, onSaveBio, userEmail,
}: {
  bio: string; setBio: (s: string) => void; bioSaving: boolean; bioSaved: boolean; bioError: string | null;
  onSaveBio: () => void; userEmail: string;
}) {
  return (
    <>
      <SectionCard title="Profile" icon={User} description="Your public bio appears on shared screenshots and trader profile pages.">
        <textarea
          value={bio} onChange={(e) => setBio(e.target.value)}
          rows={3} maxLength={280}
          placeholder="A short bio — what you trade, your edge, anything."
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40 resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-neutral-600 font-mono">{bio.length}/280</span>
          <div className="flex items-center gap-3">
            {bioError && <span className="text-[11px] text-rose-400">{bioError}</span>}
            {bioSaved && <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
            <button
              onClick={onSaveBio} disabled={bioSaving}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-hub-yellow text-black hover:bg-hub-yellow/90 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              {bioSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save bio
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Account" icon={Mail} description="Email, password, and security settings.">
        <div className="text-sm text-neutral-300 mb-1">{userEmail}</div>
        <div className="text-[11px] text-neutral-500 mb-3">For email or password changes, contact support.</div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-hub-yellow hover:underline">
          Two-factor authentication settings <ArrowRight className="w-3 h-3" />
        </Link>
      </SectionCard>
    </>
  );
}

function ExternalLinkTab({ title, description, href, buttonLabel, stats }: {
  title: string; description: string; href: string; buttonLabel: string; stats?: string[];
}) {
  return (
    <SectionCard title={title} description={description}>
      {stats && stats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {stats.map((s) => (
            <span key={s} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 font-medium">
              {s}
            </span>
          ))}
        </div>
      )}
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-hub-yellow text-black text-sm font-semibold hover:bg-hub-yellow/90 transition-colors"
      >
        {buttonLabel} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </SectionCard>
  );
}

function NotificationsTab() {
  // Email notification toggles — persisted via PUT /api/user/data
  // (notificationPrefs key is already in the ALLOWED_KEYS whitelist on
  // the server). Optimistic local state for instant feedback; on PUT
  // failure we surface an inline error and revert.
  const [digest, setDigest] = useState(false);
  const [backup, setBackup] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing prefs once on mount
  useEffect(() => {
    let mounted = true;
    fetch('/api/user/data', { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!mounted) return;
        const p = j?.notificationPrefs;
        if (p) {
          setDigest(!!p.emailDailyDigest);
          setBackup(!!p.emailAlertBackup);
        }
        setLoaded(true);
      })
      .catch(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, []);

  // Single helper that PUTs a partial notificationPrefs patch. Optimistic:
  // we already updated local state; if the request fails we revert + show
  // the error message.
  const savePref = async (
    key: 'emailDailyDigest' | 'emailAlertBackup',
    nextValue: boolean,
    revert: () => void,
  ) => {
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationPrefs: { [key]: nextValue } }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      revert();
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <>
      <SectionCard title="Telegram bot" icon={Send} description="Get alerts pushed straight to Telegram. Link your account once and any alert you create will fire there.">
        <Link
          href="/account/security#telegram"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.1] text-sm text-white hover:bg-white/[0.04] transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Link Telegram
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </SectionCard>

      <SectionCard title="Push notifications" icon={Bell} description="Browser push for alerts when InfoHub is closed. Works on desktop + mobile (PWA install).">
        <div className="text-xs text-neutral-500 italic">Push permission is requested when you create your first alert.</div>
      </SectionCard>

      <SectionCard title="Email" icon={Mail} description="Plaintext email summaries — daily digest, alert backup, and account security notices.">
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2.5 text-neutral-300 cursor-not-allowed opacity-60">
            <input type="checkbox" defaultChecked disabled className="rounded border-white/20 bg-white/5 text-hub-yellow focus:ring-hub-yellow/30" />
            Security alerts (always on, recommended)
          </label>
          <label className="flex items-center gap-2.5 text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={digest}
              disabled={!loaded || savingKey === 'emailDailyDigest'}
              onChange={(e) => {
                const next = e.target.checked;
                const prev = digest;
                setDigest(next);
                savePref('emailDailyDigest', next, () => setDigest(prev));
              }}
              className="rounded border-white/20 bg-white/5 text-hub-yellow focus:ring-hub-yellow/30"
            />
            Daily market digest
            {savingKey === 'emailDailyDigest' && <Loader2 className="w-3 h-3 animate-spin text-neutral-500" />}
          </label>
          <label className="flex items-center gap-2.5 text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={backup}
              disabled={!loaded || savingKey === 'emailAlertBackup'}
              onChange={(e) => {
                const next = e.target.checked;
                const prev = backup;
                setBackup(next);
                savePref('emailAlertBackup', next, () => setBackup(prev));
              }}
              className="rounded border-white/20 bg-white/5 text-hub-yellow focus:ring-hub-yellow/30"
            />
            Backup alerts via email if Telegram is offline
            {savingKey === 'emailAlertBackup' && <Loader2 className="w-3 h-3 animate-spin text-neutral-500" />}
          </label>
        </div>
        {error && <div className="text-[11px] text-rose-400 mt-2">{error}</div>}
        <p className="text-[10px] text-neutral-600 mt-3 italic">Preferences save automatically. Telegram + push delivery are wired; email delivery for digest + backup is queued for the next batch.</p>
      </SectionCard>
    </>
  );
}

function ActivityTab({ notifications }: { notifications: AccountStats['recentNotifications'] }) {
  if (notifications.length === 0) {
    return (
      <SectionCard title="Recent activity" icon={Activity} description="Alerts and notifications fired by InfoHub on your behalf.">
        <div className="py-6 text-center text-xs text-neutral-600">
          No notifications fired yet. Set up an alert and they&apos;ll show here.
        </div>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Recent activity" icon={Activity} description={`Last ${notifications.length} notifications fired by InfoHub on your behalf.`}>
      <ul className="divide-y divide-white/[0.04]">
        {notifications.slice(0, 20).map((n, i) => (
          <li key={i} className="py-2.5 flex items-center gap-3 text-xs">
            <span className="font-mono font-bold text-white w-14 truncate">{n.symbol}</span>
            <span className="text-neutral-400">{n.metric} ≥ {n.threshold}</span>
            <span className="font-mono tabular-nums text-emerald-400">{n.actualValue}</span>
            <span className="ml-auto text-[10px] text-neutral-500 font-mono uppercase">{n.channel}</span>
            <span className="text-[10px] text-neutral-600 font-mono w-16 text-right">{formatTimeAgo(n.sentAt)}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function PreferencesTab({
  displayPrefs, setDisplayPrefs, saving, saved, error, onSave,
}: {
  displayPrefs: DisplayPrefs; setDisplayPrefs: React.Dispatch<React.SetStateAction<DisplayPrefs>>;
  saving: boolean; saved: boolean; error: string | null; onSave: () => void;
}) {
  return (
    <SectionCard title="Display preferences" icon={Settings} description="How prices, exchanges, and funding rates appear across the app.">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Currency</label>
          <div className="relative">
            <select
              value={displayPrefs.currency}
              onChange={(e) => setDisplayPrefs(p => ({ ...p, currency: e.target.value }))}
              className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-hub-yellow/40"
            >
              {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Default exchange</label>
          <input
            type="text" value={displayPrefs.defaultExchange}
            onChange={(e) => setDisplayPrefs(p => ({ ...p, defaultExchange: e.target.value }))}
            placeholder="e.g. Binance, Hyperliquid"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Funding display</label>
          <div className="relative">
            <select
              value={displayPrefs.fundingDisplay}
              onChange={(e) => setDisplayPrefs(p => ({ ...p, fundingDisplay: e.target.value }))}
              className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-hub-yellow/40"
            >
              {FUNDING_DISPLAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 mt-4">
        {error && <span className="text-[11px] text-rose-400">{error}</span>}
        {saved && <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
        <button
          onClick={onSave} disabled={saving}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-hub-yellow text-black hover:bg-hub-yellow/90 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save preferences
        </button>
      </div>
    </SectionCard>
  );
}

function ReferralsTab() {
  return (
    <SectionCard
      title="Referrals"
      icon={Gift}
      description="Two flavors: your personal invite link for bringing friends to InfoHub, and curated exchange affiliate links so you earn fee rebates while signing up to venues."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/invite"
          className="group rounded-lg border border-emerald-400/20 bg-emerald-500/[0.04] hover:border-emerald-400/40 hover:bg-emerald-500/[0.08] transition-colors p-4 flex flex-col"
        >
          <div className="inline-flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">Invite friends</span>
          </div>
          <p className="text-[12px] text-neutral-400 mb-3 leading-relaxed">
            Your personal share link. Track signups + verified accounts.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-300 group-hover:text-emerald-200">
            Get your link <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>

        <Link
          href="/referrals"
          className="group rounded-lg border border-hub-yellow/20 bg-hub-yellow/[0.04] hover:border-hub-yellow/40 hover:bg-hub-yellow/[0.08] transition-colors p-4 flex flex-col"
        >
          <div className="inline-flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-hub-yellow" />
            <span className="text-sm font-bold text-white">Exchange referrals</span>
          </div>
          <p className="text-[12px] text-neutral-400 mb-3 leading-relaxed">
            Curated affiliate links to Bybit, MEXC, Hyperliquid, and more.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-hub-yellow group-hover:text-hub-yellow/80">
            Browse partners <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      </div>
    </SectionCard>
  );
}

function BillingTab() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const billingTier = (session?.user as { billingTier?: string } | undefined)?.billingTier ?? null;
  // Admin role auto-resolves to whale regardless of billing_tier.
  // Non-admins read users.billing_tier (now in the JWT). Default 'free'
  // until NowPayments wires up paid signups.
  const tier = resolveUserTier({ role, billingTier });
  const branding = TIER_BRANDING[tier];
  const limits = TIER_LIMITS[tier];
  const monthlyPrice = TIER_PRICE_MONTHLY[tier];
  const TierIcon = branding.iconName === 'Sparkles' ? Sparkles
    : branding.iconName === 'Zap' ? Zap
    : Crown;

  // Launch state: Pro + Whale tiers are unlocked for everyone while we
  // onboard early users. Admin is grandfathered to Whale.
  const isAdminGrandfathered = role === 'admin';
  const isPaidTier = tier !== 'free';

  // Pick the "upgrade target" for the CTA — Free users get pointed at Pro,
  // Pro users at Whale, Whale users get a "you're at the top" state.
  const upgradeTarget: Tier | null = tier === 'free' ? 'pro' : tier === 'pro' ? 'whale' : null;
  const upgradeBranding = upgradeTarget ? TIER_BRANDING[upgradeTarget] : null;

  return (
    <SectionCard
      title="Plan + billing"
      icon={CreditCard}
      description={
        isAdminGrandfathered
          ? "Admin accounts are grandfathered to the Whale tier — all features unlocked, no billing."
          : "Pro + Whale tiers are free during launch — everyone gets unlimited everything while we onboard early users. See /pricing for what each tier will cost once we exit early access."
      }
    >
      {/* Current-tier card */}
      <div
        className={`rounded-lg border px-4 py-3.5 mb-4 ${
          tier === 'whale' ? 'border-amber-400/30 bg-amber-500/5'
          : tier === 'pro' ? 'border-emerald-400/30 bg-emerald-500/5'
          : 'border-white/[0.08] bg-white/[0.02]'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TierIcon className={`w-6 h-6 ${branding.textColor}`} aria-hidden />
            <div>
              <div className={`text-sm font-bold ${branding.textColor}`}>
                {branding.label} plan · active
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                {isAdminGrandfathered
                  ? 'Admin grandfather — no billing applies'
                  : isPaidTier
                  ? `Free during launch (normally $${monthlyPrice}/mo)`
                  : 'No card required — Free tier stays free forever'}
              </div>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold shrink-0">
            Current
          </span>
        </div>
      </div>

      {/* Tier limits summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <LimitTile
          label="API rate"
          value={Number.isFinite(limits.apiPerMinute) ? `${limits.apiPerMinute.toLocaleString()}/min` : 'Unlimited'}
        />
        <LimitTile
          label="Daily requests"
          value={Number.isFinite(limits.apiPerDay) ? limits.apiPerDay.toLocaleString() : 'Unlimited'}
        />
        <LimitTile
          label="Custom alerts"
          value={Number.isFinite(limits.maxAlerts) ? String(limits.maxAlerts) : 'Unlimited'}
        />
        <LimitTile
          label="Watched wallets"
          value={Number.isFinite(limits.maxWatchedWallets) ? String(limits.maxWatchedWallets) : 'Unlimited'}
        />
        <LimitTile
          label="Historical window"
          value={limits.historyDays >= 365 ? `${Math.round(limits.historyDays / 365)}y` : `${limits.historyDays}d`}
        />
        <LimitTile
          label="Plan price"
          value={monthlyPrice === 0 ? 'Free' : `$${monthlyPrice}/mo`}
        />
      </div>

      {/* Upgrade CTA (only if there's a higher tier to upgrade to and the
          user isn't already admin-grandfathered) */}
      {upgradeTarget && upgradeBranding && !isAdminGrandfathered && (
        <Link
          href="/pricing"
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 mb-3 transition-colors ${
            upgradeTarget === 'whale'
              ? 'border-amber-400/30 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
              : 'border-emerald-400/30 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]'
          }`}
        >
          <div>
            <div className={`text-[13px] font-bold ${upgradeBranding.textColor}`}>
              Upgrade to {upgradeBranding.label} — free during launch
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">{upgradeBranding.tagline}</div>
          </div>
          <ArrowRight className={`w-4 h-4 ${upgradeBranding.textColor} shrink-0`} aria-hidden />
        </Link>
      )}

      {/* Always-visible pricing link */}
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300 hover:text-emerald-200 font-semibold"
      >
        See the full pricing comparison
        <ArrowRight className="w-3 h-3" aria-hidden />
      </Link>

      <p className="text-[11px] text-neutral-600 italic mt-4">
        {isAdminGrandfathered
          ? "Admin tier is permanent — you'll never be billed regardless of how the public pricing evolves."
          : "Crypto checkout via NowPayments goes live when we exit early access. We'll email you ahead of time with the exact date."}
      </p>
    </SectionCard>
  );
}

function LimitTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</div>
      <div className="text-sm font-bold text-white mt-0.5">{value}</div>
    </div>
  );
}

function DangerZoneTab() {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSignOutEverywhere = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed: HTTP ${res.status}`);
      }
      // Account deleted — sign out + redirect home
      await signOut({ callbackUrl: '/' });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <>
      <SectionCard title="Sign out" icon={LogOut} description="End your session on this device, or all devices.">
        <button
          onClick={handleSignOutEverywhere}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.1] text-sm text-white hover:bg-white/[0.04] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out everywhere
        </button>
      </SectionCard>

      <section className="rounded-xl border border-rose-400/30 bg-rose-500/[0.04] p-5">
        <header className="mb-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Delete account
          </h2>
          <p className="text-xs text-neutral-400 mt-1.5 max-w-2xl">
            Permanently deletes your bio, watchlists, alerts, portfolio history, push subscriptions, 2FA setup, and connected accounts. This cannot be undone — your email becomes free for someone else to register, and any pending alerts will not fire.
          </p>
        </header>

        {!confirmingDelete && (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-400/30 text-sm font-semibold hover:bg-rose-500/25 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete my account…
          </button>
        )}

        {confirmingDelete && (
          <div className="space-y-3">
            <div className="text-sm text-rose-300 font-medium">Are you absolutely sure? This is permanent.</div>
            {deleteError && <div className="text-xs text-rose-400">{deleteError}</div>}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteAccount} disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Yes, delete forever
              </button>
              <button
                onClick={() => { setConfirmingDelete(false); setDeleteError(null); }}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-white/[0.1] text-sm text-neutral-300 hover:bg-white/[0.04] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
