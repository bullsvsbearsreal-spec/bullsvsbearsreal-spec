import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') || 'Real-Time Derivatives Data';
  const description = searchParams.get('desc') || 'Funding Rates · Open Interest · Liquidations · 24+ Exchanges';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Orange accent bar at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #f59e0b, #f97316, #f59e0b)',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <span
            style={{
              fontSize: '64px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-2px',
            }}
          >
            Info
          </span>
          <span
            style={{
              fontSize: '64px',
              fontWeight: 800,
              color: '#f59e0b',
              letterSpacing: '-2px',
            }}
          >
            Hub
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '40px',
            fontWeight: 700,
            color: '#e5e5e5',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.2,
            marginBottom: '16px',
          }}
        >
          {title}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '22px',
            color: '#a3a3a3',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>

        {/* Data visualization accent */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginTop: '40px',
            alignItems: 'flex-end',
          }}
        >
          {[40, 65, 50, 80, 55, 90, 70, 45, 75, 60, 85, 50, 70, 55, 80].map(
            (h, i) => (
              <div
                key={i}
                style={{
                  width: '12px',
                  height: `${h}px`,
                  borderRadius: '3px',
                  background:
                    h > 70
                      ? 'linear-gradient(180deg, #22c55e, #16a34a)'
                      : h < 50
                        ? 'linear-gradient(180deg, #ef4444, #dc2626)'
                        : 'linear-gradient(180deg, #f59e0b, #d97706)',
                  opacity: 0.8,
                }}
              />
            )
          )}
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            fontSize: '18px',
            color: '#737373',
            letterSpacing: '1px',
          }}
        >
          info-hub.io
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
