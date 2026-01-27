'use client';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function Logo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  const sizes = {
    sm: { full: 'h-8', icon: 'h-8 w-8' },
    md: { full: 'h-10', icon: 'h-10 w-10' },
    lg: { full: 'h-12', icon: 'h-12 w-12' },
    xl: { full: 'h-16', icon: 'h-16 w-16' },
  };

  if (variant === 'icon') {
    return (
      <div className={`${sizes[size].icon} ${className}`}>
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="iconYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFD700"/>
              <stop offset="50%" stopColor="#FFA500"/>
              <stop offset="100%" stopColor="#FF8C00"/>
            </linearGradient>
            <filter id="iconGlow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <rect x="2" y="2" width="60" height="60" rx="12" fill="#000000" stroke="#333333" strokeWidth="1"/>
          <rect x="8" y="8" width="48" height="48" rx="8" fill="url(#iconYellowGrad)" filter="url(#iconGlow)"/>
          <text x="14" y="46" fontFamily="Arial Black, Arial, sans-serif" fontSize="34" fontWeight="900" fill="#000000" letterSpacing="-2">iH</text>
          <circle cx="52" cy="16" r="3" fill="#000000" opacity="0.6"/>
          <circle cx="52" cy="26" r="2" fill="#000000" opacity="0.4"/>
          <circle cx="52" cy="34" r="2.5" fill="#000000" opacity="0.5"/>
        </svg>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={sizes[size].icon}>
        <defs>
          <linearGradient id="iconYellowGradFull" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700"/>
            <stop offset="50%" stopColor="#FFA500"/>
            <stop offset="100%" stopColor="#FF8C00"/>
          </linearGradient>
          <filter id="iconGlowFull">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#000000" stroke="#333333" strokeWidth="1"/>
        <rect x="8" y="8" width="48" height="48" rx="8" fill="url(#iconYellowGradFull)" filter="url(#iconGlowFull)"/>
        <text x="14" y="46" fontFamily="Arial Black, Arial, sans-serif" fontSize="34" fontWeight="900" fill="#000000" letterSpacing="-2">iH</text>
        <circle cx="52" cy="16" r="3" fill="#000000" opacity="0.6"/>
        <circle cx="52" cy="26" r="2" fill="#000000" opacity="0.4"/>
        <circle cx="52" cy="34" r="2.5" fill="#000000" opacity="0.5"/>
      </svg>
      <span className={`font-black tracking-tight ${size === 'sm' ? 'text-xl' : size === 'md' ? 'text-2xl' : size === 'lg' ? 'text-3xl' : 'text-4xl'}`}>
        <span className="text-white">Info</span>
        <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">Hub</span>
      </span>
    </div>
  );
}