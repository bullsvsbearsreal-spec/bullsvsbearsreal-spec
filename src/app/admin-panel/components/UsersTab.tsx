'use client';

import { useEffect, useState, useMemo } from 'react';
import UserDetailDrawer from './UserDetailDrawer';
import { TableSkeleton } from './AdminSkeletons';

interface User {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  role: string;
  providerCount: number;
  watchlistCount: number;
  alertCount: number;
  portfolioCount: number;
  notificationsSent: number;
}

type Filter = 'all' | 'admin' | 'advisor' | 'alerts' | 'active';
type SortKey = 'email' | 'alertCount' | 'notificationsSent' | 'watchlistCount';

function downloadCSV(users: User[]) {
  const header = 'Name,Email,Role,Alerts,Notifications,Watchlist,Portfolio\n';
  const rows = users.map(
    (u) => `"${u.name || ''}","${u.email || ''}",${u.role},${u.alertCount},${u.notificationsSent},${u.watchlistCount},${u.portfolioCount}`,
  );
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface UsersTabProps {
  userRole?: string;
  currentUserId?: string;
}

export default function UsersTab({ userRole, currentUserId }: UsersTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('email');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const loadUsers = () => {
    setLoading(true);
    setError('');
    fetch('/api/admin/users')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => setUsers(d.users ?? []))
      .catch((e) => setError(e.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
      );
    }
    if (filter === 'admin') list = list.filter((u) => u.role === 'admin');
    else if (filter === 'advisor') list = list.filter((u) => u.role === 'advisor');
    else if (filter === 'alerts') list = list.filter((u) => u.alertCount > 0);
    else if (filter === 'active') list = list.filter((u) => u.notificationsSent > 0 || u.alertCount > 0);

    list = [...list].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortAsc ? aVal - bVal : bVal - aVal;
      return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return list;
  }, [users, search, filter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'admin', label: 'Admins' },
    { key: 'advisor', label: 'Advisors' },
    { key: 'alerts', label: 'With Alerts' },
    { key: 'active', label: 'Active' },
  ];

  if (loading) return <TableSkeleton rows={8} />;

  if (error) return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] p-6 text-center">
      <p className="text-sm text-red-400 mb-2">Failed to load users: {error}</p>
      <button onClick={loadUsers} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white">Retry</button>
    </div>
  );

  const SortIcon = ({ active, asc }: { active: boolean; asc: boolean }) => (
    <svg className={`w-3 h-3 inline ml-0.5 ${active ? 'text-amber-400' : 'text-neutral-600'}`} viewBox="0 0 12 12" fill="currentColor">
      {asc ? <path d="M6 2l4 5H2z" /> : <path d="M6 10l4-5H2z" />}
    </svg>
  );

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full sm:w-56 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/50"
        />
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                filter === f.key
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-white/[0.08] text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => downloadCSV(filtered)}
          className="ml-auto text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* table */}
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-3 py-2 text-neutral-500 font-medium">User</th>
                <th className="text-left px-3 py-2 text-neutral-500 font-medium cursor-pointer select-none" onClick={() => handleSort('email')}>
                  Email <SortIcon active={sortKey === 'email'} asc={sortAsc} />
                </th>
                <th className="text-center px-3 py-2 text-neutral-500 font-medium">Role</th>
                <th className="text-right px-3 py-2 text-neutral-500 font-medium cursor-pointer select-none" onClick={() => handleSort('alertCount')}>
                  Alerts <SortIcon active={sortKey === 'alertCount'} asc={sortAsc} />
                </th>
                <th className="text-right px-3 py-2 text-neutral-500 font-medium cursor-pointer select-none" onClick={() => handleSort('notificationsSent')}>
                  Notifs <SortIcon active={sortKey === 'notificationsSent'} asc={sortAsc} />
                </th>
                <th className="text-right px-3 py-2 text-neutral-500 font-medium cursor-pointer select-none" onClick={() => handleSort('watchlistCount')}>
                  Watch <SortIcon active={sortKey === 'watchlistCount'} asc={sortAsc} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {u.image ? (
                        <img src={u.image} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] text-neutral-500 font-medium">
                          {(u.name?.[0] || u.email?.[0] || '?').toUpperCase()}
                        </div>
                      )}
                      <span className="text-white truncate max-w-[120px]">{u.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-neutral-400 truncate max-w-[180px]">{u.email || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {u.role === 'admin' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">admin</span>
                    ) : u.role === 'advisor' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">advisor</span>
                    ) : (
                      <span className="text-neutral-600">user</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-300">{u.alertCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-300">{u.notificationsSent}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-300">{u.watchlistCount}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-neutral-600 text-xs">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-white/[0.06] text-[10px] text-neutral-600">
          Showing {filtered.length} of {users.length} users
        </div>
      </div>

      <UserDetailDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        canManageRoles={userRole === 'admin'}
        currentUserId={currentUserId}
        onRoleChanged={loadUsers}
      />
    </div>
  );
}
