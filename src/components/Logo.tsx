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
      {/* Rounded square bg */}
      <rect width="40" height="40" rx="10" fill={`url(#${uid})`} />
      {/* iH monogram - crisp geometric */}
      {/* dot of i */}
      <circle cx="12.5" cy="11" r="2.5" fill="#000" />
      {/* stem of i */}
      <rect x="10" y="16" width="5" height="15" rx="1.5" fill="#000" />
      {/* H left */}
      <rect x="19" y="9" width="5" height="22" rx="1.5" fill="#000" />
      {/* H right */}
      <rect x="28" y="9" width="5" height="22" rx="1.5" fill="#000" />
      {/* H cross */}
      <rect x="19" y="17.5" width="14" height="5" rx="1.5" fill="#000" />
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
