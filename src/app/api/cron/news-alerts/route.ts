/**
 * Cron endpoint: detect breaking/high-impact news and notify Telegram users.
 * Runs every 15 minutes via Vercel Cron.
 *
 * Sends alerts for:
 * - High-sentiment or high-vote news articles
 * - News mentioning coins on user watchlists
 *
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

// Track recently sent article IDs to prevent duplicates across runs
const recentlySent = new Set<string>();
const MAX_RECENT = 200;

interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  categories: string[];
  currencies: string[];
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  votes?: { positive: number; negative: number };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNewsAlert(articles: NewsArticle[]): string {
  const lines = [
    `<b>📰 Breaking News (${articles.length})</b>`,
    '━━━━━━━━━━━━━━━━',
    '',
  ];

  for (const a of articles.slice(0, 5)) {
    const sentimentEmoji = a.sentiment === 'bullish' ? '🟢' : a.sentiment === 'bearish' ? '🔴' : '⚪';
    const coins = a.currencies.length > 0 ? ` [${a.currencies.slice(0, 3).join(', ')}]` : '';
    lines.push(
      `${sentimentEmoji} <b>${escHtml(a.title.length > 80 ? a.title.slice(0, 77) + '...' : a.title)}</b>${coins}`,
      `   ${escHtml(a.source)} · <a href="${a.url}">Read</a>`,
      '',
    );
  }

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

    // Fetch recent news
    const res = await fetch(`${origin}/api/news?limit=20`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: true, skipped: 'news fetch failed' });
    }

    const json = await res.json();
    const articles: NewsArticle[] = json.articles || [];

    // Filter to high-impact articles from last 20 minutes that haven't been sent
    const cutoff = Date.now() - 20 * 60 * 1000;
    const newArticles = articles.filter(a => {
      if (recentlySent.has(a.id)) return false;
      if (a.publishedAt < cutoff) return false;
      // High impact: strong sentiment, popular votes, or mentions major coins
      const majorCoins = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'DOT', 'LINK']);
      const mentionsMajor = a.currencies.some(c => majorCoins.has(c.toUpperCase()));
      const highVotes = (a.votes?.positive || 0) + (a.votes?.negative || 0) >= 3;
      const strongSentiment = a.sentiment === 'bullish' || a.sentiment === 'bearish';
      return mentionsMajor || highVotes || strongSentiment;
    });

    if (newArticles.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, articles: 0 });
    }

    // Mark as sent
    for (const a of newArticles) {
      recentlySent.add(a.id);
    }
    // Prune old entries
    if (recentlySent.size > MAX_RECENT) {
      const entries = Array.from(recentlySent);
      entries.slice(0, entries.length - MAX_RECENT).forEach(id => recentlySent.delete(id));
    }

    // Get active users with watchlists
    const users = await getActiveTelegramUsers();
    let totalSent = 0;

    for (const user of users) {
      // Filter articles by user watchlist if set
      let userArticles = newArticles;
      if (user.watchlist) {
        const symbols = new Set(user.watchlist.split(',').map(s => s.trim().toUpperCase()));
        userArticles = newArticles.filter(a =>
          a.currencies.length === 0 || a.currencies.some(c => symbols.has(c.toUpperCase()))
        );
      }

      if (userArticles.length === 0) continue;

      try {
        await sendMessage(user.chat_id, formatNewsAlert(userArticles), 'HTML');
        totalSent++;
      } catch (err) {
        console.error(`[news-cron] failed to send to ${user.chat_id}:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      articles: newArticles.length,
      users: users.length,
      sent: totalSent,
    });
  } catch (error) {
    console.error('[news-cron] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
