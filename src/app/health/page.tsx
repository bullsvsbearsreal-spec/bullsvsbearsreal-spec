'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface EndpointDef {
  name: string;
  path: string;
  group: 'Funding' | 'Options' | 'ETFs' | 'Discovery' | 'Synthesis' | 'On-Chain' | 'Equities' | 'Tools' | 'Events';
  /** Bytes below which the response is considered "thin" (likely degraded). */
  minBytes?: number;
}

const ENDPOINTS: EndpointDef[] = [
  { name: 'Funding Countdown', path: '/api/funding-countdown', group: 'Funding', minBytes: 500 },
  { name: 'Funding Predictor',  path: '/api/funding-predictor',  group: 'Funding', minBytes: 500 },
  { name: 'Funding Flips',      path: '/api/funding-flips',      group: 'Funding', minBytes: 80 },
  { name: 'Funding Paid 30d',   path: '/api/funding-paid',       group: 'Funding', minBytes: 500 },
  { name: 'Funding Leaderboard', path: '/api/funding-leaderboard', group: 'Funding', minBytes: 500 },
  { name: 'Skew',               path: '/api/skew?asset=BTC', group: 'Options', minBytes: 200 },
  { name: 'RV vs IV',           path: '/api/rv-iv?asset=BTC', group: 'Options', minBytes: 200 },
  { name: 'CME Basis',          path: '/api/cme-basis', group: 'Options', minBytes: 100 },
  { name: 'ETF Flows BTC',      path: '/api/etf-flows?asset=btc', group: 'ETFs', minBytes: 100 },
  { name: 'ETF Flows ETH',      path: '/api/etf-flows?asset=eth', group: 'ETFs', minBytes: 100 },
  { name: 'ETF Counterfactual', path: '/api/etf-counterfactual?asset=btc', group: 'ETFs', minBytes: 100 },
  { name: 'Crypto Stocks',      path: '/api/crypto-stocks', group: 'Equities', minBytes: 500 },
  { name: 'Sectors',            path: '/api/sectors',         group: 'Discovery', minBytes: 1000 },
  { name: 'Memecoin Radar',     path: '/api/memecoin-radar',  group: 'Discovery', minBytes: 200 },
  { name: 'Top Movers',         path: '/api/top-movers',      group: 'Discovery', minBytes: 500 },
  { name: 'Trending Tokens',    path: '/api/trending-tokens', group: 'Discovery', minBytes: 100 },
  { name: 'TGE Calendar',       path: '/api/tge-calendar',    group: 'Events', minBytes: 200 },
  { name: 'FOMC Playbook',      path: '/api/fomc-playbook',   group: 'Events', minBytes: 500 },
  { name: 'Stablecoin Supply',  path: '/api/stablecoin-supply', group: 'On-Chain', minBytes: 1000 },
  { name: 'Validators',         path: '/api/validators',      group: 'On-Chain', minBytes: 500 },
  { name: 'Volume Share',       path: '/api/volume-share',    group: 'On-Chain', minBytes: 500 },
  { name: 'On-Chain (BTC)',     path: '/api/onchain',         group: 'On-Chain', minBytes: 1000 },
  { name: 'Cycle Phase',        path: '/api/cycle-phase',     group: 'Synthesis', minBytes: 200 },
  { name: 'Crowdedness',        path: '/api/crowdedness',     group: 'Synthesis', minBytes: 500 },
  { name: 'Insider Watch',      path: '/api/insider-transfers', group: 'Synthesis', minBytes: 50 },
  { name: 'Smart Money',        path: '/api/smart-money?limit=10', group: 'Synthesis', minBytes: 500 },
  { name: 'OB Imbalance',       path: '/api/orderbook/multi?symbol=BTC&exchanges=Binance,Bybit&depth=true', group: 'Tools', minBytes: 200 },
];

interface CheckResult {
  name: string;
  path: string;
  group: EndpointDef['group'];
  status: number;
  ok: boolean;
  thin: boolean;
  latencyMs: number;
  bytes: number;
  cacheControl: string | null;
  xCache: string | null;
  errorPreview?: string;
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

const PER_CHECK_TIMEOUT = 15_000;
const CONCURRENCY = 6;

async function checkOne(ep: EndpointDef): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(ep.path, {
      signal: AbortSignal.timeout(PER_CHECK_TIMEOUT),
      cache: 'no-store',
    });
    const latencyMs = Date.now() - start;
    const cacheControl = res.headers.get('cache-control');
    const xCache = res.headers.get('x-cache');
    let bytes = 0;
    let errorPreview: string | undefined;
    try {
      const text = await res.text();
      bytes = text.length;
      if (!res.ok) errorPreview = text.slice(0, 120);
    } catch { /* ignore body read errors */ }
    return {
      name: ep.name,
      path: ep.path,
      group: ep.group,
      status: res.status,
      ok: res.ok,
      thin: ep.minBytes != null && bytes < ep.minBytes,
      latencyMs,
      bytes,
      cacheControl,
      xCache,
      errorPreview,
    };
  } catch (e) {
    return {
      name: ep.name,
      path: ep.path,
      group: ep.group,
      status: 0,
      ok: false,
      thin: false,
      latencyMs: Date.now() - start,
      bytes: 0,
      cacheControl: null,
      xCache: null,
      errorPreview: e instanceof Error ? e.message.slice(0, 120) : 'fetch error',
    };
  }
}

/** Run checks with a concurrency cap so we don't trigger CF's per-IP rate
 *  limiter by firing all 27 at once. */
async function runChecks(): Promise<CheckResult[]> {
  const queue = [...ENDPOINTS];
  const results: CheckResult[] = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;
        results.push(await checkOne(next));
      }
    }),
  );
  return results;
}

export default function HealthPage() {
  const [rows, setRows] = useState<CheckResult[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const inflightRef = useRef(false);

  const load = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setRefreshing(true);
    try {
      const results = await runChecks();
      setRows(results);
      setLastRun(Date.now());
    } finally {
      setRefreshing(false);
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const summary = useMemo(() => {
    if (!rows) return null;
    const ok = rows.filter(r => r.ok && !r.thin).length;
    const failed = rows.filter(r => !r.ok).length;
    const degraded = rows.filter(r => r.ok && r.thin).length;
    const avgLatencyMs = Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / Math.max(1, rows.length));
    return { total: rows.length, ok, failed, degraded, avgLatencyMs };
  }, [rows]);

  const grouped = useMemo(() => {
    if (!rows) return new Map<string, CheckResult[]>();
    const m = new Map<string, CheckResult[]>();
    for (const r of rows) {
      if (!m.has(r.group)) m.set(r.group, []);
      m.get(r.group)!.push(r);
    }
    return m;
  }, [rows]);

  const sortedGroups = useMemo(() => {
    const present = Array.from(grouped.keys());
    const ordered = GROUP_ORDER.filter(g => present.includes(g));
    const rest = present.filter(g => !GROUP_ORDER.includes(g));
    return [...ordered, ...rest];
  }, [grouped]);

  const fresh = lastRun ? Math.max(0, Math.floor((now - lastRun) / 1000)) : 0;

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
              {ENDPOINTS.length} endpoints · checked {lastRun ? `${fresh}s ago` : 'never'}
            </span>
            <button
              onClick={() => load()}
              disabled={refreshing}
              className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          </div>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Live status of every InfoHub data endpoint, measured from your browser.
            <span className="text-emerald-300"> Green</span> = healthy.
            <span className="text-amber-300"> Amber</span> = responded but body smaller
            than expected (probably degraded upstream).
            <span className="text-rose-300"> Red</span> = HTTP error or timeout.
            Re-checks every 60s.
          </p>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Healthy
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-emerald-400">
                {summary.ok} <span className="text-neutral-600 font-normal text-xs">/ {summary.total}</span>
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> Degraded
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-amber-400">{summary.degraded}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <XCircle className="w-3 h-3 text-rose-400" /> Failed
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-rose-400">{summary.failed}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Avg latency</div>
              <div className={`font-mono tabular-nums text-base font-bold ${latencyTone(summary.avgLatencyMs)}`}>
                {fmtMs(summary.avgLatencyMs)}
              </div>
            </div>
          </div>
        )}

        {!rows && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Checking all endpoints (~10s)…
          </div>
        )}

        {rows && sortedGroups.map(group => {
          const groupRows = grouped.get(group) ?? [];
          const groupOk = groupRows.filter(r => r.ok && !r.thin).length;
          const groupFailed = groupRows.filter(r => !r.ok).length;
          return (
            <section key={group} className="mb-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-sm font-bold text-white">{group}</h2>
                <div className="text-[11px] text-neutral-500 font-mono">
                  <span className="text-emerald-400">{groupOk}</span>
                  <span className="mx-1 text-neutral-700">/</span>
                  <span className="text-white">{groupRows.length}</span>
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
                {groupRows.map(r => (
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
          (responded but body unexpectedly small — usually upstream throttling). Red = HTTP error or
          timeout. Latency &gt; 3s = amber, &gt; 8s = red. Body size threshold per-endpoint
          (e.g. /sectors should be 1000+ bytes). Checks run client-side from your browser, capped
          at {CONCURRENCY} concurrent requests to avoid Cloudflare rate-limiting.
        </div>
      </main>
      <Footer />
    </>
  );
}
