interface StatusBadgeProps {
  status: 'ok' | 'error' | 'empty' | 'healthy' | 'degraded' | 'down';
  label?: string;
}

const styleMap: Record<string, { bg: string; text: string; border: string }> = {
  ok:       { bg: 'rgb(var(--admin-accent-rgb) / 0.1)',  text: 'var(--admin-accent)', border: 'rgb(var(--admin-accent-rgb) / 0.2)' },
  healthy:  { bg: 'rgb(var(--admin-accent-rgb) / 0.1)',  text: 'var(--admin-accent)', border: 'rgb(var(--admin-accent-rgb) / 0.2)' },
  error:    { bg: 'rgba(239, 68, 68, 0.1)',  text: '#f87171', border: 'rgba(239, 68, 68, 0.2)' },
  down:     { bg: 'rgba(239, 68, 68, 0.1)',  text: '#f87171', border: 'rgba(239, 68, 68, 0.2)' },
  empty:    { bg: 'rgba(245, 158, 11, 0.1)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.2)' },
  degraded: { bg: 'rgba(245, 158, 11, 0.1)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.2)' },
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const s = styleMap[status] || styleMap.empty;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {label || status}
    </span>
  );
}
