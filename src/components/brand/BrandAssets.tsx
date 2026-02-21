'use client';

import React from 'react';

// ============================================
// BRAND COLOR PALETTE
// ============================================
export const brandColors = {
  // Primary Colors
  primary: {
    yellow: '#FFA500',
    orange: '#FF8C00',
    gold: '#FFD700',
  },
  // Gradient Definitions
  gradients: {
    primary: 'linear-gradient(135deg, #FFB800 0%, #FF8C00 50%, #E06600 100%)',
    secondary: 'linear-gradient(135deg, #FFA500 0%, #FF6B00 100%)',
    dark: 'linear-gradient(180deg, #1A1A1A 0%, #0D0D0D 100%)',
    glow: 'radial-gradient(circle, rgba(255,165,0,0.3) 0%, transparent 70%)',
  },
  // Background Colors
  background: {
    primary: '#0D0D0D',
    secondary: '#1A1A1A',
    tertiary: '#2A2A2A',
    card: '#1E1E1E',
  },
  // Text Colors
  text: {
    primary: '#FFFFFF',
    secondary: '#B3B3B3',
    muted: '#808080',
    accent: '#FFA500',
  },
  // Semantic Colors
  semantic: {
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
};

// ============================================
// STATIC ASSET PATHS (PNG-based)
// ============================================
export const logoAssets = {
  favicon: '/favicon.png',
  icon192: '/icon-192.png',
  icon512: '/icon-512.png',
  appleTouchIcon: '/apple-touch-icon.png',
  logoFull: '/infohub-logo.png',
};

// ============================================
// BRAND TYPOGRAPHY
// ============================================
export const typography = {
  fontFamily: {
    primary: 'Inter, system-ui, -apple-system, sans-serif',
    mono: 'JetBrains Mono, Menlo, Monaco, monospace',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },
};

// ============================================
// BRAND SPACING & SIZING
// ============================================
export const spacing = {
  borderRadius: {
    sm: '0.375rem',   // 6px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    '2xl': '1.25rem', // 20px
    full: '9999px',
  },
  iconSizes: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 48,
  },
};

// ============================================
// SOCIAL MEDIA DIMENSIONS
// ============================================
export const socialDimensions = {
  // Twitter/X
  twitterHeader: { width: 1500, height: 500 },
  twitterProfile: { width: 400, height: 400 },
  twitterPost: { width: 1200, height: 675 },

  // LinkedIn
  linkedinBanner: { width: 1584, height: 396 },
  linkedinProfile: { width: 400, height: 400 },
  linkedinPost: { width: 1200, height: 627 },

  // Discord
  discordServer: { width: 512, height: 512 },
  discordBanner: { width: 960, height: 540 },

  // General
  ogImage: { width: 1200, height: 630 },
  favicon: { width: 32, height: 32 },
  appleTouchIcon: { width: 180, height: 180 },
};

// ============================================
// COMPONENT: Logo Preview Grid
// ============================================
interface LogoPreviewProps {
  src: string;
  title: string;
  size?: number;
  bgColor?: string;
}

export function LogoPreview({ src, title, size = 100, bgColor = '#1A1A1A' }: LogoPreviewProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-xl flex items-center justify-center p-4"
        style={{ backgroundColor: bgColor, width: size + 32, height: size + 32 }}
      >
        <img src={src} alt={title} style={{ width: size, height: size, objectFit: 'contain' }} />
      </div>
      <span className="text-xs text-hub-gray-text">{title}</span>
    </div>
  );
}

// ============================================
// COMPONENT: Color Swatch
// ============================================
interface ColorSwatchProps {
  color: string;
  name: string;
  hex: string;
}

export function ColorSwatch({ color, name, hex }: ColorSwatchProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-12 h-12 rounded-lg border border-white/10"
        style={{ backgroundColor: color }}
      />
      <div>
        <p className="text-white text-sm font-medium">{name}</p>
        <p className="text-hub-gray-text text-xs font-mono">{hex}</p>
      </div>
    </div>
  );
}
