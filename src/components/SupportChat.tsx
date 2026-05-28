'use client';

/**
 * SupportChat — floating customer support widget.
 *
 * Mounted next to the InfoHub version badge in StatusBar. Click opens a
 * side panel showing the user's own tickets. Each ticket is its own chat
 * thread; reply box lets them send messages that route into the same
 * /mod-panel#tickets queue support staff uses.
 *
 * Endpoints (all customer-scoped):
 *   GET  /api/support/my-tickets               → my ticket list
 *   POST /api/support/my-tickets               → open a new ticket
 *   GET  /api/support/my-tickets/[id]          → thread + non-internal msgs
 *   PATCH /api/support/my-tickets/[id]         → reply / close
 *
 * Logged-out viewers see "Sign in to chat with support" + email fallback.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { MessageSquare, X, Send, Plus, ChevronLeft, Mail, LogIn, Inbox } from 'lucide-react';

type Status = 'open' | 'claimed' | 'resolved' | 'wontfix';
type Priority = 'low' | 'normal' | 'high' | 'urgent';

interface MyTicket {
  id: number;
  subject: string;
  status: Status;
  priority: Priority;
  hasAssignee: boolean;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  replyCount: number;
  lastReplyAt: string | null;
}

interface ChatMessage {
  id: number;
  authorName: string | null;
  isStaff: boolean;
  body: string;
  createdAt: string;
}

interface ChatDetail {
  ticket: {
    id: number;
    subject: string;
    body: string;
    status: Status;
    priority: Priority;
    hasAssignee: boolean;
    assigneeName: string | null;
    createdAt: string;
    resolvedAt: string | null;
  };
  messages: ChatMessage[];
}

const STATUS_LABEL: Record<Status, string> = {
  open: 'Open', claimed: 'Being handled', resolved: 'Resolved', wontfix: 'Closed',
};
const STATUS_COLOR: Record<Status, string> = {
  open: '#fdba74', claimed: '#7dd3fc', resolved: '#86efac', wontfix: '#94a3b8',
};

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function SupportChat() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'thread' | 'new'>('list');
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const loggedIn = !!session?.user?.id;

  const loadList = useCallback(async () => {
    if (!loggedIn) { setTickets([]); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/support/my-tickets');
      const json = await res.json();
      setTickets(Array.isArray(json.tickets) ? json.tickets : []);
    } catch {
      setTickets([]);
    }
    setLoading(false);
  }, [loggedIn]);

  const loadDetail = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/support/my-tickets/${id}`);
      if (res.ok) setDetail(await res.json());
    } catch {}
    setLoading(false);
    // Scroll to newest message
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  // Refresh list whenever the panel opens
  useEffect(() => {
    if (open && view === 'list') loadList();
  }, [open, view, loadList]);

  // Load detail when activeId changes
  useEffect(() => {
    if (activeId != null && view === 'thread') loadDetail(activeId);
  }, [activeId, view, loadDetail]);

  // Poll detail every 15s while a thread is open (so staff replies show
  // up without a manual refresh). Cheap — single user, single ticket.
  useEffect(() => {
    if (activeId == null || view !== 'thread' || !open) return;
    const id = setInterval(() => loadDetail(activeId), 15_000);
    return () => clearInterval(id);
  }, [activeId, view, open, loadDetail]);

  const sendReply = useCallback(async () => {
    if (!reply.trim() || activeId == null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/my-tickets/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reply', body: reply.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || `HTTP ${res.status}`); return; }
      setReply('');
      await loadDetail(activeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }, [reply, activeId, loadDetail]);

  const createTicket = useCallback(async () => {
    if (!newSubject.trim() || !newBody.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/support/my-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: newSubject.trim(), body: newBody.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || `HTTP ${res.status}`); return; }
      setNewSubject(''); setNewBody('');
      // Jump straight into the new ticket thread. Refresh the list in
      // the background — don't `await` it (a flaky network call on the
      // list fetch would otherwise wipe the cached `tickets` to [] and
      // the user would see an empty list when they navigate back).
      loadList().catch(() => { /* ignore — thread view doesn't need it */ });
      setActiveId(Number(json.id));
      setView('thread');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }, [newSubject, newBody, loadList]);

  // Closed by default — render only the button until opened
  return (
    <>
      {/* Trigger button — placed inside StatusBar, see StatusBar.tsx */}
      <button
        type="button"
        onClick={() => { setOpen(true); setView('list'); }}
        aria-label="Open support chat"
        title="Support chat"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 999,
          background: 'rgba(125, 211, 252, 0.08)',
          border: '1px solid rgba(125, 211, 252, 0.25)',
          color: '#7dd3fc',
          fontWeight: 700, letterSpacing: '0.04em', fontSize: 9,
          textTransform: 'uppercase', flexShrink: 0,
          cursor: 'pointer',
          marginLeft: 4,
          fontFamily: 'var(--font-mono, monospace)',
          transition: 'background 150ms, border-color 150ms, transform 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(125, 211, 252, 0.15)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(125, 211, 252, 0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <MessageSquare style={{ width: 11, height: 11 }} />
        Support
      </button>

      {/* Side panel */}
      {open && (
        <>
          {/* Backdrop — dimmed but click-to-close */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 998,
              background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(2px)',
            }}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-label="Support chat"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 999,
              width: 'min(420px, 100vw)',
              background: 'var(--hub-darker, #0a0a0a)',
              borderLeft: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.08))',
              display: 'flex', flexDirection: 'column',
              boxShadow: '-12px 0 30px rgba(0,0,0,0.5)',
              color: '#fff', fontFamily: 'var(--font-sans, inherit)',
              animation: 'support-chat-slide-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <header style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.06))',
              flexShrink: 0,
            }}>
              {view !== 'list' ? (
                <button
                  type="button"
                  onClick={() => { setView('list'); setActiveId(null); setDetail(null); setError(null); }}
                  style={{ background: 'transparent', border: 0, color: 'var(--fg-muted, #888)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                  title="Back to list"
                >
                  <ChevronLeft style={{ width: 18, height: 18 }} />
                </button>
              ) : (
                <MessageSquare style={{ width: 16, height: 16, color: '#7dd3fc' }} />
              )}
              <h2 style={{ fontSize: 14, fontWeight: 700, flex: 1, margin: 0 }}>
                {view === 'list' ? 'Support' : view === 'new' ? 'New ticket' : detail?.ticket.subject || 'Conversation'}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 0, color: 'var(--fg-muted, #888)', cursor: 'pointer', padding: 4, display: 'inline-flex' }}
                aria-label="Close"
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </header>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* ─── Logged out ──────────────────────────────────────── */}
              {status !== 'loading' && !loggedIn && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted, #999)' }}>
                  <LogIn style={{ width: 28, height: 28, color: '#7dd3fc', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, marginBottom: 6 }}>
                    Sign in to chat with support
                  </div>
                  <p style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 18 }}>
                    Your account email becomes the reply address.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <Link
                      href="/login?callbackUrl=/"
                      onClick={() => setOpen(false)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8,
                        background: '#7dd3fc', color: '#000',
                        fontSize: 12, fontWeight: 700, textDecoration: 'none',
                      }}
                    >
                      <LogIn style={{ width: 12, height: 12 }} /> Log in
                    </Link>
                    <a
                      href="mailto:support@info-hub.io"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.04)', color: 'var(--fg-default, #ddd)',
                        border: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.08))',
                        fontSize: 12, fontWeight: 600, textDecoration: 'none',
                      }}
                    >
                      <Mail style={{ width: 12, height: 12 }} /> Email
                    </a>
                  </div>
                </div>
              )}

              {/* ─── List ─────────────────────────────────────────────── */}
              {loggedIn && view === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.04))' }}>
                    <button
                      type="button"
                      onClick={() => { setView('new'); setError(null); }}
                      style={{
                        width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px 14px', borderRadius: 8,
                        background: '#7dd3fc', color: '#000',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 0,
                      }}
                    >
                      <Plus style={{ width: 13, height: 13 }} /> Start a new conversation
                    </button>
                  </div>

                  {loading && tickets === null ? (
                    <div style={{ padding: 24, color: 'var(--fg-faint, #777)', fontSize: 12, textAlign: 'center' }}>
                      Loading…
                    </div>
                  ) : !tickets || tickets.length === 0 ? (
                    <div style={{ padding: 28, textAlign: 'center', color: 'var(--fg-faint, #777)', fontSize: 12 }}>
                      <Inbox style={{ width: 24, height: 24, opacity: 0.4, margin: '0 auto 8px' }} />
                      No conversations yet.
                      <div style={{ marginTop: 4 }}>Start one above and we&apos;ll get back to you.</div>
                    </div>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {tickets.map(t => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => { setActiveId(t.id); setView('thread'); setError(null); setReply(''); }}
                            style={{
                              width: '100%', textAlign: 'left',
                              padding: '12px 16px',
                              background: 'transparent', border: 0, borderBottom: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.04))',
                              color: '#fff', cursor: 'pointer',
                              display: 'flex', flexDirection: 'column', gap: 4,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ flex: 1, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.subject || '(no subject)'}
                              </span>
                              <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                                color: STATUS_COLOR[t.status], padding: '1px 6px', borderRadius: 3,
                                background: `${STATUS_COLOR[t.status]}1a`,
                              }}>
                                {STATUS_LABEL[t.status]}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--fg-faint, #777)', display: 'flex', gap: 6 }}>
                              {t.hasAssignee && (
                                <span>· assigned to {t.assigneeName || 'team'}</span>
                              )}
                              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono, monospace)' }}>
                                {fmtAgo(t.lastReplyAt || t.updatedAt)}
                              </span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ─── New ticket ──────────────────────────────────────── */}
              {loggedIn && view === 'new' && (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--fg-muted, #999)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                      Subject
                    </label>
                    <input
                      type="text"
                      value={newSubject}
                      onChange={e => setNewSubject(e.target.value)}
                      placeholder="What can we help with?"
                      maxLength={200}
                      style={{
                        width: '100%', padding: '8px 10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.08))',
                        borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: 10, color: 'var(--fg-muted, #999)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
                      Message
                    </label>
                    <textarea
                      value={newBody}
                      onChange={e => setNewBody(e.target.value)}
                      placeholder="Tell us what's happening. The more detail you share, the faster we can help."
                      maxLength={10_000}
                      style={{
                        width: '100%', flex: 1, minHeight: 140,
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.08))',
                        borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none',
                        resize: 'vertical', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  {error && (
                    <div role="alert" style={{ fontSize: 11, color: '#fda4af' }}>{error}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => { setView('list'); setError(null); }}
                      style={{
                        padding: '8px 14px', borderRadius: 6,
                        background: 'transparent', color: 'var(--fg-muted, #999)',
                        border: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.08))',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >Cancel</button>
                    <button
                      type="button"
                      onClick={createTicket}
                      disabled={submitting || newSubject.trim().length < 3 || newBody.trim().length < 10}
                      style={{
                        padding: '8px 14px', borderRadius: 6,
                        background: submitting || newSubject.trim().length < 3 || newBody.trim().length < 10 ? 'rgba(255,255,255,0.05)' : '#7dd3fc',
                        color: submitting || newSubject.trim().length < 3 || newBody.trim().length < 10 ? 'var(--fg-muted, #999)' : '#000',
                        border: 0, cursor: submitting || newSubject.trim().length < 3 || newBody.trim().length < 10 ? 'not-allowed' : 'pointer',
                        fontSize: 12, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Send style={{ width: 12, height: 12 }} />
                      {submitting ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Thread ──────────────────────────────────────────── */}
              {loggedIn && view === 'thread' && (
                <>
                  <div style={{ flex: 1, minHeight: 0, padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {detail == null && loading ? (
                      <div style={{ color: 'var(--fg-faint, #777)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
                        Loading conversation…
                      </div>
                    ) : detail == null ? (
                      <div style={{ color: 'var(--fg-faint, #777)', fontSize: 12 }}>Conversation not found.</div>
                    ) : (
                      <>
                        {/* Original body */}
                        <MessageBubble
                          author="You"
                          isMe
                          time={detail.ticket.createdAt}
                          body={detail.ticket.body}
                        />
                        {detail.messages.map(m => (
                          <MessageBubble
                            key={m.id}
                            author={m.isStaff ? (m.authorName || 'Support') : 'You'}
                            isMe={!m.isStaff}
                            time={m.createdAt}
                            body={m.body}
                          />
                        ))}
                        {detail.ticket.status === 'resolved' && (
                          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--fg-faint, #777)', padding: '8px 0' }}>
                            Marked resolved {fmtAgo(detail.ticket.resolvedAt)} ago. Reply below if you need more help — that will reopen it.
                          </div>
                        )}
                        <div ref={threadEndRef} />
                      </>
                    )}
                  </div>
                  {/* Reply box */}
                  <div style={{
                    padding: 12, borderTop: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.06))', flexShrink: 0,
                  }}>
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Type a reply…"
                      rows={3}
                      style={{
                        width: '100%', padding: '8px 10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--hub-border-subtle, rgba(255,255,255,0.08))',
                        borderRadius: 6, color: '#fff', fontSize: 12, outline: 'none',
                        resize: 'vertical', fontFamily: 'inherit',
                      }}
                    />
                    {error && (
                      <div role="alert" style={{ fontSize: 11, color: '#fda4af', marginTop: 6 }}>{error}</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={sendReply}
                        disabled={submitting || !reply.trim()}
                        style={{
                          padding: '7px 14px', borderRadius: 6,
                          background: submitting || !reply.trim() ? 'rgba(255,255,255,0.05)' : '#7dd3fc',
                          color: submitting || !reply.trim() ? 'var(--fg-muted, #999)' : '#000',
                          border: 0, cursor: submitting || !reply.trim() ? 'not-allowed' : 'pointer',
                          fontSize: 12, fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <Send style={{ width: 12, height: 12 }} />
                        {submitting ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <style jsx>{`
              @keyframes support-chat-slide-in {
                from { transform: translateX(100%); opacity: 0; }
                to   { transform: translateX(0); opacity: 1; }
              }
            `}</style>
          </aside>
        </>
      )}
    </>
  );
}

function MessageBubble({ author, isMe, time, body }: { author: string; isMe: boolean; time: string; body: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
      <div style={{ fontSize: 9, color: 'var(--fg-faint, #777)', marginBottom: 3, fontWeight: 600 }}>
        {author} · {fmtAgo(time)}
      </div>
      <div style={{
        maxWidth: '85%',
        padding: '8px 12px',
        borderRadius: 12,
        background: isMe ? 'rgba(125, 211, 252, 0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isMe ? 'rgba(125, 211, 252, 0.25)' : 'rgba(255,255,255,0.06)'}`,
        color: '#fff', fontSize: 13, lineHeight: 1.5,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {body}
      </div>
    </div>
  );
}
