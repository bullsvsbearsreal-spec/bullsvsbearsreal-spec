/**
 * Cron: Daily market summary sent to linked Telegram users.
 * Runs at 08:00 UTC via Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getActiveTelegramLinks } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const preferredRegion = 'bom1';

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(request: NextRequest) {
  const { verifyCronAuth } = await import('../_auth');
  const authErr = verifyCronAuth(request);
  if (authErr) return authErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  await initDB();

  const links = await getActiveTelegramLinks();
  if (links.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no active links' });
  }

  // Fetch market data — hardcode origin to prevent Host-header SSRF
  const origin = process.env.NEXTAUTH_URL || 'https://info-hub.io';
  let tickers: any[] = [];
  let fundingData: any[] = [];
  let oiData: any[] = [];

  try {
    const [tickerRes, fundingRes, oiRes] = await Promise.all([
      fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(15_000) }),
      fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(15_000) }),
      fetch(`${origin}/api/openinterest`, { signal: AbortSignal.timeout(15_000) }),
    ]);
    if (tickerRes.ok) {
      const j = await tickerRes.json();
      tickers = j.data || j || [];
    }
    if (fundingRes.ok) {
      const j = await fundingRes.json();
      fundingData = j.data || [];
    }
    if (oiRes.ok) {
      const j = await oiRes.json();
      oiData = j.data || j || [];
    }
  } catch (e) {
    console.error('[telegram-daily] fetch error:', e);
  }

  // Build summary
  const lines: string[] = ['📡 <b>InfoHub Daily Summary</b>', ''];

  // Top movers from tickers
  const btcTicker = tickers.find((t: any) => t.symbol === 'BTC' && t.exchange === 'Binance');
  const ethTicker = tickers.find((t: any) => t.symbol === 'ETH' && t.exchange === 'Binance');

  if (btcTicker) {
    lines.push(`<b>BTC</b> ${fmtPrice(btcTicker.lastPrice)} (${fmtPct(btcTicker.priceChangePercent24h || 0)})`);
  }
  if (ethTicker) {
    lines.push(`<b>ETH</b> ${fmtPrice(ethTicker.lastPrice)} (${fmtPct(ethTicker.priceChangePercent24h || 0)})`);
  }

  // Total OI
  if (oiData.length > 0) {
    const totalOi = oiData.reduce((sum: number, e: any) => sum + (Number(e.openInterestValue) || 0), 0);
    lines.push('');
    lines.push(`📊 Total OI: ${fmtUsd(totalOi)}`);
  }

  // Top funding rates (most extreme)
  if (fundingData.length > 0) {
    // Aggregate by symbol — average rate
    const bySymbol = new Map<string, number[]>();
    for (const f of fundingData) {
      if (!f.symbol || f.fundingRate == null) continue;
      const arr = bySymbol.get(f.symbol) || [];
      arr.push(f.fundingRate);
      bySymbol.set(f.symbol, arr);
    }
    const avgRates = Array.from(bySymbol.entries())
      .map(([sym, rates]) => ({ sym, avg: rates.reduce((a, b) => a + b, 0) / rates.length }))
      .sort((a, b) => b.avg - a.avg);

    const top3 = avgRates.slice(0, 3);
    const bottom3 = avgRates.slice(-3).reverse();

    if (top3.length > 0) {
      lines.push('');
      lines.push('🔥 <b>Highest funding</b>');
      for (const { sym, avg } of top3) {
        lines.push(`  ${sym}: ${avg.toFixed(4)}%`);
      }
    }
    if (bottom3.length > 0) {
      lines.push('');
      lines.push('❄️ <b>Lowest funding</b>');
      for (const { sym, avg } of bottom3) {
        lines.push(`  ${sym}: ${avg.toFixed(4)}%`);
      }
    }
  }

  // Top gainers/losers
  const uniqueTickers = new Map<string, any>();
  for (const t of tickers) {
    if (t.exchange === 'Binance' && t.symbol && t.priceChangePercent24h != null) {
      uniqueTickers.set(t.symbol, t);
    }
  }
  const sorted = Array.from(uniqueTickers.values())
    .filter(t => Math.abs(t.priceChangePercent24h) < 200) // filter glitches
    .sort((a, b) => b.priceChangePercent24h - a.priceChangePercent24h);

  if (sorted.length >= 6) {
    const gainers = sorted.slice(0, 3);
    const losers = sorted.slice(-3).reverse();

    lines.push('');
    lines.push('🟢 <b>Top gainers</b>');
    for (const t of gainers) {
      lines.push(`  ${t.symbol}: ${fmtPct(t.priceChangePercent24h)}`);
    }
    lines.push('');
    lines.push('🔴 <b>Top losers</b>');
    for (const t of losers) {
      lines.push(`  ${t.symbol}: ${fmtPct(t.priceChangePercent24h)}`);
    }
  }

  lines.push('');
  lines.push('<i>info-hub.io</i>');

  const msg = lines.join('\n');

  // Send to all active links
  let sent = 0;
  for (const link of links) {
    const ok = await sendMessage(link.chat_id, msg);
    if (ok) sent++;
    // Throttle to stay under Telegram rate limit
    if (links.length > 20) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  return NextResponse.json({ ok: true, sent, total: links.length });
}
