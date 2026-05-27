'use client';

/**
 * Campaigns tab — marketing-panel surface for per-campaign KPIs.
 *
 * Each campaign is a row matching users.acq_utm_campaign = campaign.slug.
 * KPIs computed in /api/marketing/campaigns:
 *   · signups
 *   · paid conversions + conversion %
 *   · D7 retention %  (signups where last_seen ≥ created_at + 7 days)
 *   · D30 retention % (signups where last_seen ≥ created_at + 30 days)
 *
 * Create form (top): slug + display name + optional budget + target URL.
 * Generated UTM link is shown when a campaign is selected — copy/paste
 * into emails / tweets / ads. Archive/unarchive on each row.
 */

import { useState, useEffect, useCallback } from 'react';
import { Megaphone, RefreshCw, Plus, Archive, ArchiveRestore, Copy, ExternalLink, Inbox } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber } from '../components/primitives';

interface Campaign {
  id: number;
  slug: string;
  name: string;
  notes: string | null;
  targetUrl: string | null;
  budgetUsd: number | null;
  archivedAt: string | null;
  createdAt: string;
  createdByEmail: string | null;
  signups: number;
  paidConversions: number;
  conversionPct: number;
  d7Retained: number;
  d7RetentionPct: number;
  d30Retained: number;
  d30RetentionPct: number;
}

export function CampaignsTab({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch('/api/marketing/campaigns');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCampaigns(json.campaigns ?? []);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to load campaigns', false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const createCampaign = useCallback(async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { slug, name };
      if (targetUrl.trim()) payload.targetUrl = targetUrl.trim();
      const b = parseFloat(budget);
      if (Number.isFinite(b) && b >= 0) payload.budgetUsd = b;
      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast(json.error || `HTTP ${res.status}`, false);
        setBusy(false);
        return;
      }
      onToast(`Campaign "${slug}" created`, true);
      setSlug(''); setName(''); setTargetUrl(''); setBudget('');
      setShowCreate(false);
      await load(true);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Network error', false);
    }
    setBusy(false);
  }, [slug, name, targetUrl, budget, load, onToast]);

  const archiveToggle = useCallback(async (c: Campaign) => {
    setBusy(true);
    try {
      const res = await fetch('/api/marketing/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, action: c.archivedAt ? 'unarchive' : 'archive' }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        onToast(json.error || `HTTP ${res.status}`, false);
        setBusy(false);
        return;
      }
      onToast(`Campaign ${c.archivedAt ? 'restored' : 'archived'}`, true);
      await load(true);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Network error', false);
    }
    setBusy(false);
  }, [load, onToast]);

  return (
    <>
      <SectionHead
        title={`Campaigns · ${campaigns.filter(c => !c.archivedAt).length} active`}
        icon={<Megaphone style={{ width: 13, height: 13 }} />}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowCreate(v => !v)}
              style={{
                background: 'rgba(196, 181, 253, 0.1)', color: '#c4b5fd',
                border: '1px solid rgba(196, 181, 253, 0.3)', borderRadius: 6,
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <Plus style={{ width: 12, height: 12 }} /> New campaign
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              style={{ background: 'transparent', border: 0, color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        }
      />

      {/* Create form */}
      {showCreate && (
        <Card title="Register new campaign">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, alignItems: 'center' }}>
              <input
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase())}
                placeholder="slug (utm_campaign)"
                style={inputStyle}
              />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Display name (e.g. 'Pro tier launch')"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 8, alignItems: 'center' }}>
              <input
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="Target URL (optional) — e.g. https://info-hub.io/pricing"
                style={inputStyle}
              />
              <input
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="Budget USD (optional)"
                type="number"
                min="0" step="1"
                style={inputStyle}
              />
            </div>
            {slug && targetUrl && (
              <div style={{
                fontSize: 10, color: 'var(--fg-muted)',
                padding: '6px 10px', borderRadius: 6,
                background: 'rgba(196, 181, 253, 0.05)',
                fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
              }}>
                <span style={{ color: 'var(--fg-faint)' }}>Preview link: </span>
                {targetUrl}{targetUrl.includes('?') ? '&' : '?'}utm_source=external&amp;utm_medium=campaign&amp;utm_campaign={slug}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                disabled={busy || !slug || !name}
                onClick={createCampaign}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: busy || !slug || !name ? 'rgba(255,255,255,0.05)' : '#c4b5fd',
                  color: busy || !slug || !name ? 'var(--fg-muted)' : '#000',
                  border: 0, cursor: busy || !slug || !name ? 'not-allowed' : 'pointer',
                }}
              >Create campaign</button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'transparent', color: 'var(--fg-muted)',
                  border: '1px solid var(--hub-border-subtle)', cursor: 'pointer',
                }}
              >Cancel</button>
            </div>
          </div>
        </Card>
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
            <SkeletonBlock w="100%" h={40} />
            <div style={{ height: 4 }} />
            <SkeletonBlock w="100%" h={40} />
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-faint)', fontSize: 12 }}>
            <Inbox style={{ width: 22, height: 22, opacity: 0.3, margin: '0 auto 6px' }} />
            No campaigns registered yet. Click &quot;New campaign&quot; to add one.
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hub-border-subtle)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Campaign</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Signups</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Paid → conv%</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>D7 retention</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>D30 retention</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Budget</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}> </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr
                  key={c.id}
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    opacity: c.archivedAt ? 0.45 : 1,
                  }}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{c.name}</span>
                      {c.archivedAt && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, color: '#94a3b8',
                          background: 'rgba(148, 163, 184, 0.15)',
                          padding: '1px 5px', borderRadius: 3,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>Archived</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
                      utm_campaign={c.slug}
                    </div>
                    {c.targetUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${c.targetUrl}${c.targetUrl!.includes('?') ? '&' : '?'}utm_source=external&utm_medium=campaign&utm_campaign=${c.slug}`;
                          navigator.clipboard?.writeText(url).then(
                            () => onToast('Campaign URL copied', true),
                            () => onToast('Copy failed', false),
                          );
                        }}
                        style={{
                          fontSize: 9, color: '#c4b5fd', background: 'transparent', border: 0,
                          padding: 0, marginTop: 2, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}
                        title="Copy UTM-tagged link"
                      >
                        <Copy style={{ width: 9, height: 9 }} /> copy link
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                    {fmtNumber(c.signups)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: c.paidConversions > 0 ? '#86efac' : 'var(--fg-faint)' }}>
                      {c.paidConversions}
                    </span>
                    <span style={{ color: 'var(--fg-faint)', marginLeft: 6, fontSize: 10 }}>
                      {c.conversionPct}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: c.d7RetentionPct >= 30 ? '#86efac' : c.d7RetentionPct >= 10 ? '#fcd34d' : 'var(--fg-muted)' }}>
                      {c.d7RetentionPct}%
                    </span>
                    <span style={{ color: 'var(--fg-faint)', marginLeft: 6, fontSize: 10 }}>
                      {c.d7Retained}/{c.signups}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: c.d30RetentionPct >= 20 ? '#86efac' : c.d30RetentionPct >= 5 ? '#fcd34d' : 'var(--fg-muted)' }}>
                      {c.d30RetentionPct}%
                    </span>
                    <span style={{ color: 'var(--fg-faint)', marginLeft: 6, fontSize: 10 }}>
                      {c.d30Retained}/{c.signups}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: c.budgetUsd ? '#fff' : 'var(--fg-faint)' }}>
                    {c.budgetUsd ? `$${fmtNumber(c.budgetUsd)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => archiveToggle(c)}
                      title={c.archivedAt ? 'Restore campaign' : 'Archive campaign'}
                      style={{
                        background: 'transparent', border: 0, cursor: busy ? 'not-allowed' : 'pointer',
                        color: 'var(--fg-muted)', padding: 4,
                      }}
                    >
                      {c.archivedAt
                        ? <ArchiveRestore style={{ width: 13, height: 13 }} />
                        : <Archive style={{ width: 13, height: 13 }} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--hub-border-subtle)',
  borderRadius: 6, color: '#fff', fontSize: 12,
  outline: 'none',
};
