'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Download, RefreshCw, Crown, Shield, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, ConfirmModal, fmtAgo, fmtNumber, TIER_COLORS } from '../components/primitives';
import { UserDrawer, type AdminUser } from '../components/UserDrawer';

type SortKey = 'createdAt' | 'lastSeen' | 'alertCount' | 'watchedWalletsCount' | 'email';
type SortDir = 'asc' | 'desc';
type RecencyFilter = 'all' | '24h' | '7d' | '30d';

/**
 * Users tab — searchable + filterable table with row-click drawer.
 *
 * Filters:
 *   - Text search across email / name / id
 *   - Tier chips (Free / Trader / Pro / Whale / Admin)
 *   - Recency chips (24h / 7d / 30d / all)
 * Sort:
 *   - Click column header. Default: createdAt DESC.
 * Actions:
 *   - Click row → UserDrawer
 *   - CSV export top-right
 */
export function UsersTab({ onToast, viewerRole }: { onToast: (msg: string, ok: boolean) => void; viewerRole?: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<Set<string>>(new Set());
  const [recency, setRecency] = useState<RecencyFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [openUser, setOpenUser] = useState<AdminUser | null>(null);

  // Bulk-selection state — held as a Set of user ids. Cleared when
  // filters change or a bulk action runs.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<
    | null
    | { kind: 'tier'; tier: 'free' | 'trader' | 'pro' | 'whale' }
    | { kind: 'suspend' }
    | { kind: 'unsuspend' }
    | { kind: 'role'; role: 'admin' | 'moderator' | 'marketer' | 'support' | 'advisor' | 'user' }
  >(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // load stays stable (empty deps) — uses functional setUsers in the
  // catch branch so we don't need `users` in the closure. Prior shape
  // had `[users]` as a dep which invalidated the callback on every
  // refresh and re-triggered the loading spinner.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users?limit=500');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list: AdminUser[] = (json.users || []).map((u: any) => ({
        id: String(u.id),
        email: u.email ?? null,
        name: u.name ?? null,
        role: u.role ?? 'user',
        billingTier: u.billingTier ?? u.billing_tier ?? 'free',
        createdAt: u.createdAt ?? u.created_at ?? null,
        lastSeen: u.lastSeen ?? u.last_seen ?? null,
        suspendedAt: u.suspendedAt ?? u.suspended_at ?? null,
        emailVerified: u.emailVerified ?? u.email_verified ?? null,
        alertCount: Number(u.alertCount ?? 0),
        watchedWalletsCount: Number(u.watchedWalletsCount ?? 0),
        connectedKeysCount: Number(u.connectedKeysCount ?? 0),
        connectedWalletsCount: Number(u.connectedWalletsCount ?? 0),
        notificationsSent: Number(u.notificationsSent ?? 0),
      }));
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
      setUsers(prev => prev ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Cross-tab handoff: Overview's Recent Signups row click stashes a
  // userId in sessionStorage, then navigates to #users. Once the user
  // list loads, find that user and open the drawer.
  useEffect(() => {
    if (!users) return;
    let pending: string | null = null;
    try { pending = sessionStorage.getItem('admin:open_user_id'); } catch {}
    if (!pending) return;
    const target = users.find(u => u.id === pending);
    if (target) {
      setOpenUser(target);
      try { sessionStorage.removeItem('admin:open_user_id'); } catch {}
    }
  }, [users]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const recencyMs = recency === '24h' ? 86400_000 : recency === '7d' ? 7 * 86400_000 : recency === '30d' ? 30 * 86400_000 : 0;

    return users
      .filter(u => {
        if (q && !(
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.name && u.name.toLowerCase().includes(q)) ||
          u.id.toLowerCase().includes(q)
        )) return false;
        if (tierFilter.size > 0) {
          // tierFilter holds "tier" values OR role values.
          // Match if user's role matches, OR user's billing_tier matches.
          const tier = u.billingTier;
          const matchTier = tierFilter.has(tier);
          const matchRole = tierFilter.has(u.role);
          if (!matchTier && !matchRole) return false;
        }
        if (recencyMs > 0 && u.createdAt) {
          if (now - new Date(u.createdAt).getTime() > recencyMs) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const av = (a as any)[sortKey];
        const bv = (b as any)[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        // Dates as strings → still sortable lexicographically when ISO.
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
      });
  }, [users, search, tierFilter, recency, sortKey, sortDir]);

  const toggleTier = (t: string) => {
    setTierFilter(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Default sort direction for each column type
      setSortDir(['createdAt', 'lastSeen'].includes(key) ? 'desc' : 'desc');
    }
  };

  const downloadCsv = () => {
    window.location.href = '/api/admin/users/csv';
  };

  const fireBulk = async (reason: string) => {
    if (!bulkConfirm) return;
    setBulkBusy(true);
    try {
      const userIds = Array.from(selected);
      const payload: Record<string, unknown> = {
        userIds,
        reason,
        action: bulkConfirm.kind, // 'tier' | 'suspend' | 'unsuspend' | 'role'
      };
      if (bulkConfirm.kind === 'tier') payload.billingTier = bulkConfirm.tier;
      if (bulkConfirm.kind === 'role') payload.role = bulkConfirm.role;
      const res = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        onToast(json.error || `HTTP ${res.status}`, false);
        return;
      }
      const summary = `${json.processed}/${userIds.length} processed${json.skippedSelf ? ` · 1 self skipped` : ''}`;
      onToast(summary, json.processed > 0);
      setSelected(new Set());
      await load(true);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Network error', false);
    } finally {
      setBulkBusy(false);
      setBulkConfirm(null);
    }
  };

  return (
    <>
      <SectionHead
        title={`Users · ${users ? users.length : '—'} total · ${filtered.length} matching`}
        icon={<Search style={{ width: 13, height: 13 }} />}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              style={{ background: 'transparent', border: 0, color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={downloadCsv}
              style={{ background: 'transparent', border: 0, color: 'var(--hub-accent)', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
        }
      />

      {/* Filter row */}
      <Card title="Filters">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 240 }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: 'var(--fg-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search email · name · id"
              style={{
                width: '100%', padding: '7px 10px 7px 30px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--hub-border-subtle)',
                borderRadius: 6, color: '#fff', fontSize: 12,
              }}
            />
          </div>

          {/* Tier chips */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['free', 'trader', 'pro', 'whale'] as const).map(t => {
              const active = tierFilter.has(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTier(t)}
                  style={{
                    padding: '5px 10px',
                    background: active ? `${TIER_COLORS[t]}22` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? TIER_COLORS[t] + '55' : 'var(--hub-border-subtle)'}`,
                    borderRadius: 999,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: active ? TIER_COLORS[t] : 'var(--fg-muted)',
                    cursor: 'pointer',
                  }}
                >{t}</button>
              );
            })}
          </div>

          {/* Role chips — same filter set as tier chips so toggling any
              of these narrows the rows to that role OR tier. Useful for
              "show me all moderators" or "show all marketers". */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(
              [
                { id: 'owner',     label: 'Owner',     color: '#f87171' },
                { id: 'admin',     label: 'Admin',     color: '#fbbf24' },
                { id: 'moderator', label: 'Mod',       color: '#7dd3fc' },
                { id: 'marketer',  label: 'Mkt',       color: '#c4b5fd' },
                { id: 'support',   label: 'Support',   color: '#fdba74' },
                { id: 'advisor',   label: 'Advisor',   color: '#86efac' },
              ] as const
            ).map(r => {
              const active = tierFilter.has(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleTier(r.id)}
                  style={{
                    padding: '5px 10px',
                    background: active ? `${r.color}22` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? r.color + '55' : 'var(--hub-border-subtle)'}`,
                    borderRadius: 999,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: active ? r.color : 'var(--fg-muted)',
                    cursor: 'pointer',
                  }}
                  title={`Filter to ${r.id} role`}
                >{r.label}</button>
              );
            })}
          </div>

          {/* Recency chips */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['24h', '7d', '30d', 'all'] as const).map(r => {
              const active = recency === r;
              return (
                <button
                  key={r}
                  onClick={() => setRecency(r)}
                  style={{
                    padding: '5px 10px',
                    background: active ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(245, 158, 11, 0.4)' : 'var(--hub-border-subtle)'}`,
                    borderRadius: 999,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: active ? '#fcd34d' : 'var(--fg-muted)',
                    cursor: 'pointer',
                  }}
                >{r === 'all' ? 'all-time' : `last ${r}`}</button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Bulk-action toolbar — only renders when at least one row is selected */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '10px 14px', marginTop: 8,
          background: 'rgba(251, 191, 36, 0.06)',
          border: '1px solid rgba(251, 191, 36, 0.25)',
          borderRadius: 8,
          position: 'sticky', top: 0, zIndex: 5,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fcd34d', fontFamily: 'var(--font-mono)' }}>
            {selected.size} selected
          </span>
          <span style={{ flex: 1, fontSize: 10, color: 'var(--fg-faint)', minWidth: 180 }}>
            All bulk actions need a reason. Your own account is silently skipped.
          </span>
          {/* Tier buttons */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['free', 'trader', 'pro', 'whale'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setBulkConfirm({ kind: 'tier', tier: t })}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: 'rgba(255,255,255,0.05)', color: TIER_COLORS[t] ?? '#fff',
                  border: `1px solid ${TIER_COLORS[t] ?? '#fff'}33`,
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}
              >→ {t}</button>
            ))}
          </div>
          {/* Role buttons — owner sees 'admin' too, others can't grant admin or owner.
              Owner grant is always per-user (with type-to-confirm), never bulk. */}
          <div style={{ display: 'flex', gap: 4, paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            {(
              [
                ...(viewerRole === 'owner' ? [{ id: 'admin', label: 'Admin', color: '#fbbf24' }] : []),
                { id: 'moderator', label: 'Mod',     color: '#7dd3fc' },
                { id: 'marketer',  label: 'Mkt',     color: '#c4b5fd' },
                { id: 'support',   label: 'Support', color: '#fdba74' },
                { id: 'advisor',   label: 'Advisor', color: '#86efac' },
                { id: 'user',      label: 'User',    color: '#94a3b8' },
              ] as const
            ).map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setBulkConfirm({ kind: 'role', role: r.id as any })}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: 'rgba(255,255,255,0.05)', color: r.color,
                  border: `1px solid ${r.color}33`,
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}
                title={`Grant ${r.id} role to ${selected.size} users`}
              >→ {r.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={() => setBulkConfirm({ kind: 'suspend' })}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: 'rgba(244, 63, 94, 0.12)', color: '#fca5a5',
                border: '1px solid rgba(244, 63, 94, 0.3)', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >Suspend</button>
            <button
              type="button"
              onClick={() => setBulkConfirm({ kind: 'unsuspend' })}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: 'rgba(52, 211, 153, 0.1)', color: '#86efac',
                border: '1px solid rgba(52, 211, 153, 0.25)', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >Unsuspend</button>
          </div>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: 'transparent', color: 'var(--fg-muted)',
              border: '1px solid var(--hub-border-subtle)', cursor: 'pointer',
            }}
          >Clear</button>
        </div>
      )}

      {/* Table */}
      <div style={{
        marginTop: 12,
        background: 'var(--hub-darker)',
        border: '1px solid var(--hub-border-subtle)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 14 }}>
            <SkeletonBlock w="100%" h={20} />
            <div style={{ height: 4 }} />
            <SkeletonBlock w="100%" h={20} />
            <div style={{ height: 4 }} />
            <SkeletonBlock w="100%" h={20} />
          </div>
        ) : error && filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--rekt-mild)', fontSize: 12 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-faint)', fontSize: 12 }}>No users match the current filters.</div>
        ) : (
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hub-border-subtle)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                <th style={{ width: 32, padding: '10px 0 10px 12px' }}>
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={filtered.length > 0 && filtered.slice(0, 200).every(u => selected.has(u.id))}
                    onChange={e => {
                      const next = new Set(selected);
                      const visible = filtered.slice(0, 200);
                      if (e.target.checked) visible.forEach(u => next.add(u.id));
                      else visible.forEach(u => next.delete(u.id));
                      setSelected(next);
                    }}
                  />
                </th>
                <Th label="User"     onClick={() => setSort('email')}             sorted={sortKey === 'email' ? sortDir : null} />
                <Th label="Tier"     onClick={() => undefined} sorted={null} />
                <Th label="Alerts"   onClick={() => setSort('alertCount')}        sorted={sortKey === 'alertCount' ? sortDir : null} alignRight />
                <Th label="Wallets"  onClick={() => setSort('watchedWalletsCount')} sorted={sortKey === 'watchedWalletsCount' ? sortDir : null} alignRight />
                <Th label="Last seen" onClick={() => setSort('lastSeen')}          sorted={sortKey === 'lastSeen' ? sortDir : null} alignRight />
                <Th label="Joined"   onClick={() => setSort('createdAt')}         sorted={sortKey === 'createdAt' ? sortDir : null} alignRight />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(u => (
                <tr
                  key={u.id}
                  onClick={() => setOpenUser(u)}
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    background: selected.has(u.id) ? 'rgba(251, 191, 36, 0.05)' : undefined,
                  }}
                  onMouseEnter={e => { if (!selected.has(u.id)) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { if (!selected.has(u.id)) (e.currentTarget as HTMLElement).style.background = ''; }}
                >
                  <td style={{ padding: '10px 0 10px 12px' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${u.email ?? u.id}`}
                      checked={selected.has(u.id)}
                      onChange={e => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(u.id); else next.delete(u.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Live-status dot — green pulse if last_seen < 5 min */}
                      {u.lastSeen && (Date.now() - new Date(u.lastSeen).getTime()) < 5 * 60_000 && (
                        <span title="Active in the last 5 minutes" className="pulse-success" style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#22c55e',
                          boxShadow: '0 0 4px rgba(34,197,94,0.6)',
                          flexShrink: 0,
                        }} />
                      )}
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {u.name || (u.email ? u.email.split('@')[0] : '(no name)')}
                      </span>
                      {(() => {
                        // Unified role badge — text pill so every elevated
                        // role is immediately legible (the prior icons-only
                        // shape made the badges easy to miss).
                        const ROLE_PILL: Record<string, { label: string; color: string; bg: string }> = {
                          owner:     { label: 'OWNER',   color: '#fca5a5', bg: 'rgba(244, 63, 94, 0.18)' },
                          admin:     { label: 'ADMIN',   color: '#fcd34d', bg: 'rgba(251, 191, 36, 0.18)' },
                          moderator: { label: 'MOD',     color: '#7dd3fc', bg: 'rgba(125, 211, 252, 0.18)' },
                          marketer:  { label: 'MKT',     color: '#c4b5fd', bg: 'rgba(196, 181, 253, 0.18)' },
                          support:   { label: 'SUPPORT', color: '#fdba74', bg: 'rgba(253, 186, 116, 0.18)' },
                          advisor:   { label: 'ADVISOR', color: '#86efac', bg: 'rgba(52, 211, 153, 0.18)' },
                        };
                        const pill = ROLE_PILL[u.role];
                        if (!pill) return null;
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 9, fontWeight: 800,
                            padding: '2px 6px', borderRadius: 4,
                            background: pill.bg, color: pill.color,
                            letterSpacing: '0.08em',
                            border: `1px solid ${pill.color}44`,
                          }}>
                            {u.role === 'owner' && <Crown style={{ width: 9, height: 9 }} />}
                            {u.role === 'admin' && <Crown style={{ width: 9, height: 9 }} />}
                            {u.role === 'advisor' && <Shield style={{ width: 9, height: 9 }} />}
                            {pill.label}
                          </span>
                        );
                      })()}
                      {u.suspendedAt && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
                          background: 'rgba(244, 63, 94, 0.15)', color: '#fca5a5',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>Susp</span>
                      )}
                    </div>
                    {u.email && (
                      <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>{u.email}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', borderRadius: 999,
                      background: `${TIER_COLORS[u.billingTier] ?? TIER_COLORS.free}22`,
                      color: TIER_COLORS[u.billingTier] ?? TIER_COLORS.free,
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{u.billingTier}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: u.alertCount > 0 ? '#fff' : 'var(--fg-faint)' }}>{u.alertCount}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: u.watchedWalletsCount > 0 ? '#fff' : 'var(--fg-faint)' }}>{u.watchedWalletsCount}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{u.lastSeen ? fmtAgo(u.lastSeen) : '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{u.createdAt ? fmtAgo(u.createdAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 200 && (
          <div style={{ padding: 10, fontSize: 10, color: 'var(--fg-faint)', textAlign: 'center', borderTop: '1px solid var(--hub-border-subtle)' }}>
            Showing first 200 of {filtered.length}. Narrow filters or export CSV for the rest.
          </div>
        )}
      </div>

      <UserDrawer
        user={openUser}
        viewerRole={viewerRole}
        onClose={() => setOpenUser(null)}
        onChanged={() => { load(true); setOpenUser(null); }}
        onToast={onToast}
      />

      <ConfirmModal
        open={bulkConfirm !== null && !bulkBusy}
        title={
          bulkConfirm?.kind === 'tier' ? `Set ${selected.size} users to ${bulkConfirm.tier.toUpperCase()}?` :
          bulkConfirm?.kind === 'suspend' ? `Suspend ${selected.size} users?` :
          bulkConfirm?.kind === 'unsuspend' ? `Unsuspend ${selected.size} users?` : ''
        }
        description={
          <>This will affect <strong style={{ color: '#fff' }}>{selected.size}</strong> user{selected.size === 1 ? '' : 's'}.
          Your own account is silently skipped. Each row writes its own audit entry plus one batch summary.</>
        }
        confirmText={bulkConfirm?.kind === 'suspend' ? 'SUSPEND' : bulkConfirm?.kind === 'unsuspend' ? 'RESTORE' : 'CONFIRM'}
        confirmLabel={
          bulkConfirm?.kind === 'tier' ? 'Change tier' :
          bulkConfirm?.kind === 'suspend' ? 'Suspend all' :
          bulkConfirm?.kind === 'unsuspend' ? 'Unsuspend all' : 'Confirm'
        }
        danger={bulkConfirm?.kind === 'suspend' || (bulkConfirm?.kind === 'tier' && (bulkConfirm.tier === 'whale' || bulkConfirm.tier === 'pro'))}
        onConfirm={fireBulk}
        onCancel={() => setBulkConfirm(null)}
      />
    </>
  );
}

function Th({ label, onClick, sorted, alignRight }: { label: string; onClick?: () => void; sorted: SortDir | null; alignRight?: boolean }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '10px 12px',
        textAlign: alignRight ? 'right' : 'left',
        fontWeight: 700, cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: sorted ? '#fff' : 'inherit' }}>
        {label}
        {sorted === 'asc'  && <ArrowUp className="w-2.5 h-2.5" />}
        {sorted === 'desc' && <ArrowDown className="w-2.5 h-2.5" />}
        {!sorted && onClick && <ArrowUpDown className="w-2.5 h-2.5" style={{ opacity: 0.3 }} />}
      </span>
    </th>
  );
}
