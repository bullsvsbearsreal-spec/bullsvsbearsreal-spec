'use client';

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
  const uid = `lg-${size}`;

  const IconSVG = () => (
    <svg
      width={dimensions.icon}
      height={dimensions.icon}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${animated ? 'hover:scale-105 transition-transform duration-200' : ''}`}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--hub-accent-light)" />
          <stop offset="0.4" stopColor="var(--hub-accent)" />
          <stop offset="1" stopColor="var(--hub-accent-dark)" />
        </linearGradient>
        <linearGradient id={`${uid}-hi`} x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE680" />
          <stop offset="0.2" stopColor="var(--hub-accent-light)" />
          <stop offset="0.5" stopColor="var(--hub-accent)" />
          <stop offset="0.8" stopColor="var(--hub-accent-dark)" />
          <stop offset="1" stopColor="#CC5500" />
        </linearGradient>
        <linearGradient id={`${uid}-bg`} x1="20" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#151515" />
          <stop offset="1" stopColor="#0A0A0A" />
        </linearGradient>
        <filter id={`${uid}-glow`}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
        </filter>
      </defs>
      {/* Dark background */}
      <rect x="1" y="1" width="38" height="38" rx="4" fill={`url(#${uid}-bg)`} />
      <rect x="1.5" y="1.5" width="37" height="37" rx="3.5" stroke="var(--hub-accent-dark)" strokeWidth="0.3" strokeOpacity={0.25} fill="none" />
      {/* Subtle gold glow behind letters */}
      <path
        d="M6 9.5 L13 9.5 L13 10.2 L11.2 10.8 L11.2 28.2 L13 28.8 L13 29.5 L6 29.5 L6 28.8 L7.8 28.2 L7.8 10.8 L6 10.2 Z"
        fill="var(--hub-accent)" opacity={0.12} filter={`url(#${uid}-glow)`}
      />
      <path
        d="M15.5 9.5 L21.5 9.5 L21.5 10.2 L20 10.8 L20 18.8 L29.5 18.8 L29.5 10.8 L28 10.2 L28 9.5 L34 9.5 L34 10.2 L32.5 10.8 L32.5 28.2 L34 28.8 L34 29.5 L28 29.5 L28 28.8 L29.5 28.2 L29.5 20.5 L20 20.5 L20 28.2 L21.5 28.8 L21.5 29.5 L15.5 29.5 L15.5 28.8 L17 28.2 L17 10.8 L15.5 10.2 Z"
        fill="var(--hub-accent)" opacity={0.12} filter={`url(#${uid}-glow)`}
      />
      {/* Serif I — elegant */}
      <path
        d="M6 9.5 L13 9.5 L13 10.2 L11.2 10.8 L11.2 28.2 L13 28.8 L13 29.5 L6 29.5 L6 28.8 L7.8 28.2 L7.8 10.8 L6 10.2 Z"
        fill={`url(#${uid}-hi)`}
      />
      {/* Serif H */}
      <path
        d="M15.5 9.5 L21.5 9.5 L21.5 10.2 L20 10.8 L20 18.8 L29.5 18.8 L29.5 10.8 L28 10.2 L28 9.5 L34 9.5 L34 10.2 L32.5 10.8 L32.5 28.2 L34 28.8 L34 29.5 L28 29.5 L28 28.8 L29.5 28.2 L29.5 20.5 L20 20.5 L20 28.2 L21.5 28.8 L21.5 29.5 L15.5 29.5 L15.5 28.8 L17 28.2 L17 10.8 L15.5 10.2 Z"
        fill={`url(#${uid}-hi)`}
      />
      {/* Signature underline */}
      <rect x="5" y="32" width="30" height="0.7" rx="0.35" fill={`url(#${uid}-hi)`} opacity={0.6} />
    </svg>
  );

  if (variant === 'icon') {
    return <div className={className}><IconSVG /></div>;
  }

  // Split wordmark: "Info" white + "Hub" black on accent badge
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
          background: 'linear-gradient(135deg, var(--hub-accent-light), var(--hub-accent), var(--hub-accent-dark))',
          padding: `${dimensions.badge.py}px ${dimensions.badge.px}px`,
          borderRadius: dimensions.badge.rx,
        }}
      >
        Hub
      </span>
    </div>
  );
}
