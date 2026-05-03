// Shared shimmer skeleton for loading states.
interface SkeletonProps { width?: number | string; height?: number; className?: string; }

export default function Skeleton({ width = 80, height = 16, className }: SkeletonProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius: 4,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s linear infinite',
      }}
      aria-hidden="true"
    />
  );
}
