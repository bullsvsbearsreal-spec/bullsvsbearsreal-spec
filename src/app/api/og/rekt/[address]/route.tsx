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
  assets: Array<{ asset: string; totalLiquidationNotional: number }>;
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

  const score = profile?.score ?? 0;
  const rank = profile?.rank ?? null;
  const totalNotional = profile?.totalNotional ?? 0;
  const count = profile?.count ?? 0;
  const topPct = profile?.topPercent ? profile.topPercent * 100 : 0;
  const tier = tierLabel(score);
  const color = tierColor(score);
  const topAsset = profile?.assets?.[0]?.asset ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#0f1117',
          padding: '60px',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 800, color: '#ff4757' }}>bounce.tech</div>
            <div style={{ display: 'flex', fontSize: 14, color: '#888', marginTop: 4 }}>Rekt profile · via InfoHub</div>
          </div>
          <div
            style={{
              display: 'flex',
              padding: '10px 16px',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1,
              borderRadius: 8,
              background: `${color}26`,
              color: color,
              border: `2px solid ${color}66`,
            }}
          >
            {tier}
          </div>
        </div>

        {/* Score — the hero */}
        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 40 }}>
          <div style={{ display: 'flex', fontSize: 240, fontWeight: 900, color: color, lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ display: 'flex', fontSize: 32, color: '#666', marginLeft: 16 }}>/ 1000</div>
        </div>
        <div style={{ display: 'flex', fontSize: 20, color: '#888', marginTop: 8 }}>
          liquidation score
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, marginTop: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 14, color: '#888' }}>TOTAL REKT</div>
            <div style={{ display: 'flex', fontSize: 42, fontWeight: 800, color: '#ff4757', marginTop: 4 }}>
              {fmtUsd(totalNotional)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 14, color: '#888' }}>EVENTS</div>
            <div style={{ display: 'flex', fontSize: 42, fontWeight: 800, color: '#fff', marginTop: 4 }}>
              {count.toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 14, color: '#888' }}>RANK</div>
            <div style={{ display: 'flex', fontSize: 42, fontWeight: 800, color: '#ffcb2e', marginTop: 4 }}>
              {rank ? `#${rank.toLocaleString()}` : '—'}
            </div>
            {topPct > 0 ? (
              <div style={{ display: 'flex', fontSize: 13, color: '#666' }}>
                top {topPct < 0.01 ? topPct.toFixed(4) : topPct.toFixed(2)}%
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', marginTop: 'auto', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: '#fff' }}>
              {short(address)}
            </div>
            {topAsset ? (
              <div style={{ display: 'flex', fontSize: 14, color: '#666', marginTop: 4 }}>
                rekt most on {topAsset}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', fontSize: 16, color: '#ffcb2e', fontWeight: 700 }}>
            info-hub.io/bounce
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
