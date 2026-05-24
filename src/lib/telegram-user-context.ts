/**
 * Telegram user-context builder.
 *
 * Loads the linked user's live positions + watchlist + recent fired alerts
 * and serializes them into a system-prompt snippet. Injected into every
 * Hub bot turn so responses can reference "your BTC long" instead of
 * generic market commentary.
 *
 * THIS is the personalization win that makes Hub feel different from any
 * other crypto LLM bot — they don't have your book, we do.
 *
 * Cached 60s per chatId so a tight conversation burst doesn't hammer the
 * DB. Cache key is chatId (not userId) because the same user could in
 * theory link multiple chats and have per-chat opt-outs.
 */

import {
  getTelegramLink,
  listUserPositions,
  getUserData,
  getSQL,
} from '@/lib/db';

interface CachedContext {
  body: string;
  ts: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<number, CachedContext>();

// Bound the cache so a runaway user-base doesn't OOM the process — at
// 60s TTL this trims naturally, but we cap as belt-and-braces.
const MAX_CACHE_ENTRIES = 2000;

/**
 * Build a system-prompt snippet describing the user's current context, or
 * `null` if the chat isn't linked. Errors are swallowed and return null
 * so the bot continues to work without context when the DB is hiccupping.
 */
export async function buildUserContext(chatId: number): Promise<string | null> {
  const cached = cache.get(chatId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.body || null;
  }

  try {
    const link = await getTelegramLink(chatId);
    if (!link || !link.user_id || !link.active) {
      // Anonymous / unlinked chats get no context. Still cache the
      // negative result for 60s so a spammer can't burn DB cycles.
      _writeCache(chatId, '');
      return null;
    }

    const userId = link.user_id;
    const [positions, prefs, recentFires] = await Promise.all([
      listUserPositions(userId).catch(() => []),
      getUserData(userId).catch(() => null),
      _recentAlertFires(userId).catch(() => []),
    ]);

    const lines: string[] = ["# This user's context"];

    // ── Positions ─────────────────────────────────────────────────────
    // Top 6 by absolute position value (keeps tokens bounded for whales
    // with dozens of small positions). Sorted server-side already; we
    // just slice + format.
    if (positions.length > 0) {
      lines.push('Active positions (across linked exchanges):');
      const topPositions = positions.slice(0, 6);
      for (const p of topPositions) {
        const sideTag = p.side?.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG';
        const value = p.positionValue ?? null;
        const valueStr = value != null ? `$${_fmtMoney(value)}` : '?';
        const entry = p.entryPrice != null ? `entry $${_fmtNum(p.entryPrice)}` : '';
        const upnl = p.unrealizedPnl != null
          ? ` ${p.unrealizedPnl >= 0 ? '+' : ''}$${_fmtMoney(p.unrealizedPnl)}`
          : '';
        const liq = p.liquidationPrice != null && p.markPrice
          ? ` liq $${_fmtNum(p.liquidationPrice)} (${_distPct(p.markPrice, p.liquidationPrice).toFixed(1)}% away)`
          : '';
        const exch = p.exchange || 'unknown';
        lines.push(`- ${sideTag} ${p.symbol} ${valueStr} @ ${exch}, ${entry}${upnl}${liq}`);
      }
      if (positions.length > 6) {
        lines.push(`(${positions.length - 6} smaller positions truncated)`);
      }
    } else {
      lines.push('Active positions: none currently open.');
    }

    // ── Watchlist ─────────────────────────────────────────────────────
    const watchlist = Array.isArray(prefs?.watchlist) ? prefs!.watchlist.slice(0, 20) : [];
    if (watchlist.length > 0) {
      lines.push(`Watchlist: ${watchlist.join(', ')}`);
    }

    // ── Recent alert fires ───────────────────────────────────────────
    if (recentFires.length > 0) {
      lines.push('Recent alerts (last 24h):');
      for (const f of recentFires.slice(0, 5)) {
        const time = _hoursAgo(f.sent_at);
        lines.push(`- ${f.symbol} ${f.metric} threshold ${f.threshold} fired (${time})`);
      }
    }

    // Tail guidance — tell the model how to USE the context, otherwise
    // it just dumps it back at the user verbatim.
    lines.push(
      '',
      'Use this context to make responses concrete and personal. ' +
      'Reference positions, watchlist, and recent alerts when relevant — ' +
      'but don\'t quote the context block back verbatim. The user knows ' +
      'their own positions; surface insights they don\'t already have.',
    );

    const body = lines.join('\n');
    _writeCache(chatId, body);
    return body;
  } catch (e) {
    console.error('[telegram-user-context] build error:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Force-invalidate the cache for one chat. Called from /forget. */
export function invalidateUserContext(chatId: number): void {
  cache.delete(chatId);
}

// ─── Internal helpers ────────────────────────────────────────────────

interface AlertFireRow {
  symbol: string;
  metric: string;
  threshold: number;
  sent_at: Date;
}

async function _recentAlertFires(userId: string): Promise<AlertFireRow[]> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT symbol, metric, threshold, sent_at
      FROM alert_notifications
      WHERE user_id = ${userId}
        AND sent_at > NOW() - INTERVAL '24 hours'
      ORDER BY sent_at DESC
      LIMIT 10
    `;
    return rows.map((r: any) => ({
      symbol: String(r.symbol),
      metric: String(r.metric),
      threshold: Number(r.threshold),
      sent_at: new Date(r.sent_at),
    }));
  } catch {
    return [];
  }
}

function _writeCache(chatId: number, body: string): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Eviction: drop the oldest 10% — cheap, no need for LRU bookkeeping.
    const drop = Math.ceil(MAX_CACHE_ENTRIES * 0.1);
    const keys = Array.from(cache.keys()).slice(0, drop);
    for (const k of keys) cache.delete(k);
  }
  cache.set(chatId, { body, ts: Date.now() });
}

function _fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function _fmtNum(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}

function _distPct(price: number, target: number): number {
  if (price <= 0) return 0;
  return Math.abs((target - price) / price) * 100;
}

function _hoursAgo(d: Date): string {
  const mins = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
