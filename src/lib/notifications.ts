/**
 * Notification delivery for user alerts.
 * Supports email (Resend), Telegram, Discord Webhook, WhatsApp (Twilio), and Web Push channels.
 */

import { Resend } from 'resend';
import { sendMessage } from './telegram';
import webpush from 'web-push';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
const BASE_URL = process.env.NEXTAUTH_URL || 'https://info-hub.io';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface TriggeredAlertInfo {
  alertId: string;
  symbol: string;
  metric: string;
  operator: string;
  threshold: number;
  actualValue: number;
  exchange?: string;
  proximityPct?: number;
}

// ─── Email Notifications ────────────────────────────────────────────────────

function formatMetricLabel(metric: string): string {
  switch (metric) {
    case 'price': return 'Price';
    case 'fundingRate': return 'Funding Rate';
    case 'openInterest': return 'Open Interest';
    case 'change24h': return '24h Change';
    case 'volume24h': return '24h Volume';
    case 'liquidations24h': return '24h Liquidations';
    case 'liqProximity': return 'Liquidation Price';
    case 'tpProximity': return 'Take Profit Price';
    default: return metric;
  }
}

function formatValue(metric: string, value: number): string {
  const abs = Math.abs(value);
  switch (metric) {
    case 'price': return `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
    case 'fundingRate': return `${value.toFixed(4)}%`;
    case 'openInterest':
    case 'volume24h':
    case 'liquidations24h':
      if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
      return `$${value.toFixed(2)}`;
    case 'change24h': return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    case 'liqProximity':
    case 'tpProximity':
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    default: return String(value);
  }
}

function formatCondition(a: TriggeredAlertInfo): string {
  if (a.metric === 'liqProximity' || a.metric === 'tpProximity') {
    const label = a.metric === 'liqProximity' ? 'liq price' : 'TP';
    const distPct = a.threshold > 0 ? (Math.abs(a.actualValue - a.threshold) / a.threshold * 100).toFixed(1) : '?';
    return `within ${distPct}% of ${label} ${formatValue(a.metric, a.threshold)}`;
  }
  const opLabel = a.operator === 'gt' ? 'above' : 'below';
  const metricLabel = a.exchange
    ? `${formatMetricLabel(a.metric)} (${a.exchange})`
    : formatMetricLabel(a.metric);
  return `${metricLabel} ${opLabel} ${formatValue(a.metric, a.threshold)}`;
}

function buildAlertEmailHTML(alerts: TriggeredAlertInfo[]): string {
  const rows = alerts.map((a) => {
    return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: #fff; font-weight: 600;">${escapeHtml(a.symbol)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: #999;">${escapeHtml(formatCondition(a))}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: #f5a623; font-weight: 600;">${escapeHtml(formatValue(a.metric === 'liqProximity' || a.metric === 'tpProximity' ? 'price' : a.metric, a.actualValue))}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 20px; font-weight: 600; color: #fff; margin: 0;">InfoHub</h1>
      </div>
      <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f5a623; margin: 0 0 16px;">
          🔔 ${alerts.length} Alert${alerts.length > 1 ? 's' : ''} Triggered
        </h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr>
              <th style="padding: 6px 12px; text-align: left; color: #666; font-weight: 500; border-bottom: 1px solid #333;">Symbol</th>
              <th style="padding: 6px 12px; text-align: left; color: #666; font-weight: 500; border-bottom: 1px solid #333;">Condition</th>
              <th style="padding: 6px 12px; text-align: left; color: #666; font-weight: 500; border-bottom: 1px solid #333;">Current</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top: 20px; text-align: center;">
          <a href="${BASE_URL}/alerts" style="display: inline-block; background: #f5a623; color: #000; font-weight: 600; font-size: 13px; padding: 8px 20px; border-radius: 8px; text-decoration: none;">
            View Alerts
          </a>
        </div>
      </div>
      <p style="font-size: 11px; color: #444; text-align: center; margin-top: 24px;">
        InfoHub &mdash; Real-time derivatives intelligence
      </p>
    </div>
  `;
}

/**
 * Conservative email-shape check. Defence in depth: callers ARE expected
 * to pass the verified email from the DB, but a future caller passing a
 * user-supplied string straight through would otherwise let an attacker
 * relay alert emails via Resend to any address. Reject anything that
 * doesn't match a baseline pattern + is under 254 chars (RFC 5321).
 */
function isPlausibleEmailAddress(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  if (s.length === 0 || s.length > 254) return false;
  // Single @ separator, non-empty local + domain, at least one "." in domain.
  const parts = s.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (!domain.includes('.')) return false;
  // No whitespace or control chars.
  if (/\s/.test(s)) return false;
  return true;
}

export async function sendAlertEmail(
  to: string,
  alerts: TriggeredAlertInfo[],
): Promise<boolean> {
  const resend = getResend();
  if (!resend || alerts.length === 0) return false;
  if (!isPlausibleEmailAddress(to)) {
    console.warn(`[notifications] rejected sendAlertEmail to=${JSON.stringify(to).slice(0, 80)}`);
    return false;
  }
  try {
    await resend.emails.send({
      from: 'InfoHub <noreply@info-hub.io>',
      to,
      subject: `InfoHub Alert: ${alerts.map((a) => a.symbol).join(', ')}`,
      html: buildAlertEmailHTML(alerts),
    });
    return true;
  } catch (e) {
    console.error('[notifications] email send error:', e);
    return false;
  }
}

// ─── Telegram Notifications ─────────────────────────────────────────────────

function buildTelegramMessage(alerts: TriggeredAlertInfo[]): string {
  const lines = alerts.map((a) => {
    if (a.metric === 'liqProximity' || a.metric === 'tpProximity') {
      const label = a.metric === 'liqProximity' ? 'liquidation price' : 'take profit';
      const distPct = a.threshold > 0 ? (Math.abs(a.actualValue - a.threshold) / a.threshold * 100).toFixed(1) : '?';
      return `<b>${escapeHtml(a.symbol)}</b> ⚠️ Price within ${distPct}% of ${label}\nPrice: <b>${escapeHtml(formatValue('price', a.actualValue))}</b> | Target: ${escapeHtml(formatValue(a.metric, a.threshold))}`;
    }
    const opLabel = a.operator === 'gt' ? '▲ above' : '▼ below';
    const metricLabel = a.exchange
      ? `${formatMetricLabel(a.metric)} (${a.exchange})`
      : formatMetricLabel(a.metric);
    return `<b>${escapeHtml(a.symbol)}</b> — ${escapeHtml(metricLabel)} ${opLabel} ${escapeHtml(formatValue(a.metric, a.threshold))}\nCurrent: <b>${escapeHtml(formatValue(a.metric, a.actualValue))}</b>`;
  });
  return `🔔 <b>Alert${alerts.length > 1 ? 's' : ''} Triggered</b>\n\n${lines.join('\n\n')}`;
}

export async function sendAlertTelegram(
  chatId: number,
  alerts: TriggeredAlertInfo[],
): Promise<boolean> {
  if (alerts.length === 0) return false;
  try {
    await sendMessage(chatId, buildTelegramMessage(alerts), 'HTML');
    return true;
  } catch (e) {
    console.error('[notifications] telegram send error:', e);
    return false;
  }
}

// ─── Web Push Notifications ──────────────────────────────────────────────────

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:noreply@info-hub.io',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    vapidConfigured = true;
    return true;
  } catch (e) {
    console.error('[notifications] VAPID setup failed:', e);
    return false;
  }
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendAlertPush(
  subscriptions: PushSubscriptionData[],
  alerts: TriggeredAlertInfo[],
): Promise<{ sent: number; failed: number; expiredEndpoints: string[] }> {
  if (!ensureVapid() || alerts.length === 0 || subscriptions.length === 0) {
    return { sent: 0, failed: 0, expiredEndpoints: [] };
  }

  const symbols = alerts.map((a) => a.symbol).join(', ');
  const body = alerts.map((a) => {
    if (a.metric === 'liqProximity' || a.metric === 'tpProximity') {
      const label = a.metric === 'liqProximity' ? 'liq' : 'TP';
      return `${a.symbol} price near ${label} ${formatValue(a.metric, a.threshold)} → ${formatValue('price', a.actualValue)}`;
    }
    const op = a.operator === 'gt' ? 'above' : 'below';
    const metricLabel = a.exchange
      ? `${formatMetricLabel(a.metric)} (${a.exchange})`
      : formatMetricLabel(a.metric);
    return `${a.symbol} ${metricLabel} ${op} ${formatValue(a.metric, a.threshold)} → ${formatValue(a.metric, a.actualValue)}`;
  }).join('\n');

  const payload = JSON.stringify({
    title: `InfoHub: ${symbols}`,
    body,
    tag: `alert-${Date.now()}`,
    url: '/alerts',
  });

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        return 'sent' as const;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
          console.warn(`[push] Subscription expired: ${sub.endpoint.slice(0, 60)}...`);
        } else {
          console.error('[push] Send error:', err?.statusCode || err);
        }
        return 'failed' as const;
      }
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value === 'sent') sent++;
    else failed++;
  }

  return { sent, failed, expiredEndpoints };
}

// ─── Discord Webhook Notifications ─────────────────────────────────────────

function buildDiscordEmbed(alerts: TriggeredAlertInfo[]): object {
  const fields = alerts.map((a) => {
    let value: string;
    if (a.metric === 'liqProximity' || a.metric === 'tpProximity') {
      const label = a.metric === 'liqProximity' ? 'liq price' : 'TP';
      const distPct = a.threshold > 0 ? (Math.abs(a.actualValue - a.threshold) / a.threshold * 100).toFixed(1) : '?';
      value = `⚠️ Within ${distPct}% of ${label} ${formatValue(a.metric, a.threshold)}\nPrice: **${formatValue('price', a.actualValue)}**`;
    } else {
      const opLabel = a.operator === 'gt' ? '▲ above' : '▼ below';
      const metricLabel = a.exchange
        ? `${formatMetricLabel(a.metric)} (${a.exchange})`
        : formatMetricLabel(a.metric);
      value = `${metricLabel} ${opLabel} ${formatValue(a.metric, a.threshold)}\nCurrent: **${formatValue(a.metric, a.actualValue)}**`;
    }
    return { name: a.symbol, value, inline: true };
  });

  return {
    embeds: [
      {
        title: `🔔 ${alerts.length} Alert${alerts.length > 1 ? 's' : ''} Triggered`,
        color: 0xf5a623, // hub-yellow
        fields,
        footer: { text: 'InfoHub — info-hub.io' },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export async function sendAlertDiscord(
  webhookUrl: string,
  alerts: TriggeredAlertInfo[],
): Promise<boolean> {
  if (alerts.length === 0 || !webhookUrl) return false;
  // Basic Discord webhook URL validation (allow word chars, hyphens, dots in token)
  if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w\-.]+$/.test(webhookUrl)) {
    console.error('[notifications] invalid discord webhook URL');
    return false;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDiscordEmbed(alerts)),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('[notifications] discord webhook error:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[notifications] discord send error:', e);
    return false;
  }
}

// ─── WhatsApp Notifications (Twilio) ───────────────────────────────────────

function buildWhatsAppMessage(alerts: TriggeredAlertInfo[]): string {
  const lines = alerts.map((a) => {
    if (a.metric === 'liqProximity' || a.metric === 'tpProximity') {
      const label = a.metric === 'liqProximity' ? 'liq price' : 'TP';
      const distPct = a.threshold > 0 ? (Math.abs(a.actualValue - a.threshold) / a.threshold * 100).toFixed(1) : '?';
      return `*${a.symbol}* ⚠️ Within ${distPct}% of ${label} ${formatValue(a.metric, a.threshold)}\nPrice: *${formatValue('price', a.actualValue)}*`;
    }
    const opLabel = a.operator === 'gt' ? '▲ above' : '▼ below';
    const metricLabel = a.exchange
      ? `${formatMetricLabel(a.metric)} (${a.exchange})`
      : formatMetricLabel(a.metric);
    return `*${a.symbol}* — ${metricLabel} ${opLabel} ${formatValue(a.metric, a.threshold)}\nCurrent: *${formatValue(a.metric, a.actualValue)}*`;
  });
  return `🔔 *Alert${alerts.length > 1 ? 's' : ''} Triggered*\n\n${lines.join('\n\n')}\n\n_InfoHub — info-hub.io_`;
}

export async function sendAlertWhatsApp(
  toPhone: string,
  alerts: TriggeredAlertInfo[],
): Promise<boolean> {
  if (alerts.length === 0 || !toPhone) return false;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default

  if (!accountSid || !authToken) {
    console.error('[notifications] Twilio credentials not configured');
    return false;
  }

  // Normalize phone to E.164 with whatsapp: prefix
  let normalized = toPhone.trim();
  if (normalized.startsWith('whatsapp:')) normalized = normalized.slice(9);
  // Ensure + prefix for E.164 (Twilio requires it)
  if (/^\d/.test(normalized)) normalized = `+${normalized}`;
  const to = `whatsapp:${normalized}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: buildWhatsAppMessage(alerts),
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      console.error('[notifications] whatsapp send error:', res.status, errorBody);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[notifications] whatsapp send error:', e);
    return false;
  }
}
