'use client';

import { useState, useEffect } from 'react';
import { Cog, Activity, Trash2, Shield, Send, Mail, RefreshCw, Download, Server, ArrowRight, AlertOctagon } from 'lucide-react';
import Link from 'next/link';
import { Card, SectionHead, SkeletonBlock, ConfirmModal, fmtAgo } from '../components/primitives';
import type { AuditEntry } from '../types';

interface ServerError {
  id: number;
  route: string;
  message: string;
  stack: string | null;
  timestamp: string;
}

/**
 * Ops tab — operator controls + system health board + paged audit log.
 *
 * Sections:
 *  1. Per-cron triggers (with last-run + success rate table)
 *  2. Cache flush (all + per-endpoint)
 *  3. Aggregator venue board (read-only health from prices.info-hub.io)
 *  4. Broadcast + email tester (links — heavy enough to deserve sub-pages)
 *  5. Paged audit log with CSV export
 */
interface WorkerStatus {
  worker: string;
  lastBeat: string;
  status: string;
  stale: boolean;
}

export function OpsTab({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const [aggregator, setAggregator] = useState<null | { venues: { name: string; connected: boolean; lastUpdate: number; errors: number }[]; total: number; connected: number }>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditMore, setAuditMore] = useState(true);
  const [confirm, setConfirm] = useState<null | { kind: 'flush' | 'trigger'; cron?: string }>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Worker heartbeats — keyed by cron id (without the "cron:" prefix).
  const [workers, setWorkers] = useState<Record<string, WorkerStatus>>({});

  // Load aggregator health
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('https://prices.info-hub.io/health', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const d = await res.json();
        const venues = Object.entries(d.health || {}).map(([name, v]) => ({
          name,
          connected: (v as any).connected,
          lastUpdate: (v as any).lastUpdate,
          errors: (v as any).errors,
        })).sort((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name));
        const connected = venues.filter(v => v.connected).length;
        setAggregator({ venues, total: venues.length, connected });
      } catch {}
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  // Server errors — 60s poll. Surfaces 5xx events captured by
  // lib/error-capture.ts so the operator sees production breaks
  // without scrolling Sentry / DO logs.
  const [errors, setErrors] = useState<ServerError[] | null>(null);
  const [errorSummary, setErrorSummary] = useState<{ total: number; last1m: number; last5m: number } | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/server-errors?minutes=60&limit=30');
        if (!res.ok) return;
        const d = await res.json();
        setErrors(Array.isArray(d.errors) ? d.errors : []);
        setErrorSummary(d.summary ?? null);
      } catch {}
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // Cron history — 5min poll. Last-24h runs per cron with success/fail
  // rendered as a tiny ✓✗ sparkline next to each trigger button.
  const [cronHistory, setCronHistory] = useState<Record<string, { ok: number; total: number; runs: { ok: boolean; timestamp: string }[] }>>({});
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/cron-history?hours=24');
        if (!res.ok) return;
        const d = await res.json();
        const map: Record<string, { ok: number; total: number; runs: { ok: boolean; timestamp: string }[] }> = {};
        for (const c of (d.crons ?? []) as any[]) {
          map[c.id] = { ok: c.ok, total: c.total, runs: c.runs ?? [] };
        }
        setCronHistory(map);
      } catch {}
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // Worker heartbeats — 60s poll. Used to surface "last ran Xm ago"
  // next to each cron trigger button so the operator can spot stalled
  // crons before clicking.
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/monitoring/workers');
        if (!res.ok) return;
        const d = await res.json();
        const map: Record<string, WorkerStatus> = {};
        for (const w of (d.workers ?? []) as WorkerStatus[]) {
          // Strip "cron:" prefix so the map keys match our button ids.
          const id = w.worker.startsWith('cron:') ? w.worker.slice(5) : w.worker;
          map[id] = w;
        }
        setWorkers(map);
      } catch {}
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // Load audit log
  const loadAudit = async (offset: number, append: boolean) => {
    try {
      const res = await fetch(`/api/admin/audit-log?limit=20&offset=${offset}`);
      if (!res.ok) return;
      const d = await res.json();
      const list: AuditEntry[] = Array.isArray(d) ? d : Array.isArray(d.entries) ? d.entries : [];
      setAudit(prev => append ? [...prev, ...list] : list);
      setAuditMore(list.length === 20);
    } catch {}
  };
  useEffect(() => { loadAudit(0, false); }, []);

  // Action wrappers
  const fireTrigger = async (cron: string, reason: string) => {
    setBusy(cron);
    try {
      const res = await fetch('/api/admin/actions/trigger-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cron, reason }),
      });
      onToast(`Trigger ${cron}: ${res.ok ? 'fired' : `HTTP ${res.status}`}`, res.ok);
    } catch (e) {
      onToast(`Trigger ${cron}: ${e instanceof Error ? e.message : 'error'}`, false);
    }
    setBusy(null);
    setConfirm(null);
  };

  const fireFlush = async (reason: string) => {
    setBusy('flush');
    try {
      const res = await fetch('/api/admin/actions/flush-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      onToast(`Flush cache: ${res.ok ? 'done' : `HTTP ${res.status}`}`, res.ok);
    } catch (e) {
      onToast(`Flush: ${e instanceof Error ? e.message : 'error'}`, false);
    }
    setBusy(null);
    setConfirm(null);
  };

  // Allowlisted cron timers (matches /api/admin/actions/trigger-cron
  // ALLOWED_CRONS). telegram-daily is intentionally omitted — broadcast
  // operations route through the dedicated /admin-panel/broadcast
  // composer with its own type-to-confirm modal.
  const crons: { id: string; label: string; schedule: string }[] = [
    { id: 'snapshot',              label: 'Snapshot',               schedule: 'every minute' },
    { id: 'ingest-liquidations',   label: 'Ingest liquidations',    schedule: 'every minute' },
    { id: 'sync-positions',        label: 'Sync positions',         schedule: 'every minute' },
    { id: 'whale-alerts',          label: 'Whale priority alerts',  schedule: 'every 30s' },
    { id: 'whale-trades',          label: 'Whale trades',           schedule: 'every 2 min' },
    { id: 'alerts',                label: 'Standard alerts',        schedule: 'every 5 min' },
    { id: 'check-position-alerts', label: 'Position alerts',        schedule: 'every 5 min' },
    { id: 'auto-tweet',            label: 'Auto-tweet',             schedule: 'every 5 min' },
    { id: 'social-fetch',          label: 'KOL feed',               schedule: 'every 15 min' },
    { id: 'refresh-etf-flows',     label: 'ETF flows refresh',      schedule: 'every 30 min' },
    { id: 'refresh-validators',    label: 'Validator refresh',      schedule: 'every 30 min' },
    { id: 'warm-smart-money',      label: 'Warm smart money',       schedule: 'every 25 min' },
    { id: 'portfolio-snapshot',    label: 'Portfolio snapshot',     schedule: 'daily 12:00 UTC' },
    { id: 'aggregate-page-views',  label: 'Aggregate page views',   schedule: 'daily 02:00 UTC' },
  ];

  return (
    <>
      {/* Cron triggers */}
      <SectionHead title="Cron Jobs" icon={<Activity style={{ width: 13, height: 13 }} />} />
      <Card title="Manual trigger · last-known schedules from CLAUDE.md">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {crons.map(c => {
            const w = workers[c.id];
            // Color the freshness dot: green = beat within last 5 min,
            // amber = within last 30 min, rose = stale (>30) or missing.
            let dotColor: string;
            let dotTitle: string;
            if (!w) {
              dotColor = 'var(--hub-border-subtle)';
              dotTitle = 'No heartbeat recorded (cron may not be wired to upsertWorkerHeartbeat)';
            } else {
              const age = Date.now() - new Date(w.lastBeat).getTime();
              if (w.stale || age > 30 * 60_000) {
                dotColor = '#f87171';
                dotTitle = `Stale — last beat ${Math.floor(age / 60_000)}m ago`;
              } else if (age > 5 * 60_000) {
                dotColor = '#fcd34d';
                dotTitle = `Last beat ${Math.floor(age / 60_000)}m ago`;
              } else {
                dotColor = '#34d399';
                dotTitle = `Healthy — last beat ${Math.max(1, Math.floor(age / 1000))}s ago`;
              }
            }
            return (
              <button
                key={c.id}
                onClick={() => setConfirm({ kind: 'trigger', cron: c.id })}
                disabled={busy === c.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 10px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--hub-border-subtle)', borderRadius: 6,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span title={dotTitle} style={{
                    width: 8, height: 8, borderRadius: '50%', background: dotColor,
                    flexShrink: 0,
                    boxShadow: dotColor === '#34d399' ? '0 0 4px rgba(52,211,153,0.5)' : undefined,
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
                      {w ? fmtAgo(w.lastBeat) : '/api/cron/' + c.id}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* Last 24h sparkline of ✓/✗ runs (audit-log triggered + scheduled) */}
                  {(() => {
                    const h = cronHistory[c.id];
                    if (!h || h.total === 0) return null;
                    const dots = h.runs.slice(-20);
                    const pct = Math.round((h.ok / h.total) * 100);
                    return (
                      <div title={`${h.ok}/${h.total} ok (24h, ${pct}%)`}
                           style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                        {dots.map((r, i) => (
                          <span key={i} style={{
                            width: 4, height: 8, borderRadius: 1,
                            background: r.ok ? '#34d399' : '#f87171',
                            opacity: 0.4 + (i / dots.length) * 0.6,
                          }} />
                        ))}
                        <span style={{ fontSize: 9, color: pct >= 95 ? '#34d399' : pct >= 80 ? '#fcd34d' : '#f87171', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })()}
                  <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{c.schedule}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Flush cache + Broadcast + Email tester */}
      <SectionHead title="Other Operator Actions" icon={<Cog style={{ width: 13, height: 13 }} />} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <ActionCard
          icon={<Trash2 className="w-4 h-4" />}
          label="Flush L1 caches"
          desc="Clear all in-process L1 caches across API routes. Next request hits origin or upstream. Use when an upstream returned bad data we cached."
          tone="caution"
          onClick={() => setConfirm({ kind: 'flush' })}
          busy={busy === 'flush'}
        />
        <Link href="/admin-panel/broadcast" style={{ textDecoration: 'none' }}>
          <ActionCard
            icon={<Send className="w-4 h-4" />}
            label="Broadcast composer"
            desc="Send push notification to subscribed users. Tier filter + title + body + URL. Type-to-confirm guarded."
            tone="caution"
            asLink
          />
        </Link>
        {/* Email preview is a server-rendered HTML index at the API
            route itself — no SPA page needed. Opens in a new tab so the
            admin keeps the dashboard context. */}
        <a href="/api/admin/email-preview" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <ActionCard
            icon={<Mail className="w-4 h-4" />}
            label="Email tester"
            desc="Render any template (welcome / commission / payout / cutover) with sample data. Opens in new tab."
            tone="safe"
            asLink
          />
        </a>
      </div>

      {/* Aggregator venue board */}
      <SectionHead
        title={`Aggregator · ${aggregator ? `${aggregator.connected}/${aggregator.total}` : '—'} venues`}
        icon={<Server style={{ width: 13, height: 13 }} />}
        right={
          <a
            href="https://prices.info-hub.io/health"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: 'var(--hub-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            Raw health <ArrowRight style={{ width: 10, height: 10 }} />
          </a>
        }
      />
      <Card title="Live WS connection state · prices.info-hub.io/health">
        {!aggregator ? <SkeletonBlock w="100%" h={160} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
            {aggregator.venues.map(v => {
              const age = v.lastUpdate ? Math.floor((Date.now() - v.lastUpdate) / 1000) : null;
              return (
                <div key={v.name} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 6,
                  background: v.connected ? 'rgba(34, 197, 94, 0.05)' : 'rgba(244, 63, 94, 0.08)',
                  border: `1px solid ${v.connected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(244, 63, 94, 0.25)'}`,
                  fontSize: 11,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: v.connected ? 'var(--pump-mild)' : 'var(--rekt-mild)',
                    boxShadow: v.connected ? '0 0 4px rgba(52, 211, 153, 0.5)' : '0 0 4px rgba(244, 63, 94, 0.5)',
                  }} />
                  <span style={{ flex: 1, color: v.connected ? '#fff' : 'var(--fg-muted)', fontWeight: 600 }}>{v.name}</span>
                  {age !== null && (
                    <span style={{ fontSize: 9, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
                      {age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`}
                    </span>
                  )}
                  {v.errors > 5 && (
                    <span style={{ fontSize: 9, color: '#fca5a5', fontFamily: 'var(--font-mono)' }} title={`${v.errors} errors`}>
                      e{v.errors}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Server errors panel */}
      <SectionHead
        title="Server Errors · last 60 min"
        icon={<AlertOctagon style={{ width: 13, height: 13 }} />}
        right={errorSummary ? (
          <span style={{ fontSize: 10, color: errorSummary.last5m > 0 ? '#f87171' : 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
            {errorSummary.total} total · {errorSummary.last5m} in last 5m
          </span>
        ) : null}
      />
      <Card title="5xx + caught exceptions written by lib/error-capture">
        {errors === null ? (
          <SkeletonBlock h={80} />
        ) : errors.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0' }}>
            Nothing recorded in the last hour. Healthy.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 4 }}>
            {errors.slice(0, 12).map(err => (
              <div key={err.id} style={{
                display: 'grid', gridTemplateColumns: '16px 1fr 80px', alignItems: 'start', gap: 8,
                padding: '6px 10px',
                background: 'rgba(244, 63, 94, 0.06)',
                border: '1px solid rgba(244, 63, 94, 0.18)',
                borderRadius: 6,
              }}>
                <AlertOctagon style={{ width: 12, height: 12, color: '#f87171', marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {err.route}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#fda4af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {err.message}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                  {fmtAgo(err.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Paged audit log */}
      <SectionHead
        title="Audit Log"
        icon={<Activity style={{ width: 13, height: 13 }} />}
        right={
          <a
            href="/api/admin/audit-log/csv"
            style={{ fontSize: 10, color: 'var(--hub-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <Download className="w-3 h-3" /> CSV
          </a>
        }
      />
      <div style={{
        marginTop: 4, marginBottom: 18,
        background: 'var(--hub-darker)',
        border: '1px solid var(--hub-border-subtle)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        {audit.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--fg-faint)' }}>No admin actions logged yet.</div>
        ) : (
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hub-border-subtle)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                <th style={{ textAlign: 'left',  padding: '8px 12px', fontWeight: 700 }}>Action</th>
                <th style={{ textAlign: 'left',  padding: '8px 12px', fontWeight: 700 }}>Actor</th>
                <th style={{ textAlign: 'left',  padding: '8px 12px', fontWeight: 700 }}>Reason</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700 }}>When</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fcd34d' }}>{r.action}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--fg-default)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.actorName || r.actorEmail || '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--fg-muted)', fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(r.metadata?.reason as string | undefined) || '—'}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{fmtAgo(r.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {auditMore && (
          <button
            onClick={() => { const o = auditOffset + 20; setAuditOffset(o); loadAudit(o, true); }}
            style={{
              width: '100%', padding: 10, fontSize: 11, fontWeight: 600,
              background: 'transparent', border: 0, borderTop: '1px solid var(--hub-border-subtle)',
              color: 'var(--hub-accent)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <RefreshCw className="w-3 h-3" />
            Load 20 more
          </button>
        )}
      </div>

      {/* Confirm modals */}
      <ConfirmModal
        open={confirm?.kind === 'flush'}
        title="Flush all L1 caches?"
        description="Clears all in-process L1 caches. Next request to each /api endpoint will hit the upstream (CMC, CoinGecko, exchange APIs). Brief latency spike expected on the next minute of traffic."
        confirmText="FLUSH"
        confirmLabel="Flush all"
        danger
        onConfirm={fireFlush}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'trigger'}
        title={confirm?.kind === 'trigger' ? `Trigger /api/cron/${confirm.cron}?` : ''}
        description={
          <>This will fire <code style={{ fontFamily: 'var(--font-mono)', color: '#fcd34d' }}>/api/cron/{confirm?.kind === 'trigger' ? confirm.cron : ''}</code> once,
          out-of-schedule, against the live database. Idempotent for most crons but check the cron source if uncertain.</>
        }
        confirmText="RUN"
        confirmLabel="Trigger now"
        onConfirm={(reason) => confirm?.kind === 'trigger' ? fireTrigger(confirm.cron!, reason) : Promise.resolve()}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function ActionCard({ icon, label, desc, tone, onClick, busy, asLink }: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  tone: 'safe' | 'caution';
  onClick?: () => void;
  busy?: boolean;
  asLink?: boolean;
}) {
  const accent = tone === 'caution' ? 'rgba(245, 158, 11, 0.3)' : 'var(--hub-border-subtle)';
  const accentColor = tone === 'caution' ? '#fcd34d' : '#34d399';
  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color: accentColor }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{label}</span>
        {busy && <RefreshCw className="w-3 h-3 animate-spin" style={{ color: 'var(--fg-muted)', marginLeft: 'auto' }} />}
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.55 }}>{desc}</div>
    </>
  );
  const sx: React.CSSProperties = {
    background: 'var(--hub-darker)',
    border: `1px solid ${accent}`,
    borderRadius: 10, padding: 14, textAlign: 'left', cursor: busy ? 'wait' : 'pointer',
    width: '100%', display: 'block', color: 'inherit', textDecoration: 'none',
  };
  if (asLink) return <div style={sx}>{inner}</div>;
  return <button onClick={onClick} disabled={busy} style={sx as React.CSSProperties}>{inner}</button>;
}
