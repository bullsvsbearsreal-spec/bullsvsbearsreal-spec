/**
 * Hub bot v2 — nightly retention sweep for telegram_conversations.
 *
 * The conversation table has no TTL — we let the bot keep history forever
 * UNTIL this cron deletes anything older than 90 days. 90 days lets users
 * come back to an old topic a few weeks later without dragging the table
 * to hundreds of millions of rows.
 *
 * Schedule (systemd timer, not in this file):
 *   /etc/systemd/system/infohub-cron-prune-tg-conversations.timer
 *   OnCalendar=*-*-* 03:30:00 UTC  (~3 AM UTC, low-traffic window)
 *
 * The cron is intentionally idempotent — if we miss a day or get fired
 * twice, the second run is a no-op.
 */

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '../_auth';
import { initDB, isDBConfigured, pruneOldTelegramConversations } from '@/lib/db';

const RETENTION_DAYS = 90;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;
  if (!isDBConfigured()) return NextResponse.json({ ok: true, skipped: 'db not configured' });

  await initDB();
  const started = Date.now();
  const deleted = await pruneOldTelegramConversations(RETENTION_DAYS);
  return NextResponse.json({
    ok: true,
    deletedRows: deleted,
    retentionDays: RETENTION_DAYS,
    durationMs: Date.now() - started,
  });
}
