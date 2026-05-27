'use client';

/**
 * Spam tab — multi-account / email-pattern detector for mod-panel.
 *
 * Pulls /api/mod/spam-detector which clusters users by:
 *   · gmail-tag    (a+x@gmail.com, a+y@gmail.com → same canonical)
 *   · gmail-dot    (a.b@gmail.com, ab@gmail.com → same canonical)
 *   · numeric-suffix (alice1@x.com, alice2@x.com → same canonical)
 *
 * Mod sees each cluster, clicks a member to open the user drawer, and
 * suspends manually. No auto-action — flag only.
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Inbox, ChevronRight } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtAgo } from '../components/primitives';

type Signal = 'gmail-tag' | 'gmail-dot' | 'numeric-suffix';

interface ClusterMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  suspendedAt: string | null;
}

interface Cluster {
  canonicalEmail: string;
  signal: Signal;
  confidence: number;
  members: ClusterMember[];
}

const SIGNAL_LABEL: Record<Signal, string> = {
  'gmail-tag':       '+tag alias',
  'gmail-dot':       'gmail dot-trick',
  'numeric-suffix':  'numeric suffix',
};

const SIGNAL_COLOR: Record<Signal, string> = {
  'gmail-tag':       '#f87171',
  'gmail-dot':       '#fbbf24',
  'numeric-suffix':  '#7dd3fc',
};

export function SpamTab({ onToast, onOpenUser }: {
  onToast: (msg: string, ok: boolean) => void;
  onOpenUser?: (userId: string) => void;
}) {
  const [data, setData] = useState<{ clusters: Cluster[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch('/api/mod/spam-detector');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData({ clusters: json.clusters ?? [], total: json.total ?? 0 });
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to load spam clusters', false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <SectionHead
        title={`Suspect accounts · ${data?.total ?? 0} clusters flagged`}
        icon={<AlertTriangle style={{ width: 13, height: 13 }} />}
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

      <Card title="What this detects">
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
          Clusters of accounts sharing a normalised email pattern. Three signals:
          <ul style={{ margin: '6px 0 0 14px', padding: 0 }}>
            <li><strong style={{ color: '#f87171' }}>+tag</strong> — alice+test@gmail.com & alice+foo@gmail.com both route to alice@gmail.com</li>
            <li><strong style={{ color: '#fbbf24' }}>gmail dot</strong> — a.lice@gmail.com & alice@gmail.com are the same gmail inbox</li>
            <li><strong style={{ color: '#7dd3fc' }}>numeric</strong> — alice1@x.com, alice2@x.com look like a sock puppet pattern</li>
          </ul>
          <div style={{ marginTop: 6, color: 'var(--fg-faint)' }}>
            Flag only — no auto-suspend. Owners + admins are excluded from the scan.
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <SkeletonBlock w="100%" h={80} />
        ) : !data || data.clusters.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center', color: 'var(--fg-faint)',
            background: 'var(--hub-darker)', border: '1px solid var(--hub-border-subtle)', borderRadius: 10,
          }}>
            <Inbox style={{ width: 22, height: 22, opacity: 0.3, margin: '0 auto 6px' }} />
            No suspicious clusters detected. Nice and clean.
          </div>
        ) : (
          data.clusters.map(c => (
            <div key={`${c.signal}:${c.canonicalEmail}`} style={{
              background: 'var(--hub-darker)',
              border: `1px solid ${SIGNAL_COLOR[c.signal]}33`,
              borderRadius: 10, padding: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: SIGNAL_COLOR[c.signal], background: `${SIGNAL_COLOR[c.signal]}1a`,
                  padding: '2px 7px', borderRadius: 4,
                }}>{SIGNAL_LABEL[c.signal]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                  {c.canonicalEmail}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: 'var(--fg-muted)' }}>Confidence</span>
                  <span style={{
                    fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)',
                    color: c.confidence >= 80 ? '#f87171' : c.confidence >= 60 ? '#fbbf24' : '#7dd3fc',
                  }}>
                    {c.confidence}%
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {c.members.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onOpenUser?.(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer', textAlign: 'left',
                      color: '#fff',
                    }}
                  >
                    <span style={{ fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.email}
                    </span>
                    {m.suspendedAt && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, color: '#fca5a5',
                        background: 'rgba(244, 63, 94, 0.15)',
                        padding: '1px 5px', borderRadius: 3,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>Suspended</span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
                      {fmtAgo(m.createdAt)}
                    </span>
                    <ChevronRight style={{ width: 11, height: 11, color: 'var(--fg-muted)' }} />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
