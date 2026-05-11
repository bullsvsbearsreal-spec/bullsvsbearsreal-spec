'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, X, CheckCheck, Mail, Clock, Settings2, Smartphone, MessageCircle, Hash, Crosshair, Target, Send, Copy, Check, Loader2, Unlink } from 'lucide-react';
import { SampleAlertsList } from '@/components/SampleDataPreview';
import AuthPromptBanner from '@/components/AuthPromptBanner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ALL_EXCHANGES } from '@/lib/constants';
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
      // Funding rate precision: use 4 decimals when |value| < 0.1% (typical
      // 8h-tick scale) and 2 decimals when ≥ 0.1% (the "spicy" range). Was
      // hardcoded to 4 decimals which produced "7.0000%" for a 7% threshold —
      // ugly trailing zeros that read as suspicious over-precision.
      return abs < 0.1
        ? `${value.toFixed(4)}%`
        : `${value.toFixed(2)}%`;
    case 'openInterest':
    case 'volume24h':
    case 'liquidations24h':
      if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
      return `$${value.toLocaleString()}`;
    case 'change24h':
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    case 'liqProximity':
    case 'tpProximity':
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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
  const { data: session, status } = useSession();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [triggered, setTriggered] = useState<TriggeredAlert[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Notification preferences
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [discordEditing, setDiscordEditing] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappEditing, setWhatsappEditing] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Telegram link state
  const [tgLinked, setTgLinked] = useState(false);
  const [tgActive, setTgActive] = useState(false);
  const [tgMutedUntil, setTgMutedUntil] = useState<string | null>(null);
  const [tgCode, setTgCode] = useState<string | null>(null);
  const [tgGenerating, setTgGenerating] = useState(false);
  const [tgUnlinking, setTgUnlinking] = useState(false);
  const [tgCopied, setTgCopied] = useState(false);
  const [tgEditing, setTgEditing] = useState(false);

  // Form state
  const [formSymbol, setFormSymbol] = useState('BTC');
  const [formMetric, setFormMetric] = useState<AlertMetric>('price');
  const [formOperator, setFormOperator] = useState<AlertOperator>('gt');
  const [formValue, setFormValue] = useState('');
  const [formExchange, setFormExchange] = useState('');
  const [formProximityPct, setFormProximityPct] = useState('10');
  const [formChannels, setFormChannels] = useState<string[]>([]);

  const isProximityMetric = formMetric === 'liqProximity' || formMetric === 'tpProximity';

  const toggleFormChannel = (ch: string) => {
    setFormChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };

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
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/data', { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const json = await res.json();
        const prefs = json.notificationPrefs;
        if (mounted && prefs) {
          setEmailEnabled(prefs.email ?? true);
          setCooldownMinutes(prefs.cooldownMinutes ?? 60);
          setDiscordEnabled(prefs.discordEnabled ?? false);
          setDiscordWebhookUrl(prefs.discordWebhookUrl ?? '');
          setWhatsappEnabled(prefs.whatsappEnabled ?? false);
          setWhatsappPhone(prefs.whatsappPhone ?? '');
        }
        // Telegram status comes bundled in user data (no extra fetch)
        if (mounted && json.telegramLink) {
          setTgLinked(json.telegramLink.linked);
          if (json.telegramLink.linked) {
            setTgActive(json.telegramLink.active);
            setTgMutedUntil(json.telegramLink.mutedUntil ?? null);
          }
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [session]);

  const tgGenerateCode = async () => {
    setTgGenerating(true);
    try {
      const res = await fetch('/api/telegram/link-code', { method: 'POST', signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const json = await res.json();
        setTgCode(json.code);
      }
    } catch {}
    setTgGenerating(false);
  };

  const tgCopyCode = async () => {
    if (!tgCode) return;
    try {
      await navigator.clipboard.writeText(`/start ${tgCode}`);
      setTgCopied(true);
      setTimeout(() => setTgCopied(false), 2000);
    } catch {}
  };

  const tgUnlink = async () => {
    setTgUnlinking(true);
    try {
      const res = await fetch('/api/telegram/link-code', { method: 'DELETE', signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        setTgLinked(false);
        setTgActive(false);
        setTgCode(null);
      }
    } catch {}
    setTgUnlinking(false);
  };

  const handleAdd = () => {
    const val = parseFloat(formValue);
    if (!formSymbol.trim() || isNaN(val)) return;
    const isProx = formMetric === 'liqProximity' || formMetric === 'tpProximity';
    addAlert({
      symbol: formSymbol.toUpperCase().trim(),
      metric: formMetric,
      operator: isProx ? 'lt' : formOperator,
      value: val,
      enabled: true,
      ...(formMetric === 'fundingRate' && formExchange ? { exchange: formExchange } : {}),
      ...(isProx ? { proximityPct: parseFloat(formProximityPct) || 10 } : {}),
      ...(formChannels.length > 0 ? { channels: formChannels } : {}),
    });
    setFormValue('');
    setFormExchange('');
    setFormChannels([]);
    setShowForm(false);
    refresh();
  };

  const startSuggestedAlert = (suggestion: {
    symbol: string;
    metric: AlertMetric;
    operator: AlertOperator;
    value: string;
    exchange?: string;
  }) => {
    setFormSymbol(suggestion.symbol);
    setFormMetric(suggestion.metric);
    setFormOperator(suggestion.operator);
    setFormValue(suggestion.value);
    setFormExchange(suggestion.exchange ?? '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const saveNotificationPrefs = async (overrides?: Record<string, any>) => {
    setPrefsSaving(true);
    try {
      const res = await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPrefs: {
            email: emailEnabled,
            cooldownMinutes,
            discordEnabled,
            discordWebhookUrl,
            whatsappEnabled,
            whatsappPhone,
            ...overrides,
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
      // Surface non-2xx so the user knows their notification toggle didn't
      // actually take effect (e.g. session expired). Browser console is
      // better than nothing — fully silent meant alerts kept firing for
      // people who thought they'd disabled them.
      if (!res.ok) console.error('[alerts] saveNotificationPrefs failed:', res.status);
    } catch (e) {
      console.error('[alerts] saveNotificationPrefs error:', e);
    }
    setPrefsSaving(false);
  };

  const undismissedCount = triggered.filter((t) => !t.dismissed).length;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="text-white">
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
            <AuthPromptBanner variant="email-alerts" dismissKey="alerts" className="mb-6" />
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
                    onChange={(e) => {
                      setFormMetric(e.target.value as AlertMetric);
                      if (e.target.value !== 'fundingRate') setFormExchange('');
                    }}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-hub-yellow/50"
                  >
                    <option value="price">Price</option>
                    <option value="fundingRate">Funding Rate</option>
                    <option value="openInterest">Open Interest</option>
                    <option value="change24h">24h Change</option>
                    <option value="volume24h">24h Volume</option>
                    <option value="liquidations24h">24h Liquidations</option>
                    <option value="liqProximity">Liquidation Proximity</option>
                    <option value="tpProximity">Take Profit Proximity</option>
                  </select>
                </div>
                {!isProximityMetric && (
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
                )}
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">
                    {isProximityMetric ? (formMetric === 'liqProximity' ? 'Liq Price' : 'TP Price') : 'Value'}
                  </label>
                  <input
                    type="number"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder={isProximityMetric ? '80000' : '100000'}
                    step="any"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/50"
                  />
                </div>
                {isProximityMetric && (
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Alert within %</label>
                    <select
                      value={formProximityPct}
                      onChange={(e) => setFormProximityPct(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-hub-yellow/50"
                    >
                      <option value="5">5%</option>
                      <option value="10">10%</option>
                      <option value="15">15%</option>
                      <option value="20">20%</option>
                      <option value="30">30%</option>
                    </select>
                  </div>
                )}
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
              {/* Exchange selector for per-exchange funding alerts */}
              {formMetric === 'fundingRate' && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <label className="text-xs text-neutral-500 block mb-1">Exchange (optional, leave blank for average)</label>
                  <select
                    value={formExchange}
                    onChange={(e) => setFormExchange(e.target.value)}
                    className="w-full max-w-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-hub-yellow/50"
                  >
                    <option value="">All exchanges (average)</option>
                    {ALL_EXCHANGES.map((ex) => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Proximity alert help text */}
              {isProximityMetric && (
                <p className="mt-3 text-xs text-neutral-600">
                  {formMetric === 'liqProximity'
                    ? 'Enter your liquidation price. You will be alerted when the current price is within your selected % of that level.'
                    : 'Enter your take profit price. You will be alerted when the current price is within your selected % of that level.'}
                </p>
              )}
              {/* Per-alert channel routing */}
              {status === 'authenticated' && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <label className="text-xs text-neutral-500 block mb-1.5">Notify via (empty = all channels)</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'email', label: 'Email', icon: Mail },
                      { key: 'telegram', label: 'Telegram', icon: Send },
                      { key: 'discord', label: 'Discord', icon: Hash },
                      { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                      { key: 'push', label: 'Push', icon: Smartphone },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleFormChannel(key)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors border ${
                          formChannels.includes(key)
                            ? 'bg-hub-yellow/20 border-hub-yellow/40 text-hub-yellow'
                            : 'bg-white/[0.03] border-white/[0.08] text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                            {t.operator === 'gt' ? '>' : '<'} {formatMetricValue(t.metric, t.threshold)}
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
                <div className="mt-5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-left">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-600">Quick starters</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      { label: 'BTC breaks above $80k', symbol: 'BTC', metric: 'price' as AlertMetric, operator: 'gt' as AlertOperator, value: '80000' },
                      { label: 'ETH drops below $2500', symbol: 'ETH', metric: 'price' as AlertMetric, operator: 'lt' as AlertOperator, value: '2500' },
                      { label: 'SOL funding overheats', symbol: 'SOL', metric: 'fundingRate' as AlertMetric, operator: 'gt' as AlertOperator, value: '0.05' },
                      { label: 'BTC OI cools off', symbol: 'BTC', metric: 'openInterest' as AlertMetric, operator: 'lt' as AlertOperator, value: '30000000000' },
                    ].map((suggestion) => (
                      <button
                        key={suggestion.label}
                        onClick={() => startSuggestedAlert(suggestion)}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-left text-xs text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>
                <SampleAlertsList />
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
                          <span className="text-neutral-400">
                            {METRIC_LABELS[alert.metric]}
                            {alert.exchange && <span className="text-hub-yellow"> ({alert.exchange})</span>}
                          </span>{' '}
                          {alert.metric === 'liqProximity' || alert.metric === 'tpProximity' ? (
                            <span className="text-hub-yellow">
                              within {alert.proximityPct ?? 10}% of{' '}
                              <span className="text-white font-mono">{formatMetricValue(alert.metric, alert.value)}</span>
                            </span>
                          ) : (
                            <>
                              <span className={alert.operator === 'gt' ? 'text-green-400' : 'text-red-400'}>
                                {alert.operator === 'gt' ? '>' : '<'}
                              </span>{' '}
                              <span className="text-white font-mono">{formatMetricValue(alert.metric, alert.value)}</span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-neutral-600 flex items-center gap-1.5 flex-wrap">
                          <span>Created {new Date(alert.createdAt).toLocaleDateString()}</span>
                          {alert.channels && alert.channels.length > 0 && (
                            <>
                              <span className="text-neutral-700">·</span>
                              {alert.channels.map((ch) => (
                                <span key={ch} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-500 text-[9px] uppercase">{ch}</span>
                              ))}
                            </>
                          )}
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
                      saveNotificationPrefs({ email: next });
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

                {/* Telegram */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-neutral-400" />
                    <div>
                      <p className="text-sm text-white">Telegram notifications</p>
                      <p className="text-xs text-neutral-600">
                        {tgLinked
                          ? tgActive
                            ? tgMutedUntil ? `Muted until ${new Date(tgMutedUntil).toLocaleString()}` : 'Linked & receiving alerts'
                            : 'Paused — send /start to the bot to resume'
                          : 'Link via @InfoHubRadarBot'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tgLinked ? (
                      <>
                        <span className={`w-2 h-2 rounded-full ${tgActive ? 'bg-green-500' : 'bg-neutral-600'}`} />
                        <button
                          onClick={tgUnlink}
                          disabled={tgUnlinking}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          {tgUnlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setTgEditing(!tgEditing)}
                        className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        {tgEditing ? 'Close' : 'Setup'}
                      </button>
                    )}
                  </div>
                </div>
                {tgEditing && !tgLinked && (
                  <div className="ml-6 space-y-2">
                    {tgCode ? (
                      <>
                        <p className="text-xs text-neutral-500">
                          Send this to{' '}
                          <a href="https://t.me/InfoHubRadarBot" target="_blank" rel="noopener noreferrer" className="text-hub-yellow hover:underline">
                            @InfoHubRadarBot
                          </a>{' '}
                          on Telegram:
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-hub-yellow font-mono select-all">
                            /start {tgCode}
                          </code>
                          <button
                            onClick={tgCopyCode}
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
                          >
                            {tgCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="text-xs text-neutral-600">Expires in 10 minutes</p>
                      </>
                    ) : (
                      <button
                        onClick={tgGenerateCode}
                        disabled={tgGenerating}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-[#2AABEE]/10 border border-[#2AABEE]/20 text-[#2AABEE] hover:bg-[#2AABEE]/20 transition-colors disabled:opacity-50"
                      >
                        {tgGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Generate Link Code
                      </button>
                    )}
                  </div>
                )}

                {/* Discord webhook */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-neutral-400" />
                    <div>
                      <p className="text-sm text-white">Discord notifications</p>
                      <p className="text-xs text-neutral-600">
                        {discordWebhookUrl ? 'Webhook configured' : 'Paste a Discord channel webhook URL'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDiscordEditing(!discordEditing)}
                      className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      {discordEditing ? 'Close' : 'Setup'}
                    </button>
                    {discordWebhookUrl && (
                      <button
                        onClick={() => {
                          const next = !discordEnabled;
                          setDiscordEnabled(next);
                          saveNotificationPrefs({ discordEnabled: next });
                        }}
                        disabled={prefsSaving}
                        className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                      >
                        {discordEnabled ? <ToggleRight className="w-6 h-6 text-[#5865F2]" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                    )}
                  </div>
                </div>
                {discordEditing && (
                  <div className="ml-6 space-y-2">
                    <input
                      type="url"
                      value={discordWebhookUrl}
                      onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:border-[#5865F2]/50 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        setDiscordEditing(false);
                        if (discordWebhookUrl) setDiscordEnabled(true);
                        saveNotificationPrefs({ discordWebhookUrl, discordEnabled: !!discordWebhookUrl });
                      }}
                      disabled={prefsSaving}
                      className="px-3 py-1 rounded-md text-xs font-medium bg-[#5865F2] text-white hover:bg-[#4752c4] transition-colors disabled:opacity-50"
                    >
                      Save Webhook
                    </button>
                  </div>
                )}

                {/* WhatsApp */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-neutral-400" />
                    <div>
                      <p className="text-sm text-white">WhatsApp notifications</p>
                      <p className="text-xs text-neutral-600">
                        {whatsappPhone ? `Sending to ${whatsappPhone}` : 'Enter your WhatsApp phone number'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWhatsappEditing(!whatsappEditing)}
                      className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      {whatsappEditing ? 'Close' : 'Setup'}
                    </button>
                    {whatsappPhone && (
                      <button
                        onClick={() => {
                          const next = !whatsappEnabled;
                          setWhatsappEnabled(next);
                          saveNotificationPrefs({ whatsappEnabled: next });
                        }}
                        disabled={prefsSaving}
                        className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                      >
                        {whatsappEnabled ? <ToggleRight className="w-6 h-6 text-[#25D366]" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                    )}
                  </div>
                </div>
                {whatsappEditing && (
                  <div className="ml-6 space-y-2">
                    <input
                      type="tel"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder="+1234567890 (E.164 format)"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:border-[#25D366]/50 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        setWhatsappEditing(false);
                        if (whatsappPhone) setWhatsappEnabled(true);
                        saveNotificationPrefs({ whatsappPhone, whatsappEnabled: !!whatsappPhone });
                      }}
                      disabled={prefsSaving}
                      className="px-3 py-1 rounded-md text-xs font-medium bg-[#25D366] text-black hover:bg-[#1da851] transition-colors disabled:opacity-50"
                    >
                      Save Phone
                    </button>
                  </div>
                )}

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
                          saveNotificationPrefs({ cooldownMinutes: opt.value });
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
                  <p className="text-neutral-400 text-xs"><span className="text-neutral-300 font-medium">Delivery</span> — Email, Telegram, Discord &amp; WhatsApp based on your notification settings</p>
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
      <ReferralBanner />
      <Footer />
    </div>
  );
}
