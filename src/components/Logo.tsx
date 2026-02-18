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
        <linearGradient id={`${uid}-g`} x1="40" y1="80" x2="480" y2="440" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--hub-accent-light, #FFD700)" />
          <stop offset="0.45" stopColor="var(--hub-accent, #FFA500)" />
          <stop offset="1" stopColor="var(--hub-accent-dark, #E67300)" />
        </linearGradient>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop stopColor="#101820" />
          <stop offset="0.6" stopColor="#0C1219" />
          <stop offset="1" stopColor="#080E14" />
        </linearGradient>
      </defs>
      {/* Dark navy bg */}
      <rect x="16" y="16" width="480" height="480" rx="92" fill={`url(#${uid}-bg)`} />
      <rect x="18" y="18" width="476" height="476" rx="90" fill="none" stroke="var(--hub-accent-dark, #D4922A)" strokeWidth="1.2" strokeOpacity={0.1} />
      {/* I traces */}
      <line x1="106" y1="142" x2="206" y2="142" stroke={`url(#${uid}-g)`} strokeWidth="15" strokeLinecap="round" />
      <line x1="155" y1="142" x2="155" y2="382" stroke={`url(#${uid}-g)`} strokeWidth="15" strokeLinecap="round" />
      <line x1="106" y1="382" x2="206" y2="382" stroke={`url(#${uid}-g)`} strokeWidth="15" strokeLinecap="round" />
      {/* I nodes */}
      <circle cx="106" cy="142" r="12" fill={`url(#${uid}-g)`} />
      <circle cx="206" cy="142" r="11" fill={`url(#${uid}-g)`} />
      <circle cx="106" cy="382" r="11" fill={`url(#${uid}-g)`} />
      <circle cx="206" cy="382" r="12" fill={`url(#${uid}-g)`} />
      {/* I dot */}
      <circle cx="155" cy="90" r="18" fill={`url(#${uid}-g)`} />
      <circle cx="155" cy="90" r="10" fill={`url(#${uid}-bg)`} />
      {/* H traces */}
      <line x1="282" y1="142" x2="282" y2="382" stroke={`url(#${uid}-g)`} strokeWidth="15" strokeLinecap="round" />
      <line x1="408" y1="142" x2="408" y2="382" stroke={`url(#${uid}-g)`} strokeWidth="15" strokeLinecap="round" />
      <line x1="282" y1="262" x2="408" y2="262" stroke={`url(#${uid}-g)`} strokeWidth="15" strokeLinecap="round" />
      {/* H nodes */}
      <circle cx="282" cy="142" r="11" fill={`url(#${uid}-g)`} />
      <circle cx="282" cy="262" r="12" fill={`url(#${uid}-g)`} />
      <circle cx="282" cy="382" r="11" fill={`url(#${uid}-g)`} />
      <circle cx="408" cy="142" r="12" fill={`url(#${uid}-g)`} />
      <circle cx="408" cy="262" r="11" fill={`url(#${uid}-g)`} />
      <circle cx="408" cy="382" r="12" fill={`url(#${uid}-g)`} />
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
