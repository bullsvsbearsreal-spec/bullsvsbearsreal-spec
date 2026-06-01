'use client';

/**
 * /admin-panel/broadcast — broadcast notification composer.
 *
 * Channels: push (web-push to every subscribed device) and telegram
 * (every user with a linked chat_id). Both call POST /api/admin/actions/broadcast.
 *
 * Safety:
 *   · 500-char hard cap (matches the API validator)
 *   · type-to-confirm modal before send (audit reason required)
 *   · push + telegram channels are independent toggles
 *   · sends are NOT undoable — once dispatched, the message is in flight
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowLeft, Send, Bell, AlertTriangle, Lock } from 'lucide-react';
import { Card, ConfirmModal, ToastHost, type ToastMsg } from '../components/primitives';

export default function BroadcastPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  // Owner inherits admin everywhere else (main panel gate + requireAdmin API
  // gate both accept owner); without this an owner hit the "Admin only" lock
  // on a page the POST endpoint would have accepted.
  const isAdmin = role === 'admin' || role === 'owner';

  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<{ push: boolean; telegram: boolean }>({ push: true, telegram: true });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [lastResult, setLastResult] = useState<null | { push: { sent: number; failed: number }; telegram: { sent: number; failed: number } }>(null);

  // Esc to cancel modal
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setConfirming(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirming, busy]);

  const send = async (reason: string) => {
    setBusy(true);
    setLastResult(null);
    const selected = (['push', 'telegram'] as const).filter(c => channels[c]);
    try {
      const res = await fetch('/api/admin/actions/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), channels: selected, reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setToast({ msg: j.error || `HTTP ${res.status}`, ok: false });
        return;
      }
      const json = await res.json();
      setLastResult({ push: json.push, telegram: json.telegram });
      const total = (json.push?.sent ?? 0) + (json.telegram?.sent ?? 0);
      setToast({ msg: `Broadcast sent · ${total} delivered`, ok: true });
      setMessage('');
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Network error', ok: false });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ padding: 80, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: 28, height: 28, border: '2px solid rgba(251,191,36,0.3)', borderTopColor: '#fbbf24', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </main>
        <Footer />
      </div>
    );
  }
  if (!session?.user || !isAdmin) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 16px', color: '#fff' }}>
          <Lock style={{ width: 28, height: 28, color: '#fbbf24', marginBottom: 14 }} />
          <div style={{ color: 'var(--fg-muted)', fontSize: 13, marginBottom: 14 }}>Admin only</div>
          <a href="/login?callbackUrl=/admin-panel/broadcast" style={{ padding: '8px 18px', borderRadius: 8, background: '#fbbf24', color: '#000', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Log in</a>
        </main>
        <Footer />
      </div>
    );
  }

  const channelCount = Object.values(channels).filter(Boolean).length;
  const canSend = message.trim().length >= 4 && message.length <= 500 && channelCount > 0 && !busy;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main style={{ color: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 24px' }}>
          <Link href="/admin-panel#ops" style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10, textDecoration: 'none' }}>
            <ArrowLeft style={{ width: 12, height: 12 }} />
            Back to dashboard
          </Link>

          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Send style={{ width: 18, height: 18, color: '#fbbf24' }} />
            Broadcast Notification
          </h1>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 18 }}>
            Sends to every push subscriber and/or every linked Telegram chat. Type-to-confirm before dispatch — no undo.
          </p>

          <Card title="Compose">
            {/* Channel toggles */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>Channels</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ChannelChip
                  active={channels.push}
                  onClick={() => setChannels(c => ({ ...c, push: !c.push }))}
                  icon={<Bell style={{ width: 12, height: 12 }} />}
                  label="Push"
                />
                <ChannelChip
                  active={channels.telegram}
                  onClick={() => setChannels(c => ({ ...c, telegram: !c.telegram }))}
                  icon={<Send style={{ width: 12, height: 12 }} />}
                  label="Telegram"
                />
              </div>
            </div>

            {/* Message field */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-muted)' }}>Message</span>
                <span style={{ fontSize: 10, color: message.length > 480 ? '#fca5a5' : 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
                  {message.length} / 500
                </span>
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, 500))}
                placeholder="e.g. Scheduled maintenance tonight 02:00–02:15 UTC. Funding-rate ingest will pause briefly."
                rows={6}
                style={{
                  width: '100%', resize: 'vertical',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--hub-border-subtle)',
                  borderRadius: 8, padding: '10px 12px',
                  fontSize: 13, color: '#fff', fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />
            </div>

            <div style={{ fontSize: 10, color: 'var(--fg-faint)', display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 10 }}>
              <AlertTriangle style={{ width: 12, height: 12, flexShrink: 0, marginTop: 1, color: '#fcd34d' }} />
              <span>This sends to <b>every</b> subscriber across selected channels. No segmentation. Use sparingly.</span>
            </div>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!canSend}
              style={{
                marginTop: 14,
                padding: '10px 18px', borderRadius: 8,
                background: canSend ? '#fbbf24' : 'rgba(255,255,255,0.06)',
                color: canSend ? '#000' : 'var(--fg-faint)',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                border: 0, cursor: canSend ? 'pointer' : 'not-allowed',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Send style={{ width: 13, height: 13 }} />
              Review & send
            </button>
          </Card>

          {lastResult && (
            <Card title="Last broadcast">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <ResultTile label="Push"     sent={lastResult.push.sent}     failed={lastResult.push.failed}     />
                <ResultTile label="Telegram" sent={lastResult.telegram.sent} failed={lastResult.telegram.failed} />
              </div>
            </Card>
          )}
        </div>
      </main>
      <Footer />

      <ConfirmModal
        open={confirming}
        title="Send broadcast to every subscriber?"
        description={
          <>
            <div style={{ marginBottom: 8 }}>
              Channels: <code style={{ fontFamily: 'var(--font-mono)', color: '#fcd34d' }}>{Object.entries(channels).filter(([_, v]) => v).map(([k]) => k).join(', ')}</code>
            </div>
            <div style={{ padding: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--hub-border-subtle)', borderRadius: 6, fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: 12, color: '#fff' }}>
              {message}
            </div>
          </>
        }
        confirmText="BROADCAST"
        confirmLabel="Send broadcast"
        danger
        onConfirm={send}
        onCancel={() => setConfirming(false)}
      />

      <ToastHost toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}

function ChannelChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 999,
        background: active ? 'rgba(251, 191, 36, 0.16)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(251, 191, 36, 0.3)' : 'var(--hub-border-subtle)'}`,
        color: active ? '#fcd34d' : 'var(--fg-muted)',
        fontSize: 11, fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ResultTile({ label, sent, failed }: { label: string; sent: number; failed: number }) {
  const total = sent + failed;
  const pct = total > 0 ? (sent / total) * 100 : 0;
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--hub-border-subtle)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: '#34d399' }}>{sent}</span>
        <span style={{ color: 'var(--fg-faint)', margin: '0 6px', fontSize: 14 }}>/</span>
        <span style={{ color: failed > 0 ? '#fca5a5' : 'var(--fg-faint)' }}>{failed}</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
        {pct.toFixed(0)}% delivered · sent / failed
      </div>
    </div>
  );
}
