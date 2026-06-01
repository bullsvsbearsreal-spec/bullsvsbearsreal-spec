'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, TrendingUp } from 'lucide-react';

interface ChipItem { href: string; label: string; prefix?: string; }
interface RecentChipsProps { recent: ChipItem[]; pinned: ChipItem[]; className?: string; }

export default function RecentChips({ recent, pinned, className }: RecentChipsProps) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '8px 18px', borderBottom: '1px solid var(--hub-border-subtle)', background: 'var(--hub-black)', flexShrink: 0, overflowX: 'auto' }}>
      {/* Labeled "Popular" not "Recent" — the `recent` items passed by
          TerminalShell are a curated static list of high-traffic routes,
          not the user's actual visit history. "Recent" implied
          auto-tracking that doesn't happen. */}
      <ChipGroup label="Popular" iconClock items={recent} />
      <div style={{ width: 1, height: 18, background: 'var(--hub-border-subtle)', flexShrink: 0 }} />
      <ChipGroup label="Shortcuts" iconStar items={pinned} />
    </div>
  );
}

function ChipGroup({ label, iconClock, iconStar, items }: { label: string; iconClock?: boolean; iconStar?: boolean; items: ChipItem[]; }) {
  const pathname = usePathname();
  if (!items?.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {iconClock && <TrendingUp size={11} strokeWidth={2.5} aria-hidden />}
        {iconStar && <Bookmark size={10} strokeWidth={2.5} aria-hidden style={{ color: 'var(--hub-accent)' }} />}
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {items.map(it => {
          const on = it.href === '/' ? pathname === '/' : (pathname === it.href || pathname.startsWith(it.href + '/'));
          return (
            <Link key={it.href} href={it.href} className="rc-chip" style={{ padding: '4px 10px', borderRadius: 999, background: on ? 'var(--hub-secondary-medium)' : 'var(--hub-darker)', border: '1px solid', borderColor: on ? 'var(--hub-border-hover)' : 'var(--hub-border)', color: on ? 'var(--fg-default)' : 'var(--fg-muted)', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 100ms', textDecoration: 'none' }}>
              {it.prefix && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--hub-accent)', letterSpacing: '0.04em' }}>{it.prefix}</span>}
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
