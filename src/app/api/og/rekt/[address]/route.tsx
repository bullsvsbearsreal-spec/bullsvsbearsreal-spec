/**
 * GET /api/og/rekt/[address]
 *
 * 1200×630 rekt card for social share.
 */
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

interface ProfileResponse {
  address: string;
  totalNotional: number;
  count: number;
  topPercent: number;
  rank: number | null;
  score: number;
  rarestAsset: string | null;
  liquidatedOnOct10?: boolean;
  firstLiquidation?: { timestamp: number; asset: string; notional: number } | null;
  assets: Array<{ asset: string; totalLiquidationNotional: number; totalLiquidationCount?: number }>;
}

function short(a: string): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtCount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(ts: number): string {
  try { return new Date(ts).toISOString().slice(0, 10); }
  catch { return '—'; }
}

function tierLabel(score: number): string {
  if (score >= 900) return 'APEX GAMBLER';
  if (score >= 800) return 'SERIAL LIQUIDATEE';
  if (score >= 600) return 'FREQUENT FLYER';
  if (score >= 400) return 'TAKING DAMAGE';
  if (score >= 200) return 'SLIGHTLY SINGED';
  if (score > 0)    return 'BARELY REKT';
  return 'CLEAN RECORD';
}

function tierColor(score: number): string {
  if (score >= 800) return '#ff4757';
  if (score >= 600) return '#ff9500';
  if (score >= 400) return '#ffcb2e';
  if (score >= 200) return '#a0a0a0';
  return '#22c55e';
}

async function fetchProfile(address: string): Promise<ProfileResponse | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';
    const res = await fetch(`${base}/api/bounce/profile/${address}`, {
      signal: AbortSignal.timeout(6000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ProfileResponse;
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } },
) {
  const address = (params.address || '').toLowerCase();
  const profile = await fetchProfile(address);

  const score = Math.max(0, Math.min(1000, profile?.score ?? 0));
  const rank = profile?.rank ?? null;
  const totalNotional = profile?.totalNotional ?? 0;
  const count = profile?.count ?? 0;
  const topPctRaw = profile?.topPercent ?? 0;
  const topPct = topPctRaw > 0 ? (topPctRaw <= 1 ? topPctRaw * 100 : topPctRaw) : 0;
  const tier = tierLabel(score);
  const color = tierColor(score);
  const topAssets = (profile?.assets ?? []).slice(0, 3);
  const oct10 = profile?.liquidatedOnOct10 === true;
  const firstTs = profile?.firstLiquidation?.timestamp;
  const scorePct = (score / 1000) * 100;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          // Layered backgrounds: deep base + tier-tinted radial glow from top-right
          backgroundColor: '#0b0d12',
          backgroundImage: `radial-gradient(circle at 85% 0%, ${color}33 0%, ${color}11 22%, transparent 55%), radial-gradient(circle at 0% 100%, ${color}1a 0%, transparent 45%)`,
          padding: '56px 60px',
          color: '#fff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Top-left tier accent bar (full-bleed left edge) */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 0,
            left: 0,
            width: 6,
            height: '100%',
            background: color,
          }}
        />

        {/* ─── Header ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#ff4757',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                  color: '#0b0d12',
                }}
              >
                B
              </div>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#ff4757', letterSpacing: -0.5 }}>bounce.tech</div>
            </div>
            <div style={{ display: 'flex', fontSize: 14, color: '#7a8190', marginTop: 6, marginLeft: 42, letterSpacing: 0.3 }}>
              Liquidation profile · powered by InfoHub
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                padding: '10px 18px',
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: 1.2,
                borderRadius: 999,
                background: `${color}22`,
                color: color,
                border: `1.5px solid ${color}88`,
              }}
            >
              {tier}
            </div>
            {oct10 ? (
              <div
                style={{
                  display: 'flex',
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1,
                  borderRadius: 6,
                  background: '#ff475722',
                  color: '#ff4757',
                  border: '1px solid #ff475766',
                }}
              >
                💀 OCT 10 SURVIVOR
              </div>
            ) : null}
          </div>
        </div>

        {/* ─── Hero row: Score gauge (left) + Stats column (right) ─── */}
        <div style={{ display: 'flex', flex: 1, marginTop: 36, gap: 56, alignItems: 'flex-start' }}>
          {/* Score block (left) */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1.2 }}>
            <div style={{ display: 'flex', fontSize: 13, color: '#7a8190', letterSpacing: 2, fontWeight: 600 }}>
              LIQUIDATION SCORE
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 6 }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 188,
                  fontWeight: 900,
                  color: color,
                  lineHeight: 0.9,
                  letterSpacing: -6,
                  // Subtle glow via duplicated text-shadow on Satori-supported syntax
                  textShadow: `0 0 24px ${color}55`,
                }}
              >
                {score}
              </div>
              <div style={{ display: 'flex', fontSize: 36, color: '#4a5060', marginLeft: 14, fontWeight: 600 }}>/ 1000</div>
            </div>

            {/* Score gauge bar */}
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: 12,
                  background: '#1a1d27',
                  borderRadius: 999,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    width: `${scorePct}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, #22c55e 0%, #ffcb2e 35%, #ff9500 70%, #ff4757 100%)`,
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#4a5060', fontWeight: 600 }}>
                <div style={{ display: 'flex' }}>0</div>
                <div style={{ display: 'flex' }}>250</div>
                <div style={{ display: 'flex' }}>500</div>
                <div style={{ display: 'flex' }}>750</div>
                <div style={{ display: 'flex' }}>1000</div>
              </div>
            </div>
          </div>

          {/* Stats column (right) */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14 }}>
            <StatCard label="TOTAL REKT" value={fmtUsd(totalNotional)} valueColor="#ff4757" accent={color} />
            <StatCard label="EVENTS" value={fmtCount(count)} valueColor="#ffffff" accent={color} />
            <StatCard
              label="RANK"
              value={rank ? `#${rank.toLocaleString()}` : '—'}
              valueColor="#ffcb2e"
              accent={color}
              subtext={topPct > 0 ? `top ${topPct < 0.01 ? topPct.toFixed(4) : topPct.toFixed(2)}%` : undefined}
            />
          </div>
        </div>

        {/* ─── Top assets chips row ─── */}
        {topAssets.length > 0 ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', fontSize: 12, color: '#4a5060', letterSpacing: 1.5, fontWeight: 700, alignItems: 'center', marginRight: 4 }}>
              REKT MOST ON
            </div>
            {topAssets.map((a, i) => (
              <div
                key={a.asset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: i === 0 ? `${color}1f` : '#16191f',
                  border: `1px solid ${i === 0 ? `${color}55` : '#272a35'}`,
                  fontSize: 14,
                  fontWeight: 700,
                  color: i === 0 ? color : '#cbd0db',
                }}
              >
                <div style={{ display: 'flex' }}>{a.asset}</div>
                <div style={{ display: 'flex', fontSize: 12, color: i === 0 ? `${color}cc` : '#6b7280', fontWeight: 600 }}>
                  {fmtUsd(a.totalLiquidationNotional)}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* ─── Footer ─── */}
        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            paddingTop: 22,
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #1a1d27',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: 0.5 }}>
              {short(address)}
            </div>
            {firstTs ? (
              <div style={{ display: 'flex', fontSize: 13, color: '#4a5060', marginTop: 4 }}>
                first rekt · {fmtDate(firstTs)}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', width: 6, height: 6, borderRadius: '50%', background: '#ffcb2e' }} />
            <div style={{ display: 'flex', fontSize: 16, color: '#ffcb2e', fontWeight: 800, letterSpacing: 0.5 }}>
              info-hub.io/bounce
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

// ─── Small stat-card helper component ──────────────────────────────────────
function StatCard({
  label,
  value,
  valueColor,
  accent,
  subtext,
}: {
  label: string;
  value: string;
  valueColor: string;
  accent: string;
  subtext?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 18px',
        background: '#11141b',
        border: `1px solid ${accent}22`,
        borderLeft: `3px solid ${accent}aa`,
        borderRadius: 10,
      }}
    >
      <div style={{ display: 'flex', fontSize: 11, color: '#7a8190', letterSpacing: 1.8, fontWeight: 700 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 900, color: valueColor, letterSpacing: -1 }}>{value}</div>
        {subtext ? (
          <div style={{ display: 'flex', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{subtext}</div>
        ) : null}
      </div>
    </div>
  );
}
