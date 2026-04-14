/**
 * Cron endpoint: poll tracked wallets for new DEX trades.
 * Runs every 2 minutes via Vercel Cron.
 *
 * Batches wallets (max 25 per invocation) with a cursor to round-robin
 * through all tracked wallets across multiple cycles.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initDB, isDBConfigured, getSQL,
  getDistinctTrackedWallets, insertWhaleTradeEvents,
  getTradeSubscribers, logWhaleNotification, hasWhaleNotifBeenSent,
  getCache, setCache, pruneOldWhaleData,
  getPushSubscriptionsForUser, deletePushSubscription,
  upsertWorkerHeartbeat,
} from '@/lib/db';
import { detectTrades, formatTradeMessage } from '@/lib/whale-trades';
import { sendMessage } from '@/lib/telegram';
import { sendAlertDiscord, sendAlertWhatsApp, sendAlertEmail } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 55;
export const preferredRegion = 'bom1';

const MAX_WALLETS_PER_CYCLE = 25;
const CURSOR_CACHE_KEY = 'whale_trades_cursor';

export async function GET(request: NextRequest) {
  const { verifyCronAuth } = await import('../_auth');
  const authErr = verifyCronAuth(request);
  if (authErr) return authErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB not configured' }, { status: 503 });
  }
  await initDB();

  const allWallets = await getDistinctTrackedWallets();
  if (allWallets.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, trades: 0, notifications: 0 });
  }

  // Round-robin cursor
  let cursor = 0;
  try {
    const cached = await getCache<{ cursor: number }>(CURSOR_CACHE_KEY);
    if (cached?.cursor != null) cursor = cached.cursor;
  } catch { /* start at 0 */ }
  if (cursor >= allWallets.length) cursor = 0;

  const batch = allWallets.slice(cursor, cursor + MAX_WALLETS_PER_CYCLE);
  const nextCursor = cursor + batch.length >= allWallets.length ? 0 : cursor + batch.length;
  await setCache(CURSOR_CACHE_KEY, { cursor: nextCursor }, 600).catch(() => {});

  let totalTrades = 0;
  let totalNotifs = 0;
  const errors: string[] = [];

  for (const wallet of batch) {
    try {
      const trades = await detectTrades(wallet.address, wallet.chain);
      if (trades.length === 0) continue;

      // Only process trades from last 10 minutes
      const cutoff = Date.now() - 10 * 60 * 1000;
      const recent = trades.filter(t => t.blockTime.getTime() > cutoff);
      if (recent.length === 0) continue;

      // Insert and get count of actually new trades
      const inserted = await insertWhaleTradeEvents(
        recent.map(t => ({
          address: t.address, chain: t.chain, txHash: t.txHash,
          logIndex: t.logIndex, dex: t.dex, action: t.action,
          tokenIn: t.tokenIn, tokenInSymbol: t.tokenInSymbol, amountIn: t.amountIn,
          tokenOut: t.tokenOut, tokenOutSymbol: t.tokenOutSymbol, amountOut: t.amountOut,
          valueUsd: t.valueUsd, blockNumber: t.blockNumber, blockTime: t.blockTime,
        })),
      );
      totalTrades += inserted;

      if (inserted > 0) {
        // Query back the newly inserted events to get their DB IDs
        const sql = getSQL();
        const txHashes = recent.map(t => t.txHash);
        const newEvents = await sql`
          SELECT id, tx_hash FROM whale_trade_events
          WHERE tx_hash = ANY(${txHashes}) AND address = ${wallet.address.toLowerCase()}
          ORDER BY discovered_at DESC LIMIT ${inserted}
        `;
        const txToId = new Map(newEvents.map((r: any) => [r.tx_hash, r.id]));

        totalNotifs += await notifySubscribers(wallet.address, wallet.chain, recent, txToId);
      }
    } catch (err) {
      errors.push(`${wallet.chain}:${wallet.address.slice(0, 8)}: ${err instanceof Error ? err.message : 'error'}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // Prune old data (5% chance)
  if (Math.random() < 0.05) {
    await pruneOldWhaleData(30).catch(() => {});
  }

  await upsertWorkerHeartbeat('cron:whale-trades', 'ok', {
    checked: batch.length, trades: totalTrades, notifications: totalNotifs,
  }).catch(() => {});

  return NextResponse.json({
    ok: true, checked: batch.length, totalTracked: allWallets.length,
    trades: totalTrades, notifications: totalNotifs, cursor: nextCursor,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// ─── Notification dispatch ──────────────────────────────────────────────────

import type { DetectedTrade } from '@/lib/whale-trades';

async function notifySubscribers(
  address: string,
  chain: string,
  trades: DetectedTrade[],
  txToId: Map<string, number>,
): Promise<number> {
  const subscribers = await getTradeSubscribers(address, chain);
  if (subscribers.length === 0) return 0;

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  let sent = 0;

  for (const sub of subscribers) {
    // Filter trades below subscriber's min value threshold
    const filteredTrades = sub.minValueUsd
      ? trades.filter(t => (t.valueUsd || 0) >= sub.minValueUsd!)
      : trades;

    for (const trade of filteredTrades) {
      const eventId = txToId.get(trade.txHash);
      if (!eventId) continue; // not newly inserted

      for (const channel of sub.notifyChannels) {
        // Dedup: skip if already notified for this event+channel
        const alreadySent = await hasWhaleNotifBeenSent(sub.ownerId, eventId, channel);
        if (alreadySent) continue;

        try {
          if (channel === 'email' && sub.email) {
            const ok = await sendAlertEmail(sub.email, [{
              alertId: String(eventId),
              symbol: trade.tokenOutSymbol || trade.tokenInSymbol || '?',
              metric: 'whale_trade',
              operator: trade.action === 'buy' ? 'gt' : 'lt',
              threshold: trade.valueUsd || 0,
              actualValue: trade.valueUsd || 0,
            }]);
            if (ok) { await logWhaleNotification(sub.ownerId, eventId, channel); sent++; }
          } else if (channel === 'telegram' && sub.ownerType === 'telegram' && BOT_TOKEN) {
            const chatId = parseInt(sub.ownerId.replace('tg_', ''));
            if (isNaN(chatId)) continue;
            const msg = `\u{1F40B} <b>Whale Trade Alert</b>\n\n${esc(formatTradeMessage(trade, sub.label))}`;
            const ok = await sendMessage(chatId, msg);
            if (ok) {
              await logWhaleNotification(sub.ownerId, eventId, channel);
              sent++;
            }
          } else if (channel === 'push' && sub.ownerType === 'user') {
            await sendPush(sub.ownerId, trade, sub.label);
            await logWhaleNotification(sub.ownerId, eventId, channel);
            sent++;
          } else if (channel === 'discord' && sub.discordWebhookUrl) {
            const tradeMsg = formatTradeMessage(trade, sub.label);
            const ok = await sendAlertDiscord(sub.discordWebhookUrl, [{
              alertId: String(eventId),
              symbol: trade.tokenOutSymbol || trade.tokenInSymbol || '?',
              metric: 'whale_trade',
              operator: trade.action === 'buy' ? 'gt' : 'lt',
              threshold: trade.valueUsd || 0,
              actualValue: trade.valueUsd || 0,
            }]);
            if (ok) { await logWhaleNotification(sub.ownerId, eventId, channel); sent++; }
          } else if (channel === 'whatsapp' && sub.whatsappPhone) {
            const ok = await sendAlertWhatsApp(sub.whatsappPhone, [{
              alertId: String(eventId),
              symbol: trade.tokenOutSymbol || trade.tokenInSymbol || '?',
              metric: 'whale_trade',
              operator: trade.action === 'buy' ? 'gt' : 'lt',
              threshold: trade.valueUsd || 0,
              actualValue: trade.valueUsd || 0,
            }]);
            if (ok) { await logWhaleNotification(sub.ownerId, eventId, channel); sent++; }
          }
        } catch (err) {
          console.error(`[whale-trades] notify ${channel}:`, err instanceof Error ? err.message : err);
        }
      }
    }
  }
  return sent;
}

async function sendPush(userId: string, trade: DetectedTrade, label?: string | null): Promise<void> {
  try {
    const webpush = await import('web-push');
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY || '';
    if (!vapidPublic || !vapidPrivate) return;
    webpush.setVapidDetails('mailto:noreply@info-hub.io', vapidPublic, vapidPrivate);

    const subs = await getPushSubscriptionsForUser(userId);
    const body = formatTradeMessage(trade, label);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: 'Whale Trade Alert', body, url: '/wallet-tracker' }),
        );
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await deletePushSubscription(sub.endpoint);
        }
      }
    }
  } catch { /* push not available */ }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
