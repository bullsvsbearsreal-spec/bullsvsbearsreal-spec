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
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${animated ? 'hover:scale-105 transition-transform duration-200' : ''}`}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB800" />
          <stop offset="0.5" stopColor="#FF8C00" />
          <stop offset="1" stopColor="#E06600" />
        </linearGradient>
      </defs>
      {/* Orange gradient bg */}
      <rect x="16" y="16" width="480" height="480" rx="80" fill={`url(#${uid}-bg)`} />
      {/* I traces */}
      <line x1="100" y1="155" x2="200" y2="155" stroke="#1A1A2E" strokeWidth="18" strokeLinecap="round" />
      <line x1="150" y1="155" x2="150" y2="385" stroke="#1A1A2E" strokeWidth="18" strokeLinecap="round" />
      <line x1="100" y1="385" x2="200" y2="385" stroke="#1A1A2E" strokeWidth="18" strokeLinecap="round" />
      {/* I-dot */}
      <circle cx="150" cy="85" r="22" fill="#1A1A2E" />
      {/* I nodes */}
      <circle cx="100" cy="155" r="12" fill="#1A1A2E" />
      <circle cx="200" cy="155" r="12" fill="#1A1A2E" />
      <circle cx="100" cy="385" r="12" fill="#1A1A2E" />
      <circle cx="200" cy="385" r="12" fill="#1A1A2E" />
      {/* H traces */}
      <line x1="280" y1="155" x2="280" y2="385" stroke="#1A1A2E" strokeWidth="18" strokeLinecap="round" />
      <line x1="400" y1="155" x2="400" y2="385" stroke="#1A1A2E" strokeWidth="18" strokeLinecap="round" />
      <line x1="280" y1="270" x2="400" y2="270" stroke="#1A1A2E" strokeWidth="18" strokeLinecap="round" />
      {/* H nodes */}
      <circle cx="280" cy="155" r="12" fill="#1A1A2E" />
      <circle cx="280" cy="270" r="12" fill="#1A1A2E" />
      <circle cx="280" cy="385" r="12" fill="#1A1A2E" />
      <circle cx="400" cy="155" r="12" fill="#1A1A2E" />
      <circle cx="400" cy="270" r="12" fill="#1A1A2E" />
      <circle cx="400" cy="385" r="12" fill="#1A1A2E" />
    </svg>
  );

  if (variant === 'icon') {
    return <div className={className}><IconSVG /></div>;
  }

  // Split wordmark: "Info" white + "Hub" orange
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
