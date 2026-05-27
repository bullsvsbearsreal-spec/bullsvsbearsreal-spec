'use client';

import { Send, Bell, Mail, MessageSquare, Webhook, Phone } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber, fmtPct } from '../components/primitives';
import type { StatsResp } from '../types';

/**
 * Notifications tab — alert delivery health, per-channel volume, and
 * a coarse engagement count.
 *
 * Powered by stats.notifications (already in /api/admin/stats):
 *   - sent / failed / total in last 7d
 *   - byChannel sends in last 7d
 *
 * No new endpoints — all data flows through the extended stats route.
 */
export function NotificationsTab({ stats }: { stats: StatsResp | null }) {
  const n = stats?.notifications;
  const successPct = n && n.total > 0 ? (n.sent / n.total) * 100 : null;

  return (
    <>
      <SectionHead title="Alert Engine · last 7 days" icon={<Bell style={{ width: 13, height: 13 }} />} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <Card title="Delivery Success">
          {!n ? <SkeletonBlock w={120} h={32} /> : successPct === null ? (
            <div style={{ fontSize: 14, color: 'var(--fg-muted)' }}>No sends in last 7d</div>
          ) : (
            <>
              <div style={{
                fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)',
                color: successPct >= 95 ? 'var(--pump-mild)' : successPct >= 80 ? '#fbbf24' : 'var(--rekt-mild)',
                letterSpacing: '-0.01em', lineHeight: 1,
              }}>
                {successPct.toFixed(1)}<span style={{ fontSize: 18, marginLeft: 2 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                {fmtNumber(n!.sent)} sent · {fmtNumber(n!.failed)} failed · {fmtNumber(n!.total)} total
              </div>
            </>
          )}
        </Card>

        <Card title="Volume · last 7d">
          {!n ? <SkeletonBlock w={120} h={32} /> : (
            <>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                {fmtNumber(n.total)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 6 }}>
                Attempts across all channels
              </div>
            </>
          )}
        </Card>

        <Card title="Failure Rate">
          {!n ? <SkeletonBlock w={120} h={32} /> : (
            <>
              <div style={{
                fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)',
                color: n.total > 0 && (n.failed / n.total) > 0.05 ? 'var(--rekt-mild)' : '#fff',
              }}>
                {n.total > 0 ? fmtPct((n.failed / n.total) * 100) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 6 }}>
                {n.total > 0 && (n.failed / n.total) > 0.05
                  ? 'Above the 5% degraded threshold'
                  : 'Within healthy band (<5%)'}
              </div>
            </>
          )}
        </Card>
      </div>

      <SectionHead title="Sends by Channel" icon={<Send style={{ width: 13, height: 13 }} />} />
      <Card title="Volume per channel · last 7 days">
        {!n ? <SkeletonBlock w="100%" h={180} /> : n.byChannel.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '24px 0' }}>
            No notifications in last 7 days.
          </div>
        ) : (
          <ChannelList byChannel={n.byChannel} />
        )}
      </Card>

      {/* Subscription counts */}
      <SectionHead title="Subscription Pools" icon={<Bell style={{ width: 13, height: 13 }} />} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <Card title="Telegram users · linked">
          {!stats ? <SkeletonBlock w={120} h={32} /> : (
            <>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                {fmtNumber(stats.totals.telegramUsers)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 6 }}>
                Users who&apos;ve linked @InfoHubRadarBot to their account
              </div>
            </>
          )}
        </Card>
        <Card title="Browser push subscribers">
          {!stats ? <SkeletonBlock w={120} h={32} /> : (
            <>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                {fmtNumber(stats.totals.pushSubscriptions)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 6 }}>
                Active service-worker push subscriptions
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function channelIcon(ch: string) {
  const lower = ch.toLowerCase();
  if (lower.startsWith('telegram')) return <Send style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('email'))    return <Mail style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('discord'))  return <MessageSquare style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('sms') || lower.includes('whatsapp')) return <Phone style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('webhook'))  return <Webhook style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('push'))     return <Bell style={{ width: 12, height: 12 }} />;
  return <Bell style={{ width: 12, height: 12 }} />;
}

function ChannelList({ byChannel }: { byChannel: { channel: string; count: number }[] }) {
  const max = Math.max(...byChannel.map(x => x.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {byChannel.map(c => {
        const w = (c.count / max) * 100;
        return (
          <div key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--fg-muted)', width: 14 }}>{channelIcon(c.channel)}</span>
            <span style={{ fontSize: 12, color: 'var(--fg-default)', textTransform: 'capitalize', width: 110 }}>{c.channel}</span>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${w}%`, height: '100%', background: 'var(--hub-accent)', transition: 'width 600ms ease-out' }} />
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff', width: 64, textAlign: 'right' }}>{fmtNumber(c.count)}</span>
          </div>
        );
      })}
    </div>
  );
}
