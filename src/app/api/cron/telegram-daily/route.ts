/**
 * Cron: Daily market briefing from Hub — sent to linked Telegram users.
 * Runs at 08:00 UTC via Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getActiveTelegramLinks } from '@/lib/db';
import { sendMessage, type InlineKeyboardMarkup } from '@/lib/telegram';

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
  if (n >= 1) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(6)}`;
}

/** Pick a greeting + emoji based on BTC 24h change */
function pickMood(btcChange: number): { emoji: string; greeting: string } {
  if (btcChange > 5) return { emoji: '🚀', greeting: 'Markets ripping' };
  if (btcChange > 2) return { emoji: '📈', greeting: 'Solid green day' };
  if (btcChange > 0) return { emoji: '🟢', greeting: 'Slight green' };
  if (btcChange > -2) return { emoji: '🔻', greeting: 'Mild red' };
  if (btcChange > -5) return { emoji: '📉', greeting: 'Selling pressure' };
  return { emoji: '🩸', greeting: 'Blood in the streets' };
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
  let fearGreed: { value: number; classification: string } | null = null;
  let dominance: any = null;

  try {
    const [tickerRes, fundingRes, oiRes, fgRes, domRes] = await Promise.all([
      fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(15_000) }),
      fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(15_000) }),
      fetch(`${origin}/api/openinterest`, { signal: AbortSignal.timeout(15_000) }),
      fetch(`${origin}/api/fear-greed`, { signal: AbortSignal.timeout(10_000) }),
      fetch(`${origin}/api/dominance`, { signal: AbortSignal.timeout(10_000) }),
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
    if (fgRes.ok) {
      const j = await fgRes.json();
      fearGreed = j.current || j;
    }
    if (domRes.ok) {
      const j = await domRes.json();
      dominance = j.data || j;
    }
  } catch (e) {
    console.error('[telegram-daily] fetch error:', e);
  }

  // ── Key Prices ──────────────────────────────────────────────
  const btcTicker = tickers.find((t: any) => t.symbol === 'BTC' && t.exchange === 'Binance');
  const ethTicker = tickers.find((t: any) => t.symbol === 'ETH' && t.exchange === 'Binance');
  const solTicker = tickers.find((t: any) => t.symbol === 'SOL' && t.exchange === 'Binance');
  const btcChange = btcTicker?.priceChangePercent24h || 0;
  const { emoji, greeting } = pickMood(btcChange);

  const lines: string[] = [];

  // Header with Hub personality
  lines.push(`${emoji} <b>Hub Daily Briefing</b>`);
  lines.push(`<i>${greeting} — here's your morning scan.</i>`);
  lines.push('');

  // ── Prices ──────────────────────────────────────────────────
  lines.push('💰 <b>Prices</b>');
  if (btcTicker) lines.push(`  BTC  ${fmtPrice(btcTicker.lastPrice)}  ${fmtPct(btcChange)}`);
  if (ethTicker) lines.push(`  ETH  ${fmtPrice(ethTicker.lastPrice)}  ${fmtPct(ethTicker.priceChangePercent24h || 0)}`);
  if (solTicker) lines.push(`  SOL  ${fmtPrice(solTicker.lastPrice)}  ${fmtPct(solTicker.priceChangePercent24h || 0)}`);

  // ── Sentiment ───────────────────────────────────────────────
  if (fearGreed || dominance) {
    lines.push('');
    lines.push('🧠 <b>Sentiment</b>');
    if (fearGreed) {
      lines.push(`  Fear & Greed: ${fearGreed.value}/100 (${fearGreed.classification})`);
    }
    if (dominance?.btcDominance != null) {
      lines.push(`  BTC Dom: ${dominance.btcDominance.toFixed(1)}%`);
    }
    if (dominance?.totalMarketCap != null) {
      const mcChange = dominance.marketCapChangePercentage24h;
      const mcSuffix = mcChange != null ? ` (${fmtPct(mcChange)})` : '';
      lines.push(`  Total MCap: ${fmtUsd(dominance.totalMarketCap)}${mcSuffix}`);
    }
  }

  // ── Open Interest ───────────────────────────────────────────
  if (oiData.length > 0) {
    const totalOi = oiData.reduce((sum: number, e: any) => sum + (Number(e.openInterestValue) || 0), 0);
    lines.push('');
    lines.push(`📊 <b>Open Interest:</b> ${fmtUsd(totalOi)}`);
  }

  // ── Funding Rates ───────────────────────────────────────────
  if (fundingData.length > 0) {
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

    if (top3.length > 0 || bottom3.length > 0) {
      lines.push('');
      lines.push('📡 <b>Funding</b>');
      if (top3.length > 0) {
        lines.push('  🔥 ' + top3.map(({ sym, avg }) => `${sym} ${avg.toFixed(4)}%`).join(' · '));
      }
      if (bottom3.length > 0) {
        lines.push('  ❄️ ' + bottom3.map(({ sym, avg }) => `${sym} ${avg.toFixed(4)}%`).join(' · '));
      }
    }
  }

  // ── Top Movers ──────────────────────────────────────────────
  const uniqueTickers = new Map<string, any>();
  for (const t of tickers) {
    if (t.exchange === 'Binance' && t.symbol && t.priceChangePercent24h != null) {
      uniqueTickers.set(t.symbol, t);
    }
  }
  const sorted = Array.from(uniqueTickers.values())
    .filter(t => Math.abs(t.priceChangePercent24h) < 200)
    .sort((a, b) => b.priceChangePercent24h - a.priceChangePercent24h);

  if (sorted.length >= 6) {
    const gainers = sorted.slice(0, 3);
    const losers = sorted.slice(-3).reverse();

    lines.push('');
    lines.push('📊 <b>Top Movers</b>');
    lines.push('  🟢 ' + gainers.map(t => `${t.symbol} ${fmtPct(t.priceChangePercent24h)}`).join(' · '));
    lines.push('  🔴 ' + losers.map(t => `${t.symbol} ${fmtPct(t.priceChangePercent24h)}`).join(' · '));
  }

  // Footer
  lines.push('');
  lines.push('Type anything to ask me about the market.');

  const msg = lines.join('\n');

  // Build inline keyboard for follow-ups
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: '📈 Market Analysis', callback_data: 'q:Give me a full market analysis right now' },
        { text: '🐋 Whale Watch', callback_data: 'q:What are the biggest whales doing?' },
      ],
      [
        { text: '💰 Arb Opportunities', callback_data: 'q:Best funding rate arb opportunities' },
        { text: '🌐 Dashboard', url: 'https://info-hub.io' },
      ],
    ],
  };

  // Send to all active links
  let sent = 0;
  for (const link of links) {
    const ok = await sendMessage(link.chat_id, msg, 'HTML', keyboard);
    if (ok) sent++;
    // Throttle to stay under Telegram rate limit
    if (links.length > 20) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  return NextResponse.json({ ok: true, sent, total: links.length });
}
