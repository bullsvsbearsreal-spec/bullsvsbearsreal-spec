'use client';

import { useState } from 'react';
import ConfirmModal from './ConfirmModal';
import { useToast } from './Toast';

interface ActionState {
  loading: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'error';
}

const ICONS = {
  cache: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  health: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  broadcast: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
    </svg>
  ),
  snapshot: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  ),
};

interface ActionsTabProps {
  userRole?: string;
}

export default function ActionsTab({ userRole }: ActionsTabProps) {
  const isFullAdmin = userRole === 'admin';
  const toast = useToast();
  const [states, setStates] = useState<Record<string, ActionState>>({
    cache: { loading: false },
    health: { loading: false },
    broadcast: { loading: false },
    snapshot: { loading: false },
  });
  const [confirm, setConfirm] = useState<{ key: string; title: string; desc: string; danger: boolean } | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastChannels, setBroadcastChannels] = useState<string[]>(['push', 'telegram']);

  const setActionState = (key: string, patch: Partial<ActionState>) => {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const runAction = async (key: string, url: string, body?: object) => {
    setActionState(key, { loading: true });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setActionState(key, { loading: false, lastRun: new Date().toISOString(), lastStatus: 'success' });
      return data;
    } catch (err: any) {
      setActionState(key, { loading: false, lastRun: new Date().toISOString(), lastStatus: 'error' });
      toast.error(err.message || 'Action failed');
      return null;
    }
  };

  const handleFlushCache = () => {
    setConfirm({
      key: 'cache',
      title: 'Flush API Cache',
      desc: 'This will delete all cached API responses. The next requests will be slower until the cache repopulates.',
      danger: true,
    });
  };

  const handleHealthCheck = async () => {
    const data = await runAction('health', '/api/admin/actions/health-check');
    if (data?.success) {
      const status = data.healthResult?.status;
      if (status === 'healthy') toast.success('System healthy');
      else if (status === 'degraded') toast.info(`Health: degraded — ${data.healthResult?.errors?.length ?? 0} exchange errors`);
      else toast.info(`Health: ${status} — ${data.healthResult?.errors?.length ?? 0} errors`);
    }
  };

  const handleBroadcast = () => {
    setBroadcastOpen(true);
  };

  const handleTriggerSnapshot = async () => {
    const data = await runAction('snapshot', '/api/admin/actions/trigger-snapshot');
    if (data?.success) {
      const r = data.result || {};
      toast.success(`Snapshot done — ${r.fundingInserted ?? 0} funding, ${r.oiInserted ?? 0} OI, ${r.liqInserted ?? 0} liq`);
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const { key } = confirm;
    setConfirm(null);
    if (key === 'cache') {
      const data = await runAction('cache', '/api/admin/actions/flush-cache');
      if (data?.success) toast.success(`Cache flushed: ${data.clearedEntries} entries cleared`);
    }
  };

  const submitBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcastOpen(false);
    const data = await runAction('broadcast', '/api/admin/actions/broadcast', {
      message: broadcastMsg.trim(),
      channels: broadcastChannels,
    });
    if (data?.success) {
      const parts: string[] = [];
      if (data.push) parts.push(`Push: ${data.push.sent} sent`);
      if (data.telegram) parts.push(`Telegram: ${data.telegram.sent} sent`);
      toast.success(parts.join(', ') || 'Broadcast sent');
      setBroadcastMsg('');
    }
  };

  const fmtTime = (iso?: string) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const actions = [
    { key: 'cache', icon: ICONS.cache, label: 'Flush Cache', desc: 'Clear all cached API responses', handler: handleFlushCache, color: 'text-red-400', adminOnly: true },
    { key: 'health', icon: ICONS.health, label: 'Health Check', desc: 'Run full system health check', handler: handleHealthCheck, color: 'text-emerald-400', adminOnly: false },
    { key: 'broadcast', icon: ICONS.broadcast, label: 'Broadcast', desc: 'Send notification to all users', handler: handleBroadcast, color: 'text-blue-400', adminOnly: true },
    { key: 'snapshot', icon: ICONS.snapshot, label: 'Trigger Snapshot', desc: 'Trigger a data collection cycle', handler: handleTriggerSnapshot, color: 'text-hub-yellow', adminOnly: false },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((a) => {
          const st = states[a.key];
          const locked = a.adminOnly && !isFullAdmin;
          return (
            <button
              key={a.key}
              onClick={locked ? undefined : a.handler}
              disabled={st.loading || locked}
              className={`text-left rounded-lg border p-4 transition-colors disabled:opacity-60 ${
                locked
                  ? 'border-white/[0.04] bg-white/[0.01] cursor-not-allowed'
                  : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={locked ? 'text-neutral-600' : a.color}>{a.icon}</span>
                <span className={`text-sm font-medium ${locked ? 'text-neutral-500' : 'text-white'}`}>{a.label}</span>
                {locked && (
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-600 font-medium">ADMIN ONLY</span>
                )}
                {st.loading && (
                  <svg className="w-3.5 h-3.5 animate-spin text-neutral-400 ml-auto" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-neutral-500">{a.desc}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-600">
                <span>Last: {fmtTime(st.lastRun)}</span>
                {st.lastStatus && (
                  <span className={st.lastStatus === 'success' ? 'text-emerald-600' : 'text-red-600'}>
                    {st.lastStatus === 'success' ? 'OK' : 'FAIL'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirm modal for dangerous actions */}
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title ?? ''}
        description={confirm?.desc}
        danger={confirm?.danger ?? false}
        confirmLabel="Yes, proceed"
        loading={states[confirm?.key ?? '']?.loading ?? false}
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />

      {/* Broadcast modal */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBroadcastOpen(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-xl border border-white/[0.1] bg-[#111] p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-3">Broadcast Notification</h3>
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Message to send..."
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/50 resize-none"
            />
            <div className="mt-2 flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastChannels.includes('push')}
                  onChange={(e) =>
                    setBroadcastChannels((ch) =>
                      e.target.checked ? [...ch, 'push'] : ch.filter((c) => c !== 'push'),
                    )
                  }
                  className="rounded border-white/20 bg-white/5 text-hub-yellow focus:ring-hub-yellow/30"
                />
                Push
              </label>
              <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastChannels.includes('telegram')}
                  onChange={(e) =>
                    setBroadcastChannels((ch) =>
                      e.target.checked ? [...ch, 'telegram'] : ch.filter((c) => c !== 'telegram'),
                    )
                  }
                  className="rounded border-white/20 bg-white/5 text-hub-yellow focus:ring-hub-yellow/30"
                />
                Telegram
              </label>
              <span className="ml-auto text-[10px] text-neutral-600">{broadcastMsg.length}/500</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setBroadcastOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.1] text-neutral-300 hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                onClick={submitBroadcast}
                disabled={!broadcastMsg.trim() || broadcastChannels.length === 0 || states.broadcast.loading}
                className="px-3 py-1.5 text-xs rounded-lg font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
              >
                {states.broadcast.loading ? 'Sending...' : 'Send Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
