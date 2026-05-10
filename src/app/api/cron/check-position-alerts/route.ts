/**
 * Cron: every 5 min, scan all enabled alert rules and notify users when their
 * positions trigger them.
 *
 * MVP rule kind: `funding_flip`
 *   For each open position the user has, look up the latest two funding-rate
 *   snapshots in funding_snapshots. If the SIGN of the funding rate has
 *   flipped, AND it's now flipped AGAINST the position direction (long+pos
 *   or short+neg), and the cooldown has elapsed, fire one Telegram message
 *   summarising every triggered position.
 *
 * Cooldown is per-rule (default 60 min) — a single fire bundles every flipped
 * position into one message so the user doesn't get one ping per coin.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  isDBConfigured, listEnabledAlertsWithPositions, markAlertFired,
  getTelegramLinkByUser, getUserEmail, getSQL,
  getPushSubscriptionsForUser, deletePushSubscription,
} from '@/lib/db';
import { sendMessage } from '@/lib/telegram';
import { Resend } from 'resend';
import webpush from 'web-push';
import { verifyCronAuth } from '../_auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface FundingSign {
  current: number;   // most recent rate
  previous: number;  // rate before that
}

async function loadLastTwoFunding(
  pairs: { exchange: string; symbol: string }[],
): Promise<Map<string, FundingSign>> {
  const out = new Map<string, FundingSign>();
  if (pairs.length === 0) return out;
  const sql = getSQL();
  const exchanges = pairs.map(p => p.exchange);
  const symbols = pairs.map(p => p.symbol);
  // ROW_NUMBER over (partition by exchange, symbol order by ts desc) — pull
  // the top 2 rows per pair in one query.
  const rows = await sql`
    WITH wanted AS (
      SELECT * FROM UNNEST(
        ${sql.array(exchanges)}::text[],
        ${sql.array(symbols)}::text[]
      ) AS t(exchange, symbol)
    ),
    ranked AS (
      -- Skip rate=0 / null placeholders written by the per-minute mark-price
      -- block of cron/snapshot — those would otherwise be picked as the
      -- "current" rate and trigger spurious sign-flip alerts.
      SELECT f.exchange, f.symbol, f.rate, f.ts,
             ROW_NUMBER() OVER (PARTITION BY f.exchange, f.symbol ORDER BY f.ts DESC) AS rn
      FROM funding_snapshots f
      JOIN wanted w ON w.exchange = f.exchange AND w.symbol = f.symbol
      WHERE f.ts > NOW() - INTERVAL '24 hours'
        AND f.rate IS NOT NULL
        AND f.rate <> 0
    )
    SELECT exchange, symbol, rate, rn FROM ranked WHERE rn <= 2
  `;
  // Group by pair, pick rn=1 → current, rn=2 → previous
  type Tmp = { current?: number; previous?: number };
  const tmp = new Map<string, Tmp>();
  for (const r of rows as any[]) {
    const key = `${r.exchange}|${r.symbol}`;
    const e = tmp.get(key) ?? {};
    if (r.rn === 1) e.current = Number(r.rate);
    else if (r.rn === 2) e.previous = Number(r.rate);
    tmp.set(key, e);
  }
  Array.from(tmp.entries()).forEach(([k, v]) => {
    if (typeof v.current === 'number' && typeof v.previous === 'number') {
      out.set(k, { current: v.current, previous: v.previous });
    }
  });
  return out;
}

/** Threshold per-window funding rate above which we consider it "meaningful"
 *  pressure. 0.005% per 8h = ~5.5% APR — well above neutral noise. */
const MEANINGFUL_AGAINST_RATE = 0.00005;

/**
 * True if funding is unfavourable to the position. Two cases trigger:
 *
 *   1. CLASSIC FLIP — sign flipped vs the previous reading and is now against
 *      our side. Catches the moment of transition.
 *
 *   2. SUSTAINED PRESSURE — both readings are against our side, current rate
 *      magnitude exceeds MEANINGFUL_AGAINST_RATE, and the situation is active.
 *      Catches the case where funding has been against us for many hours but
 *      no new flip happened in the last cron window.
 *
 * The dedupe / cooldown logic in the caller ensures sustained-pressure cases
 * only ping once per cooldown period (default 60 min).
 */
function flippedAgainst(side: 'long' | 'short', f: FundingSign): boolean {
  // Helper: is rate against our position?
  const againstSide = (rate: number): boolean =>
    side === 'long' ? rate > 0 : rate < 0;

  // Case 1: classic flip — sign changed and it's now against us.
  if (f.previous * f.current < 0 && againstSide(f.current)) return true;

  // Case 2: sustained pressure — both readings against us, current is meaningful.
  if (againstSide(f.current) && Math.abs(f.current) >= MEANINGFUL_AGAINST_RATE
      && (f.previous === 0 || againstSide(f.previous))) {
    return true;
  }

  return false;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(4)}%`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Render the alert as a minimal HTML email body. */
function renderEmailHtml(triggers: Array<{
  symbol: string; side: 'long' | 'short'; exchange: string; previous: number; current: number;
}>): string {
  const rows = triggers.map(t => `
    <tr>
      <td style="padding:8px 12px;font-weight:600;color:#fff">${escapeHtml(t.symbol)}</td>
      <td style="padding:8px 12px;color:${t.side === 'long' ? '#34d399' : '#f87171'};text-transform:uppercase;font-size:12px;font-weight:700">${t.side}</td>
      <td style="padding:8px 12px;color:#9ca3af">${escapeHtml(t.exchange)}</td>
      <td style="padding:8px 12px;color:#9ca3af;text-align:right;font-family:monospace">${fmtPct(t.previous)}</td>
      <td style="padding:8px 12px;color:#fbbf24;text-align:right;font-family:monospace;font-weight:600">→ ${fmtPct(t.current)}</td>
    </tr>`).join('');
  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#0b0d12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e7eb">
  <div style="max-width:600px;margin:0 auto;background:#11141b;border:1px solid #1f2937;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;border-bottom:1px solid #1f2937">
      <div style="font-size:11px;letter-spacing:2px;color:#fbbf24;font-weight:700">⚠️ INFOHUB ALERT</div>
      <h1 style="margin:6px 0 0;font-size:18px;color:#fff">Funding flipped against your position${triggers.length > 1 ? 's' : ''}</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:rgba(255,255,255,0.02);text-transform:uppercase;font-size:10px;letter-spacing:1.5px;color:#6b7280">
          <th style="padding:8px 12px;text-align:left">Coin</th>
          <th style="padding:8px 12px;text-align:left">Side</th>
          <th style="padding:8px 12px;text-align:left">Exchange</th>
          <th style="padding:8px 12px;text-align:right">Previous</th>
          <th style="padding:8px 12px;text-align:right">Current</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="padding:16px 24px;border-top:1px solid #1f2937;text-align:center">
      <a href="https://info-hub.io/positions" style="display:inline-block;padding:8px 16px;background:#fbbf24;color:#000;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px">View positions →</a>
    </div>
    <div style="padding:12px 24px;font-size:11px;color:#4b5563;text-align:center">
      You're getting this because you enabled <em>Funding flip alerts</em> on InfoHub.
      <a href="https://info-hub.io/account/connections" style="color:#6b7280">Manage</a>
    </div>
  </div>
</body></html>`.trim();
}

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

let _vapidConfigured = false;
function ensureVapid(): boolean {
  if (_vapidConfigured) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:noreply@info-hub.io',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    _vapidConfigured = true;
    return true;
  } catch (e) {
    console.error('[alerts] VAPID setup failed:', e);
    return false;
  }
}

export async function GET(req: NextRequest) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  // Wrap the whole batch in try/catch — without it, an unhandled throw
  // from listEnabledAlertsWithPositions, loadLastTwoFunding, or any
  // delivery function turns into a 500 HTML page that the cron monitor
  // (HTTP 200 grep) silently misses. Users would stop receiving
  // near-liq / funding-flip alerts with no signal.
  try {
  const all = await listEnabledAlertsWithPositions();
  let usersChecked = 0;
  let alertsFired = 0;
  let positionsTriggered = 0;
  const debug: Array<{ userId: string; kind: string; triggered: number; fired: boolean; reason?: string }> = [];

  // Threshold above which a long is considered "near liquidation". Tied to
  // the position-health liqBuffer sub-score: anything below this distance
  // would be a yellow/red alarm anyway.
  const NEAR_LIQ_PCT = 0.05; // 5% buffer triggers the alert

  for (const { rule, positions } of all) {
    usersChecked++;
    if (rule.kind !== 'funding_flip' && rule.kind !== 'near_liq') {
      debug.push({ userId: rule.userId, kind: rule.kind, triggered: 0, fired: false, reason: 'unknown kind' });
      continue;
    }

    // Cooldown
    if (rule.lastFiredAt) {
      const sinceMin = (Date.now() - new Date(rule.lastFiredAt).getTime()) / 60_000;
      if (sinceMin < rule.cooldownMin) {
        debug.push({ userId: rule.userId, kind: rule.kind, triggered: 0, fired: false, reason: `cooldown ${Math.round(rule.cooldownMin - sinceMin)}m left` });
        continue;
      }
    }

    if (positions.length === 0) {
      debug.push({ userId: rule.userId, kind: rule.kind, triggered: 0, fired: false, reason: 'no positions' });
      continue;
    }

    // ─── Per-kind trigger evaluation ──────────────────────────────────
    // Each kind computes:
    //   - triggered: which positions matched
    //   - lines:     per-position HTML body
    //   - headline:  HTML headline
    //   - emailSubj: email subject
    //   - pushTitle: short push notification title
    //   - pushTag:   dedup tag for browser push
    //   - reasonNo:  debug reason when triggered.length === 0
    let triggered: typeof positions = [];
    let lines = '';
    let headline = '';
    let emailSubj = '';
    let pushTitle = '';
    let pushTag = '';
    let reasonNo = '';
    let pushBody = '';
    let emailRows: Array<{ symbol: string; side: 'long'|'short'; exchange: string; previous: number; current: number }> = [];

    if (rule.kind === 'funding_flip') {
      const fundingMap = await loadLastTwoFunding(
        positions.map(p => ({ exchange: p.exchange, symbol: p.symbol })),
      );
      triggered = positions.filter(p => {
        const f = fundingMap.get(`${p.exchange}|${p.symbol}`);
        return f ? flippedAgainst(p.side, f) : false;
      });
      reasonNo = 'no flips';
      if (triggered.length > 0) {
        lines = triggered.map(p => {
          const f = fundingMap.get(`${p.exchange}|${p.symbol}`)!;
          const arrow = p.side === 'long' ? '🔻' : '🔺';
          const isFlip = f.previous * f.current < 0;
          const tag = isFlip ? '(now against you)' : '(still against you)';
          return `${arrow} <b>${p.symbol}</b> ${p.side.toUpperCase()} on ${p.exchange}\n   funding: ${fmtPct(f.previous)} → <b>${fmtPct(f.current)}</b> ${tag}`;
        }).join('\n\n');
        const flipped = triggered.some(p => {
          const f = fundingMap.get(`${p.exchange}|${p.symbol}`)!;
          return f.previous * f.current < 0;
        });
        headline = flipped
          ? `⚠️ <b>Funding flipped against your position${triggered.length > 1 ? 's' : ''}</b>`
          : `⚠️ <b>Funding pressure against your position${triggered.length > 1 ? 's' : ''}</b>`;
        emailSubj = `Funding flipped on ${triggered.length} position${triggered.length > 1 ? 's' : ''}`;
        pushTitle = `⚠️ Funding flipped on ${triggered.length} position${triggered.length > 1 ? 's' : ''}`;
        pushTag = `funding-flip-${rule.id}`;
        pushBody = triggered
          .map(p => `${p.symbol} ${p.side.toUpperCase()} on ${p.exchange} — funding now against you`)
          .join('\n')
          .slice(0, 240);
        emailRows = triggered.map(p => {
          const f = fundingMap.get(`${p.exchange}|${p.symbol}`)!;
          return { symbol: p.symbol, side: p.side, exchange: p.exchange, previous: f.previous, current: f.current };
        });
      }
    } else if (rule.kind === 'near_liq') {
      // Filter positions where mark is within NEAR_LIQ_PCT of liquidation
      // price. Long: liq is below mark (warn when mark - liq is small).
      // Short: liq is above mark (warn when liq - mark is small).
      triggered = positions.filter(p => {
        if (p.liquidationPrice == null || p.liquidationPrice <= 0) return false;
        const ref = (p.markPrice && p.markPrice > 0) ? p.markPrice : p.entryPrice;
        if (!ref || ref <= 0) return false;
        const distance = p.side === 'long'
          ? (ref - p.liquidationPrice) / ref
          : (p.liquidationPrice - ref) / ref;
        return distance > 0 && distance < NEAR_LIQ_PCT;
      });
      reasonNo = 'no near-liq positions';
      if (triggered.length > 0) {
        lines = triggered.map(p => {
          const ref = (p.markPrice && p.markPrice > 0) ? p.markPrice : p.entryPrice;
          const distance = p.side === 'long'
            ? (ref - p.liquidationPrice!) / ref
            : (p.liquidationPrice! - ref) / ref;
          return `🔥 <b>${p.symbol}</b> ${p.side.toUpperCase()} on ${p.exchange}\n   liq <b>${(distance * 100).toFixed(2)}%</b> away (mark $${ref.toLocaleString()} → liq $${p.liquidationPrice!.toLocaleString()})`;
        }).join('\n\n');
        headline = `🚨 <b>Position${triggered.length > 1 ? 's' : ''} approaching liquidation</b>`;
        emailSubj = `🚨 ${triggered.length} position${triggered.length > 1 ? 's' : ''} near liquidation`;
        pushTitle = `🚨 ${triggered.length} position${triggered.length > 1 ? 's' : ''} near liquidation`;
        pushTag = `near-liq-${rule.id}`;
        pushBody = triggered
          .map(p => {
            const ref = (p.markPrice && p.markPrice > 0) ? p.markPrice : p.entryPrice;
            const distance = p.side === 'long'
              ? (ref - p.liquidationPrice!) / ref
              : (p.liquidationPrice! - ref) / ref;
            return `${p.symbol} ${p.side.toUpperCase()}: liq ${(distance * 100).toFixed(1)}% away`;
          })
          .join('\n')
          .slice(0, 240);
        // Email row shape reuses the funding-flip table; we put liq distance
        // into the "current" slot and 0 into "previous" so the renderer
        // still shows numbers. Future: render-email-html dedicated layout.
        emailRows = triggered.map(p => {
          const ref = (p.markPrice && p.markPrice > 0) ? p.markPrice : p.entryPrice;
          const distance = p.side === 'long'
            ? (ref - p.liquidationPrice!) / ref
            : (p.liquidationPrice! - ref) / ref;
          return { symbol: p.symbol, side: p.side, exchange: p.exchange, previous: 0, current: distance * 100 };
        });
      }
    }

    positionsTriggered += triggered.length;

    if (triggered.length === 0) {
      debug.push({ userId: rule.userId, kind: rule.kind, triggered: 0, fired: false, reason: reasonNo });
      continue;
    }

    const body =
      headline + '\n\n' +
      lines +
      `\n\n<a href="https://info-hub.io/positions">View positions →</a>`;

    // Send via every configured channel. Each is best-effort independent —
    // we mark the rule fired (and start cooldown) if AT LEAST ONE channel
    // delivered, so a missing telegram link doesn't block email or vice versa.
    const channelResults: string[] = [];
    let anyDelivered = false;

    if (rule.channels.includes('telegram')) {
      const link = await getTelegramLinkByUser(rule.userId);
      if (link?.active && (!link.muted_until || link.muted_until.getTime() < Date.now())) {
        const ok = await sendMessage(link.chat_id, body, 'HTML');
        channelResults.push(`telegram=${ok ? 'sent' : 'failed'}`);
        if (ok) anyDelivered = true;
      } else {
        channelResults.push(`telegram=${link ? 'inactive/muted' : 'not linked'}`);
      }
    }

    if (rule.channels.includes('email')) {
      const email = await getUserEmail(rule.userId);
      const resend = getResend();
      if (!email) {
        channelResults.push('email=no verified address');
      } else if (!resend) {
        channelResults.push('email=RESEND_API_KEY unset');
      } else {
        try {
          const html = renderEmailHtml(emailRows);
          await resend.emails.send({
            from: 'InfoHub Alerts <noreply@info-hub.io>',
            to: email,
            subject: emailSubj,
            html,
          });
          channelResults.push('email=sent');
          anyDelivered = true;
        } catch (e) {
          channelResults.push(`email=failed (${e instanceof Error ? e.message.slice(0, 60) : 'err'})`);
        }
      }
    }

    if (rule.channels.includes('browser_push')) {
      const subs = await getPushSubscriptionsForUser(rule.userId);
      if (subs.length === 0) {
        channelResults.push('browser_push=no subscriptions');
      } else if (!ensureVapid()) {
        channelResults.push('browser_push=VAPID keys unset');
      } else {
        const payload = JSON.stringify({
          title: pushTitle,
          body: pushBody,
          tag: pushTag,
          url: '/positions',
        });
        let pushSent = 0;
        await Promise.all(subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            );
            pushSent++;
          } catch (err: any) {
            // 410 Gone / 404 → subscription is dead, evict to avoid retries forever
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await deletePushSubscription(sub.endpoint).catch(() => undefined);
            }
          }
        }));
        channelResults.push(`browser_push=${pushSent}/${subs.length} delivered`);
        if (pushSent > 0) anyDelivered = true;
      }
    }

    if (anyDelivered) {
      await markAlertFired(rule.id);
      alertsFired++;
    }

    const reason = channelResults.join('; ');
    debug.push({ userId: rule.userId, kind: rule.kind, triggered: triggered.length, fired: anyDelivered, reason });
  }

  return NextResponse.json(
    {
      usersChecked,
      alertsFired,
      positionsTriggered,
      debug,
      ts: Date.now(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[check-position-alerts] cron failed:', msg);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
