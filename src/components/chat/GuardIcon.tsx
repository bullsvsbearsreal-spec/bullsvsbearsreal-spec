'use client';

/** MK.II robot avatar — uses the robot PFP image with fallback to styled text */
export default function GuardIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/chat/mk2.png"
      alt="MK.II"
      className={`rounded-full object-cover ${className}`}
      onError={(e) => {
        // Fallback: hide image and show parent's background
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
