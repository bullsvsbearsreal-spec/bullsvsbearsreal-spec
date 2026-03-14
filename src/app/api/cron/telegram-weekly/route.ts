/**
 * Cron endpoint: weekly Telegram market digest.
 * Runs at 0 10 * * 0 (Sundays 10 AM UTC) via Vercel Cron.
 *
 * Sends a comprehensive weekly summary to all daily subscribers.
 * Security: Verifies CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getSubscribedUsers } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const CRON_SECRET = process.env.CRON_SECRET || '';

function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return sign + '$' + (abs / 1_000_000_000).toFixed(2) + 'B';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(2);
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  await initDB();

  // Send to all daily subscribers (weekly piggybacks on daily subscription)
  const chatIds = await getSubscribedUsers('daily');
  if (chatIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no subscribers' });
  }

  const origin = request.nextUrl.origin;

  const [tickersRes, oiRes, stablesRes, onchainRes, cycleRes, etfRes, fearGreedRes] = await Promise.allSettled([
    fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(20000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/openinterest`, { signal: AbortSignal.timeout(15000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/stablecoins`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/onchain`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/market-cycle`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/etf?type=btc`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
    fetch(`${origin}/api/fear-greed?history=true&limit=7`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
  ]);

  const tickers = tickersRes.status === 'fulfilled' ? tickersRes.value?.data || [] : [];

  const lines = [
    '<b>Weekly Market Digest</b>',
    '━━━━━━━━━━━━━━━━',
    '',
  ];

  // BTC + ETH 7d change (from tickers)
  const bySymbol = new Map<string, any>();
  for (const t of tickers) {
    if (!t.lastPrice || t.priceChangePercent24h == null) continue;
    const existing = bySymbol.get(t.symbol);
    if (!existing || t.quoteVolume24h > existing.quoteVolume24h) {
      bySymbol.set(t.symbol, t);
    }
  }

  const btc = bySymbol.get('BTC');
  const eth = bySymbol.get('ETH');
  if (btc) {
    lines.push(`🟠 BTC: <b>${fmtUsd(btc.lastPrice)}</b> (${btc.priceChangePercent24h >= 0 ? '+' : ''}${btc.priceChangePercent24h.toFixed(2)}% 24h)`);
  }
  if (eth) {
    lines.push(`🔷 ETH: <b>${fmtUsd(eth.lastPrice)}</b> (${eth.priceChangePercent24h >= 0 ? '+' : ''}${eth.priceChangePercent24h.toFixed(2)}% 24h)`);
  }
  if (btc || eth) lines.push('');

  // Weekly top movers
  const allSymbols = Array.from(bySymbol.values()).filter((e: any) => e.quoteVolume24h >= 500_000);
  const sorted = [...allSymbols].sort((a: any, b: any) => b.priceChangePercent24h - a.priceChangePercent24h);
  if (sorted.length >= 6) {
    const gainers = sorted.slice(0, 3);
    const losers = sorted.slice(-3).reverse();
    lines.push('<b>🟢 Top Gainers:</b>');
    gainers.forEach((g: any) => lines.push(`  ${g.symbol}: +${g.priceChangePercent24h.toFixed(2)}%`));
    lines.push('');
    lines.push('<b>🔴 Top Losers:</b>');
    losers.forEach((l: any) => lines.push(`  ${l.symbol}: ${l.priceChangePercent24h.toFixed(2)}%`));
    lines.push('');
  }

  // OI snapshot
  const oiData = oiRes.status === 'fulfilled' ? oiRes.value?.data || [] : [];
  if (oiData.length > 0) {
    const btcOI = oiData.filter((e: any) => e.symbol === 'BTC').reduce((s: number, e: any) => s + (e.openInterestValue || 0), 0);
    const totalOI = oiData.reduce((s: number, e: any) => s + (e.openInterestValue || 0), 0);
    if (totalOI > 0) {
      lines.push(`<b>📊 Total OI:</b> ${fmtUsd(totalOI)}${btcOI > 0 ? ` (BTC: ${fmtUsd(btcOI)})` : ''}`);
      lines.push('');
    }
  }

  // Stablecoin flows
  const stables = stablesRes.status === 'fulfilled' ? stablesRes.value : null;
  if (stables?.totalMcap) {
    const topCoins = (stables.stablecoins || []).slice(0, 3);
    const flows = topCoins
      .filter((c: any) => c.change7d != null)
      .map((c: any) => `${c.symbol} ${c.change7d >= 0 ? '+' : ''}${c.change7d.toFixed(1)}%`)
      .join(', ');
    lines.push(`<b>💵 Stablecoins:</b> ${fmtUsd(stables.totalMcap)} total`);
    if (flows) lines.push(`  7d flows: ${flows}`);
    lines.push('');
  }

  // On-chain signals
  const onchain = onchainRes.status === 'fulfilled' ? onchainRes.value : null;
  if (onchain) {
    const signals: string[] = [];
    if (onchain.puellMultiple?.signal) signals.push(`Puell: ${onchain.puellMultiple.signal}`);
    if (onchain.mvrv?.signal) signals.push(`MVRV: ${onchain.mvrv.signal}`);
    if (signals.length > 0) {
      lines.push(`<b>⛏️ On-Chain:</b> ${signals.join(' | ')}`);
      lines.push('');
    }
  }

  // Market cycle
  const cycle = cycleRes.status === 'fulfilled' ? cycleRes.value : null;
  if (cycle) {
    const parts: string[] = [];
    if (cycle.piCycle?.signal) parts.push(`Pi: ${cycle.piCycle.signal}`);
    if (cycle.rainbow?.currentBand) parts.push(`Rainbow: ${cycle.rainbow.currentBand}`);
    if (parts.length > 0) {
      lines.push(`<b>🔄 Cycle:</b> ${parts.join(' | ')}`);
      lines.push('');
    }
  }

  // ETF weekly total
  const etfData = etfRes.status === 'fulfilled' ? etfRes.value : null;
  if (etfData?.flows?.length > 0) {
    const weekFlows = etfData.flows.slice(0, 5);
    const weekTotal = weekFlows.reduce((s: number, f: any) => s + (f.netFlow || 0), 0);
    lines.push(`<b>🏦 BTC ETF (5d):</b> ${weekTotal >= 0 ? '+' : ''}${fmtUsd(weekTotal)} net`);
    lines.push('');
  }

  // Fear & Greed trend
  const fg = fearGreedRes.status === 'fulfilled' ? fearGreedRes.value : null;
  if (fg?.current) {
    const emoji = fg.current.value <= 25 ? '😱' : fg.current.value <= 45 ? '😰' : fg.current.value <= 55 ? '😐' : fg.current.value <= 75 ? '😊' : '🤑';
    const hist = (fg.history || []).slice(0, 7).reverse();
    const trend = hist.map((h: any) => h.value >= 70 ? '▇' : h.value >= 50 ? '▅' : h.value >= 30 ? '▃' : '▁').join('');
    lines.push(`${emoji} Fear & Greed: <b>${fg.current.value}</b> (${fg.current.classification})`);
    if (trend) lines.push(`  7d: <code>${trend}</code>`);
    lines.push('');
  }

  lines.push('<i>Weekly digest every Sunday. /unsubscribe daily to stop.</i>');

  const reportText = lines.join('\n');

  let sent = 0;
  for (let i = 0; i < chatIds.length; i++) {
    try {
      await sendMessage(chatIds[i], reportText);
      sent++;
    } catch (err) {
      console.error(`[telegram-weekly] Failed to send to ${chatIds[i]}:`, err);
    }
    if (i < chatIds.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return NextResponse.json({ ok: true, sent, total: chatIds.length });
}
