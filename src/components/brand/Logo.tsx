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
  xs: { icon: 24, text: 14, height: 24 },
  sm: { icon: 32, text: 18, height: 32 },
  md: { icon: 40, text: 22, height: 40 },
  lg: { icon: 48, text: 28, height: 48 },
  xl: { icon: 64, text: 36, height: 64 },
  '2xl': { icon: 80, text: 44, height: 80 },
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
        return { primary: `url(#${gradientId})`, secondary: '#000000', text: 'white' };
      case 'light':
        return { primary: '#FFA500', secondary: '#000000', text: '#FFA500' };
      case 'dark':
        return { primary: '#1A1A1A', secondary: '#FFA500', text: 'white' };
      case 'mono':
        return { primary: '#FFFFFF', secondary: '#000000', text: 'white' };
      default:
        return { primary: `url(#${gradientId})`, secondary: '#000000', text: 'white' };
    }
  };

  const colors = getColors();

  // Icon only (hub network mark)
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
          <stop offset="50%" stopColor="#FFA500" />
          <stop offset="100%" stopColor="#FF8C00" />
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

      {/* Hub network mark */}
      {/* Hub ring */}
      <circle cx="50" cy="55" r="15.3" stroke={colors.secondary} strokeWidth="5.5" fill="none" opacity={0.85} />
      {/* Hub core */}
      <circle cx="50" cy="55" r="4.3" fill={colors.secondary} opacity={0.85} />
      {/* Top spoke */}
      <rect x="47.7" y="26" width="4.6" height="17" rx="2.3" fill={colors.secondary} opacity={0.85} />
      {/* Bottom spoke */}
      <rect x="47.7" y="67" width="4.6" height="12.5" rx="2.3" fill={colors.secondary} opacity={0.85} />
      {/* Left spoke */}
      <rect x="21" y="52.7" width="13.7" height="4.6" rx="2.3" fill={colors.secondary} opacity={0.85} />
      {/* Right spoke */}
      <rect x="65.3" y="52.7" width="13.7" height="4.6" rx="2.3" fill={colors.secondary} opacity={0.85} />
      {/* i-dot (information node) */}
      <circle cx="50" cy="23" r="5.5" fill={colors.secondary} opacity={0.85} />
      {/* Endpoint nodes */}
      <circle cx="20.5" cy="55" r="2.7" fill={colors.secondary} opacity={0.6} />
      <circle cx="79.5" cy="55" r="2.7" fill={colors.secondary} opacity={0.6} />
      <circle cx="50" cy="79.5" r="2.7" fill={colors.secondary} opacity={0.6} />
    </svg>
  );

  // Wordmark only (InfoHub text)
  const WordmarkLogo = () => (
    <div className={`flex items-center ${animated ? 'group' : ''}`}>
      <span
        className={`font-bold tracking-tight ${animated ? 'group-hover:text-hub-yellow transition-colors' : ''}`}
        style={{ fontSize: dimensions.text, color: colors.text }}
      >
        Info
      </span>
      <span
        className="font-bold tracking-tight"
        style={{
          fontSize: dimensions.text,
          background: theme === 'gradient' ? 'linear-gradient(135deg, #FFD700, #FFA500, #FF8C00)' : undefined,
          color: theme === 'gradient' ? 'transparent' : '#FFA500',
          WebkitBackgroundClip: theme === 'gradient' ? 'text' : undefined,
          backgroundClip: theme === 'gradient' ? 'text' : undefined,
        }}
      >
        Hub
      </span>
    </div>
  );

  // Full logo (icon + wordmark)
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
