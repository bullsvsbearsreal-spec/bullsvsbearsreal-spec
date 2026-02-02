'use client';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
}

export default function Logo({ variant = 'full', size = 'md', className = '', animated = false }: LogoProps) {
  const sizeMap = {
    xs: { icon: 24, text: 'text-sm', gap: 'gap-1.5' },
    sm: { icon: 32, text: 'text-base', gap: 'gap-2' },
    md: { icon: 40, text: 'text-xl', gap: 'gap-2.5' },
    lg: { icon: 48, text: 'text-2xl', gap: 'gap-3' },
    xl: { icon: 64, text: 'text-3xl', gap: 'gap-3' },
  };

  const dimensions = sizeMap[size];
  const gradientId = `logo-grad-${Math.random().toString(36).substr(2, 9)}`;

  const IconSVG = () => (
    <svg
      width={dimensions.icon}
      height={dimensions.icon}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${animated ? 'hover:scale-110 transition-transform duration-300' : ''}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFDF00"/>
          <stop offset="50%" stopColor="#FFAA00"/>
          <stop offset="100%" stopColor="#FF7700"/>
        </linearGradient>
        <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#FF9500" floodOpacity="0.35"/>
        </filter>
      </defs>

      {/* Background */}
      <rect
        x="32"
        y="32"
        width="448"
        height="448"
        rx="88"
        fill={`url(#${gradientId})`}
        filter={animated ? `url(#${gradientId}-shadow)` : undefined}
      />

      {/* Highlight */}
      <rect x="72" y="56" width="368" height="6" rx="3" fill="white" opacity="0.25"/>

      {/* Letter i */}
      <circle cx="160" cy="140" r="32" fill="#000" opacity="0.9"/>
      <rect x="128" y="196" width="64" height="188" rx="12" fill="#000" opacity="0.9"/>

      {/* Letter H */}
      <rect x="232" y="128" width="64" height="256" rx="12" fill="#000" opacity="0.9"/>
      <rect x="360" y="128" width="64" height="256" rx="12" fill="#000" opacity="0.9"/>
      <rect x="232" y="224" width="192" height="64" rx="12" fill="#000" opacity="0.9"/>
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={className}>
        <IconSVG />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${dimensions.gap} ${animated ? 'group' : ''} ${className}`}>
      <IconSVG />
      <span className={`font-extrabold tracking-tight ${dimensions.text}`}>
        <span className={`text-white ${animated ? 'group-hover:text-gray-100 transition-colors' : ''}`}>Info</span>
        <span className="bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">Hub</span>
      </span>
    </div>
  );
}
