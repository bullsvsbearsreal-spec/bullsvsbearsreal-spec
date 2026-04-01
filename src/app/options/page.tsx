'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import DataFreshness from '@/components/DataFreshness';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatCompact, formatPrice } from '@/lib/utils/format';
import {
  RefreshCw, Target, Crosshair, ArrowLeftRight, BarChart3,
  DollarSign, Activity, Globe, TrendingUp, TrendingDown, Calendar,
  Shield, ChevronRight, Zap,
} from 'lucide-react';
import { useFlash } from '@/hooks/useFlash';
import { useApi } from '@/hooks/useSWRApi';

/* ─── Types ──────────────────────────────────────────────────────── */

interface StrikeData {
  strike: number;
  callOI: number;
  putOI: number;
}

interface IVPoint {
  strike: number;
  callIV: number;
  putIV: number;
}

interface ExchangeBreakdown {
  exchange: string;
  callOI: number;
  putOI: number;
  totalOI: number;
  instruments: number;
  share: number;
}

interface ExpiryEntry {
  date: string;
  callOI: number;
  putOI: number;
  totalOI: number;
  expiry: number;
  maxPain?: number;
}

interface OptionsResponse {
  currency: string;
  underlyingPrice: number;
  maxPain: number;
  putCallRatio: number;
  totalCallOI: number;
  totalPutOI: number;
  totalOI: number;
  instrumentCount: number;
  strikeData: StrikeData[];
  ivSmile: IVPoint[];
  exchangeBreakdown?: ExchangeBreakdown[];
  expiryBreakdown?: ExpiryEntry[];
  exchangeStrikes?: Record<string, StrikeData[]>;
  health?: Array<{ exchange: string; status: string; count: number; latency: number }>;
}

/* ─── Chart Legend ────────────────────────────────────────────────── */

function Legend({ items }: { items: { color: string; label: string; type?: 'box' | 'line' }[] }) {
  return (
    <div className="flex items-center justify-center gap-5 pt-3 pb-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          {item.type === 'line' ? (
            <div className="w-4 h-[2px] rounded-full" style={{ background: item.color }} />
          ) : (
            <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: item.color }} />
          )}
          {item.label}
        </div>
      ))}
    </div>
  );
}

/* ─── Section wrapper ────────────────────────────────────────────── */

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-hub-darker border border-white/[0.06] rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, right }: {
  icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ─── OI by Strike Chart ──────────────────────────────────────────── */

function OIByStrikeChart({
  strikes,
  spotPrice,
  maxPain,
  height = 340,
}: {
  strikes: StrikeData[];
  spotPrice: number;
  maxPain: number;
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  if (strikes.length === 0)
    return (
      <div className="flex items-center justify-center h-[200px] text-neutral-600 text-sm">
        No strike data available for this symbol
      </div>
    );

  const filtered = strikes.filter((s) => s.callOI + s.putOI > 0);
  const display = filtered.length > 80
    ? filtered.filter((_, i) => i % Math.ceil(filtered.length / 80) === 0)
    : filtered;

  const totalOI = display.reduce((sum, s) => sum + s.callOI + s.putOI, 0) || 1;
  const maxOI = Math.max(...display.map((s) => Math.max(s.callOI, s.putOI)), 1);
  const width = 1200;
  const pad = { top: 24, bottom: 36, left: 4, right: 4 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const groupW = chartW / display.length;
  const barW = groupW * 0.38;
  const gap = groupW * 0.06;

  const spotIdx = display.findIndex((s) => s.strike >= spotPrice);
  const maxPainIdx = display.findIndex((s) => s.strike >= maxPain);
  const sameIdx = spotIdx === maxPainIdx;

  const hoveredStrike = hovered !== null ? display[hovered] : null;
  const tooltipX = hovered !== null ? pad.left + hovered * groupW + groupW / 2 : 0;
  const labelStep = Math.max(1, Math.floor(display.length / 14));

  const clampedLeft = (() => {
    if (hovered === null || !containerRef.current) return 0;
    const containerW = containerRef.current.offsetWidth;
    const tooltipW = tooltipRef.current?.offsetWidth ?? 180;
    const rawLeft = (tooltipX / width) * containerW;
    return Math.max(8, Math.min(rawLeft - tooltipW / 2, containerW - tooltipW - 8));
  })();

  return (
    <div className="relative" ref={containerRef} onMouseLeave={() => setHovered(null)}>
      {hoveredStrike && hovered !== null && (
        <div
          ref={tooltipRef}
          className="absolute z-20 pointer-events-none bg-[#1a1a2e]/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md"
          style={{
            left: `${clampedLeft}px`,
            top: 0,
          }}
        >
          <p className="text-xs font-bold text-white font-mono mb-1.5">
            Strike ${hoveredStrike.strike.toLocaleString()}
          </p>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-sm bg-[#22c55e]" />
            <span className="text-neutral-400">Call OI</span>
            <span className="text-white font-mono font-medium ml-auto">${formatCompact(hoveredStrike.callOI)}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] mt-1">
            <span className="w-2 h-2 rounded-sm bg-[#ef4444]" />
            <span className="text-neutral-400">Put OI</span>
            <span className="text-white font-mono font-medium ml-auto">${formatCompact(hoveredStrike.putOI)}</span>
          </div>
          <div className="border-t border-white/[0.06] mt-2 pt-1.5">
            <p className="text-[10px] text-neutral-500 font-mono">
              {(((hoveredStrike.callOI + hoveredStrike.putOI) / totalOI) * 100).toFixed(1)}% of total OI
            </p>
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Open interest by strike price chart">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={pad.left}
            y1={pad.top + chartH * (1 - pct)}
            x2={width - pad.right}
            y2={pad.top + chartH * (1 - pct)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={0.5}
          />
        ))}

        {/* Spot dashed line */}
        {spotIdx >= 0 && (
          <line
            x1={pad.left + spotIdx * groupW + groupW / 2}
            y1={pad.top}
            x2={pad.left + spotIdx * groupW + groupW / 2}
            y2={pad.top + chartH}
            stroke="#eab308"
            strokeDasharray="4,3"
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}

        {/* Max Pain dashed line */}
        {maxPainIdx >= 0 && maxPainIdx !== spotIdx && (
          <line
            x1={pad.left + maxPainIdx * groupW + groupW / 2}
            y1={pad.top}
            x2={pad.left + maxPainIdx * groupW + groupW / 2}
            y2={pad.top + chartH}
            stroke="#f97316"
            strokeDasharray="3,4"
            strokeWidth={1.5}
            opacity={0.6}
          />
        )}

        {display.map((s, i) => {
          const x = pad.left + i * groupW;
          const callH = (s.callOI / maxOI) * chartH;
          const putH = (s.putOI / maxOI) * chartH;
          const isSpot = i === spotIdx;
          const isMaxPain = i === maxPainIdx;
          const isHovered = i === hovered;

          return (
            <g key={s.strike} onMouseEnter={() => setHovered(i)}>
              <rect x={x} y={pad.top} width={groupW} height={chartH} fill="transparent" />
              <rect
                x={x + gap}
                y={pad.top + chartH - callH}
                width={barW}
                height={Math.max(callH, 0.5)}
                fill={isHovered ? '#22c55e' : '#22c55e'}
                rx={1.5}
              />
              <rect
                x={x + barW + gap * 2}
                y={pad.top + chartH - putH}
                width={barW}
                height={Math.max(putH, 0.5)}
                fill={isHovered ? '#ef4444' : '#ef4444'}
                rx={1.5}
              />
              {(i % labelStep === 0 || isSpot || isMaxPain) && (
                <text
                  x={x + groupW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isSpot ? '#eab308' : isMaxPain ? '#f97316' : 'rgba(255,255,255,0.3)'}
                  fontWeight={isSpot || isMaxPain ? 'bold' : 'normal'}
                  fontFamily="monospace"
                >
                  {s.strike >= 1000 ? `${(s.strike / 1000).toFixed(0)}K` : s.strike}
                </text>
              )}
            </g>
          );
        })}

        {/* Spot label */}
        {spotIdx >= 0 && (
          <g>
            <title>{sameIdx ? 'Spot price and max pain strike' : 'Spot price strike'}</title>
            <rect
              x={pad.left + spotIdx * groupW + groupW / 2 - (sameIdx ? 48 : 20)}
              y={pad.top - 16}
              width={sameIdx ? 96 : 40}
              height={14}
              rx={4}
              fill="#eab308"
              opacity={0.9}
            />
            <text
              x={pad.left + spotIdx * groupW + groupW / 2}
              y={pad.top - 6}
              textAnchor="middle"
              fontSize="8"
              fill="#000"
              fontWeight="bold"
            >
              {sameIdx ? 'SPOT / MAX PAIN' : 'SPOT'}
            </text>
          </g>
        )}

        {/* Max Pain label */}
        {maxPainIdx >= 0 && maxPainIdx !== spotIdx && (
          <g>
            <title>Max pain strike</title>
            <rect
              x={pad.left + maxPainIdx * groupW + groupW / 2 - 28}
              y={pad.top - 16}
              width={56}
              height={14}
              rx={4}
              fill="#f97316"
              opacity={0.9}
            />
            <text
              x={pad.left + maxPainIdx * groupW + groupW / 2}
              y={pad.top - 6}
              textAnchor="middle"
              fontSize="8"
              fill="#000"
              fontWeight="bold"
            >
              MAX PAIN
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ─── OI by Expiry Chart ─────────────────────────────────────────── */

function OIByExpiryChart({
  entries,
  height = 240,
}: {
  entries: ExpiryEntry[];
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  if (entries.length === 0) return null;

  const maxOI = Math.max(...entries.map((e) => Math.max(e.callOI, e.putOI)), 1);
  const totalOI = entries.reduce((s, e) => s + e.totalOI, 0) || 1;
  const width = 900;
  const pad = { top: 28, bottom: 36, left: 4, right: 4 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  // Cap group width so bars aren't too spread out with few entries
  const maxGroupW = 120;
  const rawGroupW = chartW / entries.length;
  const groupW = Math.min(rawGroupW, maxGroupW);
  const totalW = groupW * entries.length;
  const offsetX = pad.left + (chartW - totalW) / 2; // Center bars
  const barW = groupW * 0.36;
  const gap = groupW * 0.07;

  const hoveredEntry = hovered !== null ? entries[hovered] : null;
  const tooltipX = hovered !== null ? offsetX + hovered * groupW + groupW / 2 : 0;

  const clampedLeft = (() => {
    if (hovered === null || !containerRef.current) return 0;
    const containerW = containerRef.current.offsetWidth;
    const tooltipW = tooltipRef.current?.offsetWidth ?? 180;
    const rawLeft = (tooltipX / width) * containerW;
    return Math.max(8, Math.min(rawLeft - tooltipW / 2, containerW - tooltipW - 8));
  })();

  return (
    <div className="relative" ref={containerRef} onMouseLeave={() => setHovered(null)}>
      {hoveredEntry && hovered !== null && (
        <div
          ref={tooltipRef}
          className="absolute z-20 pointer-events-none bg-[#1a1a2e]/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md"
          style={{
            left: `${clampedLeft}px`,
            top: 0,
          }}
        >
          <p className="text-xs font-bold text-white font-mono mb-1.5">{hoveredEntry.date}</p>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-sm bg-[#22c55e]" />
            <span className="text-neutral-400">Calls</span>
            <span className="text-white font-mono font-medium ml-auto">${formatCompact(hoveredEntry.callOI)}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] mt-1">
            <span className="w-2 h-2 rounded-sm bg-[#ef4444]" />
            <span className="text-neutral-400">Puts</span>
            <span className="text-white font-mono font-medium ml-auto">${formatCompact(hoveredEntry.putOI)}</span>
          </div>
          <div className="border-t border-white/[0.06] mt-2 pt-1.5 flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-500 font-mono">
              {((hoveredEntry.totalOI / totalOI) * 100).toFixed(1)}% of total OI
            </span>
            {hoveredEntry.maxPain && (
              <span className="text-[10px] text-orange-400 font-mono">
                Max Pain: ${hoveredEntry.maxPain.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Open interest by expiry date chart">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={pad.left}
            y1={pad.top + chartH * (1 - pct)}
            x2={width - pad.right}
            y2={pad.top + chartH * (1 - pct)}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={0.5}
          />
        ))}

        {entries.map((e, i) => {
          const x = offsetX + i * groupW;
          const callH = (e.callOI / maxOI) * chartH;
          const putH = (e.putOI / maxOI) * chartH;
          const d = new Date(e.expiry);
          const isValidDate = !isNaN(d.getTime());
          const label = isValidDate ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
          const year = isValidDate ? d.getFullYear().toString().slice(2) : '';
          const isHovered = i === hovered;
          const pct = ((e.totalOI / totalOI) * 100);

          return (
            <g key={e.date} onMouseEnter={() => setHovered(i)}>
              {/* Hover highlight background */}
              {isHovered && (
                <rect
                  x={x + 1}
                  y={pad.top}
                  width={groupW - 2}
                  height={chartH}
                  fill="rgba(255,255,255,0.02)"
                  rx={4}
                />
              )}
              <rect x={x} y={pad.top} width={groupW} height={chartH + 40} fill="transparent" />

              {/* Call bar */}
              <rect
                x={x + (groupW / 2) - barW - gap / 2}
                y={pad.top + chartH - callH}
                width={barW}
                height={Math.max(callH, 1)}
                fill={isHovered ? '#22c55e' : '#22c55e'}
                rx={3}
              />
              {/* Put bar */}
              <rect
                x={x + (groupW / 2) + gap / 2}
                y={pad.top + chartH - putH}
                width={barW}
                height={Math.max(putH, 1)}
                fill={isHovered ? '#ef4444' : '#ef4444'}
                rx={3}
              />

              {/* Total OI + % label above bars */}
              <text
                x={x + groupW / 2}
                y={pad.top + chartH - Math.max(callH, putH) - 8}
                textAnchor="middle"
                fontSize="7.5"
                fill={isHovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'}
                fontFamily="monospace"
                fontWeight={isHovered ? 'bold' : 'normal'}
              >
                {formatCompact(e.totalOI)}
              </text>
              {isHovered && (
                <text
                  x={x + groupW / 2}
                  y={pad.top + chartH - Math.max(callH, putH) - 18}
                  textAnchor="middle"
                  fontSize="7"
                  fill="rgba(255,255,255,0.35)"
                  fontFamily="monospace"
                >
                  {pct.toFixed(0)}%
                </text>
              )}

              {/* Date label — single line */}
              <text
                x={x + groupW / 2}
                y={height - 14}
                textAnchor="middle"
                fontSize="8.5"
                fill={isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)'}
                fontWeight={isHovered ? 'bold' : 'normal'}
                fontFamily="monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── IV Smile Chart ─────────────────────────────────────────────── */

/** Simple moving average to smooth jagged IV data */
function smoothData(data: { x: number; y: number }[], windowSize: number): { x: number; y: number }[] {
  if (data.length <= windowSize) return data;
  const half = Math.floor(windowSize / 2);
  return data.map((d, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);
    let sum = 0, count = 0;
    for (let j = start; j <= end; j++) { sum += data[j].y; count++; }
    return { x: d.x, y: sum / count };
  });
}

/** Convert points to an SVG cubic bezier path for smooth curves */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[Math.min(i + 1, pts.length - 1)];
    const prevPrev = pts[Math.max(i - 2, 0)];
    const cpx1 = prev.x + (cur.x - prevPrev.x) / 6;
    const cpy1 = prev.y + (cur.y - prevPrev.y) / 6;
    const cpx2 = cur.x - (next.x - prev.x) / 6;
    const cpy2 = cur.y - (next.y - prev.y) / 6;
    d += ` C${cpx1},${cpy1} ${cpx2},${cpy2} ${cur.x},${cur.y}`;
  }
  return d;
}

function IVSmileChart({
  points,
  spotPrice,
  height = 240,
}: {
  points: IVPoint[];
  spotPrice: number;
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  if (points.length < 2) return null;

  // Combine call/put IV (identical by put-call parity) into single line
  const combinedIVs = points.map((p) => {
    if (p.callIV > 0 && p.putIV > 0) return (p.callIV + p.putIV) / 2;
    return p.callIV || p.putIV || 0;
  }).filter((v) => v > 0);
  if (combinedIVs.length === 0) return null;

  const minIV = Math.min(...combinedIVs) * 0.92;
  const maxIV = Math.max(...combinedIVs) * 1.05;
  const range = maxIV - minIV || 1;

  const width = 900;
  const pad = { top: 20, bottom: 36, left: 48, right: 12 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const scaleX = (i: number) => pad.left + (i / (points.length - 1)) * chartW;
  const scaleY = (val: number) => pad.top + (1 - (val - minIV) / range) * chartH;

  // Build single IV curve (call≈put by parity), smooth with moving average
  const SMOOTH_WINDOW = 5;
  const rawIV = points.map((p, i) => {
    const iv = p.callIV > 0 && p.putIV > 0 ? (p.callIV + p.putIV) / 2 : (p.callIV || p.putIV);
    return { x: scaleX(i), y: iv };
  }).filter(d => d.y > 0);
  const smoothIV = smoothData(rawIV, SMOOTH_WINDOW).map(d => ({ x: d.x, y: scaleY(d.y) }));

  const ivPath = smoothPath(smoothIV);

  // Area fill path
  const ivArea = smoothIV.length > 1
    ? `${ivPath} L${smoothIV[smoothIV.length - 1].x},${pad.top + chartH} L${smoothIV[0].x},${pad.top + chartH} Z`
    : '';

  // Spot price position
  const spotIdx = points.findIndex((p) => p.strike >= spotPrice);
  const spotX = spotIdx >= 0 ? scaleX(spotIdx) : -1;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: minIV + pct * range,
    y: scaleY(minIV + pct * range),
  }));

  // Hover: find nearest point
  const hoveredPoint = hovered !== null ? points[hovered] : null;
  const hoveredX = hovered !== null ? scaleX(hovered) : 0;

  const ivClampedLeft = (() => {
    if (hovered === null || !containerRef.current) return 0;
    const containerW = containerRef.current.offsetWidth;
    const tooltipW = tooltipRef.current?.offsetWidth ?? 180;
    const rawLeft = (hoveredX / width) * containerW;
    return Math.max(8, Math.min(rawLeft - tooltipW / 2, containerW - tooltipW - 8));
  })();

  return (
    <div className="relative" ref={containerRef} onMouseLeave={() => setHovered(null)}>
      {/* Tooltip */}
      {hoveredPoint && hovered !== null && (
        <div
          ref={tooltipRef}
          className="absolute z-20 pointer-events-none bg-[#1a1a2e]/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md"
          style={{
            left: `${ivClampedLeft}px`,
            top: 0,
          }}
        >
          <p className="text-xs font-bold text-white font-mono mb-1.5">
            Strike ${hoveredPoint.strike.toLocaleString()}
          </p>
          {(hoveredPoint.callIV > 0 || hoveredPoint.putIV > 0) && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-sm bg-[#eab308]" />
              <span className="text-neutral-400">Implied Vol</span>
              <span className="text-hub-yellow font-mono font-medium ml-auto">{((hoveredPoint.callIV + hoveredPoint.putIV) / (hoveredPoint.callIV > 0 && hoveredPoint.putIV > 0 ? 2 : 1)).toFixed(1)}%</span>
            </div>
          )}
          {hoveredPoint.callIV > 0 && hoveredPoint.putIV > 0 && Math.abs(hoveredPoint.callIV - hoveredPoint.putIV) > 0.5 && (
            <div className="border-t border-white/[0.06] mt-2 pt-1.5 text-[10px] text-neutral-500 font-mono">
              Skew: {(hoveredPoint.putIV - hoveredPoint.callIV).toFixed(1)}%
            </div>
          )}
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Implied volatility smile chart">
        {/* Grid + Y labels */}
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={pad.left}
              y1={tick.y}
              x2={width - pad.right}
              y2={tick.y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={0.5}
            />
            <text x={pad.left - 8} y={tick.y + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.3)" fontFamily="monospace">
              {tick.value.toFixed(0)}%
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {(() => {
          const step = Math.max(1, Math.floor(points.length / 10));
          return points.map((p, i) => {
            if (i % step !== 0 && i !== points.length - 1) return null;
            const isSpot = i === spotIdx;
            return (
              <text
                key={p.strike}
                x={scaleX(i)}
                y={height - 8}
                textAnchor="middle"
                fontSize="8"
                fill={isSpot ? '#eab308' : 'rgba(255,255,255,0.3)'}
                fontWeight={isSpot ? 'bold' : 'normal'}
                fontFamily="monospace"
              >
                {p.strike >= 1000 ? `${(p.strike / 1000).toFixed(0)}K` : p.strike}
              </text>
            );
          });
        })()}

        {/* Spot price vertical line */}
        {spotX > 0 && (
          <>
            <line
              x1={spotX} y1={pad.top} x2={spotX} y2={pad.top + chartH}
              stroke="#eab308" strokeDasharray="4,3" strokeWidth={1} opacity={0.5}
            />
            <rect x={spotX - 16} y={pad.top - 14} width={32} height={12} rx={3} fill="#eab308" opacity={0.85} />
            <text x={spotX} y={pad.top - 5} textAnchor="middle" fontSize="7" fill="#000" fontWeight="bold">SPOT</text>
          </>
        )}

        {/* IV area + smooth line (single curve, call≈put by parity) */}
        {ivArea && (
          <path d={ivArea} fill="rgba(234,179,8,0.08)" />
        )}
        {ivPath && (
          <path d={ivPath} fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" />
        )}

        {/* Hover crosshair + dot */}
        {hovered !== null && hoveredPoint && (
          <g>
            <line
              x1={hoveredX} y1={pad.top} x2={hoveredX} y2={pad.top + chartH}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="2,2"
            />
            {(hoveredPoint.callIV > 0 || hoveredPoint.putIV > 0) && (
              <circle cx={hoveredX} cy={scaleY((hoveredPoint.callIV + hoveredPoint.putIV) / (hoveredPoint.callIV > 0 && hoveredPoint.putIV > 0 ? 2 : 1))} r={4} fill="#eab308" stroke="#000" strokeWidth={1.5} />
            )}
          </g>
        )}

        {/* Invisible hover targets */}
        {points.map((_, i) => (
          <rect
            key={i}
            x={scaleX(i) - chartW / points.length / 2}
            y={pad.top}
            width={chartW / points.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}
      </svg>
    </div>
  );
}

/* ─── Metric Card ────────────────────────────────────────────────── */

function MetricCard({ icon, label, value, sub, accent, className = '', flash }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
  accent?: string;
  className?: string;
  flash?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-hub-darker border border-white/[0.06] rounded-2xl px-4 py-4 ${className}`}>
      {accent && (
        <div className="absolute inset-0 opacity-[0.04]" style={{ background: `radial-gradient(circle at top right, ${accent}, transparent 70%)` }} />
      )}
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold text-white font-mono leading-none ${flash || ''}`}>{value}</p>
      {sub && <div className="mt-2">{sub}</div>}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

export default function OptionsPage() {
  const [currency, setCurrency] = useState<'BTC' | 'ETH' | 'SOL'>('BTC');
  const [activeExchange, setActiveExchange] = useState<string>('all');
  const [liveSpot, setLiveSpot] = useState<number>(0);

  interface OptionsBundle { options: OptionsResponse; spot: number }

  const fetcher = useCallback(async (): Promise<OptionsBundle> => {
    const [res, tickerRes] = await Promise.all([
      fetch(`/api/options?currency=${currency}`),
      fetch('/api/tickers').then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    // Use live spot price from tickers API (more accurate than Deribit index)
    let bestPrice = 0, bestVol = 0;
    if (tickerRes) {
      const tickers = Array.isArray(tickerRes) ? tickerRes : tickerRes.data ?? [];
      for (const t of tickers) {
        const sym = (t.symbol || '').replace(/(USDT|USD|USDC|PERP|SWAP)$/i, '');
        if (sym === currency) {
          const vol = Number(t.quoteVolume24h) || 0;
          if (vol > bestVol) { bestPrice = t.lastPrice || 0; bestVol = vol; }
        }
      }
    }
    return { options: json as OptionsResponse, spot: bestPrice };
  }, [currency]);

  const { data: bundle, error: fetchError, isLoading: loading, lastUpdate, refresh: fetchData } = useApi<OptionsBundle>({
    key: `options-${currency}`,
    fetcher,
    refreshInterval: 60000,
  });

  const data = bundle?.options ?? null;
  const error = fetchError;

  // Sync live spot from bundle (in useEffect to avoid setState during render)
  const prevSpotRef = useRef(0);
  useEffect(() => {
    if (bundle && bundle.spot > 0 && bundle.spot !== prevSpotRef.current) {
      prevSpotRef.current = bundle.spot;
      setLiveSpot(bundle.spot);
    }
  }, [bundle?.spot]);

  const pcRatioFlash = useFlash(data?.putCallRatio);
  const totalOIFlash = useFlash(data?.totalOI);
  const spotFlash = useFlash(liveSpot || data?.underlyingPrice);

  const filteredStrikes = useMemo(() => {
    if (!data) return [];
    if (activeExchange === 'all') return data.strikeData;
    return data.exchangeStrikes?.[activeExchange] || [];
  }, [data, activeExchange]);

  const filteredOI = useMemo(() => {
    if (!data) return { callOI: 0, putOI: 0, totalOI: 0 };
    if (activeExchange === 'all') {
      return { callOI: data.totalCallOI, putOI: data.totalPutOI, totalOI: data.totalOI };
    }
    const ex = data.exchangeBreakdown?.find((e) => e.exchange === activeExchange);
    return ex
      ? { callOI: ex.callOI, putOI: ex.putOI, totalOI: ex.totalOI }
      : { callOI: 0, putOI: 0, totalOI: 0 };
  }, [data, activeExchange]);

  const exchangeNames = useMemo(() => {
    if (!data?.exchangeBreakdown) return [];
    return data.exchangeBreakdown.filter((e) => e.totalOI > 0).map((e) => e.exchange);
  }, [data?.exchangeBreakdown]);

  const activeCount = data?.health?.filter((h) => h.status === 'ok' && h.count > 0).length || 0;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-hub-yellow/20 to-hub-yellow/5 flex items-center justify-center border border-hub-yellow/20">
                <Target className="w-4.5 h-4.5 text-hub-yellow" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Options</h1>
            </div>
            <p className="text-neutral-500 text-sm ml-12">
              Max pain, OI distribution & IV across {activeCount} exchanges
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Currency selector */}
            <div className="flex bg-white/[0.04] rounded-xl p-1 gap-1 border border-white/[0.06]">
              {(['BTC', 'ETH', 'SOL'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currency === c
                      ? 'bg-hub-yellow text-black shadow-glow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <DataFreshness exchangeCount={activeCount} lastUpdated={lastUpdate} />
            <button
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh data"
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ─── Loading skeleton ─── */}
        {loading && !data && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-2xl h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-2xl h-[340px] animate-pulse" />
          </div>
        )}

        {/* ─── Error ─── */}
        {error && !data && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={fetchData} className="text-sm text-hub-yellow hover:underline font-medium">
              Try again
            </button>
          </div>
        )}

        {data && (
          <div className="space-y-4">

            {/* ─── Key Metrics ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Max Pain */}
              {(() => {
                const nearest = data.expiryBreakdown?.[0];
                const mp = nearest?.maxPain || data.maxPain || 0;
                const spot = liveSpot || data.underlyingPrice;
                const dist = spot > 0 ? ((mp - spot) / spot * 100) : 0;
                const label = nearest ? nearest.date.slice(5) : 'Global';
                return (
                  <MetricCard
                    icon={<Crosshair className="w-4 h-4 text-hub-yellow" />}
                    label={`Max Pain (${label})`}
                    value={`$${mp.toLocaleString()}`}
                    accent="#eab308"
                    className="border-hub-yellow/15"
                    sub={
                      <span className={`delta-badge text-[10px] ${dist >= 0 ? 'delta-badge-up' : 'delta-badge-down'}`}>
                        {dist >= 0 ? '+' : ''}{dist.toFixed(1)}% from spot
                      </span>
                    }
                  />
                );
              })()}

              {/* P/C Ratio */}
              <MetricCard
                icon={<ArrowLeftRight className={`w-4 h-4 ${data.putCallRatio > 1 ? 'text-red-400' : 'text-green-400'}`} />}
                label="Put/Call Ratio"
                value={(data.putCallRatio || 0).toFixed(2)}
                accent={data.putCallRatio > 1 ? '#ef4444' : '#22c55e'}
                flash={pcRatioFlash}
                sub={
                  <span className="text-xs text-neutral-500">
                    {data.putCallRatio > 1 ? 'Bearish hedging' : data.putCallRatio < 0.7 ? 'Bullish bias' : 'Balanced'}
                  </span>
                }
              />

              {/* Total OI */}
              <MetricCard
                icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
                label="Total Options OI"
                value={`$${formatCompact(data.totalOI)}`}
                accent="#3b82f6"
                flash={totalOIFlash}
                sub={
                  <span className="text-xs text-neutral-500">{data.instrumentCount.toLocaleString()} instruments</span>
                }
              />

              {/* Spot Price */}
              <MetricCard
                icon={<DollarSign className="w-4 h-4 text-neutral-400" />}
                label={`${currency} Spot`}
                value={formatPrice(liveSpot || data.underlyingPrice)}
                flash={spotFlash}
                sub={
                  <span className="text-xs text-neutral-500">Live spot price</span>
                }
              />
            </div>

            {/* ─── Exchange filter tabs ─── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveExchange('all')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border whitespace-nowrap ${
                  activeExchange === 'all'
                    ? 'bg-hub-yellow text-black font-bold border-hub-yellow shadow-glow-sm'
                    : 'bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/[0.06] border-white/[0.06]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                All Exchanges
              </button>
              {exchangeNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveExchange(name)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border whitespace-nowrap ${
                    activeExchange === name
                      ? 'bg-hub-yellow text-black font-bold border-hub-yellow shadow-glow-sm'
                      : 'bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/[0.06] border-white/[0.06]'
                  }`}
                >
                  <ExchangeLogo exchange={name.toLowerCase()} size={14} />
                  {name}
                </button>
              ))}
            </div>

            {/* ─── Call / Put Split ─── */}
            <Section>
              <SectionHeader
                icon={<ArrowLeftRight className="w-4 h-4 text-purple-400" />}
                title={`Call / Put Open Interest${activeExchange !== 'all' ? ` — ${activeExchange}` : ''}`}
                right={<span className="text-xs text-neutral-500 font-mono">Total: ${formatCompact(filteredOI.totalOI)}</span>}
              />

              <div className="flex items-center gap-6">
                {/* Donut */}
                {(() => {
                  const total = filteredOI.totalOI || 1;
                  const callPct = (filteredOI.callOI / total) * 100;
                  const r = 44;
                  const c = 2 * Math.PI * r;
                  const callDash = (callPct / 100) * c;

                  return (
                    <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0" role="img" aria-label="Put/Call ratio donut chart">
                      <circle cx="60" cy="60" r={r} fill="none" stroke="#ef4444" strokeWidth="14" opacity="0.5" />
                      <circle
                        cx="60" cy="60" r={r} fill="none"
                        stroke="#22c55e" strokeWidth="14"
                        strokeDasharray={`${callDash} ${c - callDash}`}
                        strokeDashoffset={c / 4}
                        strokeLinecap="round"
                        opacity="0.75"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
                      />
                      <text x="60" y="56" textAnchor="middle" fontSize="17" fontWeight="bold" fill="white" fontFamily="monospace">
                        {(data.putCallRatio || 0).toFixed(2)}
                      </text>
                      <text x="60" y="72" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">
                        P/C Ratio
                      </text>
                    </svg>
                  );
                })()}

                {/* Bar + labels */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-green-500/70" />
                      <span className="text-green-400 font-medium">Calls</span>
                      <span className="text-white font-mono font-semibold">${formatCompact(filteredOI.callOI)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono font-semibold">${formatCompact(filteredOI.putOI)}</span>
                      <span className="text-red-400 font-medium">Puts</span>
                      <div className="w-3 h-3 rounded bg-red-500/70" />
                    </div>
                  </div>

                  <div className="h-6 rounded-lg overflow-hidden flex bg-white/[0.04]">
                    <div
                      className="h-full bg-gradient-to-r from-green-500/80 to-green-500/60 transition-all duration-500"
                      style={{ width: `${filteredOI.totalOI ? (filteredOI.callOI / filteredOI.totalOI) * 100 : 50}%` }}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-red-500/60 to-red-500/80 transition-all duration-500"
                      style={{ width: `${filteredOI.totalOI ? (filteredOI.putOI / filteredOI.totalOI) * 100 : 50}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-neutral-500 mt-2 font-mono">
                    <span>{filteredOI.totalOI ? ((filteredOI.callOI / filteredOI.totalOI) * 100).toFixed(1) : '50.0'}%</span>
                    <span className="text-neutral-600 italic font-sans text-[11px]">
                      {data.putCallRatio > 1.2
                        ? 'Heavy hedging — contrarian bullish signal'
                        : data.putCallRatio < 0.6
                        ? 'Call speculation — contrarian caution'
                        : data.putCallRatio < 0.85
                        ? 'Moderately bullish'
                        : 'Balanced positioning'}
                    </span>
                    <span>{filteredOI.totalOI ? ((filteredOI.putOI / filteredOI.totalOI) * 100).toFixed(1) : '50.0'}%</span>
                  </div>
                </div>
              </div>
            </Section>

            {/* ─── OI by Strike ─── */}
            <Section>
              <SectionHeader
                icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
                title={`Open Interest by Strike${activeExchange !== 'all' ? ` — ${activeExchange}` : ''}`}
                subtitle="Hover bars for details"
              />
              <div className="h-[340px]">
                <OIByStrikeChart
                  strikes={filteredStrikes}
                  spotPrice={data.underlyingPrice}
                  maxPain={data.expiryBreakdown?.[0]?.maxPain || data.maxPain}
                />
              </div>
              <Legend items={[
                { color: '#22c55e', label: 'Calls' },
                { color: '#ef4444', label: 'Puts' },
                { color: '#eab308', label: 'Spot Price', type: 'line' },
                { color: '#f97316', label: 'Max Pain', type: 'line' },
              ]} />
            </Section>

            {/* ─── OI by Expiry + Exchange Breakdown ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* OI by Expiry */}
              {data.expiryBreakdown && data.expiryBreakdown.length > 0 && (
                <Section>
                  <SectionHeader
                    icon={<Calendar className="w-4 h-4 text-purple-400" />}
                    title="OI by Expiry"
                    subtitle={`${data.expiryBreakdown.length} upcoming expiries`}
                  />
                  <div className="h-[220px]">
                    <OIByExpiryChart entries={data.expiryBreakdown.slice(0, 12)} />
                  </div>
                  <Legend items={[
                    { color: '#22c55e', label: 'Calls' },
                    { color: '#ef4444', label: 'Puts' },
                  ]} />
                </Section>
              )}

              {/* Exchange Breakdown */}
              {data.exchangeBreakdown && data.exchangeBreakdown.filter(e => e.totalOI > 0).length > 1 && (
                <Section>
                  <SectionHeader
                    icon={<Globe className="w-4 h-4 text-hub-yellow" />}
                    title="OI by Exchange"
                    subtitle="Click to filter charts"
                  />
                  <div className="space-y-2.5">
                    {data.exchangeBreakdown.filter(e => e.totalOI > 0).map((ex) => {
                      const total = ex.totalOI || 1;
                      const callPct = (ex.callOI / total) * 100;
                      const isActive = activeExchange === ex.exchange;
                      return (
                        <button
                          key={ex.exchange}
                          className={`w-full text-left rounded-xl px-4 py-3 transition-all border ${
                            isActive
                              ? 'bg-hub-yellow/[0.08] border-hub-yellow/25 shadow-glow-sm'
                              : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]'
                          }`}
                          onClick={() => setActiveExchange(ex.exchange === activeExchange ? 'all' : ex.exchange)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ExchangeLogo exchange={ex.exchange.toLowerCase()} size={18} />
                              <span className="text-sm font-semibold text-white">{ex.exchange}</span>
                              <span className="text-[10px] text-neutral-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md font-mono">
                                {ex.share.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-white font-mono">${formatCompact(ex.totalOI)}</span>
                              <ChevronRight className={`w-3.5 h-3.5 text-neutral-600 transition-transform ${isActive ? 'rotate-90 text-hub-yellow' : ''}`} />
                            </div>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden flex bg-white/[0.04]">
                            <div className="h-full bg-green-500/60 transition-all" style={{ width: `${callPct}%` }} />
                            <div className="h-full bg-red-500/60 transition-all" style={{ width: `${100 - callPct}%` }} />
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-[10px] text-neutral-500">
                            <span>{ex.instruments} instruments</span>
                            <span className="font-mono">C:{callPct.toFixed(0)}% / P:{(100 - callPct).toFixed(0)}%</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>

            {/* ─── IV Smile ─── */}
            {data.ivSmile.length > 2 && (
              <Section>
                <SectionHeader
                  icon={<Activity className="w-4 h-4 text-purple-400" />}
                  title="Implied Volatility Smile"
                  subtitle="Mark IV across strike prices (70-130% of spot)"
                />
                <div className="h-[220px]">
                  <IVSmileChart points={data.ivSmile} spotPrice={data.underlyingPrice} />
                </div>
                <Legend items={[
                  { color: '#eab308', label: 'Implied Volatility', type: 'line' },
                ]} />
              </Section>
            )}

            {/* ─── Max Pain by Expiry Table ─── */}
            {data.expiryBreakdown && data.expiryBreakdown.length > 0 && (
              <Section>
                <SectionHeader
                  icon={<Crosshair className="w-4 h-4 text-orange-400" />}
                  title="Max Pain by Expiry"
                  subtitle={`Spot: ${formatPrice(liveSpot || data.underlyingPrice)}`}
                  right={
                    <div className="flex items-center gap-1.5 text-[11px] text-orange-400/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      Near expiry (&le;3d)
                    </div>
                  }
                />

                {/* Table header */}
                <div className="grid grid-cols-[1fr_2fr_1fr_1fr_80px] gap-3 px-4 py-2 text-[10px] text-neutral-500 uppercase tracking-wider font-semibold border-b border-white/[0.04]">
                  <span>Expiry</span>
                  <span>Call / Put Distribution</span>
                  <span className="text-right">Total OI</span>
                  <span className="text-right">Max Pain</span>
                  <span className="text-right">vs Spot</span>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {data.expiryBreakdown.slice(0, 15).map((exp) => {
                    const total = exp.totalOI || 1;
                    const callPct = (exp.callOI / total) * 100;
                    const expDate = new Date(exp.expiry);
                    const daysUntil = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / 86400000));
                    const isNear = daysUntil <= 3;
                    const tableSpot = liveSpot || data.underlyingPrice;
                    const mpDist = tableSpot > 0 && exp.maxPain
                      ? ((exp.maxPain - tableSpot) / tableSpot * 100)
                      : 0;

                    return (
                      <div
                        key={exp.date}
                        className={`grid grid-cols-[1fr_2fr_1fr_1fr_80px] gap-3 items-center px-4 py-2.5 border-b border-white/[0.02] transition-colors hover:bg-white/[0.02] ${
                          isNear ? 'bg-orange-500/[0.03]' : ''
                        }`}
                      >
                        <div>
                          <p className={`text-xs font-mono font-semibold ${isNear ? 'text-orange-400' : 'text-white'}`}>
                            {exp.date.slice(5)}
                          </p>
                          <p className="text-[10px] text-neutral-600">
                            {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? '1 day' : `${daysUntil} days`}
                          </p>
                        </div>

                        <div>
                          <div className="h-3 rounded-full overflow-hidden flex bg-white/[0.04]">
                            <div className="h-full bg-green-500/50 transition-all" style={{ width: `${callPct}%` }} />
                            <div className="h-full bg-red-500/50 transition-all" style={{ width: `${100 - callPct}%` }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-green-400/60 font-mono">C: {callPct.toFixed(0)}%</span>
                            <span className="text-[10px] text-red-400/60 font-mono">P: {(100 - callPct).toFixed(0)}%</span>
                          </div>
                        </div>

                        <p className="text-xs font-mono text-neutral-300 text-right">${formatCompact(exp.totalOI)}</p>

                        <p className="text-xs font-mono text-orange-400 font-semibold text-right">
                          ${exp.maxPain ? exp.maxPain.toLocaleString() : '—'}
                        </p>

                        <span className={`delta-badge text-[9px] ${mpDist >= 0 ? 'delta-badge-up' : 'delta-badge-down'}`}>
                          {mpDist >= 0 ? '+' : ''}{mpDist.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* ─── Data Sources ─── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-2">
              {data.health && data.health.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                    <Shield className="w-3 h-3" />
                    <span className="font-medium">Data Sources</span>
                  </div>
                  {data.health.map((h) => (
                    <div key={h.exchange} className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${h.status === 'ok' && h.count > 0 ? 'bg-green-500' : 'bg-red-500/60'}`} />
                      <ExchangeLogo exchange={h.exchange.toLowerCase()} size={12} />
                      <span className="text-[11px] text-neutral-500">{h.exchange}</span>
                      {h.count > 0 && (
                        <span className="text-[10px] text-neutral-600 font-mono">{h.latency}ms</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Info footer */}
            <div className="bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs text-neutral-400">
                <span className="text-hub-yellow font-medium">Options</span> aggregates real-time options data from Deribit, OKX, and Bybit. OI is summed across all exchanges. Prices update every 60s.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-neutral-500 leading-relaxed">
                <div><span className="text-neutral-400 font-medium">Max Pain</span> — strike price that minimizes total option holder profit at expiry</div>
                <div><span className="text-neutral-400 font-medium">Put/Call Ratio</span> — total put OI / total call OI. Below 0.7 = bullish, above 1.2 = bearish hedging</div>
                <div><span className="text-neutral-400 font-medium">IV Smile</span> — mark implied volatility across strikes (call ≈ put by put-call parity)</div>
                <div><span className="text-neutral-400 font-medium">OI by Strike</span> — open interest distribution across strike prices (70-130% of spot)</div>
              </div>
              <div className="text-[10px] text-neutral-500">
                <span className="text-neutral-400 font-medium">Sources:</span>{' '}
                Deribit (~90% of market), OKX, Bybit · Currencies: BTC, ETH, SOL · Refreshes every 60s
              </div>
            </div>
          </div>
        )}
      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}
