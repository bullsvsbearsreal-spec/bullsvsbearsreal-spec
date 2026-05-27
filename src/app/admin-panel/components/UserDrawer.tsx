'use client';

/**
 * Slide-out drawer triggered by clicking a user row in the Users tab.
 *
 * Sections:
 *   1. Profile + activity timeline — email/name/role/tier/joined/last seen,
 *      counts of alerts/wallets/keys, recent events list.
 *   2. Tier override — 4 buttons promote/demote across Free/Trader/Pro/Whale.
 *      Writes audit_log entry with the required reason field via
 *      ConfirmModal.
 *   3. Suspend / unban — toggles users.suspended_at. Same confirm flow.
 *
 * Force-logout deferred — was on the original spec but cut for first
 * ship to keep blast radius small. Suspending already invalidates
 * future requests on next session check.
 */

import { useState, useEffect } from 'react';
import { X as XIcon, Crown, Shield, ChevronRight, Bell, Wallet, Key, Calendar, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { ConfirmModal, TIER_COLORS, fmtAgo, fmtNumber, SkeletonBlock } from './primitives';

export interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  billingTier: string;
  createdAt: string;
  lastSeen: string | null;
  suspendedAt: string | null;
  emailVerified: string | null;
  alertCount: number;
  watchedWalletsCount: number;
  connectedKeysCount: number;
  connectedWalletsCount: number;
  notificationsSent: number;
}

type Tier = 'free' | 'trader' | 'pro' | 'whale';
const TIERS: Tier[] = ['free', 'trader', 'pro', 'whale'];

export function UserDrawer({ user, onClose, onChanged, onToast }: {
  user: AdminUser | null;
  onClose: () => void;
  onChanged: () => void;
  onToast: (msg: string, ok: boolean) => void;
}) {
  const [pending, setPending] = useState<null | { kind: 'tier'; tier: Tier } | { kind: 'suspend' } | { kind: 'unsuspend' }>(null);

  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [user, onClose]);

  if (!user) return null;

  const isSuspended = !!user.suspendedAt;

  const setTier = (tier: Tier) => setPending({ kind: 'tier', tier });

  const performTier = async (tier: Tier, reason: string) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingTier: tier, reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onToast(`${user.email || user.id} → ${tier}`, true);
      onChanged();
    } catch (e) {
      onToast(`Tier change failed: ${e instanceof Error ? e.message : 'unknown'}`, false);
    }
    setPending(null);
  };

  const performSuspend = async (reason: string) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onToast(`Suspended ${user.email || user.id}`, true);
      onChanged();
    } catch (e) {
      onToast(`Suspend failed: ${e instanceof Error ? e.message : 'unknown'}`, false);
    }
    setPending(null);
  };

  const performUnsuspend = async (reason: string) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onToast(`Unsuspended ${user.email || user.id}`, true);
      onChanged();
    } catch (e) {
      onToast(`Unsuspend failed: ${e instanceof Error ? e.message : 'unknown'}`, false);
    }
    setPending(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
        }}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`User detail · ${user.email || user.id}`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 51,
          width: 'min(520px, 90vw)',
          background: 'var(--hub-black)',
          borderLeft: '1px solid var(--hub-border)',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.4)',
          overflowY: 'auto',
          color: 'var(--fg-default)',
        }}
      >
        {/* Drawer header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          background: 'var(--hub-black)',
          borderBottom: '1px solid var(--hub-border-subtle)',
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {user.name || (user.email ? user.email.split('@')[0] : '(no name)')}
              </span>
              {user.role === 'admin' && <Crown style={{ width: 14, height: 14, color: '#fbbf24' }} />}
              {user.role === 'advisor' && <Shield style={{ width: 14, height: 14, color: '#7dd3fc' }} />}
              {isSuspended && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                  background: 'rgba(244, 63, 94, 0.15)', color: '#fca5a5',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>Suspended</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background: 'transparent', border: 0, cursor: 'pointer',
              color: 'var(--fg-muted)', padding: 4,
            }}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 18px' }}>

          {/* Profile facts */}
          <Section title="Profile">
            <Field label="User ID"        value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{user.id}</span>} />
            <Field label="Role"           value={user.role} mono />
            <Field label="Tier"           value={
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                background: `${TIER_COLORS[user.billingTier] ?? TIER_COLORS.free}22`,
                color: TIER_COLORS[user.billingTier] ?? TIER_COLORS.free,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{user.billingTier}</span>
            } />
            <Field label="Joined"         value={`${fmtAgo(user.createdAt)} · ${new Date(user.createdAt).toLocaleDateString()}`} />
            <Field label="Last seen"      value={user.lastSeen ? fmtAgo(user.lastSeen) : <span style={{ color: 'var(--fg-faint)' }}>never (no last_seen)</span>} />
            <Field label="Email verified" value={user.emailVerified ? '✓' : <span style={{ color: 'var(--fg-faint)' }}>pending</span>} />
          </Section>

          {/* Activity counts */}
          <Section title="Activity">
            <ActivityRow icon={<Bell className="w-3 h-3" />}    label="Active alerts"      value={user.alertCount} />
            <ActivityRow icon={<Eye className="w-3 h-3" />}     label="Watched wallets"    value={user.watchedWalletsCount} />
            <ActivityRow icon={<Key className="w-3 h-3" />}     label="Connected keys"     value={user.connectedKeysCount} />
            <ActivityRow icon={<Wallet className="w-3 h-3" />}  label="Connected wallets"  value={user.connectedWalletsCount} />
            <ActivityRow icon={<Calendar className="w-3 h-3" />} label="Notifications sent" value={user.notificationsSent} />
          </Section>

          {/* Tier override */}
          <Section title="Tier Override">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {TIERS.map(t => {
                const isCurrent = user.billingTier === t;
                return (
                  <button
                    key={t}
                    onClick={() => !isCurrent && setTier(t)}
                    disabled={isCurrent}
                    style={{
                      padding: '8px 6px',
                      background: isCurrent ? `${TIER_COLORS[t]}22` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isCurrent ? TIER_COLORS[t] + '55' : 'var(--hub-border-subtle)'}`,
                      borderRadius: 6,
                      color: isCurrent ? TIER_COLORS[t] : '#fff',
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      cursor: isCurrent ? 'default' : 'pointer',
                    }}
                  >
                    {t}{isCurrent && ' ✓'}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 8 }}>
              Tier change requires a reason (audit trail). Each click opens a confirm modal.
            </div>
          </Section>

          {/* Suspend / unban */}
          <Section title="Account Status">
            {!isSuspended ? (
              <button
                onClick={() => setPending({ kind: 'suspend' })}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'rgba(244, 63, 94, 0.08)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  borderRadius: 6, color: '#fca5a5',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <EyeOff className="w-3.5 h-3.5" />
                Suspend account
              </button>
            ) : (
              <button
                onClick={() => setPending({ kind: 'unsuspend' })}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 6, color: '#86efac',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                Unsuspend account
              </button>
            )}
            <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-px" />
              <span>Suspending sets <code style={{ fontFamily: 'var(--font-mono)' }}>users.suspended_at</code>. NextAuth rejects them on next session check. Sessions already in flight expire within ~5 min.</span>
            </div>
          </Section>

        </div>
      </aside>

      {/* Confirm modals */}
      <ConfirmModal
        open={pending?.kind === 'tier'}
        title={pending?.kind === 'tier' ? `Change tier to ${pending.tier.toUpperCase()}?` : ''}
        description={
          <>This will set <strong style={{ color: '#fff' }}>{user.email || user.id}</strong>&apos;s billing_tier to{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: pending?.kind === 'tier' ? TIER_COLORS[pending.tier] : '#fff' }}>
            {pending?.kind === 'tier' ? pending.tier : ''}
          </code>{' '}
          and write to audit_log. The user&apos;s perms reflect immediately on their next request.</>
        }
        confirmLabel="Change tier"
        danger={pending?.kind === 'tier' && (pending.tier === 'whale' || pending.tier === 'pro')}
        onConfirm={(reason) => pending?.kind === 'tier' ? performTier(pending.tier, reason) : Promise.resolve()}
        onCancel={() => setPending(null)}
      />
      <ConfirmModal
        open={pending?.kind === 'suspend'}
        title="Suspend account?"
        description={<>This will set <strong style={{ color: '#fff' }}>{user.email || user.id}</strong>&apos;s <code style={{ fontFamily: 'var(--font-mono)' }}>suspended_at</code>. They can no longer sign in. Existing sessions invalidate on next refresh (~5 min).</>}
        confirmText="SUSPEND"
        confirmLabel="Suspend"
        danger
        onConfirm={performSuspend}
        onCancel={() => setPending(null)}
      />
      <ConfirmModal
        open={pending?.kind === 'unsuspend'}
        title="Unsuspend account?"
        description={<>This will clear <strong style={{ color: '#fff' }}>{user.email || user.id}</strong>&apos;s suspended_at timestamp. They can sign in immediately.</>}
        confirmText="RESTORE"
        confirmLabel="Unsuspend"
        onConfirm={performUnsuspend}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--fg-muted)',
        marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
      <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#fff', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</span>
    </div>
  );
}

function ActivityRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      <span style={{ color: 'var(--fg-muted)' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--fg-default)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>{fmtNumber(value)}</span>
    </div>
  );
}
