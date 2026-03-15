/**
 * Cron endpoint: notify Telegram users about upcoming high-impact economic events.
 * Runs every hour via Vercel Cron.
 *
 * Sends alerts for events happening in the next 1-2 hours.
 * Security: Verifies CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getActiveTelegramUsers } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const preferredRegion = 'bom1';

const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

// Track recently notified event IDs
const notifiedEvents = new Set<string>();

interface EconomicEvent {
  id: string;
  name: string;
  description: string;
  date: string;
  time?: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  country: string;
  previous?: string;
  forecast?: string;
  actual?: string;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function impactEmoji(impact: string): string {
  switch (impact) {
    case 'high': return '🔴';
    case 'medium': return '🟡';
    default: return '⚪';
  }
}

function formatCalendarAlert(events: EconomicEvent[]): string {
  const lines = [
    '<b>📅 Upcoming Economic Events</b>',
    '━━━━━━━━━━━━━━━━',
    '',
  ];

  for (const e of events.slice(0, 8)) {
    const timeStr = e.time ? ` at <b>${escHtml(e.time)}</b>` : '';
    const forecast = e.forecast ? ` (F: ${escHtml(e.forecast)}` + (e.previous ? `, P: ${escHtml(e.previous)})` : ')') : '';
    lines.push(
      `${impactEmoji(e.impact)} <b>${escHtml(e.name)}</b>`,
      `   ${escHtml(e.country)}${timeStr}${forecast}`,
      '',
    );
  }

  lines.push('💡 High-impact events can cause significant volatility.');

  return lines.join('\n');
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const origin = request.nextUrl.origin;

    // Fetch economic calendar
    const res = await fetch(`${origin}/api/economic-calendar`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: true, skipped: 'calendar fetch failed' });
    }

    const json = await res.json();
    const events: EconomicEvent[] = json.events || [];

    // Filter to high/medium impact events happening in the next 2 hours
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const upcoming = events.filter(e => {
      if (notifiedEvents.has(e.id)) return false;
      if (e.impact === 'low') return false;

      // Parse event datetime
      try {
        const eventDate = new Date(e.date);
        if (e.time) {
          // Parse time like "14:00 ET" or "08:30"
          const timeMatch = e.time.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            eventDate.setUTCHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10));
          }
        }
        return eventDate >= now && eventDate <= twoHoursFromNow;
      } catch {
        return false;
      }
    });

    if (upcoming.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, events: 0 });
    }

    // Mark as notified
    for (const e of upcoming) {
      notifiedEvents.add(e.id);
    }
    // Prune old entries daily
    if (notifiedEvents.size > 500) {
      notifiedEvents.clear();
    }

    // Send to all active users
    const users = await getActiveTelegramUsers();
    let totalSent = 0;
    const message = formatCalendarAlert(upcoming);

    for (const user of users) {
      try {
        await sendMessage(user.chat_id, message, 'HTML');
        totalSent++;
      } catch (err) {
        console.error(`[calendar-cron] failed to send to ${user.chat_id}:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      events: upcoming.length,
      users: users.length,
      sent: totalSent,
    });
  } catch (error) {
    console.error('[calendar-cron] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
