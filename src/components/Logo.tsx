'use client';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
}

export default function Logo({ variant = 'full', size = 'md', className = '', animated = false }: LogoProps) {
  const sizeMap = {
    sm: { icon: 32, text: 'text-lg' },
    md: { icon: 40, text: 'text-xl' },
    lg: { icon: 48, text: 'text-2xl' },
    xl: { icon: 64, text: 'text-3xl' },
  };

  const dimensions = sizeMap[size];
  const gradientId = `logo-gradient-${Math.random().toString(36).substr(2, 9)}`;

  const IconSVG = () => (
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
        <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
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
        fill={`url(#${gradientId})`}
        filter={animated ? `url(#${gradientId}-shadow)` : undefined}
      />

      {/* Letter "i" - italic */}
      <text
        x="28"
        y="68"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="52"
        fontWeight="800"
        fill="#000000"
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
        fill="#000000"
      >
        H
      </text>
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
    <div className={`flex items-center gap-2.5 ${animated ? 'group' : ''} ${className}`}>
      <IconSVG />
      <span className={`font-extrabold tracking-tight ${dimensions.text}`}>
        <span className={`text-white ${animated ? 'group-hover:text-gray-200 transition-colors' : ''}`}>Info</span>
        <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">Hub</span>
      </span>
    </div>
  );
}
