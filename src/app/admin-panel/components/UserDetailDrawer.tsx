'use client';

import { useEffect, useState } from 'react';

interface UserDetail {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  email_verified?: string;
  role?: string;
  providers: string[];
  watchlist: string[];
  recentNotifications: { id: string; symbol: string; metric: string; threshold: number; actual_value: number; channel: string; sent_at: string }[];
  pushSubscriptions: number;
}

interface Props {
  userId: string | null;
  onClose: () => void;
  canManageRoles?: boolean;
  currentUserId?: string;
  onRoleChanged?: () => void;
}

export default function UserDetailDrawer({ userId, onClose, canManageRoles, currentUserId, onRoleChanged }: Props) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleChanging, setRoleChanging] = useState(false);

  useEffect(() => {
    if (!userId) { setData(null); return; }
    setLoading(true);
    setError('');
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d.user);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [userId, onClose]);

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0d0d0d] border-l border-white/[0.08] shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* header */}
        <div className="sticky top-0 z-10 bg-[#0d0d0d]/90 backdrop-blur border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">User Detail</span>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded bg-white/[0.06] h-12" />
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          {data && (
            <>
              {/* profile */}
              <div className="flex items-center gap-3">
                {data.image ? (
                  <img src={data.image} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-neutral-500 text-sm font-medium">
                    {(data.name?.[0] || data.email?.[0] || '?').toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-white">{data.name || 'Unnamed'}</p>
                  <p className="text-xs text-neutral-500">{data.email || 'No email'}</p>
                </div>
                <span className="ml-auto">
                  {data.role === 'admin' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-hub-yellow/20 text-hub-yellow font-medium">ADMIN</span>
                  )}
                  {data.role === 'advisor' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">ADVISOR</span>
                  )}
                </span>
              </div>

              {/* meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <p className="text-neutral-500 mb-0.5">Verified</p>
                  <p className="text-white">{data.email_verified ? 'Yes' : 'No'}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <p className="text-neutral-500 mb-0.5">Providers</p>
                  <p className="text-white">{data.providers?.join(', ') || '—'}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <p className="text-neutral-500 mb-0.5">Push Subs</p>
                  <p className="text-white">{data.pushSubscriptions}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <p className="text-neutral-500 mb-0.5">Watchlist</p>
                  <p className="text-white">{data.watchlist?.length ?? 0} items</p>
                </div>
              </div>

              {/* role management */}
              {canManageRoles && data.id && data.id !== currentUserId && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-xs text-neutral-500 mb-2">Manage Role</p>
                  <div className="flex items-center gap-2">
                    {(['user', 'advisor', 'admin'] as const).map((role) => (
                      <button
                        key={role}
                        disabled={roleChanging || data.role === role}
                        onClick={async () => {
                          setRoleChanging(true);
                          try {
                            const res = await fetch(`/api/admin/users/${data.id}/role`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ role }),
                            });
                            if (!res.ok) {
                              const err = await res.json();
                              throw new Error(err.error || 'Failed');
                            }
                            setData((prev) => prev ? { ...prev, role } : prev);
                            onRoleChanged?.();
                          } catch (e: any) {
                            setError(e.message);
                          } finally {
                            setRoleChanging(false);
                          }
                        }}
                        className={`px-3 py-1.5 text-[11px] rounded-lg border font-medium transition-colors disabled:opacity-50 ${
                          data.role === role
                            ? role === 'admin'
                              ? 'border-hub-yellow/40 bg-hub-yellow/15 text-hub-yellow'
                              : role === 'advisor'
                                ? 'border-blue-500/40 bg-blue-500/15 text-blue-400'
                                : 'border-white/20 bg-white/[0.08] text-white'
                            : 'border-white/[0.08] text-neutral-500 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                    {roleChanging && (
                      <svg className="w-3.5 h-3.5 animate-spin text-neutral-400" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                      </svg>
                    )}
                  </div>
                </div>
              )}

              {/* watchlist */}
              {data.watchlist && data.watchlist.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1.5">Watchlist</p>
                  <div className="flex flex-wrap gap-1">
                    {data.watchlist.map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-300">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* recent notifications */}
              <div>
                <p className="text-xs text-neutral-500 mb-1.5">Recent Notifications ({data.recentNotifications?.length ?? 0})</p>
                {!data.recentNotifications?.length ? (
                  <p className="text-xs text-neutral-600">No notifications</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {data.recentNotifications.map((n) => (
                      <div key={n.id} className="rounded border border-white/[0.04] bg-white/[0.02] p-2 text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-hub-yellow font-medium">{n.symbol}</span>
                          <span className="text-[10px] text-neutral-600">{new Date(n.sent_at).toLocaleString()}</span>
                        </div>
                        <p className="text-neutral-400 leading-relaxed">{n.metric}: {n.actual_value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
