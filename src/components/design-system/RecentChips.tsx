'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ChipItem { href: string; label: string; prefix?: string; }
interface RecentChipsProps { recent: ChipItem[]; pinned: ChipItem[]; onClose?: () => void; className?: string; }

export default function RecentChips({ recent, pinned, onClose, className }: RecentChipsProps) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '8px 18px', borderBottom: '1px solid var(--hub-border-subtle)', background: 'var(--hub-black)', flexShrink: 0, overflowX: 'auto' }}>
      <ChipGroup label="Recent" iconClock items={recent} />
      <div style={{ width: 1, height: 18, background: 'var(--hub-border-subtle)', flexShrink: 0 }} />
      <ChipGroup label="Pinned" iconStar items={pinned} />
      <div style={{ flex: 1 }} />
      {onClose && <button onClick={onClose} aria-label="Dismiss" style={{ background: 'transparent', border: 'none', color: 'var(--fg-subtle)', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>×</button>}
    </div>
  );
}

function ChipGroup({ label, iconClock, iconStar, items }: { label: string; iconClock?: boolean; iconStar?: boolean; items: ChipItem[]; }) {
  const pathname = usePathname();
  if (!items?.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {iconClock && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
        {iconStar && <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {items.map(it => {
          const on = pathname === it.href;
          return (
            <Link key={it.href} href={it.href} style={{ padding: '4px 10px', borderRadius: 999, background: on ? 'var(--hub-secondary-medium)' : 'var(--hub-darker)', border: '1px solid', borderColor: on ? 'var(--hub-border-hover)' : 'var(--hub-border)', color: on ? 'var(--fg-default)' : 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 100ms', textDecoration: 'none' }}>
              {it.prefix && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--hub-accent)', letterSpacing: '0.04em' }}>{it.prefix}</span>}
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
