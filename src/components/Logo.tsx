'use client';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
}

export default function Logo({ variant = 'full', size = 'md', className = '', animated = false }: LogoProps) {
  const sizeMap = {
    xs: { icon: 22, text: 'text-sm', gap: 'gap-1.5' },
    sm: { icon: 28, text: 'text-base', gap: 'gap-2' },
    md: { icon: 34, text: 'text-lg', gap: 'gap-2' },
    lg: { icon: 44, text: 'text-2xl', gap: 'gap-2.5' },
    xl: { icon: 56, text: 'text-3xl', gap: 'gap-3' },
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
          <stop stopColor="#FFD700" />
          <stop offset="1" stopColor="#FF8C00" />
        </linearGradient>
      </defs>
      {/* Squircle bg */}
      <rect x="2.5" y="2.5" width="35" height="35" rx="8" fill={`url(#${uid})`} />
      {/* Hub network mark */}
      {/* Hub ring */}
      <circle cx="20" cy="22" r="6.1" stroke="#000" strokeWidth="2.2" fill="none" opacity={0.85} />
      {/* Hub core */}
      <circle cx="20" cy="22" r="1.7" fill="#000" opacity={0.85} />
      {/* Top spoke */}
      <rect x="19.1" y="10.5" width="1.8" height="6.8" rx="0.9" fill="#000" opacity={0.85} />
      {/* Bottom spoke */}
      <rect x="19.1" y="26.8" width="1.8" height="5" rx="0.9" fill="#000" opacity={0.85} />
      {/* Left spoke */}
      <rect x="8.5" y="21.1" width="5.5" height="1.8" rx="0.9" fill="#000" opacity={0.85} />
      {/* Right spoke */}
      <rect x="26" y="21.1" width="5.5" height="1.8" rx="0.9" fill="#000" opacity={0.85} />
      {/* i-dot (information node) */}
      <circle cx="20" cy="9.2" r="2.2" fill="#000" opacity={0.85} />
      {/* Endpoint nodes */}
      <circle cx="8.2" cy="22" r="1.1" fill="#000" opacity={0.6} />
      <circle cx="31.8" cy="22" r="1.1" fill="#000" opacity={0.6} />
      <circle cx="20" cy="31.5" r="1.1" fill="#000" opacity={0.6} />
    </svg>
  );

  if (variant === 'icon') {
    return <div className={className}><IconSVG /></div>;
  }

  return (
    <div className={`flex items-center ${dimensions.gap} ${className}`}>
      <IconSVG />
      <span className={`font-bold tracking-tight ${dimensions.text}`}>
        <span className="text-white">info</span>
        <span className="text-hub-yellow">hub</span>
      </span>
    </div>
  );
}
