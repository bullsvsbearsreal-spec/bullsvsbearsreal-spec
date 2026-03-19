'use client';

import Image from 'next/image';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
}

export default function Logo({ variant = 'full', size = 'md', className = '', animated = false }: LogoProps) {
  const sizeMap = {
    xs: { icon: 22, text: 12, hub: 12, gap: 1, badge: { px: 3, py: 1, rx: 3 } },
    sm: { icon: 28, text: 14, hub: 14, gap: 1, badge: { px: 4, py: 2, rx: 4 } },
    md: { icon: 34, text: 17, hub: 17, gap: 2, badge: { px: 5, py: 2.5, rx: 5 } },
    lg: { icon: 44, text: 22, hub: 22, gap: 2, badge: { px: 6, py: 3, rx: 6 } },
    xl: { icon: 56, text: 28, hub: 28, gap: 3, badge: { px: 8, py: 4, rx: 7 } },
  };

  const d = sizeMap[size];

  if (variant === 'icon') {
    return (
      <div className={className}>
        <Image
          src="/icon-512.png"
          alt="InfoHub"
          width={d.icon}
          height={d.icon}
          className={`flex-shrink-0 ${animated ? 'hover:scale-105 transition-transform duration-200' : ''}`}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className} ${animated ? 'hover:scale-[1.02] transition-transform duration-200' : ''}`}>
      <span
        className="font-black tracking-tight"
        style={{
          fontSize: d.text,
          lineHeight: 1,
          color: '#ffffff',
          letterSpacing: '-0.02em',
        }}
      >
        info
      </span>
      <span
        className="font-black tracking-tight"
        style={{
          fontSize: d.hub,
          lineHeight: 1,
          marginLeft: d.gap,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #FFD700, #FFA500, #FF8C00)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        hub
      </span>
    </div>
  );
}
