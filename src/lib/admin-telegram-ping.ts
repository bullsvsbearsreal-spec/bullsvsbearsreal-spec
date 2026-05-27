/**
 * Operator-alert pings to the InfoHub Radar bot.
 *
 * Single recipient: the operator's personal chat with @InfoHubRadarBot.
 * Configured via env var `ADMIN_TELEGRAM_CHAT_ID`. No-op if either the
 * bot token or chat id is unset — useful for local dev where we don't
 * want every test bug report to spam Telegram.
 *
 * Used for high-signal operator events:
 *   · new bug reports (per-page Report widget)
 *   · future: suspended-user 401 spike, broadcast result, etc.
 *
 * Failures are silently logged — the calling code path should never
 * fail because Telegram is down.
 */

const TOKEN   = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const CHAT_ID = (process.env.ADMIN_TELEGRAM_CHAT_ID || '').trim();
const ENABLED = !!TOKEN && !!CHAT_ID;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function send(text: string): Promise<void> {
  if (!ENABLED) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn('[admin-telegram-ping] HTTP', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[admin-telegram-ping] error:', e instanceof Error ? e.message : e);
  }
}

/**
 * Notify the operator about a new bug report. Fire-and-forget — the
 * caller should NOT await this if the user-facing latency matters.
 *
 * Format intentionally compact: severity badge, first line of the
 * message, page URL, reporter (or anonymous). Anything more goes to
 * the admin dashboard.
 */
export function pingBugReport(report: {
  id: number;
  severity: 'low' | 'normal' | 'high';
  message: string;
  pageUrl: string;
  userEmail: string | null;
}): Promise<void> {
  const sevBadge = report.severity === 'high'   ? '🔴 HIGH'
                : report.severity === 'normal' ? '🟡 NORMAL'
                : '⚪ LOW';
  const firstLine = (report.message.split('\n')[0] || '').slice(0, 200);
  const url = `https://info-hub.io/admin-panel#feedback`;
  const text = [
    `<b>🐛 Bug report #${report.id}</b> · ${sevBadge}`,
    '',
    `${escapeHtml(firstLine)}`,
    '',
    `<i>page:</i> <code>${escapeHtml(report.pageUrl)}</code>`,
    `<i>from:</i> ${report.userEmail ? escapeHtml(report.userEmail) : '<i>anonymous</i>'}`,
    '',
    `<a href="${url}">Triage in dashboard →</a>`,
  ].join('\n');
  return send(text);
}
