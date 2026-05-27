'use client';

/**
 * Feedback tab — bug reports inbox (replaces the standalone
 * /admin/feedback page; the old page now just redirects here).
 *
 * Backed by GET/PATCH /api/feedback. Supports:
 *   · filter chips (open / resolved / wontfix / all)
 *   · severity chips (high / normal / low / any)
 *   · free-text search across message + URL + email
 *   · click a row to expand into a detail drawer with the
 *     full message, browser/viewport, internal note, and a
 *     pre-canned reply-by-email link
 *   · status changes write to /api/feedback?id=… PATCH and
 *     refresh the list
 *   · red-banner count of unread "high" reports surfaces at the
 *     top of the dashboard via the orchestrator (sourced from
 *     the same /api/feedback response)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bug, RefreshCw, Filter, Search, ExternalLink, Check, X as XIcon,
  AlertTriangle, Mail, ChevronRight, Monitor,
} from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtAgo } from '../components/primitives';
import type { BugReport } from '../types';

type StatusFilt = 'open' | 'resolved' | 'wontfix' | 'all';
type SevFilt    = 'high' | 'normal' | 'low' | 'any';

const SEV_TONE: Record<BugReport['severity'], { bg: string; border: string; text: string; label: string }> = {
  high:   { bg: 'rgba(244, 63, 94, 0.08)',  border: 'rgba(244, 63, 94, 0.35)',  text: '#fda4af', label: 'HIGH'   },
  normal: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.30)', text: '#fcd34d', label: 'NORMAL' },
  low:    { bg: 'rgba(255,255,255,0.03)',   border: 'var(--hub-border-subtle)',  text: '#a3a3a3', label: 'LOW'    },
};

function browserFromUA(ua: string | null): string {
  if (!ua) return '—';
  if (/Edg\//.test(ua))                      return 'Edge';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua))                  return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua))   return 'Safari';
  return ua.slice(0, 40) + (ua.length > 40 ? '…' : '');
}

export function FeedbackTab({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [statusFilt, setStatusFilt] = useState<StatusFilt>('open');
  const [sevFilt,    setSevFilt]    = useState<SevFilt>('any');
  const [query,      setQuery]      = useState('');
  const [openId,     setOpenId]     = useState<number | null>(null);
  const [busyId,     setBusyId]     = useState<number | null>(null);
  const [noteDraft,  setNoteDraft]  = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback?status=${statusFilt}&limit=300`, {
        signal: AbortSignal.timeout(15_000),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setReports(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [statusFilt]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .filter(r => sevFilt === 'any' ? true : r.severity === sevFilt)
      .filter(r => !q
        ? true
        : r.message.toLowerCase().includes(q)
          || r.pageUrl.toLowerCase().includes(q)
          || (r.userEmail || '').toLowerCase().includes(q)
      );
  }, [reports, sevFilt, query]);

  const counts = useMemo(() => ({
    open:     reports.filter(r => r.status === 'open').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    wontfix:  reports.filter(r => r.status === 'wontfix').length,
    highOpen: reports.filter(r => r.severity === 'high' && r.status === 'open').length,
  }), [reports]);

  const setStatus = useCallback(async (id: number, next: 'open' | 'resolved' | 'wontfix') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/feedback?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, adminNotes: noteDraft[id] || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        onToast(`Update failed: ${json.error || 'HTTP ' + res.status}`, false);
        return;
      }
      onToast(`Report #${id} → ${next}`, true);
      // Optimistic patch so the list updates instantly without re-fetching
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: next, adminNotes: noteDraft[id] || r.adminNotes } : r));
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Network error', false);
    } finally {
      setBusyId(null);
    }
  }, [noteDraft, onToast]);

  const open = openId !== null ? reports.find(r => r.id === openId) ?? null : null;

  return (
    <>
      {counts.highOpen > 0 && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 14,
          fontSize: 12, color: '#fda4af',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span><b>{counts.highOpen}</b> high-severity report{counts.highOpen === 1 ? '' : 's'} open</span>
        </div>
      )}

      <SectionHead
        title="Bug Reports"
        icon={<Bug style={{ width: 13, height: 13 }} />}
        right={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{
              fontSize: 10, color: 'var(--fg-muted)', background: 'transparent',
              border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <RefreshCw style={{ width: 11, height: 11, ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
            refresh
          </button>
        }
      />

      {/* Filters row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
        marginBottom: 12,
      }}>
        <Filter style={{ width: 12, height: 12, color: 'var(--fg-faint)' }} />
        {(['open', 'resolved', 'wontfix', 'all'] as StatusFilt[]).map(s => (
          <Chip key={s} active={statusFilt === s} onClick={() => setStatusFilt(s)}>
            {s} {s !== 'all' && <span style={{ opacity: 0.6, marginLeft: 4 }}>{counts[s] ?? 0}</span>}
          </Chip>
        ))}
        <span style={{ width: 1, height: 14, background: 'var(--hub-border-subtle)', margin: '0 4px' }} />
        {(['any', 'high', 'normal', 'low'] as SevFilt[]).map(s => (
          <Chip key={s} active={sevFilt === s} onClick={() => setSevFilt(s)} variant="sev">
            {s}
          </Chip>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Search style={{
            width: 12, height: 12, color: 'var(--fg-faint)',
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="search · message · URL · email"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--hub-border-subtle)',
              borderRadius: 6,
              padding: '5px 10px 5px 26px',
              fontSize: 11, color: '#fff', minWidth: 240,
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 12,
          fontSize: 12, color: '#fda4af',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle style={{ width: 14, height: 14 }} />
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      {loading && reports.length === 0 ? (
        <Card title={`Loading ${statusFilt} reports`}>
          <div style={{ display: 'grid', gap: 6 }}>
            <SkeletonBlock h={36} />
            <SkeletonBlock h={36} />
            <SkeletonBlock h={36} />
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'var(--hub-darker)',
          border: '1px solid var(--hub-border-subtle)',
          borderRadius: 10, padding: 28, textAlign: 'center',
          color: 'var(--fg-muted)', fontSize: 12,
        }}>
          {reports.length === 0
            ? 'Inbox is empty. Either no reports submitted yet or all triaged.'
            : 'No reports match the current filters.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {filtered.map(r => {
            const sev = SEV_TONE[r.severity];
            const isHover = openId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenId(r.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 110px 110px 90px 16px',
                  alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  background: isHover ? 'var(--hub-card-hover)' : sev.bg,
                  border: `1px solid ${isHover ? 'var(--hub-accent)' : sev.border}`,
                  borderRadius: 8, color: 'inherit', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit', width: '100%',
                  transition: 'background 120ms, border-color 120ms',
                }}
              >
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: sev.text,
                  padding: '2px 6px', borderRadius: 4,
                  border: `1px solid ${sev.border}`,
                  textAlign: 'center',
                }}>{sev.label}</span>

                <div style={{ minWidth: 0 }}>
                  <div style={{
                    color: '#fff', fontSize: 12.5,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.message}</div>
                  <div style={{
                    fontSize: 10, color: 'var(--fg-faint)', marginTop: 2,
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.pageUrl}
                  </div>
                </div>

                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
                  {r.userEmail || <span style={{ color: 'var(--fg-faint)' }}>anonymous</span>}
                </span>

                <span style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: r.status === 'open' ? '#34d399' : r.status === 'resolved' ? 'var(--fg-muted)' : 'var(--fg-faint)',
                }}>
                  {r.status}
                </span>

                <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                  {fmtAgo(r.createdAt)}
                </span>

                <ChevronRight style={{ width: 14, height: 14, color: 'var(--fg-faint)' }} />
              </button>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      {open && (
        <DetailDrawer
          report={open}
          busy={busyId === open.id}
          noteDraft={noteDraft[open.id] ?? open.adminNotes ?? ''}
          onNoteChange={v => setNoteDraft(prev => ({ ...prev, [open.id]: v }))}
          onClose={() => setOpenId(null)}
          onStatus={next => setStatus(open.id, next)}
        />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Chips
// ────────────────────────────────────────────────────────────────────
function Chip({
  active, onClick, children, variant = 'status',
}: { active: boolean; onClick: () => void; children: React.ReactNode; variant?: 'status' | 'sev' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 999,
        fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
        background: active
          ? (variant === 'sev' ? 'rgba(245, 158, 11, 0.16)' : 'var(--hub-accent)')
          : 'rgba(255,255,255,0.04)',
        color: active
          ? (variant === 'sev' ? '#fcd34d' : '#000')
          : 'var(--fg-muted)',
        border: active && variant === 'sev'
          ? '1px solid rgba(245, 158, 11, 0.3)'
          : '1px solid transparent',
        cursor: 'pointer',
        transition: 'all 120ms',
      }}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────
// Detail drawer (slides in from right; Esc to close)
// ────────────────────────────────────────────────────────────────────
function DetailDrawer({
  report, busy, noteDraft, onNoteChange, onClose, onStatus,
}: {
  report: BugReport;
  busy: boolean;
  noteDraft: string;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onStatus: (next: 'open' | 'resolved' | 'wontfix') => void;
}) {
  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const sev = SEV_TONE[report.severity];
  const mailto = report.userEmail
    ? `mailto:${report.userEmail}?subject=${encodeURIComponent('Re: your InfoHub bug report #' + report.id)}&body=${encodeURIComponent(`Hi,\n\nThanks for the report on ${report.pageUrl}.\n\n— InfoHub`)}`
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={busy ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--hub-darker)',
          borderLeft: '1px solid var(--hub-border-subtle)',
          width: 480, maxWidth: '95vw', height: '100vh',
          overflowY: 'auto', padding: 22, color: 'var(--fg-default)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bug style={{ width: 16, height: 16, color: '#fcd34d' }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              Report #{report.id}
            </h2>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: sev.text, padding: '2px 7px', borderRadius: 4,
              border: `1px solid ${sev.border}`,
            }}>{sev.label}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: report.status === 'open' ? '#34d399' : 'var(--fg-muted)',
            }}>
              · {report.status}
            </span>
          </div>
          <button
            type="button" onClick={onClose} disabled={busy}
            style={{ background: 'transparent', border: 0, color: 'var(--fg-muted)', cursor: 'pointer' }}
          >
            <XIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <Field label="Message">
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--hub-border-subtle)',
            borderRadius: 6, padding: '10px 12px',
            fontSize: 13, color: '#fff', lineHeight: 1.5,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {report.message}
          </div>
        </Field>

        <Field label="Page">
          <a
            href={report.pageUrl}
            target="_blank" rel="noopener noreferrer"
            style={{
              color: 'var(--hub-accent)', fontSize: 12, fontFamily: 'var(--font-mono)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              wordBreak: 'break-all',
            }}
          >
            {report.pageUrl}
            <ExternalLink style={{ width: 11, height: 11 }} />
          </a>
          {report.pageTitle && (
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{report.pageTitle}</div>
          )}
        </Field>

        <Field label="Reporter">
          {report.userEmail
            ? <span style={{ fontSize: 12, color: 'var(--fg-default)' }}>{report.userEmail}</span>
            : <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>anonymous</span>}
          {report.userId && (
            <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{report.userId}</div>
          )}
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Browser">
            <span style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Monitor style={{ width: 11, height: 11 }} />
              {browserFromUA(report.userAgent)}
            </span>
          </Field>
          <Field label="Viewport">
            <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              {report.viewport || '—'}
            </span>
          </Field>
        </div>

        <Field label="Submitted">
          <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
            {new Date(report.createdAt).toLocaleString()} · {fmtAgo(report.createdAt)}
          </span>
        </Field>

        {report.resolvedAt && (
          <Field label="Resolved">
            <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              {new Date(report.resolvedAt).toLocaleString()} · {fmtAgo(report.resolvedAt)}
            </span>
          </Field>
        )}

        {/* Internal note (resolves alongside the status change) */}
        <Field label="Internal note (saved on next status change)">
          <textarea
            value={noteDraft}
            onChange={e => onNoteChange(e.target.value)}
            disabled={busy}
            maxLength={500}
            rows={3}
            placeholder="e.g. fixed in commit abc123 · escalated to ops · cannot reproduce"
            style={{
              width: '100%', minHeight: 60, resize: 'vertical',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--hub-border-subtle)',
              borderRadius: 6, padding: '8px 10px',
              fontSize: 12, color: '#fff', fontFamily: 'inherit',
            }}
          />
        </Field>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          {report.status !== 'resolved' && (
            <ActionButton
              onClick={() => onStatus('resolved')}
              disabled={busy}
              tone="success"
              icon={<Check style={{ width: 12, height: 12 }} />}
            >
              Mark resolved
            </ActionButton>
          )}
          {report.status !== 'wontfix' && (
            <ActionButton
              onClick={() => onStatus('wontfix')}
              disabled={busy}
              tone="neutral"
              icon={<XIcon style={{ width: 12, height: 12 }} />}
            >
              Won&rsquo;t fix
            </ActionButton>
          )}
          {report.status !== 'open' && (
            <ActionButton
              onClick={() => onStatus('open')}
              disabled={busy}
              tone="warn"
              icon={<RefreshCw style={{ width: 12, height: 12 }} />}
            >
              Reopen
            </ActionButton>
          )}
          {mailto && (
            <a
              href={mailto}
              style={{
                padding: '7px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'rgba(125, 211, 252, 0.1)', color: '#7dd3fc',
                border: '1px solid rgba(125, 211, 252, 0.25)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                textDecoration: 'none',
              }}
            >
              <Mail style={{ width: 12, height: 12 }} />
              Reply via email
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-faint)', marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ActionButton({
  onClick, disabled, tone, icon, children,
}: {
  onClick: () => void;
  disabled: boolean;
  tone: 'success' | 'warn' | 'neutral';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    success: { bg: 'rgba(52, 211, 153, 0.12)', color: '#34d399', border: 'rgba(52, 211, 153, 0.25)' },
    warn:    { bg: 'rgba(245, 158, 11, 0.12)', color: '#fcd34d', border: 'rgba(245, 158, 11, 0.25)' },
    neutral: { bg: 'rgba(255,255,255,0.05)',    color: 'var(--fg-muted)', border: 'var(--hub-border-subtle)' },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        background: tones.bg, color: tones.color,
        border: `1px solid ${tones.border}`, cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
