/**
 * Chart image rendering for Telegram bot.
 * GET /api/charts/telegram?type=funding&symbol=BTC
 *
 * Returns a 400x300 PNG image with dark theme.
 * Chart types: funding (bar chart), rsi (heatmap), price (sparkline)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCanvas } from '@napi-rs/canvas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Colors (dark theme)
// ---------------------------------------------------------------------------
const BG = '#0d1117';
const TEXT = '#c9d1d9';
const TEXT_DIM = '#8b949e';
const GRID = '#21262d';
const GREEN = '#3fb950';
const RED = '#f85149';
const YELLOW = '#d29922';
const BLUE = '#58a6ff';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtRate(r: number): string {
  return (r >= 0 ? '+' : '') + r.toFixed(4) + '%';
}

function fmtPrice(n: number): string {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(6);
}

// ---------------------------------------------------------------------------
// Funding bar chart
// ---------------------------------------------------------------------------
async function renderFundingChart(origin: string, symbol: string): Promise<Buffer> {
  const res = await fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('Failed to fetch funding data');
  const json = await res.json();
  const data = (json.data || [])
    .filter((e: any) => e.symbol === symbol.toUpperCase() && e.fundingRate != null && e.assetClass !== 'stocks' && e.assetClass !== 'forex')
    .sort((a: any, b: any) => (b.fundingRate ?? 0) - (a.fundingRate ?? 0));

  if (data.length === 0) throw new Error(`No funding data for ${symbol}`);

  const W = 400, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`${symbol.toUpperCase()} Funding Rates`, 15, 25);

  // Chart area
  const top = 40, bottom = H - 20, left = 90, right = W - 15;
  const chartH = bottom - top;
  const entries = data.slice(0, 15); // max 15 exchanges

  if (entries.length === 0) throw new Error('No entries');

  const maxAbs = Math.max(...entries.map((e: any) => Math.abs(e.fundingRate)), 0.01);
  const barH = Math.min(16, (chartH - 10) / entries.length);
  const gap = Math.max(2, (chartH - barH * entries.length) / (entries.length + 1));

  // Zero line
  const zeroX = left + (right - left) / 2;
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(zeroX, top);
  ctx.lineTo(zeroX, bottom);
  ctx.stroke();

  // Draw bars
  ctx.font = '11px sans-serif';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rate = e.fundingRate as number;
    const y = top + gap + i * (barH + gap);
    const barW = (Math.abs(rate) / maxAbs) * ((right - left) / 2 - 5);

    // Exchange label
    ctx.fillStyle = TEXT_DIM;
    ctx.textAlign = 'right';
    ctx.fillText(e.exchange, left - 5, y + barH / 2 + 4);

    // Bar
    ctx.fillStyle = rate >= 0 ? GREEN : RED;
    if (rate >= 0) {
      ctx.fillRect(zeroX, y, barW, barH);
    } else {
      ctx.fillRect(zeroX - barW, y, barW, barH);
    }

    // Rate label
    ctx.fillStyle = TEXT;
    ctx.textAlign = rate >= 0 ? 'left' : 'right';
    const labelX = rate >= 0 ? zeroX + barW + 4 : zeroX - barW - 4;
    ctx.fillText(fmtRate(rate), labelX, y + barH / 2 + 4);
  }

  // Footer
  ctx.fillStyle = TEXT_DIM;
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('infohub.dev', W - 10, H - 5);

  return Buffer.from(canvas.toBuffer('image/png'));
}

// ---------------------------------------------------------------------------
// RSI heatmap
// ---------------------------------------------------------------------------
async function renderRsiChart(origin: string, symbol?: string): Promise<Buffer> {
  const url = symbol
    ? `${origin}/api/rsi?symbol=${symbol.toUpperCase()}`
    : `${origin}/api/rsi`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('Failed to fetch RSI data');
  const json = await res.json();
  let data = json.data || [];

  // If specific symbol, filter; otherwise top 10 by volume
  if (symbol) {
    data = data.filter((e: any) => e.symbol === symbol.toUpperCase());
  }
  data = data.slice(0, 10);
  if (data.length === 0) throw new Error('No RSI data');

  const W = 400, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(symbol ? `${symbol.toUpperCase()} RSI` : 'RSI Heatmap', 15, 25);

  // Headers
  const headers = ['1H', '4H', '1D'];
  const keys = ['rsi1h', 'rsi4h', 'rsi1d'];
  const labelW = 70, cellW = 90, cellH = 24;
  const startX = labelW + 10, startY = 45;

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  for (let c = 0; c < headers.length; c++) {
    ctx.textAlign = 'center';
    ctx.fillText(headers[c], startX + c * cellW + cellW / 2, startY - 5);
  }

  // Rows
  ctx.font = '11px sans-serif';
  for (let r = 0; r < data.length; r++) {
    const entry = data[r];
    const y = startY + r * (cellH + 3);

    // Symbol label
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'right';
    ctx.fillText(entry.symbol, labelW, y + cellH / 2 + 4);

    // Cells
    for (let c = 0; c < keys.length; c++) {
      const val = entry[keys[c]] as number | null;
      const x = startX + c * cellW;

      // Cell background
      let color = GRID;
      if (val != null) {
        if (val <= 30) color = '#0d4429'; // oversold green
        else if (val <= 45) color = '#1a3a2a';
        else if (val <= 55) color = '#21262d'; // neutral
        else if (val <= 70) color = '#3a2a1a';
        else color = '#4a1a1a'; // overbought red
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellW - 4, cellH);

      // Value text
      ctx.fillStyle = val != null ? TEXT : TEXT_DIM;
      ctx.textAlign = 'center';
      ctx.fillText(val != null ? val.toFixed(1) : '—', x + (cellW - 4) / 2, y + cellH / 2 + 4);
    }
  }

  // Footer
  ctx.fillStyle = TEXT_DIM;
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('infohub.dev', W - 10, H - 5);

  return Buffer.from(canvas.toBuffer('image/png'));
}

// ---------------------------------------------------------------------------
// Price sparkline
// ---------------------------------------------------------------------------
async function renderPriceChart(origin: string, symbol: string): Promise<Buffer> {
  const res = await fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('Failed to fetch ticker data');
  const json = await res.json();
  const entries = (json.data || [])
    .filter((t: any) => t.symbol === symbol.toUpperCase() && t.lastPrice > 0)
    .sort((a: any, b: any) => (b.quoteVolume24h || 0) - (a.quoteVolume24h || 0));

  if (entries.length === 0) throw new Error(`No ticker data for ${symbol}`);

  const best = entries[0];
  const price = best.lastPrice;
  const change = best.priceChangePercent24h ?? 0;
  const high = best.highPrice24h ?? price * 1.02;
  const low = best.lowPrice24h ?? price * 0.98;

  const W = 400, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`${symbol.toUpperCase()} Price`, 15, 25);

  // Price display
  ctx.fillStyle = change >= 0 ? GREEN : RED;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(fmtPrice(price), 15, 70);

  ctx.font = '14px sans-serif';
  const changeStr = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
  ctx.fillText(changeStr, 15, 95);

  // High/Low bar
  const barTop = 130, barLeft = 30, barRight = W - 30;
  const barW = barRight - barLeft;
  const range = high - low || 1;

  // Background bar
  ctx.fillStyle = GRID;
  ctx.fillRect(barLeft, barTop, barW, 12);

  // Fill to current price position
  const pricePct = Math.max(0, Math.min(1, (price - low) / range));
  ctx.fillStyle = change >= 0 ? GREEN : RED;
  ctx.fillRect(barLeft, barTop, barW * pricePct, 12);

  // Current price marker
  const markerX = barLeft + barW * pricePct;
  ctx.fillStyle = TEXT;
  ctx.fillRect(markerX - 1, barTop - 4, 3, 20);

  // Labels
  ctx.font = '11px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.textAlign = 'left';
  ctx.fillText(`Low: ${fmtPrice(low)}`, barLeft, barTop + 30);
  ctx.textAlign = 'right';
  ctx.fillText(`High: ${fmtPrice(high)}`, barRight, barTop + 30);

  // Exchange info grid
  const gridTop = 185;
  ctx.font = '11px sans-serif';
  const topExchanges = entries.slice(0, 8);
  for (let i = 0; i < topExchanges.length; i++) {
    const e = topExchanges[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 20 + col * 195;
    const y = gridTop + row * 22;

    ctx.fillStyle = TEXT_DIM;
    ctx.textAlign = 'left';
    ctx.fillText(e.exchange, x, y);

    ctx.fillStyle = TEXT;
    ctx.textAlign = 'right';
    ctx.fillText(fmtPrice(e.lastPrice), x + 180, y);
  }

  // Footer
  ctx.fillStyle = TEXT_DIM;
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('infohub.dev', W - 10, H - 5);

  return Buffer.from(canvas.toBuffer('image/png'));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  const symbol = searchParams.get('symbol') || 'BTC';
  const origin = request.nextUrl.origin;

  if (!type || !['funding', 'rsi', 'price'].includes(type)) {
    return NextResponse.json(
      { error: 'Missing or invalid type. Use: funding, rsi, price' },
      { status: 400 },
    );
  }

  try {
    let imageBuffer: Buffer;

    switch (type) {
      case 'funding':
        imageBuffer = await renderFundingChart(origin, symbol);
        break;
      case 'rsi':
        imageBuffer = await renderRsiChart(origin, symbol);
        break;
      case 'price':
        imageBuffer = await renderPriceChart(origin, symbol);
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error(`[charts/telegram] Error rendering ${type} chart:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chart render failed' },
      { status: 500 },
    );
  }
}
