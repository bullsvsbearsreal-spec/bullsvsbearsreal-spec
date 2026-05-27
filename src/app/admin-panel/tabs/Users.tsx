'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Download, RefreshCw, Crown, Shield, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtAgo, fmtNumber, TIER_COLORS } from '../components/primitives';
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
export function UsersTab({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
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
          // tierFilter holds "tier" values OR "admin" (a role, not a tier).
          // Match if user's role matches, OR user's billing_tier matches.
          const tier = u.billingTier;
          const matchTier = tierFilter.has(tier);
          const matchRole = tierFilter.has('admin') && u.role === 'admin';
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
            {(['free', 'trader', 'pro', 'whale', 'admin'] as const).map(t => {
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
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {u.name || (u.email ? u.email.split('@')[0] : '(no name)')}
                      </span>
                      {u.role === 'admin' && <Crown style={{ width: 12, height: 12, color: '#fbbf24' }} />}
                      {u.role === 'advisor' && <Shield style={{ width: 12, height: 12, color: '#7dd3fc' }} />}
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
        onClose={() => setOpenUser(null)}
        onChanged={() => { load(true); setOpenUser(null); }}
        onToast={onToast}
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
