'use client';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
}

export default function Logo({ variant = 'full', size = 'md', className = '', animated = false }: LogoProps) {
  const sizeMap = {
    sm: { icon: 32, text: 'text-lg', gap: 'gap-2' },
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
      className={animated ? 'hover:scale-105 transition-transform duration-300' : ''}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE55C"/>
          <stop offset="30%" stopColor="#FFD700"/>
          <stop offset="70%" stopColor="#FFA500"/>
          <stop offset="100%" stopColor="#FF8C00"/>
        </linearGradient>
        <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect
        x="24"
        y="24"
        width="464"
        height="464"
        rx="96"
        fill={`url(#${gradientId})`}
        filter={animated ? `url(#${gradientId}-glow)` : undefined}
      />

      {/* Highlight */}
      <rect x="48" y="48" width="416" height="8" rx="4" fill="white" opacity="0.25"/>

      {/* Letter "i" */}
      <circle cx="168" cy="148" r="28" fill="#000000"/>
      <rect x="140" y="200" width="56" height="180" rx="8" fill="#000000"/>

      {/* Letter "H" */}
      <rect x="248" y="132" width="56" height="248" rx="8" fill="#000000"/>
      <rect x="376" y="132" width="56" height="248" rx="8" fill="#000000"/>
      <rect x="248" y="228" width="184" height="56" rx="8" fill="#000000"/>
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
        <span className={`text-white ${animated ? 'group-hover:text-gray-200 transition-colors' : ''}`}>Info</span>
        <span className="bg-gradient-to-r from-yellow-300 via-orange-400 to-orange-500 bg-clip-text text-transparent">Hub</span>
      </span>
    </div>
  );
}
