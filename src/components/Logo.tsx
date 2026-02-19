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
    xs: { icon: 22, text: 11, badge: { h: 16, px: 3, py: 1, rx: 3 } },
    sm: { icon: 28, text: 13, badge: { h: 20, px: 4, py: 2, rx: 4 } },
    md: { icon: 34, text: 15, badge: { h: 24, px: 5, py: 3, rx: 5 } },
    lg: { icon: 44, text: 20, badge: { h: 30, px: 6, py: 3, rx: 6 } },
    xl: { icon: 56, text: 26, badge: { h: 38, px: 8, py: 4, rx: 7 } },
  };

  const dimensions = sizeMap[size];

  if (variant === 'icon') {
    return (
      <div className={className}>
        <Image
          src="/icon-512.png"
          alt="InfoHub"
          width={dimensions.icon}
          height={dimensions.icon}
          className={`flex-shrink-0 ${animated ? 'hover:scale-105 transition-transform duration-200' : ''}`}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className} ${animated ? 'hover:scale-[1.02] transition-transform duration-200' : ''}`}>
      <span
        className="font-black tracking-tight text-white"
        style={{ fontSize: dimensions.text, lineHeight: 1 }}
      >
        Info
      </span>
      <span
        className="font-black tracking-tight text-black rounded-[4px] ml-[1px]"
        style={{
          fontSize: dimensions.text,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #FFB800, #FF8C00, #E06600)',
          padding: `${dimensions.badge.py}px ${dimensions.badge.px}px`,
          borderRadius: dimensions.badge.rx,
        }}
      >
        Hub
      </span>
    </div>
  );
}
