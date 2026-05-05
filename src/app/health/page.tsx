'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface CheckResult {
  name: string;
  path: string;
  group: string;
  status: number;
  ok: boolean;
  thin: boolean;
  latencyMs: number;
  bytes: number;
  cacheControl: string | null;
  xCache: string | null;
  errorPreview?: string;
}

interface ApiResponse {
  rows: CheckResult[];
  summary: {
    total: number;
    ok: number;
    failed: number;
    degraded: number;
    avgLatencyMs: number;
  };
  ts: number;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${n}B`;
}

function statusIcon(r: CheckResult) {
  if (!r.ok) return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
  if (r.thin) return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
}

function rowTone(r: CheckResult): string {
  if (!r.ok) return 'bg-rose-500/[0.04] border-l-2 border-l-rose-400';
  if (r.thin) return 'bg-amber-500/[0.03] border-l-2 border-l-amber-400';
  return '';
}

function latencyTone(ms: number): string {
  if (ms > 8000) return 'text-rose-300';
  if (ms > 3000) return 'text-amber-300';
  if (ms > 1000) return 'text-neutral-300';
  return 'text-emerald-300';
}

const GROUP_ORDER = ['Funding', 'Options', 'ETFs', 'Equities', 'Discovery', 'Events', 'On-Chain', 'Synthesis', 'Tools'];

export default function HealthPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/health-dashboard', { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    if (!data) return new Map<string, CheckResult[]>();
    const m = new Map<string, CheckResult[]>();
    for (const r of data.rows) {
      if (!m.has(r.group)) m.set(r.group, []);
      m.get(r.group)!.push(r);
    }
    return m;
  }, [data]);

  const sortedGroups = useMemo(() => {
    if (!grouped) return [];
    const present = Array.from(grouped.keys());
    const ordered = GROUP_ORDER.filter(g => present.includes(g));
    const rest = present.filter(g => !GROUP_ORDER.includes(g));
    return [...ordered, ...rest];
  }, [grouped]);

  const fresh = data ? Math.max(0, Math.floor((now - data.ts) / 1000)) : 0;

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Endpoint Health</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {data?.summary.total ?? 0} endpoints · checked {fresh}s ago
            </span>
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          </div>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Live status of every InfoHub data endpoint. <span className="text-emerald-300">Green</span>{' '}
            = healthy. <span className="text-amber-300">Amber</span> = responded but body smaller than
            expected (probably degraded upstream). <span className="text-rose-300">Red</span> = HTTP
            error or timeout. Re-checks every 60s.
          </p>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Healthy
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-emerald-400">
                {data.summary.ok} <span className="text-neutral-600 font-normal text-xs">/ {data.summary.total}</span>
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> Degraded
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-amber-400">
                {data.summary.degraded}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <XCircle className="w-3 h-3 text-rose-400" /> Failed
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-rose-400">
                {data.summary.failed}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Avg latency</div>
              <div className={`font-mono tabular-nums text-base font-bold ${latencyTone(data.summary.avgLatencyMs)}`}>
                {fmtMs(data.summary.avgLatencyMs)}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Checking all endpoints (~10s)…
          </div>
        )}

        {/* Per-group sections */}
        {data && sortedGroups.map(group => {
          const rows = grouped.get(group) ?? [];
          const groupOk = rows.filter(r => r.ok && !r.thin).length;
          const groupFailed = rows.filter(r => !r.ok).length;
          return (
            <section key={group} className="mb-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-sm font-bold text-white">{group}</h2>
                <div className="text-[11px] text-neutral-500 font-mono">
                  <span className="text-emerald-400">{groupOk}</span>
                  <span className="mx-1 text-neutral-700">/</span>
                  <span className="text-white">{rows.length}</span>
                  {groupFailed > 0 && <span className="text-rose-400 ml-2">· {groupFailed} failing</span>}
                </div>
              </div>

              <div className="card-premium p-2 overflow-x-auto">
                <div className="grid grid-cols-[24px,1fr,200px,80px,90px,90px,1fr] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
                  <div></div>
                  <div>Endpoint</div>
                  <div>Path</div>
                  <div className="text-right">Status</div>
                  <div className="text-right">Latency</div>
                  <div className="text-right">Bytes</div>
                  <div>Cache / notes</div>
                </div>
                {rows.map(r => (
                  <div
                    key={r.path + r.name}
                    className={`grid grid-cols-[24px,1fr,200px,80px,90px,90px,1fr] gap-3 px-3 py-2 items-center rounded ${rowTone(r)}`}
                  >
                    <div>{statusIcon(r)}</div>
                    <div className="text-sm text-white font-bold truncate">{r.name}</div>
                    <div className="text-[11px] font-mono text-neutral-500 truncate">{r.path}</div>
                    <div className={`text-right font-mono text-xs tabular-nums ${r.ok ? 'text-emerald-300' : 'text-rose-400'}`}>
                      {r.status === 0 ? 'TIMEOUT' : r.status}
                    </div>
                    <div className={`text-right font-mono text-xs tabular-nums ${latencyTone(r.latencyMs)}`}>
                      {fmtMs(r.latencyMs)}
                    </div>
                    <div className={`text-right font-mono text-xs tabular-nums ${r.thin ? 'text-amber-400' : 'text-neutral-400'}`}>
                      {fmtBytes(r.bytes)}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono truncate">
                      {r.errorPreview ? (
                        <span className="text-rose-300">{r.errorPreview}</span>
                      ) : (
                        <>
                          <span>{r.xCache ? `${r.xCache} · ` : ''}</span>
                          <span>{r.cacheControl?.slice(0, 60) ?? ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> green = healthy. Amber = degraded
          (responded but body unexpectedly small — usually means upstream throttling left us with
          partial data). Red = HTTP error or timeout. Latency &gt; 3s = amber, &gt; 8s = red. Body
          size threshold is per-endpoint (e.g. /sectors should be 1000+ bytes — anything smaller
          means something stripped the data). Source: server-side `/api/health-dashboard` polled
          every 60s. Cache hits count as healthy.
        </div>
      </main>
      <Footer />
    </>
  );
}
