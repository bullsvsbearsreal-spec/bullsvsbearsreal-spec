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

import { useState, useEffect, useCallback } from 'react';
import { X as XIcon, Crown, Shield, ChevronRight, Bell, Wallet, Key, Calendar, Eye, EyeOff, AlertCircle, Clock, CheckCircle2, UserPlus, Send, MessageSquare, Trash2 } from 'lucide-react';
import { ConfirmModal, TIER_COLORS, fmtAgo, fmtNumber, SkeletonBlock } from './primitives';

interface UserNote {
  id: number;
  body: string;
  createdAt: string;
  authorId: string | null;
  authorEmail: string | null;
  authorName: string | null;
}

interface ActivityEvent {
  type: string;
  label: string;
  detail?: string | null;
  timestamp: string;
}

function activityIcon(type: string) {
  switch (type) {
    case 'signup':            return <UserPlus      style={{ width: 11, height: 11, color: '#7dd3fc' }} />;
    case 'verified':          return <CheckCircle2  style={{ width: 11, height: 11, color: '#34d399' }} />;
    case 'last_seen':         return <Clock         style={{ width: 11, height: 11, color: 'var(--fg-muted)' }} />;
    case 'suspended':         return <EyeOff        style={{ width: 11, height: 11, color: '#f87171' }} />;
    case 'wallet_added':      return <Eye           style={{ width: 11, height: 11, color: '#c4b5fd' }} />;
    case 'key_added':         return <Key           style={{ width: 11, height: 11, color: '#fcd34d' }} />;
    case 'dex_wallet_added':  return <Wallet        style={{ width: 11, height: 11, color: '#34d399' }} />;
    case 'notification':      return <Send          style={{ width: 11, height: 11, color: '#fbbf24' }} />;
    case 'admin_action':      return <Shield        style={{ width: 11, height: 11, color: '#fbbf24' }} />;
    default:                  return <ChevronRight  style={{ width: 11, height: 11, color: 'var(--fg-muted)' }} />;
  }
}

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
type Role = 'owner' | 'admin' | 'moderator' | 'marketer' | 'advisor' | 'user';
const TIERS: Tier[] = ['free', 'trader', 'pro', 'whale'];

// Visual order + tones for role buttons. owner/admin are owner-only;
// everything else can be set by any admin/owner.
const ROLE_ORDER: { id: Role; label: string; color: string; ownerOnly: boolean }[] = [
  { id: 'owner',     label: 'Owner',     color: '#f87171', ownerOnly: true  },
  { id: 'admin',     label: 'Admin',     color: '#fbbf24', ownerOnly: true  },
  { id: 'moderator', label: 'Moderator', color: '#7dd3fc', ownerOnly: false },
  { id: 'marketer',  label: 'Marketer',  color: '#c4b5fd', ownerOnly: false },
  { id: 'advisor',   label: 'Advisor',   color: '#86efac', ownerOnly: false },
  { id: 'user',      label: 'User',      color: '#a3a3a3', ownerOnly: false },
];

export function UserDrawer({ user, viewerRole, onClose, onChanged, onToast }: {
  user: AdminUser | null;
  /** Role of the admin currently viewing the drawer — controls which
   *  role-change buttons are clickable. Defaults to 'admin'. */
  viewerRole?: 'owner' | 'admin' | string;
  onClose: () => void;
  onChanged: () => void;
  onToast: (msg: string, ok: boolean) => void;
}) {
  const isOwnerViewer = viewerRole === 'owner';
  const [pending, setPending] = useState<
    | null
    | { kind: 'tier'; tier: Tier }
    | { kind: 'role'; role: Role }
    | { kind: 'suspend' }
    | { kind: 'unsuspend' }
  >(null);
  const [activity, setActivity] = useState<ActivityEvent[] | null>(null);
  const [activityErr, setActivityErr] = useState<string | null>(null);
  const [notes, setNotes] = useState<UserNote[] | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

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

  // Load activity timeline whenever the drawer opens for a new user
  useEffect(() => {
    if (!user) return;
    setActivity(null);
    setActivityErr(null);
    fetch(`/api/admin/user-activity?userId=${encodeURIComponent(user.id)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => {
        if (d?.error) { setActivityErr(d.error); return; }
        setActivity(Array.isArray(d?.events) ? d.events : []);
      })
      .catch(e => setActivityErr(e.message ?? 'Network error'));
  }, [user]);

  // Load notes
  const reloadNotes = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/notes`);
      if (!res.ok) { setNotes([]); return; }
      const d = await res.json();
      setNotes(Array.isArray(d?.notes) ? d.notes : []);
    } catch { setNotes([]); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setNotes(null);
    setNoteDraft('');
    reloadNotes();
  }, [user, reloadNotes]);

  const addNote = async () => {
    if (!user) return;
    const body = noteDraft.trim();
    if (body.length < 1) return;
    setNoteBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        onToast(j.error || `HTTP ${res.status}`, false);
        return;
      }
      setNoteDraft('');
      await reloadNotes();
      onToast('Note added', true);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Network error', false);
    } finally {
      setNoteBusy(false);
    }
  };

  const removeNote = async (noteId: number) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/notes?noteId=${noteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        onToast(j.error || `HTTP ${res.status}`, false);
        return;
      }
      await reloadNotes();
      onToast('Note removed', true);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Network error', false);
    }
  };

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

  const performRole = async (role: Role, reason: string) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onToast(`${user.email || user.id} role → ${role}`, true);
      onChanged();
    } catch (e) {
      onToast(`Role change failed: ${e instanceof Error ? e.message : 'unknown'}`, false);
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

          {/* Activity timeline — lifecycle + behaviour events */}
          <Section title="Activity Timeline">
            {activityErr ? (
              <div style={{ fontSize: 11, color: '#fda4af' }}>{activityErr}</div>
            ) : activity === null ? (
              <SkeletonBlock w="100%" h={80} />
            ) : activity.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--fg-faint)', padding: '4px 0' }}>
                No timeline events yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 4 }}>
                {activity.map((e, i) => (
                  <div key={`${e.type}-${e.timestamp}-${i}`} style={{
                    display: 'grid', gridTemplateColumns: '18px 1fr 70px', alignItems: 'center', gap: 8,
                    padding: '4px 0',
                  }}>
                    <span>{activityIcon(e.type)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.label}
                      </div>
                      {e.detail && (
                        <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.detail}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--fg-muted)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {fmtAgo(e.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Operator notes — shared scratchpad visible to all admins */}
          <Section title="Operator Notes">
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !noteBusy) { e.preventDefault(); addNote(); } }}
                placeholder="Add a note (e.g. spam — watching, VIP)…"
                maxLength={2000}
                disabled={noteBusy}
                style={{
                  flex: 1, minWidth: 0, padding: '7px 10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--hub-border-subtle)',
                  borderRadius: 6, fontSize: 12, color: '#fff',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={addNote}
                disabled={noteBusy || noteDraft.trim().length < 1}
                style={{
                  padding: '7px 12px', borderRadius: 6,
                  background: '#fbbf24', color: '#000',
                  fontSize: 11, fontWeight: 700, border: 0,
                  cursor: (noteBusy || noteDraft.trim().length < 1) ? 'not-allowed' : 'pointer',
                  opacity: (noteBusy || noteDraft.trim().length < 1) ? 0.5 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <MessageSquare style={{ width: 11, height: 11 }} />
                Add
              </button>
            </div>
            {notes === null ? (
              <SkeletonBlock w="100%" h={40} />
            ) : notes.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--fg-faint)', padding: '4px 0' }}>
                No notes yet. Visible to every admin.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {notes.map(n => (
                  <div key={n.id} style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid var(--hub-border-subtle)',
                    borderRadius: 6, padding: '8px 10px',
                  }}>
                    <div style={{ fontSize: 12, color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {n.body}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--fg-faint)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        {n.authorEmail || n.authorName || 'unknown'} · {fmtAgo(n.createdAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeNote(n.id)}
                        title="Remove note"
                        style={{
                          background: 'transparent', border: 0, color: 'var(--fg-muted)',
                          cursor: 'pointer', padding: 2,
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        <Trash2 style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Tier override */}
          {/* Role override — owner sees all 6 buttons; non-owner admins
              see only the 4 non-restricted ones (moderator/marketer/
              advisor/user). The current role is highlighted + disabled. */}
          <Section title="Role">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {ROLE_ORDER.map(r => {
                const isCurrent = user.role === r.id;
                const blockedByPolicy = r.ownerOnly && !isOwnerViewer;
                const isOwnerTarget = user.role === 'owner';
                // Non-owner admins can't demote the current owner
                const demoteBlocked = isOwnerTarget && !isOwnerViewer;
                const disabled = isCurrent || blockedByPolicy || demoteBlocked;
                const title = blockedByPolicy
                  ? 'Owner role required'
                  : demoteBlocked
                    ? 'Only owner can change owner'
                    : isCurrent
                      ? 'Current role'
                      : `Change role to ${r.label}`;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => !disabled && setPending({ kind: 'role', role: r.id })}
                    disabled={disabled}
                    title={title}
                    style={{
                      padding: '8px 6px',
                      background: isCurrent ? `${r.color}22` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isCurrent ? r.color + '55' : 'var(--hub-border-subtle)'}`,
                      borderRadius: 6,
                      color: isCurrent ? r.color : (blockedByPolicy || demoteBlocked) ? 'var(--fg-faint)' : '#fff',
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: (blockedByPolicy || demoteBlocked) ? 0.4 : 1,
                    }}
                  >
                    {r.label}{isCurrent && ' ✓'}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 8 }}>
              {isOwnerViewer
                ? 'You can grant any role. Demoting the owner requires explicit confirmation.'
                : 'Owner + admin roles are owner-only. Demoting the current owner is also blocked.'}
            </div>
          </Section>

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
        open={pending?.kind === 'role'}
        title={pending?.kind === 'role' ? `Change role to ${pending.role.toUpperCase()}?` : ''}
        description={
          pending?.kind === 'role' ? (
            <>This will set <strong style={{ color: '#fff' }}>{user.email || user.id}</strong>&apos;s role to{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: ROLE_ORDER.find(r => r.id === pending.role)?.color ?? '#fff' }}>
              {pending.role}
            </code>{' '}
            and write to audit_log.
            {(pending.role === 'owner' || pending.role === 'admin') && (
              <> <strong style={{ color: '#fca5a5' }}>This grants high-trust access.</strong></>
            )}
            </>
          ) : ''
        }
        confirmText={pending?.kind === 'role' && (pending.role === 'owner' || pending.role === 'admin') ? 'GRANT' : 'CONFIRM'}
        confirmLabel="Change role"
        danger={pending?.kind === 'role' && (pending.role === 'owner' || pending.role === 'admin')}
        onConfirm={(reason) => pending?.kind === 'role' ? performRole(pending.role, reason) : Promise.resolve()}
        onCancel={() => setPending(null)}
      />

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
  // Grid layout (not flex space-between) so the value column can
  // shrink and break long content (UUIDs, emails, addresses) without
  // forcing the drawer to widen. Right-aligned + word-break:break-all
  // means a 36-char UUID still fits the 520px drawer.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'start', gap: 12, padding: '5px 0' }}>
      <span style={{ fontSize: 11, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{
        fontSize: 12, color: '#fff',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        textAlign: 'right',
        minWidth: 0,
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }}>{value}</span>
    </div>
  );
}

function ActivityRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      <span style={{ color: 'var(--fg-muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--fg-default)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{fmtNumber(value)}</span>
    </div>
  );
}
