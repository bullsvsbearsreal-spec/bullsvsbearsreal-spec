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
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE066" />
          <stop offset="0.25" stopColor="#FFD700" />
          <stop offset="0.5" stopColor="var(--hub-accent)" />
          <stop offset="0.75" stopColor="var(--hub-accent-dark)" />
          <stop offset="1" stopColor="#E67300" />
        </linearGradient>
        <linearGradient id={`${uid}-hi`} x1="20" y1="2" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF0AA" stopOpacity="0.5" />
          <stop offset="0.3" stopColor="#FFD700" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-letter`} x1="8" y1="10" x2="32" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A1000" />
          <stop offset="0.5" stopColor="#0D0800" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
      </defs>
      {/* Gold squircle bg */}
      <rect x="2" y="2" width="36" height="36" rx="8" fill={`url(#${uid}-gold)`} />
      {/* Top highlight */}
      <rect x="2" y="2" width="36" height="36" rx="8" fill={`url(#${uid}-hi)`} />
      {/* Border */}
      <rect x="2.5" y="2.5" width="35" height="35" rx="7.5" stroke="#FFE680" strokeWidth="0.15" strokeOpacity={0.4} fill="none" />
      {/* I with serifs */}
      <rect x="9.5" y="11" width="4.3" height="18" rx="0.5" fill={`url(#${uid}-letter)`} opacity={0.92} />
      <rect x="8.2" y="11" width="6.8" height="1.1" rx="0.3" fill={`url(#${uid}-letter)`} opacity={0.92} />
      <rect x="8.2" y="27.8" width="6.8" height="1.1" rx="0.3" fill={`url(#${uid}-letter)`} opacity={0.92} />
      {/* H */}
      <rect x="18" y="11" width="4" height="18" rx="0.5" fill={`url(#${uid}-letter)`} opacity={0.92} />
      <rect x="26.5" y="11" width="4" height="18" rx="0.5" fill={`url(#${uid}-letter)`} opacity={0.92} />
      <rect x="18" y="18" width="12.5" height="4" rx="0.5" fill={`url(#${uid}-letter)`} opacity={0.92} />
      {/* Underline */}
      <rect x="8.2" y="31" width="22.3" height="0.6" rx="0.3" fill={`url(#${uid}-letter)`} opacity={0.35} />
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
