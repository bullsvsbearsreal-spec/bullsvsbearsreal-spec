'use client';

import React from 'react';
import Image from 'next/image';

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
  className = '',
  animated = false,
}: LogoProps) {
  const dimensions = sizeMap[size];

  // Icon only — uses the exact PNG logo
  const IconLogo = () => (
    <Image
      src="/icon-512.png"
      alt="InfoHub"
      width={dimensions.icon}
      height={dimensions.icon}
      className={`flex-shrink-0 ${animated ? 'hover:scale-105 transition-transform duration-300' : ''}`}
    />
  );

  // Wordmark: "Info" in white + "Hub" in black on gold badge
  const WordmarkLogo = () => (
    <div className={`flex items-center ${animated ? 'group' : ''}`}>
      <span
        className={`font-black tracking-tight text-white ${animated ? 'group-hover:opacity-80 transition-opacity' : ''}`}
        style={{ fontSize: dimensions.text, lineHeight: 1 }}
      >
        Info
      </span>
      <span
        className="font-black tracking-tight text-black ml-[2px]"
        style={{
          fontSize: dimensions.text,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #FFB800, #FF8C00, #E06600)',
          padding: `${dimensions.badgePy}px ${dimensions.badgePx}px`,
          borderRadius: dimensions.badgeRx,
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
