'use client';

import React from 'react';

interface LogoProps {
  variant?: 'full' | 'icon' | 'wordmark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  theme?: 'gradient' | 'light' | 'dark' | 'mono';
  className?: string;
  animated?: boolean;
}

const sizeMap = {
  xs: { icon: 24, text: 14, height: 24, badgePx: 4, badgePy: 1, badgeRx: 3 },
  sm: { icon: 32, text: 18, height: 32, badgePx: 5, badgePy: 2, badgeRx: 4 },
  md: { icon: 40, text: 22, height: 40, badgePx: 6, badgePy: 3, badgeRx: 5 },
  lg: { icon: 48, text: 28, height: 48, badgePx: 8, badgePy: 3, badgeRx: 6 },
  xl: { icon: 64, text: 36, height: 64, badgePx: 10, badgePy: 4, badgeRx: 7 },
  '2xl': { icon: 80, text: 44, height: 80, badgePx: 12, badgePy: 5, badgeRx: 8 },
};

export default function Logo({
  variant = 'full',
  size = 'md',
  theme = 'gradient',
  className = '',
  animated = false,
}: LogoProps) {
  const dimensions = sizeMap[size];
  const gradientId = `logo-gradient-${Math.random().toString(36).substr(2, 9)}`;

  const getColors = () => {
    switch (theme) {
      case 'gradient':
        return {
          primary: `url(#${gradientId})`,
          secondary: '#000000',
          text: 'white',
          badge: 'linear-gradient(135deg, #FFD700, #FFA500, #FF7700)',
          badgeText: '#000000',
        };
      case 'light':
        return {
          primary: '#FFA500',
          secondary: '#000000',
          text: '#FFA500',
          badge: '#FFA500',
          badgeText: '#000000',
        };
      case 'dark':
        return {
          primary: '#1A1A1A',
          secondary: '#FFA500',
          text: 'white',
          badge: '#FFA500',
          badgeText: '#000000',
        };
      case 'mono':
        return {
          primary: '#FFFFFF',
          secondary: '#000000',
          text: 'white',
          badge: '#FFFFFF',
          badgeText: '#000000',
        };
      default:
        return {
          primary: `url(#${gradientId})`,
          secondary: '#000000',
          text: 'white',
          badge: 'linear-gradient(135deg, #FFD700, #FFA500, #FF7700)',
          badgeText: '#000000',
        };
    }
  };

  const colors = getColors();

  // Icon only — bold IH on gradient squircle
  const IconLogo = () => (
    <svg
      width={dimensions.icon}
      height={dimensions.icon}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={animated ? 'hover:scale-105 transition-transform duration-300' : ''}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="40%" stopColor="#FFA500" />
          <stop offset="100%" stopColor="#FF7700" />
        </linearGradient>
        <filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#FFA500" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Squircle background */}
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="20"
        fill={colors.primary}
        filter={animated ? 'url(#logo-shadow)' : undefined}
      />

      {/* Bold geometric IH */}
      {/* I letter */}
      <rect x="25" y="28" width="10.5" height="44" rx="1.5" fill={colors.secondary} opacity={0.9} />

      {/* H letter */}
      <rect x="43" y="28" width="10.5" height="44" rx="1.5" fill={colors.secondary} opacity={0.9} />
      <rect x="64.5" y="28" width="10.5" height="44" rx="1.5" fill={colors.secondary} opacity={0.9} />
      <rect x="43" y="44.5" width="32" height="10.5" rx="1.5" fill={colors.secondary} opacity={0.9} />
    </svg>
  );

  // PH-style split wordmark: "Info" in white + "Hub" in black on gold badge
  const WordmarkLogo = () => (
    <div className={`flex items-center ${animated ? 'group' : ''}`}>
      <span
        className={`font-black tracking-tight ${animated ? 'group-hover:opacity-80 transition-opacity' : ''}`}
        style={{ fontSize: dimensions.text, color: colors.text, lineHeight: 1 }}
      >
        Info
      </span>
      <span
        className="font-black tracking-tight ml-[2px]"
        style={{
          fontSize: dimensions.text,
          lineHeight: 1,
          color: colors.badgeText,
          background: colors.badge,
          padding: `${dimensions.badgePy}px ${dimensions.badgePx}px`,
          borderRadius: dimensions.badgeRx,
        }}
      >
        Hub
      </span>
    </div>
  );

  // Full logo (icon + split wordmark)
  const FullLogo = () => (
    <div className={`flex items-center gap-3 ${animated ? 'group' : ''}`}>
      <IconLogo />
      <WordmarkLogo />
    </div>
  );

  return (
    <div className={className}>
      {variant === 'icon' && <IconLogo />}
      {variant === 'wordmark' && <WordmarkLogo />}
      {variant === 'full' && <FullLogo />}
    </div>
  );
}

// Export individual components for flexibility
export function LogoIcon(props: Omit<LogoProps, 'variant'>) {
  return <Logo {...props} variant="icon" />;
}

export function LogoWordmark(props: Omit<LogoProps, 'variant'>) {
  return <Logo {...props} variant="wordmark" />;
}

export function LogoFull(props: Omit<LogoProps, 'variant'>) {
  return <Logo {...props} variant="full" />;
}
