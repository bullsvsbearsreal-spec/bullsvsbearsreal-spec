'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, X, Info, CheckCheck } from 'lucide-react';
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
  switch (metric) {
    case 'price':
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    case 'fundingRate':
      return `${value.toFixed(4)}%`;
    case 'openInterest':
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      return `$${value.toLocaleString()}`;
    case 'change24h':
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
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

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [triggered, setTriggered] = useState<TriggeredAlert[]>([]);
  const [showForm, setShowForm] = useState(false);

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

  const undismissedCount = triggered.filter((t) => !t.dismissed).length;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#0a0a0a] text-white page-enter">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
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

          {/* Create Alert Form */}
          {showForm && (
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">Create Alert</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                        ? 'bg-[#0d0d0d] border-white/[0.04] opacity-60'
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
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-8 text-center">
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
                        ? 'bg-[#0d0d0d] border-white/[0.06]'
                        : 'bg-[#0d0d0d] border-white/[0.04] opacity-50'
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

          {/* Info footer */}
          <div className="mt-8 bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 border-l-2 border-l-hub-yellow">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
              <div className="text-xs text-neutral-400 space-y-1">
                <p>
                  <strong className="text-neutral-300">Alert System</strong> checks your conditions
                  against live market data every 60 seconds while InfoHub is open.
                </p>
                <p>
                  Alerts are stored in your browser&apos;s localStorage. Enable browser notifications
                  for desktop pop-ups when conditions trigger.
                </p>
                <p>
                  Tip: Set funding rate alerts to catch high-funding opportunities for carry trades,
                  or price alerts below key support levels.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
