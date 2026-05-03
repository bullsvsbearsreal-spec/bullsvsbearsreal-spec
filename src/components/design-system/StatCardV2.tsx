// v4 StatCardV2 — icon + label/value/sub
import type { ReactNode } from 'react';

interface StatCardV2Props { icon?: ReactNode; label: string; value: ReactNode; valueColor?: string; sub?: ReactNode; className?: string; }

export default function StatCardV2({ icon, label, value, valueColor, sub, className }: StatCardV2Props) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--hub-darker)',
        border: '1px solid var(--hub-border)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
        transition: 'border-color 180ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--hub-border-hover)';
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 0 0 1px rgb(var(--hub-accent-rgb) / 0.06), 0 6px 20px rgba(0,0,0,0.35)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--hub-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {icon && (
        <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hub-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)' }}>{icon}</div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 700, color: valueColor || 'var(--fg-default)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>{sub}</div>}
      </div>
    </div>
  );
}
