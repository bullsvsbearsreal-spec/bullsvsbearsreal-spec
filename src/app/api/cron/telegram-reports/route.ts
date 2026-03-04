/**
 * Cron endpoint: daily Telegram market report.
 * Runs at 0 8 * * * (daily 8 AM UTC) via Vercel Cron.
 *
 * Sends a market summary to all subscribed users.
 * Security: Verifies CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getSubscribedUsers } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET || '';

/** Format a USD amount with compact notation. */
function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return sign + '$' + (abs / 1_000_000_000).toFixed(2) + 'B';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(2);
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  await initDB();

  // Get subscribed users
  const chatIds = await getSubscribedUsers('daily');
  if (chatIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no subscribers' });
  }

  // Fetch market data in parallel
  const origin = request.nextUrl.origin;
  const [tickersRes, fundingRes, fearGreedRes] = await Promise.allSettled([
    fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(20000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(20000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/fear-greed`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
  ]);

  const tickers = tickersRes.status === 'fulfilled' ? tickersRes.value?.data || [] : [];
  const fundingData = fundingRes.status === 'fulfilled' ? fundingRes.value?.data || [] : [];
  const fearGreed = fearGreedRes.status === 'fulfilled' ? fearGreedRes.value : null;

  // BTC price
  const btcEntries = tickers.filter((t: any) => t.symbol === 'BTC');
  const btcBest = btcEntries.length > 0
    ? btcEntries.reduce((a: any, b: any) => (b.quoteVolume24h > a.quoteVolume24h ? b : a))
    : null;

  // Top gainers/losers
  const bySymbol = new Map<string, any>();
  for (const t of tickers) {
    if (!t.lastPrice || t.priceChangePercent24h == null) continue;
    const existing = bySymbol.get(t.symbol);
    if (!existing || t.quoteVolume24h > existing.quoteVolume24h) {
      bySymbol.set(t.symbol, t);
    }
  }
  const symbols = Array.from(bySymbol.values()).filter((e: any) => e.quoteVolume24h >= 500_000);
  const sorted = [...symbols].sort((a: any, b: any) => b.priceChangePercent24h - a.priceChangePercent24h);
  const gainers = sorted.slice(0, 3);
  const losers = sorted.slice(-3).reverse();

  // Highest/lowest funding
  const fundingEntries = fundingData
    .filter((e: any) => e.fundingRate != null && e.assetClass !== 'stocks' && e.assetClass !== 'forex')
    .sort((a: any, b: any) => (b.fundingRate ?? 0) - (a.fundingRate ?? 0));
  const highFunding = fundingEntries.slice(0, 3);
  const lowFunding = fundingEntries.slice(-3).reverse();

  // Build report message
  const lines = [
    '<b>Daily Market Report</b>',
    '━━━━━━━━━━━━━━━━',
    '',
  ];

  // BTC Price
  if (btcBest) {
    const change = (btcBest.priceChangePercent24h >= 0 ? '+' : '') + btcBest.priceChangePercent24h.toFixed(2) + '%';
    lines.push(`🟠 BTC: <b>${fmtUsd(btcBest.lastPrice)}</b> (${change})`);
    lines.push('');
  }

  // Top gainers
  if (gainers.length > 0) {
    lines.push('<b>🟢 Top Gainers:</b>');
    gainers.forEach((g: any) => {
      lines.push(`  ${g.symbol}: +${g.priceChangePercent24h.toFixed(2)}% (${fmtUsd(g.lastPrice)})`);
    });
    lines.push('');
  }

  // Top losers
  if (losers.length > 0) {
    lines.push('<b>🔴 Top Losers:</b>');
    losers.forEach((l: any) => {
      lines.push(`  ${l.symbol}: ${l.priceChangePercent24h.toFixed(2)}% (${fmtUsd(l.lastPrice)})`);
    });
    lines.push('');
  }

  // Funding rates
  if (highFunding.length > 0) {
    lines.push('<b>📈 Highest Funding:</b>');
    highFunding.forEach((f: any) => {
      const rate = (f.fundingRate >= 0 ? '+' : '') + f.fundingRate.toFixed(4) + '%';
      lines.push(`  ${f.symbol} (${f.exchange}): ${rate}`);
    });
    lines.push('');
  }

  if (lowFunding.length > 0) {
    lines.push('<b>📉 Lowest Funding:</b>');
    lowFunding.forEach((f: any) => {
      const rate = (f.fundingRate >= 0 ? '+' : '') + f.fundingRate.toFixed(4) + '%';
      lines.push(`  ${f.symbol} (${f.exchange}): ${rate}`);
    });
    lines.push('');
  }

  // Fear & Greed
  if (fearGreed) {
    const emoji = fearGreed.value <= 25 ? '😱' : fearGreed.value <= 45 ? '😰' : fearGreed.value <= 55 ? '😐' : fearGreed.value <= 75 ? '😊' : '🤑';
    lines.push(`${emoji} Fear & Greed: <b>${fearGreed.value}</b> (${fearGreed.classification})`);
    lines.push('');
  }

  lines.push('<i>Use /unsubscribe daily to stop these reports.</i>');

  const reportText = lines.join('\n');

  // Send to all subscribers
  let sent = 0;
  for (let i = 0; i < chatIds.length; i++) {
    try {
      await sendMessage(chatIds[i], reportText);
      sent++;
    } catch (err) {
      console.error(`[telegram-reports] Failed to send to ${chatIds[i]}:`, err);
    }
    // Small delay to avoid rate limits (skip after last)
    if (i < chatIds.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return NextResponse.json({ ok: true, sent, total: chatIds.length });
}
