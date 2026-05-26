/**
 * GET /api/account/tax/csv
 *
 * Streams the user's FIFO cost-basis summary as a downloadable CSV.
 * Three CSV sections concatenated (Excel-friendly — opens each as a
 * separate sheet via the empty-row separators):
 *
 *   1. Summary   — single row: total realized PnL, fees, net, YTD
 *   2. ByYear    — one row per tax year (year, realised, fees, trades)
 *   3. Open      — one row per still-open position (symbol, exchange,
 *                  side, size, avg cost basis, total cost USD, lots)
 *
 * Authenticated. CSV intentionally plain — opens in Excel, Numbers,
 * Sheets without any reshaping.
 *
 * Pro tier feature (see /positions/tax) — the page is wrapped in
 * <TierGate>, so the download CTA only renders when tier check passes.
 * This endpoint enforces only the auth check; tier enforcement is the
 * UI layer's job during the launch window.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, listUserTrades } from '@/lib/db';
import { computeCostBasis } from '@/lib/cost-basis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Escape one CSV cell — wrap in double quotes when it contains a comma,
 *  double-quote, newline, or leading space; escape inner double-quotes by
 *  doubling them per RFC 4180. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (/[",\n\r]/.test(s) || /^\s/.test(s) || /\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',') + '\n';
}

function fmtNum(n: number | null | undefined, places = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toFixed(places);
}

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
  }

  const trades = await listUserTrades(session.user.id, { limit: 1000 });
  const asc = [...trades].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const summary = computeCostBasis(asc);

  const lines: string[] = [];

  // ── Section 1: Summary ──
  lines.push(`# Section: Summary\n`);
  lines.push(csvRow(['Metric', 'Value (USD)']));
  lines.push(csvRow(['Realised PnL — all-time', fmtNum(summary.realizedPnlUsd)]));
  lines.push(csvRow(['Realised PnL — YTD', fmtNum(summary.realizedYtdUsd)]));
  lines.push(csvRow(['Fees', fmtNum(summary.feesUsd)]));
  lines.push(csvRow(['Net PnL (after fees)', fmtNum(summary.netUsd)]));
  lines.push(csvRow(['Trade count', trades.length]));
  lines.push(`\n`);

  // ── Section 2: By year ──
  lines.push(`# Section: By tax year\n`);
  lines.push(csvRow(['Year', 'Realised (USD)', 'Fees (USD)', 'Trades']));
  for (const y of summary.byYear) {
    lines.push(csvRow([y.year, fmtNum(y.realized), fmtNum(y.fees), y.trades]));
  }
  lines.push(`\n`);

  // ── Section 3: Open positions ──
  lines.push(`# Section: Open positions\n`);
  lines.push(csvRow([
    'Symbol', 'Exchange', 'Side', 'Total size', 'Avg cost basis (USD)',
    'Total cost (USD)', 'Lot count',
  ]));
  for (const p of summary.openPositions) {
    lines.push(csvRow([
      p.symbol, p.exchange, p.side,
      fmtNum(p.totalSize, 8),
      fmtNum(p.avgCostBasis, 6),
      fmtNum(p.totalCostUsd),
      p.lotCount,
    ]));
  }
  lines.push(`\n`);

  // ── Section 4: Top winners / losers ──
  lines.push(`# Section: Top winners\n`);
  lines.push(csvRow(['Symbol', 'Exchange', 'Realised PnL (USD)', 'Trades']));
  for (const w of summary.topWinners) {
    lines.push(csvRow([w.symbol, w.exchange, fmtNum(w.pnl), w.trades]));
  }
  lines.push(`\n`);
  lines.push(`# Section: Top losers\n`);
  lines.push(csvRow(['Symbol', 'Exchange', 'Realised PnL (USD)', 'Trades']));
  for (const l of summary.topLosers) {
    lines.push(csvRow([l.symbol, l.exchange, fmtNum(l.pnl), l.trades]));
  }

  const body = lines.join('');
  const filename = `infohub-tax-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
