// ─── Spread Math & Formatting ─────────────────────────────────────────────────

import type { Pt, SpreadStats, Candle } from './types';

/** Format price for display — adaptive decimal places */
export function fp(v: number): string {
  if (!isFinite(v)) return '—';
  if (v >= 10000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  if (v >= 0.0001) return v.toFixed(6);
  if (v === 0) return '0.00';
  if (v < 0.0001 && v > 0) return '< 0.0001';
  return Number(v.toPrecision(4)).toString();
}

const OUTLIER_THRESHOLD = 0.10; // 10% from median

/** Filter outlier prices — returns sane entries */
export function filterOutliers(
  entries: { e: string; p: number }[],
): { e: string; p: number }[] {
  if (entries.length < 2) return entries;
  const prices = entries.map(x => x.p).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  if (median <= 0) return entries;
  const sane = entries.filter(x => Math.abs(x.p - median) / median < OUTLIER_THRESHOLD);
  return sane.length >= 2 ? sane : entries;
}

/** Compute spread stats from data points */
export function computeStats(data: Pt[], exs: string[], wsPrices?: Record<string, { price: number; ts: number }>): SpreadStats | null {
  if (data.length === 0 || exs.length < 2) return null;

  let sum = 0, max = 0, min = Infinity, maxT = 0, minT = 0, cnt = 0;
  let sumPct = 0, maxPct = 0, minPct = Infinity;
  let maxHi = '', maxLo = '', minHi = '', minLo = '';

  for (const pt of data) {
    const s = pt._spread || 0;
    sum += s;
    cnt++;
    const sp = pt._spreadPct || 0;
    sumPct += sp;
    if (sp > maxPct) maxPct = sp;
    if (sp < minPct) minPct = sp;
    if (s > max) {
      max = s;
      maxT = pt.time;
      const p = exs.map(e => ({ e, p: pt[e] as number })).filter(x => typeof x.p === 'number' && x.p > 0).sort((a, b) => b.p - a.p);
      if (p.length >= 2) { maxHi = p[0].e; maxLo = p[p.length - 1].e; }
    }
    if (s < min) {
      min = s;
      minT = pt.time;
      const p = exs.map(e => ({ e, p: pt[e] as number })).filter(x => typeof x.p === 'number' && x.p > 0).sort((a, b) => b.p - a.p);
      if (p.length >= 2) { minHi = p[0].e; minLo = p[p.length - 1].e; }
    }
  }

  const last = data[data.length - 1];
  const prices = exs.map(e => ({ e, p: last[e] as number })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
  const cur = prices.length >= 2 ? prices[0].p - prices[prices.length - 1].p : 0;
  const pct = prices.length >= 2 ? (cur / prices[prices.length - 1].p) * 100 : 0;
  const percentile = cnt > 10 ? Math.round(data.filter(pt => (pt._spread || 0) < cur).length / cnt * 100) : null;

  return {
    cur, pct,
    avg: cnt ? sum / cnt : 0,
    max, min: min === Infinity ? 0 : min,
    maxT, minT, maxHi, maxLo, minHi, minLo,
    prices,
    hi: prices[0],
    lo: prices[prices.length - 1],
    avgPct: cnt ? sumPct / cnt : 0,
    maxPct, minPct: minPct === Infinity ? 0 : minPct,
    percentile,
  };
}

/** Transform live WS history into chart data points */
export function transformLiveData(
  wsHistory: Array<{ t: number; prices: Record<string, number> }>,
  selectedExchanges: string[],
): { data: Pt[]; exs: string[] } {
  if (wsHistory.length < 2) return { data: [], exs: selectedExchanges };

  const wsExs = selectedExchanges.filter(e => wsHistory.some(snap => snap.prices[e] > 0));
  if (wsExs.length === 0) return { data: [], exs: [] };

  const rows: Pt[] = [];
  for (const snap of wsHistory) {
    const pt: Pt = { time: snap.t, label: '' };
    const entries: { e: string; p: number }[] = [];
    for (const e of wsExs) {
      const p = snap.prices[e];
      if (p && p > 0) entries.push({ e, p });
    }
    if (entries.length < 2) continue; // need 2+ exchanges to draw meaningful lines

    const sane = filterOutliers(entries);
    if (sane.length < 2) continue; // skip if outlier removal leaves < 2

    // Only include sane entries in the data point
    for (const entry of sane) {
      pt[entry.e] = entry.p;
    }

    const sanePrices = sane.map(x => x.p);

    const avg = sanePrices.reduce((s, p) => s + p, 0) / sanePrices.length;
    for (const x of sane) pt[x.e + '_dev'] = ((x.p - avg) / avg) * 100;
    pt._spread = Math.max(...sanePrices) - Math.min(...sanePrices);
    const minSane = Math.min(...sanePrices);
    pt._spreadPct = minSane > 0 ? ((Math.max(...sanePrices) - minSane) / minSane) * 100 : 0;
    pt.label = new Date(snap.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    rows.push(pt);
  }
  return { data: rows, exs: wsExs };
}

/** Transform kline data into chart data points, with optional live price stitch */
export function transformKlineData(
  kd: Record<string, Candle[]>,
  selectedExchanges: string[],
  tf: string,
  livePrices?: Record<string, { price: number }>,
): { data: Pt[]; exs: string[]; available: string[] } {
  const av = Object.keys(kd);
  let active = selectedExchanges.filter(e => av.includes(e));

  // If no selected exchanges have data, use all available
  if (active.length === 0 && av.length > 0) active = av;
  if (active.length === 0) return { data: [], exs: [], available: av };

  const bucketMs = tf === '1d' ? 3600_000 : 14400_000;
  const maps: Record<string, Map<number, number>> = {};
  const allBuckets = new Set<number>();

  for (const e of active) {
    const m = new Map<number, number>();
    for (const c of kd[e]) {
      if (c.c > 0) {
        const bucket = Math.round(c.t / bucketMs) * bucketMs;
        m.set(bucket, c.c);
        allBuckets.add(bucket);
      }
    }
    maps[e] = m;
  }

  const sorted = Array.from(allBuckets).sort((a, b) => a - b);
  const rows: Pt[] = [];
  const lastSeen: Record<string, { p: number; t: number }> = {};

  for (const t of sorted) {
    const pt: Pt = { time: t, label: '' };
    const entries: { e: string; p: number }[] = [];

    for (const e of active) {
      let p = maps[e]?.get(t);
      if (p && p > 0) {
        lastSeen[e] = { p, t };
      } else if (lastSeen[e] && (t - lastSeen[e].t) <= bucketMs * 2) {
        p = lastSeen[e].p;
      }
      if (p && p > 0) entries.push({ e, p });
    }

    if (entries.length < 2) continue;

    const sane = filterOutliers(entries);
    const useExs = sane.length >= 2 ? sane : entries;
    const avg = useExs.reduce((s, x) => s + x.p, 0) / useExs.length;

    for (const x of useExs) {
      pt[x.e] = x.p;
      pt[x.e + '_dev'] = ((x.p - avg) / avg) * 100;
    }

    const usePrices = useExs.map(x => x.p);
    pt._spread = Math.max(...usePrices) - Math.min(...usePrices);
    const minUse = Math.min(...usePrices);
    pt._spreadPct = usePrices.length >= 2 && minUse > 0 ? ((Math.max(...usePrices) - minUse) / minUse) * 100 : 0;

    if (useExs.length >= 2 && avg > 0) {
      pt._spreadAB = ((useExs[0].p - useExs[1].p) / avg) * 100;
    }

    const d = new Date(t);
    pt.label = tf === '30d' ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      : tf === '7d' ? (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0')
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    rows.push(pt);
  }

  // Stitch live prices as the latest data point so chart extends to "now"
  if (livePrices && Object.keys(livePrices).length > 0 && active.length >= 2) {
    const now = Date.now();
    const pt: Pt = { time: now, label: '' };
    const entries: { e: string; p: number }[] = [];
    for (const e of active) {
      const lp = livePrices[e]?.price;
      if (lp && lp > 0) entries.push({ e, p: lp });
    }
    if (entries.length >= 2) {
      const sane = filterOutliers(entries);
      const useExs = sane.length >= 2 ? sane : entries;
      const avg = useExs.reduce((s, x) => s + x.p, 0) / useExs.length;
      for (const x of useExs) {
        pt[x.e] = x.p;
        pt[x.e + '_dev'] = ((x.p - avg) / avg) * 100;
      }
      const usePrices = useExs.map(x => x.p);
      pt._spread = Math.max(...usePrices) - Math.min(...usePrices);
      const minUse = Math.min(...usePrices);
    pt._spreadPct = usePrices.length >= 2 && minUse > 0 ? ((Math.max(...usePrices) - minUse) / minUse) * 100 : 0;
      const d = new Date(now);
      pt.label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rows.push(pt);
    }
  }

  return { data: rows, exs: active, available: av };
}

/** Compute Y axis domain with padding */
export function computeYDomain(data: Pt[], exs: string[]): [number, number] {
  if (data.length === 0 || exs.length === 0) return [0, 1];
  const ap: number[] = [];
  for (const pt of data) {
    for (const e of exs) {
      const p = pt[e] as number;
      if (typeof p === 'number' && p > 0) ap.push(p);
    }
  }
  if (ap.length === 0) return [0, 1];
  ap.sort((a, b) => a - b);
  const q1 = ap[Math.floor(ap.length * 0.05)] || ap[0];
  const q3 = ap[Math.floor(ap.length * 0.95)] || ap[ap.length - 1];
  const pad = Math.max((q3 - q1) * 0.3, q1 * 0.001);
  return [q1 - pad, q3 + pad];
}
