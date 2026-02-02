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

  // Icon only (iH badge)
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

      {/* Background rounded square */}
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="20"
        fill={colors.primary}
        filter={animated ? 'url(#logo-shadow)' : undefined}
      />

      {/* Letter "i" */}
      <text
        x="28"
        y="68"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="52"
        fontWeight="800"
        fill={colors.secondary}
        fontStyle="italic"
      >
        i
      </text>

      {/* Letter "H" */}
      <text
        x="48"
        y="68"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="52"
        fontWeight="800"
        fill={colors.secondary}
      >
        H
      </text>
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
