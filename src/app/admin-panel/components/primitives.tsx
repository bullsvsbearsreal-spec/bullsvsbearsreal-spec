'use client';

/**
 * Shared admin dashboard primitives. Anything reused across ≥2 tabs
 * lives here so the per-tab files stay focused on their content,
 * not their chrome.
 */

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

// ────────────────────────────────────────────────────────────────────
// Card — accent-bordered container used for every metric panel
// ────────────────────────────────────────────────────────────────────
export function Card({ title, action, children, dense }: { title: string; action?: React.ReactNode; children: React.ReactNode; dense?: boolean }) {
  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 10,
      padding: dense ? 12 : 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: dense ? 8 : 10,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--fg-muted)',
        }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Section heading — used to group multiple cards inside a tab
// ────────────────────────────────────────────────────────────────────
export function SectionHead({ title, icon, right }: { title: string; icon: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 10, marginTop: 4,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: 'var(--fg-muted)',
    }}>
      <span style={{ color: 'var(--fg-muted)' }}>{icon}</span>
      <span>{title}</span>
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Skeleton placeholder — shimmer block while data loads
// ────────────────────────────────────────────────────────────────────
export function SkeletonBlock({ w = '100%', h = 16 }: { w?: number | string; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} aria-hidden />
  );
}

// ────────────────────────────────────────────────────────────────────
// Sparkline — 7-day mini-chart used inside SparkCard
// ────────────────────────────────────────────────────────────────────
export function Sparkline({ data, color, w = 60, h = 20 }: { data?: number[]; color: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return <span style={{ color: 'var(--fg-faint)', fontSize: 10 }}>no trend</span>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────
// Toast — bottom-right action result feedback
// ────────────────────────────────────────────────────────────────────
export interface ToastMsg { msg: string; ok: boolean }

export function ToastHost({ toast, onClear }: { toast: ToastMsg | null; onClear: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClear, 4000);
    return () => clearTimeout(t);
  }, [toast, onClear]);
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 100,
      background: toast.ok ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
      border: `1px solid ${toast.ok ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
      borderRadius: 8, padding: '10px 14px',
      fontSize: 12, fontWeight: 600,
      color: toast.ok ? '#86efac' : '#fca5a5',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', gap: 8,
      maxWidth: 420,
    }}>
      {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      <span>{toast.msg}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Type-to-confirm modal — used for destructive ops (broadcast,
// suspend, tier override). Requires the user to type the
// `confirmText` (default "CONFIRM") into the input before the
// confirm button enables. Reason field is required by default —
// pass requireReason={false} to opt out.
// ────────────────────────────────────────────────────────────────────
export function ConfirmModal({
  open, title, description, confirmText = 'CONFIRM',
  confirmLabel = 'Confirm', danger,
  requireReason = true,
  onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  confirmLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setTyped('');
      setReason('');
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Esc to cancel
  useEffect(() => {
    if (!open || busy) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const canConfirm = typed === confirmText && (!requireReason || reason.trim().length > 0) && !busy;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--hub-darker)',
        border: `1px solid ${danger ? 'rgba(244, 63, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
        borderRadius: 14,
        padding: 22,
        maxWidth: 480, width: '100%',
        color: 'var(--fg-default)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          background: danger ? 'rgba(244, 63, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
          color: danger ? '#fca5a5' : '#fcd34d',
          marginBottom: 14,
        }}>
          <AlertTriangle className="w-3 h-3" /> Confirm destructive action
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.01em' }}>{title}</h2>
        <div style={{
          fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55, marginBottom: 16,
          overflowWrap: 'anywhere', wordBreak: 'break-word',
        }}>{description}</div>

        {requireReason && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-muted)', display: 'block', marginBottom: 5 }}>
              Reason (audit trail) <span style={{ color: 'var(--rekt-mild)' }}>required</span>
            </label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. spam · charge-back · upgrade comp"
              disabled={busy}
              style={{
                width: '100%', padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--hub-border-subtle)',
                borderRadius: 6, color: '#fff',
                fontSize: 13, fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-muted)', display: 'block', marginBottom: 5 }}>
          Type <code style={{ color: danger ? '#fca5a5' : '#fcd34d', fontFamily: 'var(--font-mono)' }}>{confirmText}</code> to enable
        </label>
        <input
          ref={inputRef}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          disabled={busy}
          style={{
            width: '100%', padding: '8px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--hub-border-subtle)',
            borderRadius: 6, color: '#fff',
            fontSize: 13, fontFamily: 'var(--font-mono)',
            marginBottom: 16,
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: 'transparent', color: 'var(--fg-muted)',
              border: '1px solid var(--hub-border-subtle)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!canConfirm) return;
              setBusy(true);
              try { await onConfirm(reason.trim()); } finally { setBusy(false); }
            }}
            disabled={!canConfirm}
            style={{
              padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              background: canConfirm ? (danger ? '#f43f5e' : '#f59e0b') : 'rgba(255,255,255,0.06)',
              color: canConfirm ? '#fff' : 'var(--fg-faint)',
              border: 0, cursor: canConfirm ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {busy && <RefreshCw className="w-3 h-3 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Red banner — sticky operator alert at the top of the dashboard.
// Renders only when at least one condition is hot.
// ────────────────────────────────────────────────────────────────────
export function RedBanner({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return (
    <div style={{
      background: 'rgba(244, 63, 94, 0.1)',
      border: '1px solid rgba(244, 63, 94, 0.3)',
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 12, color: '#fca5a5',
    }}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <div style={{ flex: 1 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'inline' }}>
            {i > 0 && <span style={{ margin: '0 8px', color: 'rgba(244, 63, 94, 0.4)' }}>·</span>}
            {m}
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Formatting helpers
// ────────────────────────────────────────────────────────────────────
export function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function fmtPct(n: number, places = 1): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(places)}%`;
}

export function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// Tier color palette — mirrors lib/constants/tiers.ts brand intent.
export const TIER_COLORS: Record<string, string> = {
  free:   'rgb(115, 115, 115)',
  trader: 'rgb(125, 211, 252)',
  pro:    'rgb(52, 211, 153)',
  whale:  'rgb(196, 181, 253)',
  admin:  'rgb(251, 191, 36)',
};
