'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, X, CheckCheck, Mail, Clock, Settings2, LogIn, Smartphone } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import Link from 'next/link';
import { TokenIconSimple } from '@/components/TokenIcon';
import {
  type Alert,
  type TriggeredAlert,
  type AlertMetric,
  type AlertOperator,
  METRIC_LABELS,
  getAlerts,
  addAlert,
  deleteAlert,
  toggleAlert,
  getTriggeredAlerts,
  dismissTriggeredAlert,
  dismissAllTriggered,
  clearTriggered,
} from '@/lib/storage/alerts';

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatMetricValue(metric: AlertMetric, value: number): string {
  const abs = Math.abs(value);
  switch (metric) {
    case 'price':
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    case 'fundingRate':
      return `${value.toFixed(4)}%`;
    case 'openInterest':
    case 'volume24h':
    case 'liquidations24h':
      if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
      return `$${value.toLocaleString()}`;
    case 'change24h':
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    default:
      return String(value);
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─── Component ──────────────────────────────────────────────────── */

const COOLDOWN_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
];

function PushToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  if (!isSupported) return null;
  const denied = permission === 'denied';
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-neutral-400" />
        <div>
          <p className="text-sm text-white">Push notifications</p>
          <p className="text-xs text-neutral-600">
            {denied ? 'Blocked — enable in browser settings' : 'Get browser push when alerts trigger'}
          </p>
        </div>
      </div>
      <button
        onClick={() => isSubscribed ? unsubscribe() : subscribe()}
        disabled={isLoading || denied}
        className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        ) : isSubscribed ? (
          <ToggleRight className="w-6 h-6 text-hub-yellow" />
        ) : (
          <ToggleLeft className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}

export default function AlertsPage() {
  const { data: session } = useSession();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [triggered, setTriggered] = useState<TriggeredAlert[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Notification preferences
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Form state
  const [formSymbol, setFormSymbol] = useState('BTC');
  const [formMetric, setFormMetric] = useState<AlertMetric>('price');
  const [formOperator, setFormOperator] = useState<AlertOperator>('gt');
  const [formValue, setFormValue] = useState('');

  const refresh = useCallback(() => {
    setAlerts(getAlerts());
    setTriggered(getTriggeredAlerts());
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Load notification prefs from DB when logged in
  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) return;
        const json = await res.json();
        const prefs = json.notificationPrefs;
        if (prefs) {
          setEmailEnabled(prefs.email ?? true);
          setCooldownMinutes(prefs.cooldownMinutes ?? 60);
        }
      } catch {}
    })();
  }, [session]);

  const handleAdd = () => {
    const val = parseFloat(formValue);
    if (!formSymbol.trim() || isNaN(val)) return;
    addAlert({
      symbol: formSymbol.toUpperCase().trim(),
      metric: formMetric,
      operator: formOperator,
      value: val,
      enabled: true,
    });
    setFormValue('');
    setShowForm(false);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteAlert(id);
    refresh();
  };

  const handleToggle = (id: string) => {
    toggleAlert(id);
    refresh();
  };

  const handleDismiss = (alertId: string) => {
    dismissTriggeredAlert(alertId);
    refresh();
  };

  const handleDismissAll = () => {
    dismissAllTriggered();
    refresh();
  };

  const handleClearTriggered = () => {
    clearTriggered();
    refresh();
  };

  const saveNotificationPrefs = async (email: boolean, cooldown: number) => {
    setPrefsSaving(true);
    try {
      const res = await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPrefs: { email, cooldownMinutes: cooldown },
        }),
      });
      if (!res.ok) console.warn('Failed to save notification prefs:', res.status);
    } catch (e) {
      console.warn('Failed to save notification prefs:', e);
    }
    setPrefsSaving(false);
  };

  const undismissedCount = triggered.filter((t) => !t.dismissed).length;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="heading-page flex items-center gap-2">
                <Bell className="w-6 h-6 text-hub-yellow" />
                Alerts
                {undismissedCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-xs font-bold text-white">
                    {undismissedCount}
                  </span>
                )}
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Set conditions on price, funding rate, OI, or 24h change. Checked every 60 seconds.
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-hub-yellow text-black text-sm font-semibold hover:bg-hub-yellow-light transition-colors"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'New Alert'}
            </button>
          </div>

          {/* Sign-in banner for email alerts */}
          {!session && (
            <div className="flex items-center gap-3 bg-hub-yellow/5 border border-hub-yellow/15 rounded-xl px-4 py-3 mb-6">
              <Mail className="w-5 h-5 text-hub-yellow flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">Get email alerts</p>
                <p className="text-xs text-neutral-500">Sign in to receive email notifications when your alerts trigger.</p>
              </div>
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hub-yellow text-black text-xs font-semibold hover:bg-hub-yellow-light transition-colors flex-shrink-0"
              >
                <LogIn className="w-3 h-3" />
                Sign in
              </Link>
            </div>
          )}

          {/* Create Alert Form */}
          {showForm && (
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">Create Alert</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Symbol</label>
                  <input
                    type="text"
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value)}
                    placeholder="BTC"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Metric</label>
                  <select
                    value={formMetric}
                    onChange={(e) => setFormMetric(e.target.value as AlertMetric)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-hub-yellow/50"
                  >
                    <option value="price">Price</option>
                    <option value="fundingRate">Funding Rate</option>
                    <option value="openInterest">Open Interest</option>
                    <option value="change24h">24h Change</option>
                    <option value="volume24h">24h Volume</option>
                    <option value="liquidations24h">24h Liquidations</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Condition</label>
                  <select
                    value={formOperator}
                    onChange={(e) => setFormOperator(e.target.value as AlertOperator)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-hub-yellow/50"
                  >
                    <option value="gt">Greater than</option>
                    <option value="lt">Less than</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Value</label>
                  <input
                    type="number"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="100000"
                    step="any"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/50"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAdd}
                    disabled={!formSymbol.trim() || !formValue}
                    className="w-full px-4 py-2 rounded-lg bg-hub-yellow text-black text-sm font-semibold hover:bg-hub-yellow-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Triggered Alerts */}
          {triggered.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Triggered ({undismissedCount} new)
                </h2>
                <div className="flex gap-2">
                  {undismissedCount > 0 && (
                    <button
                      onClick={handleDismissAll}
                      className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" /> Dismiss all
                    </button>
                  )}
                  <button
                    onClick={handleClearTriggered}
                    className="text-xs text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {triggered.slice(0, 20).map((t, i) => (
                  <div
                    key={`${t.alertId}-${i}`}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      t.dismissed
                        ? 'bg-hub-darker border-white/[0.04] opacity-60'
                        : 'bg-red-500/[0.05] border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <TokenIconSimple symbol={t.symbol} size={20} />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {t.symbol} — {METRIC_LABELS[t.metric]}{' '}
                          <span className={t.operator === 'gt' ? 'text-green-400' : 'text-red-400'}>
                            {t.operator === 'gt' ? '>' : '<'} {t.threshold}
                          </span>
                        </p>
                        <p className="text-xs text-neutral-500">
                          Actual: {formatMetricValue(t.metric, t.actualValue)} · {timeAgo(t.triggeredAt)}
                        </p>
                      </div>
                    </div>
                    {!t.dismissed && (
                      <button
                        onClick={() => handleDismiss(t.alertId)}
                        className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-white/[0.06] transition-colors"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Alerts */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">Active Alerts ({alerts.length})</h2>
            {alerts.length === 0 ? (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-8 text-center">
                <Bell className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-400 text-sm">No alerts set up yet.</p>
                <p className="text-neutral-600 text-xs mt-1">
                  Click &quot;New Alert&quot; to create your first condition-based alert.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      alert.enabled
                        ? 'bg-hub-darker border-white/[0.06]'
                        : 'bg-hub-darker border-white/[0.04] opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <TokenIconSimple symbol={alert.symbol} size={20} />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {alert.symbol}{' '}
                          <span className="text-neutral-400">{METRIC_LABELS[alert.metric]}</span>{' '}
                          <span className={alert.operator === 'gt' ? 'text-green-400' : 'text-red-400'}>
                            {alert.operator === 'gt' ? '>' : '<'}
                          </span>{' '}
                          <span className="text-white font-mono">{formatMetricValue(alert.metric, alert.value)}</span>
                        </p>
                        <p className="text-xs text-neutral-600">
                          Created {new Date(alert.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(alert.id)}
                        className="text-neutral-400 hover:text-white transition-colors"
                        title={alert.enabled ? 'Disable' : 'Enable'}
                      >
                        {alert.enabled ? (
                          <ToggleRight className="w-6 h-6 text-hub-yellow" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="text-neutral-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notification Settings (logged-in users only) */}
          {session?.user && (
            <div className="mt-6 bg-hub-darker border border-white/[0.06] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4 text-hub-yellow" />
                Notification Settings
              </h2>
              <div className="space-y-4">
                {/* Email toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-neutral-400" />
                    <div>
                      <p className="text-sm text-white">Email notifications</p>
                      <p className="text-xs text-neutral-600">
                        Get emailed at {session.user.email} when alerts trigger
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !emailEnabled;
                      setEmailEnabled(next);
                      saveNotificationPrefs(next, cooldownMinutes);
                    }}
                    disabled={prefsSaving}
                    className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {emailEnabled ? (
                      <ToggleRight className="w-6 h-6 text-hub-yellow" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>

                {/* Push notifications toggle */}
                <PushToggle />

                {/* Cooldown selector */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-neutral-400" />
                    <div>
                      <p className="text-sm text-white">Cooldown period</p>
                      <p className="text-xs text-neutral-600">
                        Minimum time between repeated notifications for the same alert
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {COOLDOWN_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setCooldownMinutes(opt.value);
                          saveNotificationPrefs(emailEnabled, opt.value);
                        }}
                        disabled={prefsSaving}
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

              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-xs text-neutral-600">
                  Server-side alerts check every 5 minutes, even when your browser is closed. Your alerts are synced to the cloud automatically.
                </p>
              </div>
            </div>
          )}

          {/* Info footer */}
          <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            {session?.user ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-green-500 text-xs mt-0.5">&#9679;</span>
                  <p className="text-neutral-400 text-xs"><span className="text-neutral-300 font-medium">Server-side</span> — Checked every 5 min, triggers even when InfoHub is closed</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 text-xs mt-0.5">&#9679;</span>
                  <p className="text-neutral-400 text-xs"><span className="text-neutral-300 font-medium">Client-side</span> — Checked every 60s while this page is open</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-500 text-xs mt-0.5">&#9679;</span>
                  <p className="text-neutral-400 text-xs"><span className="text-neutral-300 font-medium">Delivery</span> — Email &amp; Telegram based on your notification settings</p>
                </div>
              </div>
            ) : (
              <p className="text-neutral-500 text-xs leading-relaxed">
                Alerts check live market data every 60s while this page is open. <span className="text-hub-yellow">Sign in</span> for 24/7 server-side alerts with email &amp; Telegram delivery.
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
