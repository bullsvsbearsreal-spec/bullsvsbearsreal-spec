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
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

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
  const auth = request.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const [tickersRes, fundingRes, fearGreedRes, oiRes, etfRes, whalesRes, optionsRes] = await Promise.allSettled([
    fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(20000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(20000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/fear-greed`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/openinterest`, { signal: AbortSignal.timeout(15000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/etf?type=btc`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/hl-whales`, { signal: AbortSignal.timeout(15000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/options?currency=BTC`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
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

  // OI Summary
  const oiData = oiRes.status === 'fulfilled' ? oiRes.value?.data || [] : [];
  if (oiData.length > 0) {
    const btcOI = oiData.filter((e: any) => e.symbol === 'BTC').reduce((s: number, e: any) => s + (e.openInterestValue || 0), 0);
    const ethOI = oiData.filter((e: any) => e.symbol === 'ETH').reduce((s: number, e: any) => s + (e.openInterestValue || 0), 0);
    if (btcOI > 0 || ethOI > 0) {
      lines.push('<b>📊 Open Interest:</b>');
      if (btcOI > 0) lines.push(`  BTC: ${fmtUsd(btcOI)}`);
      if (ethOI > 0) lines.push(`  ETH: ${fmtUsd(ethOI)}`);
      lines.push('');
    }
  }

  // ETF Flows
  const etfData = etfRes.status === 'fulfilled' ? etfRes.value : null;
  if (etfData?.flows?.length > 0) {
    const latest = etfData.flows[0];
    if (latest?.netFlow != null) {
      const flowStr = (latest.netFlow >= 0 ? '+' : '') + fmtUsd(latest.netFlow);
      lines.push(`<b>🏦 BTC ETF:</b> ${flowStr} net flow (${latest.date || 'latest'})`);
      lines.push('');
    }
  }

  // Options
  const optionsData = optionsRes.status === 'fulfilled' ? optionsRes.value : null;
  if (optionsData?.putCallRatio != null) {
    const pcr = optionsData.putCallRatio;
    const sentiment = pcr < 0.7 ? 'bullish' : pcr > 1.3 ? 'bearish' : 'neutral';
    lines.push(`<b>🎯 BTC Options:</b> PCR ${pcr.toFixed(2)} (${sentiment}) | Max Pain: ${fmtUsd(optionsData.maxPain || 0)}`);
    lines.push('');
  }

  // Whale Spotlight
  const whales = whalesRes.status === 'fulfilled' ? whalesRes.value : null;
  if (Array.isArray(whales) && whales.length > 0) {
    const topWhale = whales[0];
    const topPos = topWhale.positions?.[0];
    if (topPos) {
      const pnl = topPos.unrealizedPnl >= 0 ? `+${fmtUsd(topPos.unrealizedPnl)}` : fmtUsd(topPos.unrealizedPnl);
      lines.push(`<b>🐋 Top Whale:</b> ${topWhale.label}`);
      lines.push(`  ${topPos.coin} ${topPos.side.toUpperCase()} ${fmtUsd(topPos.positionValue)} (${pnl})`);
      lines.push('');
    }
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
