'use client';

/**
 * Tickets tab — claim-based support queue.
 *
 * Used by /mod-panel (alongside Users + Feedback + Spam) and /support-panel
 * (as the only tab). Same component, same API.
 *
 * Behaviour:
 *   - Left pane: list of tickets, grouped by status, priority-sorted.
 *   - Right pane: selected ticket detail + message thread + reply box.
 *   - Top toolbar: filter chips (open / mine / claimed / resolved / all).
 *
 * A 'claim' button on an open ticket assigns it to the current viewer
 * via PATCH { action: 'claim' }. The mutation is optimistic: the row
 * jumps to the 'mine' filter after the API confirms.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, RefreshCw, AlertCircle, CheckCircle2, Inbox, User as UserIcon, ChevronRight, X as XIcon, Send } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtAgo } from '../components/primitives';

type Status = 'open' | 'claimed' | 'resolved' | 'wontfix';
type Priority = 'low' | 'normal' | 'high' | 'urgent';

interface Ticket {
  id: number;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  subject: string;
  body: string;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  claimedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketMessage {
  id: number;
  authorId: string | null;
  authorEmail: string | null;
  authorName: string | null;
  authorRole: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

interface TicketDetail {
  ticket: Ticket & { userRole: string | null };
  messages: TicketMessage[];
}

const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: '#f87171',
  high:   '#fbbf24',
  normal: '#7dd3fc',
  low:    '#94a3b8',
};

const STATUS_COLOR: Record<Status, string> = {
  open:     '#fdba74',
  claimed:  '#7dd3fc',
  resolved: '#86efac',
  wontfix:  '#94a3b8',
};

type FilterId = 'open' | 'mine' | 'all' | 'resolved';

export function TicketsTab({ onToast, viewerId }: { onToast: (msg: string, ok: boolean) => void; viewerId?: string }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>('open');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const qs = filter === 'mine' ? '?mine=1'
        : filter === 'open' ? '?status=open'
        : filter === 'resolved' ? '?status=resolved'
        : '?status=all';
      const res = await fetch('/api/support/tickets' + qs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTickets(json.tickets ?? []);
      setCounts(json.counts ?? {});
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to load tickets', false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [filter, onToast]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDetail(json);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to load ticket', false);
    }
    setDetailLoading(false);
  }, [onToast]);

  useEffect(() => {
    if (selectedId == null) { setDetail(null); return; }
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const performAction = useCallback(async (action: string, extra?: Record<string, unknown>) => {
    if (selectedId == null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast(json.error || `HTTP ${res.status}`, false);
        setBusy(false);
        return;
      }
      onToast(`Ticket ${action}d`, true);
      await Promise.all([load(true), loadDetail(selectedId)]);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Network error', false);
    }
    setBusy(false);
  }, [selectedId, load, loadDetail, onToast]);

  const sendReply = useCallback(async () => {
    if (!reply.trim() || selectedId == null) return;
    await performAction('message', { body: reply, isInternal: replyInternal });
    setReply('');
    setReplyInternal(false);
  }, [reply, replyInternal, selectedId, performAction]);

  const filtered = useMemo(() => tickets ?? [], [tickets]);
  const selected = filtered.find(t => t.id === selectedId) ?? detail?.ticket ?? null;

  return (
    <>
      <SectionHead
        title={`Support tickets · ${counts.open ?? 0} open · ${counts.claimed ?? 0} claimed`}
        icon={<MessageSquare style={{ width: 13, height: 13 }} />}
        right={
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            style={{ background: 'transparent', border: 0, color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([
          { id: 'open',     label: 'Open',     count: counts.open ?? 0,     color: '#fdba74' },
          { id: 'mine',     label: 'Mine',     count: undefined,            color: '#7dd3fc' },
          { id: 'resolved', label: 'Resolved', count: counts.resolved ?? 0, color: '#86efac' },
          { id: 'all',      label: 'All',      count: undefined,            color: '#94a3b8' },
        ] as { id: FilterId; label: string; count: number | undefined; color: string }[]).map(c => {
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => { setFilter(c.id); setSelectedId(null); }}
              style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                background: active ? `${c.color}22` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? c.color + '55' : 'var(--hub-border-subtle)'}`,
                color: active ? c.color : 'var(--fg-muted)',
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}
            >{c.label}{c.count != null ? ` · ${c.count}` : ''}</button>
          );
        })}
      </div>

      {/* Two-pane layout */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '360px 1fr' : '1fr', gap: 12, alignItems: 'flex-start' }}>
        {/* List */}
        <div style={{
          background: 'var(--hub-darker)',
          border: '1px solid var(--hub-border-subtle)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: 14 }}>
              <SkeletonBlock w="100%" h={50} />
              <div style={{ height: 4 }} />
              <SkeletonBlock w="100%" h={50} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-faint)', fontSize: 12 }}>
              <Inbox style={{ width: 22, height: 22, opacity: 0.3, margin: '0 auto 6px' }} />
              No tickets match this filter.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {filtered.map(t => {
                const active = selectedId === t.id;
                return (
                  <li
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    style={{
                      padding: '10px 12px',
                      borderTop: '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      background: active ? 'rgba(125, 211, 252, 0.06)' : undefined,
                      borderLeft: active ? '2px solid #7dd3fc' : '2px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: PRIORITY_COLOR[t.priority],
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '1px 5px', borderRadius: 3, background: `${PRIORITY_COLOR[t.priority]}1a`,
                      }}>{t.priority}</span>
                      <span style={{ fontSize: 9, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
                        {fmtAgo(t.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject || '(no subject)'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--fg-muted)', display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                        {t.userEmail || t.userId.slice(0, 8)}
                      </span>
                      {t.assigneeId && (
                        <>
                          <ChevronRight style={{ width: 9, height: 9, opacity: 0.5 }} />
                          <span style={{ color: t.assigneeId === viewerId ? '#86efac' : 'var(--fg-muted)' }}>
                            {t.assigneeId === viewerId ? 'You' : (t.assigneeName || t.assigneeEmail?.split('@')[0] || 'mod')}
                          </span>
                        </>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: STATUS_COLOR[t.status], textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {t.status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail */}
        {selectedId && (
          <div style={{
            background: 'var(--hub-darker)',
            border: '1px solid var(--hub-border-subtle)',
            borderRadius: 10, padding: 14,
          }}>
            {detailLoading && !detail ? (
              <SkeletonBlock w="100%" h={120} />
            ) : detail && selected ? (
              <>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: PRIORITY_COLOR[selected.priority],
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '2px 6px', borderRadius: 4, background: `${PRIORITY_COLOR[selected.priority]}1a`,
                      }}>{selected.priority}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: STATUS_COLOR[selected.status], textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {selected.status}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
                        #{selected.id}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                      {selected.subject || '(no subject)'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--fg-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <UserIcon style={{ width: 10, height: 10 }} />
                      <span>{selected.userEmail || selected.userId}</span>
                      <span style={{ color: 'var(--fg-faint)' }}>·</span>
                      <span>opened {fmtAgo(selected.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--fg-muted)' }}
                    title="Close"
                  >
                    <XIcon style={{ width: 16, height: 16 }} />
                  </button>
                </div>

                {/* Action toolbar */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {selected.status === 'open' && (
                    <ActionBtn label="Claim" color="#7dd3fc" onClick={() => performAction('claim')} disabled={busy} />
                  )}
                  {selected.status === 'claimed' && selected.assigneeId === viewerId && (
                    <ActionBtn label="Unclaim" color="#94a3b8" onClick={() => performAction('unclaim')} disabled={busy} />
                  )}
                  {(selected.status === 'open' || selected.status === 'claimed') && (
                    <>
                      <ActionBtn label="Resolve" color="#86efac" onClick={() => performAction('resolve')} disabled={busy} />
                      <ActionBtn label="Won't fix" color="#94a3b8" onClick={() => performAction('wontfix')} disabled={busy} />
                    </>
                  )}
                  {(selected.status === 'resolved' || selected.status === 'wontfix') && (
                    <ActionBtn label="Reopen" color="#fdba74" onClick={() => performAction('reopen')} disabled={busy} />
                  )}
                  {/* Priority quick-set */}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {(['low','normal','high','urgent'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => performAction('priority', { priority: p })}
                        disabled={busy || selected.priority === p}
                        title={`Set priority to ${p}`}
                        style={{
                          padding: '3px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                          background: selected.priority === p ? `${PRIORITY_COLOR[p]}22` : 'transparent',
                          color: PRIORITY_COLOR[p],
                          border: `1px solid ${PRIORITY_COLOR[p]}33`,
                          cursor: selected.priority === p ? 'default' : 'pointer',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          opacity: busy ? 0.6 : 1,
                        }}
                      >{p}</button>
                    ))}
                  </span>
                </div>

                {/* Original ticket body */}
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--hub-border-subtle)',
                  fontSize: 12, color: 'var(--fg-default)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  marginBottom: 12,
                }}>
                  {selected.body}
                </div>

                {/* Thread */}
                {detail.messages.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {detail.messages.map(m => {
                      const isMod = m.authorRole && m.authorRole !== 'user';
                      return (
                        <div key={m.id} style={{
                          padding: '8px 10px', borderRadius: 8,
                          background: m.isInternal ? 'rgba(251, 191, 36, 0.05)'
                            : isMod ? 'rgba(125, 211, 252, 0.04)'
                            : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${m.isInternal ? 'rgba(251, 191, 36, 0.18)' : 'var(--hub-border-subtle)'}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: isMod ? '#7dd3fc' : '#fff' }}>
                              {m.authorName || m.authorEmail || 'unknown'}
                            </span>
                            {m.authorRole && (
                              <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {m.authorRole}
                              </span>
                            )}
                            {m.isInternal && (
                              <span style={{
                                fontSize: 8, fontWeight: 700, color: '#fbbf24',
                                background: 'rgba(251, 191, 36, 0.15)',
                                padding: '1px 5px', borderRadius: 3,
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                              }}>Internal</span>
                            )}
                            <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
                              {fmtAgo(m.createdAt)}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--fg-default)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {m.body}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply box */}
                {(selected.status === 'open' || selected.status === 'claimed') && (
                  <div style={{
                    border: '1px solid var(--hub-border-subtle)',
                    borderRadius: 8, padding: 10,
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder={replyInternal ? 'Internal note — not visible to customer' : 'Reply to customer…'}
                      rows={3}
                      style={{
                        width: '100%', resize: 'vertical',
                        background: 'transparent', border: 0, outline: 'none',
                        color: '#fff', fontSize: 12, fontFamily: 'inherit',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--fg-muted)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={replyInternal}
                          onChange={e => setReplyInternal(e.target.checked)}
                        />
                        Internal note
                      </label>
                      <span style={{ flex: 1 }} />
                      <button
                        type="button"
                        disabled={busy || !reply.trim()}
                        onClick={sendReply}
                        style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: busy || !reply.trim() ? 'rgba(255,255,255,0.05)' : '#7dd3fc',
                          color: busy || !reply.trim() ? 'var(--fg-muted)' : '#000',
                          border: 0, cursor: busy || !reply.trim() ? 'not-allowed' : 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Send style={{ width: 11, height: 11 }} /> Send
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--fg-faint)', fontSize: 12 }}>Ticket not found or already closed.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ActionBtn({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
        background: `${color}1a`, color, border: `1px solid ${color}33`,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}
    >{label}</button>
  );
}
