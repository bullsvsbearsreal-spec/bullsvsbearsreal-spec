'use client';

/** Custom Guard shield logo — a shield with "G" monogram */
export default function GuardIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Shield shape */}
      <path
        d="M12 2L3 6.5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V6.5L12 2Z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* G letter */}
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fontFamily="inherit"
        fontWeight="700"
        fontSize="10"
        fill="currentColor"
      >
        G
      </text>
    </svg>
  );
}
