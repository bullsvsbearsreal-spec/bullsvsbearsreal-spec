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
      {/* Circuit traces */}
      <g stroke="#1A1A2E" strokeLinecap="round" fill="none" opacity="0.55">
        <polyline points="100,155 60,155 60,80 90,80" strokeWidth="3.5" />
        <polyline points="100,155 65,155 65,115 40,115" strokeWidth="3" />
        <line x1="90" y1="80" x2="90" y2="48" strokeWidth="3" />
        <polyline points="150,85 150,50 120,50" strokeWidth="3" />
        <polyline points="150,85 185,85 185,50" strokeWidth="2.5" />
        <polyline points="200,155 235,155 235,105 210,105" strokeWidth="3.5" />
        <polyline points="200,155 240,155 240,130 260,130" strokeWidth="3" />
        <line x1="210" y1="105" x2="210" y2="65" strokeWidth="3" />
        <line x1="100" y1="220" x2="55" y2="220" strokeWidth="3" />
        <polyline points="100,385 60,385 60,430 85,430" strokeWidth="3.5" />
        <polyline points="100,385 65,385 65,440 45,440" strokeWidth="3" />
        <line x1="85" y1="430" x2="85" y2="462" strokeWidth="3" />
        <polyline points="200,385 235,385 235,430 210,430" strokeWidth="3.5" />
        <line x1="210" y1="430" x2="210" y2="465" strokeWidth="3" />
        <polyline points="150,385 150,435 120,435" strokeWidth="3" />
        <polyline points="280,155 280,105 310,105 310,65" strokeWidth="3.5" />
        <polyline points="280,155 280,115 255,115 255,75" strokeWidth="3" />
        <polyline points="400,155 440,155 440,95 465,95" strokeWidth="3.5" />
        <polyline points="400,155 435,155 435,120 460,120" strokeWidth="3" />
        <line x1="465" y1="95" x2="465" y2="55" strokeWidth="3" />
        <polyline points="400,270 450,270 450,235 475,235" strokeWidth="3" />
        <polyline points="280,385 280,435 310,435" strokeWidth="3.5" />
        <polyline points="280,385 255,385 255,430 240,430" strokeWidth="3" />
        <line x1="310" y1="435" x2="310" y2="462" strokeWidth="3" />
        <polyline points="400,385 440,385 440,440 465,440" strokeWidth="3.5" />
        <polyline points="400,385 435,385 435,430 460,430" strokeWidth="3" />
        <line x1="465" y1="440" x2="465" y2="468" strokeWidth="3" />
      </g>
      {/* Circuit nodes */}
      <g fill="#1A1A2E" opacity="0.5">
        <circle cx="90" cy="48" r="4" /><circle cx="40" cy="115" r="4" />
        <circle cx="120" cy="50" r="3.5" /><circle cx="185" cy="50" r="3.5" />
        <circle cx="210" cy="65" r="3.5" /><circle cx="260" cy="130" r="3.5" />
        <circle cx="55" cy="220" r="3" />
        <circle cx="85" cy="462" r="4" /><circle cx="45" cy="440" r="4" />
        <circle cx="210" cy="465" r="3.5" /><circle cx="120" cy="435" r="3.5" />
        <circle cx="310" cy="65" r="4" /><circle cx="255" cy="75" r="3.5" />
        <circle cx="465" cy="55" r="4" /><circle cx="460" cy="120" r="3.5" />
        <circle cx="475" cy="235" r="3.5" />
        <circle cx="310" cy="462" r="4" /><circle cx="240" cy="430" r="3.5" />
        <circle cx="465" cy="468" r="4" /><circle cx="460" cy="430" r="3.5" />
      </g>
      {/* I letter */}
      <line x1="100" y1="155" x2="200" y2="155" stroke="#1A1A2E" strokeWidth="18" strokeLinecap="round" />
      <line x1="150" y1="155" x2="150" y2="385" stroke="#1A1A2E" strokeWidth="18" strokeLinecap="round" />
      <line x1="100" y1="385" x2="200" y2="385" stroke="#1A1A2E" strokeWidth="18" strokeLinecap="round" />
      {/* I-dot: square pad */}
      <rect x="130" y="65" width="40" height="40" rx="6" fill="#1A1A2E" />
      {/* I nodes */}
      <circle cx="100" cy="155" r="12" fill="#1A1A2E" />
      <circle cx="200" cy="155" r="12" fill="#1A1A2E" />
      <circle cx="100" cy="385" r="12" fill="#1A1A2E" />
      <circle cx="200" cy="385" r="12" fill="#1A1A2E" />
      {/* H letter */}
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
