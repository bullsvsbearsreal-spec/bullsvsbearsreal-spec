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
import { isDBConfigured, listEnabledAlertsWithPositions, markAlertFired, getTelegramLinkByUser, getUserEmail, getSQL } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';
import { Resend } from 'resend';
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
      SELECT f.exchange, f.symbol, f.rate, f.ts,
             ROW_NUMBER() OVER (PARTITION BY f.exchange, f.symbol ORDER BY f.ts DESC) AS rn
      FROM funding_snapshots f
      JOIN wanted w ON w.exchange = f.exchange AND w.symbol = f.symbol
      WHERE f.ts > NOW() - INTERVAL '24 hours'
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

/** True if the funding sign flipped AGAINST the position direction. */
function flippedAgainst(side: 'long' | 'short', f: FundingSign): boolean {
  // Sign change: prev * current < 0
  if (f.previous * f.current >= 0) return false;
  // Flipped — but is it AGAINST our side?
  // long  → bad when current > 0 (longs now pay)
  // short → bad when current < 0 (shorts now pay)
  if (side === 'long') return f.current > 0;
  return f.current < 0;
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

export async function GET(req: NextRequest) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const all = await listEnabledAlertsWithPositions();
  let usersChecked = 0;
  let alertsFired = 0;
  let positionsTriggered = 0;
  const debug: Array<{ userId: string; kind: string; triggered: number; fired: boolean; reason?: string }> = [];

  for (const { rule, positions } of all) {
    usersChecked++;
    if (rule.kind !== 'funding_flip') {
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

    // Pull last-2 funding for every open pair
    const fundingMap = await loadLastTwoFunding(
      positions.map(p => ({ exchange: p.exchange, symbol: p.symbol })),
    );

    const triggered = positions.filter(p => {
      const f = fundingMap.get(`${p.exchange}|${p.symbol}`);
      if (!f) return false;
      return flippedAgainst(p.side, f);
    });
    positionsTriggered += triggered.length;

    if (triggered.length === 0) {
      debug.push({ userId: rule.userId, kind: rule.kind, triggered: 0, fired: false, reason: 'no flips' });
      continue;
    }

    // Build the message body. One unified message rather than N per-position pings.
    const lines = triggered.map(p => {
      const f = fundingMap.get(`${p.exchange}|${p.symbol}`)!;
      const arrow = p.side === 'long' ? '🔻' : '🔺';
      return `${arrow} <b>${p.symbol}</b> ${p.side.toUpperCase()} on ${p.exchange}\n   funding: ${fmtPct(f.previous)} → <b>${fmtPct(f.current)}</b> (now against you)`;
    }).join('\n\n');
    const body =
      `⚠️ <b>Funding flipped against your position${triggered.length > 1 ? 's' : ''}</b>\n\n` +
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
          const html = renderEmailHtml(triggered.map(p => {
            const f = fundingMap.get(`${p.exchange}|${p.symbol}`)!;
            return { symbol: p.symbol, side: p.side, exchange: p.exchange, previous: f.previous, current: f.current };
          }));
          await resend.emails.send({
            from: 'InfoHub Alerts <noreply@info-hub.io>',
            to: email,
            subject: `Funding flipped on ${triggered.length} position${triggered.length > 1 ? 's' : ''}`,
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
      // browser_push wiring lands in a follow-up — push subscriptions table
      // already exists from the price-alert system, just need to plumb it in.
      channelResults.push('browser_push=not yet implemented');
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
}
