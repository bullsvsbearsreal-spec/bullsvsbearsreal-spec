'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database, Heart, Send, Camera,
  RefreshCw, TrendingUp, Wallet, Activity, Bell,
  Trash2, Eraser, Wand2, AlertTriangle, CheckCircle2, XCircle,
  Clock, Shield, Settings,
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useToast } from './Toast';

interface ActionState {
  loading: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'error';
  lastResult?: string; // short human summary, e.g. "12 ETF days fetched"
}

interface AuditEvent {
  id: number;
  type: string;
  details: Record<string, unknown> | null;
  timestamp: string;
}

type Risk = 'safe' | 'destructive' | 'broadcast';

interface ActionDef {
  key: string;
  group: 'health' | 'data' | 'maintenance' | 'communications';
  icon: React.ReactNode;
  label: string;
  desc: string;
  risk: Risk;
  adminOnly: boolean;
  cron?: string; // if set, runs the trigger-cron generic endpoint
  customHandler?: string; // direct admin action endpoint
}

const ACTIONS: ActionDef[] = [
  // ─── Health ─────────────────────────────────────────────────────
  { key: 'health-check', group: 'health', icon: <Heart className="w-4 h-4" />, label: 'Health Check', desc: 'Run full system health check across all venues', risk: 'safe', adminOnly: false, customHandler: '/api/admin/actions/health-check' },
  { key: 'snapshot', group: 'health', icon: <Camera className="w-4 h-4" />, label: 'Trigger Snapshot', desc: 'Funding + OI + spread snapshot (cron: every 1m)', risk: 'safe', adminOnly: false, cron: 'snapshot' },

  // ─── Data refresh ───────────────────────────────────────────────
  { key: 'refresh-etf-flows', group: 'data', icon: <TrendingUp className="w-4 h-4" />, label: 'Refresh ETF Flows', desc: 'BTC + ETH ETF flows from Farside (cron: every 30m)', risk: 'safe', adminOnly: false, cron: 'refresh-etf-flows' },
  { key: 'refresh-validators', group: 'data', icon: <Activity className="w-4 h-4" />, label: 'Refresh Validators', desc: 'LST + restaking yields from DefiLlama (cron: every 30m)', risk: 'safe', adminOnly: false, cron: 'refresh-validators' },
  { key: 'warm-smart-money', group: 'data', icon: <Wallet className="w-4 h-4" />, label: 'Warm Smart Money', desc: 'Refresh top wallets PnL leaderboard (cron: every 25m)', risk: 'safe', adminOnly: false, cron: 'warm-smart-money' },
  { key: 'whale-trades', group: 'data', icon: <Activity className="w-4 h-4" />, label: 'Refresh Whale Trades', desc: 'Detect new whale DEX swaps (cron: every 2m)', risk: 'safe', adminOnly: false, cron: 'whale-trades' },
  { key: 'ingest-liquidations', group: 'data', icon: <Activity className="w-4 h-4" />, label: 'Ingest Liquidations', desc: 'Pull recent liq events into DB (cron: every 1m)', risk: 'safe', adminOnly: false, cron: 'ingest-liquidations' },
  { key: 'social-fetch', group: 'data', icon: <RefreshCw className="w-4 h-4" />, label: 'Refresh KOL Feed', desc: 'Twitter/X cache for /social KOL list (cron: every 15m)', risk: 'safe', adminOnly: false, cron: 'social-fetch' },

  // ─── Maintenance ────────────────────────────────────────────────
  { key: 'flush-cache', group: 'maintenance', icon: <Trash2 className="w-4 h-4" />, label: 'Flush API Cache', desc: 'Clear all cached API responses. Next requests will be slower.', risk: 'destructive', adminOnly: true, customHandler: '/api/admin/actions/flush-cache' },
  { key: 'backfill-spreads', group: 'maintenance', icon: <Wand2 className="w-4 h-4" />, label: 'Backfill Spreads', desc: 'Compute spread snapshots from existing ticker history', risk: 'safe', adminOnly: true, customHandler: '/api/admin/backfill-spreads' },
  { key: 'dedup-liquidations', group: 'maintenance', icon: <Eraser className="w-4 h-4" />, label: 'Dedup Liquidations', desc: 'Remove duplicate liq snapshot rows from DB', risk: 'destructive', adminOnly: true, customHandler: '/api/admin/dedup-liquidations' },

  // ─── Communications ─────────────────────────────────────────────
  { key: 'broadcast', group: 'communications', icon: <Send className="w-4 h-4" />, label: 'Broadcast Message', desc: 'Push + Telegram notification to all subscribers', risk: 'broadcast', adminOnly: true /* opens dedicated modal */ },
];

const GROUPS: Array<{ id: ActionDef['group']; label: string; description: string; icon: React.ReactNode }> = [
  { id: 'health',         label: 'System Health',  description: 'Surface health + force a fresh snapshot',                 icon: <Heart className="w-3.5 h-3.5" /> },
  { id: 'data',           label: 'Data Refresh',   description: 'Manually re-run a cron job that normally runs on a timer', icon: <RefreshCw className="w-3.5 h-3.5" /> },
  { id: 'maintenance',    label: 'Maintenance',    description: 'Cleanup + cache operations. Some are destructive.',        icon: <Settings className="w-3.5 h-3.5" /> },
  { id: 'communications', label: 'Communications', description: 'Reach connected users via push or Telegram',               icon: <Bell className="w-3.5 h-3.5" /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────
function relTime(iso?: string): string {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  if (ms < 5_000) return 'just now';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString();
}

function summariseResult(actionKey: string, data: any): string {
  if (!data) return '';
  // health-check
  if (actionKey === 'health-check') {
    const s = data.healthResult?.status;
    const errs = data.healthResult?.errors?.length ?? 0;
    return s ? `${s}${errs ? ` · ${errs} errors` : ''}` : '';
  }
  // flush-cache
  if (actionKey === 'flush-cache') return data.clearedEntries ? `${data.clearedEntries} entries cleared` : '';
  // broadcast
  if (actionKey === 'broadcast') {
    const parts: string[] = [];
    if (data.push) parts.push(`Push ${data.push.sent}`);
    if (data.telegram) parts.push(`TG ${data.telegram.sent}`);
    return parts.join(' · ');
  }
  // snapshot
  if (actionKey === 'snapshot') {
    const r = data.result || {};
    const parts: string[] = [];
    if (r.fundingInserted != null) parts.push(`fund ${r.fundingInserted}`);
    if (r.oiInserted != null) parts.push(`oi ${r.oiInserted}`);
    if (r.liqInserted != null) parts.push(`liq ${r.liqInserted}`);
    if (r.spreadInserted != null) parts.push(`spread ${r.spreadInserted}`);
    return parts.join(' · ') || (r.runType ?? '');
  }
  // generic cron triggered via /trigger-cron
  if (data.cronName && data.result) {
    const r = data.result;
    if (typeof r === 'object' && r.results) {
      // refresh-etf-flows shape
      const okCount = Object.values(r.results).filter((x: any) => x?.ok).length;
      const total = Object.keys(r.results).length;
      return `${okCount}/${total} ok · ${data.durationMs}ms`;
    }
    return `done · ${data.durationMs}ms`;
  }
  return '';
}

function StatusPill({ status }: { status?: 'success' | 'error' | 'loading' }) {
  if (status === 'loading') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      RUNNING
    </span>
  );
  if (status === 'success') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="w-2.5 h-2.5" /> OK
    </span>
  );
  if (status === 'error') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
      <XCircle className="w-2.5 h-2.5" /> FAIL
    </span>
  );
  return <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-500 border border-white/[0.06]">IDLE</span>;
}

function RiskBadge({ risk }: { risk: Risk }) {
  if (risk === 'destructive') return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25">
      <AlertTriangle className="w-2.5 h-2.5" /> destructive
    </span>
  );
  if (risk === 'broadcast') return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
      <Send className="w-2.5 h-2.5" /> mass-send
    </span>
  );
  return null;
}

interface ActionsTabProps { userRole?: string }

export default function ActionsTab({ userRole }: ActionsTabProps) {
  const isFullAdmin = userRole === 'admin';
  const toast = useToast();
  const [states, setStates] = useState<Record<string, ActionState>>(() =>
    Object.fromEntries(ACTIONS.map(a => [a.key, { loading: false }])),
  );
  const [confirm, setConfirm] = useState<ActionDef | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastChannels, setBroadcastChannels] = useState<string[]>(['push', 'telegram']);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const setActionState = (key: string, patch: Partial<ActionState>) => {
    setStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/admin/audit-log?limit=15', { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        setAudit(data.events ?? data ?? []);
      }
    } catch { /* non-critical */ }
    setAuditLoading(false);
  }, []);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const runAction = async (action: ActionDef, body?: object) => {
    setActionState(action.key, { loading: true });
    const url = action.cron ? '/api/admin/actions/trigger-cron' : action.customHandler!;
    const payload = action.cron ? { name: action.cron, ...(body ?? {}) } : body;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(60_000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action.label} failed`);
      const ok = data.success ?? data.ok ?? true;
      setActionState(action.key, {
        loading: false,
        lastRun: new Date().toISOString(),
        lastStatus: ok ? 'success' : 'error',
        lastResult: summariseResult(action.key, data),
      });
      if (ok) toast.success(`${action.label} done${summariseResult(action.key, data) ? ` — ${summariseResult(action.key, data)}` : ''}`);
      else toast.error(`${action.label} reported failure`);
      await fetchAudit();
      return data;
    } catch (err: any) {
      setActionState(action.key, {
        loading: false,
        lastRun: new Date().toISOString(),
        lastStatus: 'error',
        lastResult: err.message ?? '',
      });
      toast.error(err.message || `${action.label} failed`);
      return null;
    }
  };

  const handleClick = (action: ActionDef) => {
    if (action.adminOnly && !isFullAdmin) return;
    if (action.key === 'broadcast') { setBroadcastOpen(true); return; }
    if (action.risk === 'destructive') { setConfirm(action); return; }
    runAction(action);
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const action = confirm;
    setConfirm(null);
    await runAction(action);
  };

  // Broadcast uses its dedicated endpoint, not the generic trigger-cron path.
  const submitBroadcast = async () => {
    if (!broadcastMsg.trim() || broadcastChannels.length === 0) return;
    setBroadcastOpen(false);
    const broadcastAction: ActionDef = {
      ...ACTIONS.find(a => a.key === 'broadcast')!,
      customHandler: '/api/admin/actions/broadcast',
      cron: undefined,
    };
    const data = await runAction(broadcastAction, {
      message: broadcastMsg.trim(),
      channels: broadcastChannels,
    });
    if (data?.success) setBroadcastMsg('');
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="text-sm text-neutral-400">
          {isFullAdmin
            ? 'Trigger cron jobs, refresh data, send broadcasts, or run maintenance.'
            : 'Read-only view. Some actions require full admin role.'}
        </div>
        <button
          onClick={fetchAudit}
          disabled={auditLoading}
          className="text-xs text-neutral-500 hover:text-hub-yellow flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${auditLoading ? 'animate-spin' : ''}`} />
          Refresh activity
        </button>
      </div>

      {/* Action groups */}
      {GROUPS.map((group) => {
        const groupActions = ACTIONS.filter(a => a.group === group.id);
        if (groupActions.length === 0) return null;
        return (
          <section key={group.id}>
            <header className="flex items-baseline gap-2 mb-2 px-1">
              <span className="text-neutral-500">{group.icon}</span>
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-300">{group.label}</h3>
              <span className="text-[10px] text-neutral-600">— {group.description}</span>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {groupActions.map((a) => {
                const st = states[a.key];
                const locked = a.adminOnly && !isFullAdmin;
                const status: 'success' | 'error' | 'loading' | undefined =
                  st.loading ? 'loading' : st.lastStatus;
                return (
                  <button
                    key={a.key}
                    onClick={locked ? undefined : () => handleClick(a)}
                    disabled={st.loading || locked}
                    className={`text-left rounded-xl border p-3.5 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                      locked
                        ? 'border-white/[0.04] bg-white/[0.01]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]'
                    }`}
                    title={locked ? 'Requires full admin role' : a.desc}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className={locked ? 'text-neutral-600' : 'text-hub-yellow'}>{a.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-sm font-semibold ${locked ? 'text-neutral-500' : 'text-white'}`}>
                            {a.label}
                          </span>
                          <RiskBadge risk={a.risk} />
                          {locked && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-600 font-medium uppercase tracking-wider">
                              <Shield className="w-2.5 h-2.5 inline -mt-0.5 mr-0.5" />
                              admin
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 leading-snug mt-0.5">{a.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.04]">
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{relTime(st.lastRun)}</span>
                        {st.lastResult && (
                          <span className="text-neutral-600">· {st.lastResult}</span>
                        )}
                      </div>
                      <StatusPill status={status} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Recent activity feed */}
      <section>
        <header className="flex items-baseline gap-2 mb-2 px-1">
          <Activity className="w-3.5 h-3.5 text-neutral-500" />
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-300">Recent Activity</h3>
          <span className="text-[10px] text-neutral-600">— last 15 admin actions across all admins</span>
        </header>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {audit.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-neutral-500">
              {auditLoading ? 'Loading…' : 'No activity yet. Trigger an action above to populate.'}
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {audit.slice(0, 15).map((ev) => {
                const ok = ev.details?.ok === true || ev.details?.ok === 'true';
                const failed = ev.details?.ok === false;
                const admin = (ev.details?.admin as string) ?? 'unknown';
                const summary = (() => {
                  const d = ev.details ?? {};
                  if (d.error) return String(d.error);
                  if (d.durationMs) return `${d.durationMs}ms`;
                  if (d.fundingInserted != null) return `fund ${d.fundingInserted} · oi ${d.oiInserted ?? 0} · liq ${d.liqInserted ?? 0}`;
                  if (d.clearedEntries != null) return `${d.clearedEntries} entries cleared`;
                  return '';
                })();
                return (
                  <li key={ev.id} className="px-3 py-2 flex items-center gap-3 hover:bg-white/[0.02]">
                    {ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" /> :
                     failed ? <XCircle className="w-3 h-3 text-rose-500 flex-shrink-0" /> :
                     <Activity className="w-3 h-3 text-neutral-500 flex-shrink-0" />}
                    <span className="font-mono text-[11px] text-white truncate flex-shrink-0">{ev.type}</span>
                    {summary && <span className="font-mono text-[10px] text-neutral-500 truncate">{summary}</span>}
                    <span className="ml-auto text-[10px] text-neutral-600 flex-shrink-0">{admin}</span>
                    <span className="text-[10px] text-neutral-600 flex-shrink-0 w-16 text-right">{relTime(ev.timestamp)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Confirm modal for destructive actions */}
      <ConfirmModal
        open={!!confirm}
        title={confirm ? `Confirm: ${confirm.label}` : ''}
        description={confirm?.desc}
        danger={confirm?.risk === 'destructive'}
        confirmLabel="Yes, run it"
        loading={!!confirm && states[confirm.key]?.loading}
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />

      {/* Broadcast modal */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBroadcastOpen(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-xl border border-white/[0.1] bg-[#111] p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Broadcast Notification</h3>
              <RiskBadge risk="broadcast" />
            </div>
            <p className="text-[11px] text-neutral-500 mb-3">
              Sends to <strong className="text-neutral-300">every</strong> opted-in subscriber on the
              selected channels. There is no recall — be sure the message is correct.
            </p>
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
                  onChange={(e) => setBroadcastChannels((ch) => e.target.checked ? [...ch, 'push'] : ch.filter((c) => c !== 'push'))}
                  className="rounded border-white/20 bg-white/5 text-hub-yellow focus:ring-hub-yellow/30"
                />
                Push
              </label>
              <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastChannels.includes('telegram')}
                  onChange={(e) => setBroadcastChannels((ch) => e.target.checked ? [...ch, 'telegram'] : ch.filter((c) => c !== 'telegram'))}
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
                disabled={!broadcastMsg.trim() || broadcastChannels.length === 0 || states.broadcast?.loading}
                className="px-3 py-1.5 text-xs rounded-lg font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
              >
                {states.broadcast?.loading ? 'Sending…' : 'Send Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
