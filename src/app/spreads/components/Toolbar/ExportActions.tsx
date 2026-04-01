'use client';

import { memo, useCallback, useState } from 'react';
import { Camera, FileText, ChevronDown } from 'lucide-react';
import { fp } from '../../lib/spread-math';
import type { Pt, SpreadStats } from '../../lib/types';

interface ExportActionsProps {
  data: Pt[];
  exchanges: string[];
  symbol: string;
  stats: SpreadStats | null;
  tf: string;
}

function ExportActionsInner({ data, exchanges, symbol, stats, tf }: ExportActionsProps) {
  const [open, setOpen] = useState(false);

  const handleScreenshot = useCallback(async () => {
    setOpen(false);
    const chartEl = document.querySelector('[data-testid="spread-chart"]')?.parentElement?.parentElement;
    if (!chartEl) return;

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(chartEl as HTMLElement, {
        backgroundColor: '#0c0e14',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'right';
        ctx.fillText(`InfoHub · ${symbol} · ${new Date().toLocaleDateString()}`, canvas.width - 16, canvas.height - 12);
      }

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${symbol}_spread_${tf}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch {
      alert('Screenshot requires html2canvas. Install with: npm i html2canvas');
    }
  }, [symbol, tf]);

  const handlePDF = useCallback(() => {
    setOpen(false);
    if (data.length === 0 || !stats) return;

    const now = new Date();
    const date = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const tfLabel = tf === 'live' ? 'Live' : tf.toUpperCase();
    const median = stats.prices.reduce((s, x) => s + x.p, 0) / stats.prices.length;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${symbol} Spread Report</title>
<style>
  @page { margin: 30px 40px; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0c10; color: #e5e5e5; padding: 0; }
  .page { max-width: 780px; margin: 0 auto; padding: 40px; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-text { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .logo-info { color: #fff; }
  .logo-hub { color: #f5a623; }
  .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: #f5a623; }
  .header-right { text-align: right; }
  .header-right .date { font-size: 11px; color: #666; }
  .header-right .badge { display: inline-block; font-size: 10px; color: #f5a623; background: rgba(245,166,35,0.1); border: 1px solid rgba(245,166,35,0.2); border-radius: 6px; padding: 2px 8px; margin-top: 4px; }

  /* Title */
  .title-section { margin-bottom: 28px; }
  .title { font-size: 28px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
  .title .sym { color: #f5a623; }
  .subtitle { font-size: 12px; color: #666; margin-top: 4px; }

  /* Stats Grid */
  .stats { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 28px; }
  .stat { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; }
  .stat-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
  .stat-value { font-size: 22px; font-weight: 700; font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace; }
  .stat-sub { font-size: 10px; color: #555; margin-top: 4px; }
  .yellow { color: #f5a623; }
  .green { color: #22c55e; }
  .red { color: #ef4444; }
  .white { color: #fff; }

  /* Table */
  .table-section { margin-bottom: 28px; }
  .table-title { font-size: 13px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; padding: 10px 14px; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  tbody td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03); }
  tbody tr:hover { background: rgba(255,255,255,0.02); }
  .rank { color: #444; font-size: 11px; font-family: monospace; }
  .exchange { color: #ccc; font-weight: 500; }
  .price { font-family: 'SF Mono', monospace; color: #fff; }
  .dev { font-family: 'SF Mono', monospace; font-size: 12px; }
  .bar-cell { width: 120px; }
  .bar-bg { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.04); overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; }
  .bar-green { background: rgba(34,197,94,0.5); }
  .bar-red { background: rgba(239,68,68,0.5); }

  /* Spread Summary */
  .spread-box { background: rgba(245,166,35,0.04); border: 1px solid rgba(245,166,35,0.12); border-radius: 12px; padding: 20px; margin-bottom: 28px; display: flex; align-items: center; gap: 32px; }
  .spread-main .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .spread-main .value { font-size: 32px; font-weight: 800; color: #f5a623; font-family: 'SF Mono', monospace; margin-top: 2px; }
  .spread-main .pct { font-size: 13px; color: #888; font-family: monospace; }
  .spread-details { display: flex; gap: 28px; }
  .spread-detail .label { font-size: 10px; color: #666; }
  .spread-detail .value { font-size: 14px; font-weight: 600; font-family: monospace; margin-top: 2px; }

  /* Footer */
  .footer { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; margin-top: 32px; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 10px; color: #444; }
  .footer-right { font-size: 10px; color: #555; }
  .footer-url { color: #f5a623; text-decoration: none; }

  @media print {
    body { background: #0a0c10 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px; }
  }
</style></head><body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo">
      <div class="logo-dot"></div>
      <div class="logo-text"><span class="logo-info">Info</span><span class="logo-hub">Hub</span></div>
    </div>
    <div class="header-right">
      <div class="date">${date}</div>
      <div class="badge">${tfLabel} Report</div>
    </div>
  </div>

  <!-- Title -->
  <div class="title-section">
    <div class="title"><span class="sym">${symbol}</span> Spread Analysis</div>
    <div class="subtitle">${exchanges.length} exchanges · ${data.length} data points · Perpetual futures</div>
  </div>

  <!-- Spread Highlight -->
  <div class="spread-box">
    <div class="spread-main">
      <div class="label">Current Spread</div>
      <div class="value">$${fp(stats.cur)}</div>
      <div class="pct">${stats.pct.toFixed(3)}% · ${(stats.pct * 100).toFixed(1)} bps</div>
    </div>
    <div class="spread-details">
      <div class="spread-detail">
        <div class="label">High</div>
        <div class="value green">${stats.hi ? `$${fp(stats.hi.p)}` : '—'}</div>
        <div class="label" style="margin-top:2px">${stats.hi?.e || ''}</div>
      </div>
      <div class="spread-detail">
        <div class="label">Low</div>
        <div class="value red">${stats.lo ? `$${fp(stats.lo.p)}` : '—'}</div>
        <div class="label" style="margin-top:2px">${stats.lo?.e || ''}</div>
      </div>
      <div class="spread-detail">
        <div class="label">${tfLabel} Average</div>
        <div class="value white">$${fp(stats.avg)}</div>
        <div class="label" style="margin-top:2px">$${fp(stats.min)} — $${fp(stats.max)}</div>
      </div>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats">
    <div class="stat">
      <div class="stat-label">Avg Spread %</div>
      <div class="stat-value white">${stats.avgPct.toFixed(4)}%</div>
      <div class="stat-sub">${(stats.avgPct * 100).toFixed(1)} bps avg</div>
    </div>
    <div class="stat">
      <div class="stat-label">Max Spread %</div>
      <div class="stat-value yellow">${stats.maxPct.toFixed(4)}%</div>
      <div class="stat-sub">${stats.maxHi ? `${stats.maxHi} vs ${stats.maxLo}` : ''}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Min Spread %</div>
      <div class="stat-value white">${stats.minPct.toFixed(4)}%</div>
      <div class="stat-sub">${stats.minHi ? `${stats.minHi} vs ${stats.minLo}` : ''}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Exchanges</div>
      <div class="stat-value white">${exchanges.length}</div>
      <div class="stat-sub">${stats.percentile !== null ? `Top ${100 - stats.percentile}% spread` : 'Active venues'}</div>
    </div>
  </div>

  <!-- Exchange Table -->
  <div class="table-section">
    <div class="table-title">Exchange Price Comparison</div>
    <table>
      <thead><tr><th>#</th><th>Exchange</th><th>Price</th><th>vs Median</th><th class="bar-cell">Deviation</th></tr></thead>
      <tbody>${stats.prices.map((p, i) => {
        const dev = ((p.p - median) / median * 100);
        const absMax = Math.max(...stats.prices.map(x => Math.abs((x.p - median) / median * 100)), 0.001);
        const barW = Math.min(Math.abs(dev) / absMax * 100, 100);
        return `<tr>
          <td class="rank">${i + 1}</td>
          <td class="exchange">${p.e}</td>
          <td class="price">$${fp(p.p)}</td>
          <td class="dev ${dev >= 0 ? 'green' : 'red'}">${dev >= 0 ? '+' : ''}${dev.toFixed(4)}%</td>
          <td class="bar-cell"><div class="bar-bg"><div class="bar-fill ${dev >= 0 ? 'bar-green' : 'bar-red'}" style="width:${barW}%"></div></div></td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <span class="logo-text" style="font-size:13px"><span class="logo-info">Info</span><span class="logo-hub">Hub</span></span>
      &nbsp;· Real-time derivatives intelligence
    </div>
    <div class="footer-right">
      <a class="footer-url" href="https://info-hub.io">info-hub.io</a> · ${symbol} perpetual futures · ${exchanges.join(', ')}
    </div>
  </div>

</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => {
        setTimeout(() => win.print(), 500);
      };
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [data, exchanges, symbol, stats, tf]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:border-white/[0.15] transition flex items-center gap-1.5"
        title="Export options"
      >
        <FileText className="w-3.5 h-3.5" />
        Export
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl bg-[#12141a] border border-white/[0.08] shadow-xl shadow-black/40 overflow-hidden">
            <button
              onClick={handleScreenshot}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-neutral-300 hover:bg-white/[0.06] hover:text-white transition text-left"
            >
              <Camera className="w-3.5 h-3.5 text-neutral-500" />
              <div>
                <div className="font-medium">Screenshot</div>
                <div className="text-[10px] text-neutral-600">Save chart as PNG</div>
              </div>
            </button>
            <button
              onClick={handlePDF}
              disabled={!stats || data.length === 0}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-neutral-300 hover:bg-white/[0.06] hover:text-white transition text-left disabled:opacity-30"
            >
              <FileText className="w-3.5 h-3.5 text-neutral-500" />
              <div>
                <div className="font-medium">PDF Report</div>
                <div className="text-[10px] text-neutral-600">Spread analysis report</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export const ExportActions = memo(ExportActionsInner);
