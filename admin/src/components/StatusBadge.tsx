interface StatusBadgeProps {
  status: 'ok' | 'error' | 'empty' | 'healthy' | 'degraded' | 'down';
  label?: string;
}

const styles: Record<string, string> = {
  ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  down: 'bg-red-500/10 text-red-400 border-red-500/20',
  empty: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  degraded: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider border ${styles[status] || styles.empty}`}>
      {label || status}
    </span>
  );
}
