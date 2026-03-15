'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Users, Database, Bell, Activity, RefreshCw, Trash2, Radio, Send,
  Server, AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp,
  MessageSquare, Smartphone, Mail, BarChart3, Zap, Shield,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────

interface Stats {
  totals: {
    users: number;
    alertNotifications: number;
    fundingSnapshots: number;
    oiSnapshots: number;
    liquidationSnapshots: number;
    telegramUsers: number;
    pushSubscriptions: number;
  };
  last24h: {
    alertNotifications: number;
    fundingSnapshots: number;
    liquidationSnapshots: number;
  };
  trends: {
    alerts: number[];
    funding: number[];
    oi: number[];
    liquidations: number[];
  };
  dbSize: string;
}

interface ExchangeHealth {
  name: string;
  status: 'ok' | 'error' | 'empty' | 'circuit-open';
  count: number;
  latencyMs: number;
  error?: string;
}

interface PipelineData {
  exchanges: {
    funding: ExchangeHealth[];
    oi: ExchangeHealth[];
  };
  anomalies: Array<{ type: string; symbol: string; exchange: string; detail: string }>;
  coverage: { totalSymbols: number; exchanges: number };
  collector?: { lastRun: string; status: string };
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  lastLogin?: string;
}

// ─── Sparkline ─────────────────────────────────────────────────────

function Sparkline({ data, color = '#f5a623' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-6" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, trend, trendColor }: {
  icon: any; label: string; value: string | number; sub?: string;
  trend?: number[]; trendColor?: string;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-neutral-400 text-xs">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xl font-semibold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
          {sub && <div className="text-xs text-neutral-500 mt-0.5">{sub}</div>}
        </div>
        {trend && <Sparkline data={trend} color={trendColor} />}
      </div>
    </div>
  );
}

// ─── Exchange Health Table ─────────────────────────────────────────

function ExchangeTable({ title, data }: { title: string; data: ExchangeHealth[] }) {
  if (!data || data.length === 0) return null;
  const sorted = [...data].sort((a, b) => {
    const order = { ok: 0, empty: 1, error: 2, 'circuit-open': 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-3">{title}</h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {sorted.map(ex => (
          <div key={ex.name} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-neutral-800">
            <div className="flex items-center gap-2">
              {ex.status === 'ok' ? <CheckCircle className="w-3 h-3 text-green-500" /> :
               ex.status === 'empty' ? <AlertTriangle className="w-3 h-3 text-yellow-500" /> :
               <XCircle className="w-3 h-3 text-red-500" />}
              <span className="text-neutral-300">{ex.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-neutral-500">{ex.count} pairs</span>
              <span className="text-neutral-600 w-14 text-right">{ex.latencyMs}ms</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Actions Panel ─────────────────────────────────────────────────

function ActionsPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const runAction = async (path: string, label: string) => {
    setLoading(label);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/actions/${path}`, { method: 'POST' });
      const data = await res.json();
      setResult(`${label}: ${res.ok ? 'OK' : 'Failed'} — ${JSON.stringify(data).slice(0, 100)}`);
    } catch (e) {
      setResult(`${label}: Error — ${e instanceof Error ? e.message : 'unknown'}`);
    }
    setLoading(null);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => runAction('trigger-snapshot', 'Snapshot')}
          disabled={loading !== null}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading === 'Snapshot' ? 'animate-spin' : ''}`} /> Trigger Snapshot
        </button>
        <button
          onClick={() => runAction('flush-cache', 'Cache Flush')}
          disabled={loading !== null}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" /> Flush Cache
        </button>
        <button
          onClick={() => runAction('health-check', 'Health Check')}
          disabled={loading !== null}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 disabled:opacity-50"
        >
          <Activity className="w-3 h-3" /> Health Check
        </button>
      </div>
      {result && (
        <div className="mt-3 p-2 bg-neutral-800 rounded text-xs text-neutral-400 break-all">
          {result}
        </div>
      )}
    </div>
  );
}

// ─── Users Table ───────────────────────────────────────────────────

function UsersTable({ users }: { users: UserRow[] }) {
  if (users.length === 0) return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-center">
      <Users className="w-6 h-6 text-neutral-600 mx-auto mb-2" />
      <p className="text-xs text-neutral-500">No users yet</p>
    </div>
  );
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-3">Recent Users ({users.length})</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-neutral-500 border-b border-neutral-800">
              <th className="text-left pb-2 pr-4">Email</th>
              <th className="text-left pb-2 pr-4">Name</th>
              <th className="text-left pb-2 pr-4">Role</th>
              <th className="text-left pb-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.slice(0, 20).map(u => (
              <tr key={u.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/50">
                <td className="py-1.5 pr-4 text-neutral-300">{u.email}</td>
                <td className="py-1.5 pr-4 text-neutral-400">{u.name || '—'}</td>
                <td className="py-1.5 pr-4">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    u.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                    u.role === 'advisor' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-neutral-700 text-neutral-400'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-1.5 text-neutral-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Broadcast Panel ───────────────────────────────────────────────

function BroadcastPanel() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/actions/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      setResult(res.ok ? `Sent to ${data.sent || 0} users` : `Error: ${data.error}`);
      if (res.ok) setMessage('');
    } catch (e) {
      setResult('Failed to send');
    }
    setSending(false);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
        <Send className="w-3.5 h-3.5" /> Broadcast to Telegram
      </h3>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="HTML message to send to all active Telegram users..."
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-xs text-neutral-300 resize-none h-20 focus:outline-none focus:border-amber-500/50"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-neutral-600">Supports HTML: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;</span>
        <button
          onClick={send}
          disabled={sending || !message.trim()}
          className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-lg disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
      {result && <p className="text-xs text-neutral-400 mt-2">{result}</p>}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, pipelineRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/monitoring/pipeline'),
        fetch('/api/admin/users?limit=20'),
      ]);

      if (statsRes.status === 403 || pipelineRes.status === 403) {
        setError('Access denied. Admin role required.');
        setLoading(false);
        return;
      }

      if (statsRes.ok) setStats(await statsRes.json());
      if (pipelineRes.ok) setPipeline(await pipelineRes.json());
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || data || []);
      }
      setLastRefresh(new Date());
    } catch (e) {
      setError('Failed to load admin data');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin');
      return;
    }
    if (status === 'authenticated') {
      fetchAll();
    }
  }, [status, router, fetchAll]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (status === 'loading' || (status === 'authenticated' && loading && !stats)) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 text-neutral-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading admin dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 text-red-400">
            <Shield className="w-5 h-5" />
            <p>{error}</p>
          </div>
          <button
            onClick={fetchAll}
            className="mt-4 flex items-center gap-2 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const okExchanges = pipeline?.exchanges?.funding?.filter(e => e.status === 'ok').length ?? 0;
  const totalExchanges = pipeline?.exchanges?.funding?.length ?? 0;

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Admin Dashboard
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              {lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
              {' · '}Auto-refreshes every 60s
            </p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Users} label="Users" value={stats.totals.users}
              sub={`${stats.totals.telegramUsers} Telegram`} />
            <StatCard icon={Bell} label="Alerts (24h)" value={stats.last24h.alertNotifications}
              sub={`${stats.totals.alertNotifications} total`} trend={stats.trends.alerts} trendColor="#f5a623" />
            <StatCard icon={BarChart3} label="Funding Snapshots" value={stats.last24h.fundingSnapshots}
              sub={`${stats.totals.fundingSnapshots.toLocaleString()} total`} trend={stats.trends.funding} trendColor="#38bdf8" />
            <StatCard icon={Zap} label="Liquidations (24h)" value={stats.last24h.liquidationSnapshots}
              sub={`${stats.totals.liquidationSnapshots.toLocaleString()} total`} trend={stats.trends.liquidations} trendColor="#ef4444" />
            <StatCard icon={Database} label="DB Size" value={stats.dbSize} />
            <StatCard icon={Server} label="Exchanges" value={`${okExchanges}/${totalExchanges}`}
              sub="active/total" />
            <StatCard icon={Smartphone} label="Push Subs" value={stats.totals.pushSubscriptions} />
            <StatCard icon={MessageSquare} label="Telegram Users" value={stats.totals.telegramUsers} />
          </div>
        )}

        {/* Pipeline + Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {pipeline?.exchanges?.funding && (
            <ExchangeTable title="Funding Pipeline Health" data={pipeline.exchanges.funding} />
          )}
          {pipeline?.exchanges?.oi && (
            <ExchangeTable title="OI Pipeline Health" data={pipeline.exchanges.oi} />
          )}
        </div>

        {/* Anomalies */}
        {pipeline?.anomalies && pipeline.anomalies.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
              Data Anomalies ({pipeline.anomalies.length})
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {pipeline.anomalies.slice(0, 20).map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 text-neutral-400">
                  <span className="text-yellow-500 font-mono w-16">{a.type}</span>
                  <span className="text-neutral-300 w-16">{a.symbol}</span>
                  <span className="text-neutral-500 w-24">{a.exchange}</span>
                  <span className="text-neutral-600 flex-1 truncate">{a.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Grid: Actions, Broadcast, Users */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <ActionsPanel />
          <BroadcastPanel />
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Cron Schedule
            </h3>
            <div className="space-y-1.5 text-xs">
              {[
                { name: 'Snapshot', schedule: 'Every hour', color: 'text-blue-400' },
                { name: 'Alerts', schedule: 'Every 5 min', color: 'text-amber-400' },
                { name: 'Arb Alerts', schedule: 'Every 5 min', color: 'text-amber-400' },
                { name: 'News Alerts', schedule: 'Every 15 min', color: 'text-green-400' },
                { name: 'Calendar', schedule: 'Every hour', color: 'text-purple-400' },
                { name: 'Liquidations', schedule: 'Every 1 min', color: 'text-red-400' },
                { name: 'Daily Report', schedule: '8 AM UTC', color: 'text-cyan-400' },
                { name: 'Weekly Report', schedule: 'Sun 10 AM', color: 'text-cyan-400' },
                { name: 'Portfolio', schedule: 'Daily 12 PM', color: 'text-neutral-400' },
              ].map(c => (
                <div key={c.name} className="flex justify-between">
                  <span className="text-neutral-400">{c.name}</span>
                  <span className={c.color}>{c.schedule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <UsersTable users={users} />
      </main>
      <Footer />
    </div>
  );
}
