/**
 * Shared OG-image building blocks. All InfoHub opengraph-image.tsx
 * files import from here so they share brand chrome (gradient meshes,
 * brand mark, chip style, footer line) and only need to declare what's
 * unique to their page.
 *
 * Each export below is a JSX node, not a component — next/og has
 * limits on what it can render. Using bare JSX expressions keeps it
 * Edge-runtime friendly.
 *
 * Standard size for every OG image: 1200x630, system fonts.
 */

import React from 'react';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

/** Background gradient meshes — pure absolute-positioned divs. */
export function ogMesh({ accent = 'emerald' }: { accent?: 'emerald' | 'amber' | 'sky' | 'rose' } = {}) {
  const colors = {
    emerald: 'rgba(16,185,129,0.16)',
    amber: 'rgba(245,166,35,0.14)',
    sky: 'rgba(56,189,248,0.14)',
    rose: 'rgba(244,63,94,0.14)',
  };
  return (
    <>
      <div
        style={{
          position: 'absolute', top: -250, right: -200,
          width: 850, height: 850, borderRadius: '50%',
          background: `radial-gradient(circle, ${colors[accent]} 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute', bottom: -300, left: -150,
          width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,166,35,0.10) 0%, transparent 70%)',
        }}
      />
    </>
  );
}

/** Brand mark — diamond logo + InfoHub text. */
export function ogBrandMark({ subtitle }: { subtitle?: string } = {}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 1 }}>
      <div
        style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 900, color: '#0a0a0a',
        }}
      >
        ◆
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: '#fff' }}>
          InfoHub
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: '#a3a3a3', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

/** Chip pill — coloured rounded label. */
export function ogChip({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        padding: '7px 14px',
        borderRadius: 999,
        background: `${color}1A`,
        border: `1px solid ${color}40`,
        color,
        fontSize: 15,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {label}
    </div>
  );
}

/** Standard page-frame wrapper — everything goes inside this. */
export function ogFrame({ children, accent }: { children: React.ReactNode; accent?: 'emerald' | 'amber' | 'sky' | 'rose' }) {
  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        padding: 60,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
        position: 'relative',
      }}
    >
      {ogMesh({ accent })}
      {children}
    </div>
  );
}
