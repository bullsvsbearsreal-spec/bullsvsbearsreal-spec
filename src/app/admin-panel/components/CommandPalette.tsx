'use client';

/**
 * Cmd+K command palette — global search modal for the admin dashboard.
 *
 * Searches:
 *   · 9 dashboard tabs by name
 *   · 2 sub-pages (Affiliates, Broadcast)
 *   · Recent users (top 100 by created_at, cached after first Users-tab load)
 *   · Open bug reports (loaded on first Cmd+K)
 *
 * Keyboard:
 *   · Cmd/Ctrl+K       → open
 *   · Esc               → close
 *   · ↑ / ↓             → move selection
 *   · Enter             → activate (navigate to target)
 *
 * Search-only by design (the user explicitly chose this). All
 * destructive actions still go through their existing confirm modals.
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { Search, X as XIcon, Hash, User, Bug, Gift, Send, ArrowRight, Megaphone, MessageSquare, Headphones, Trophy } from 'lucide-react';

interface CmdItem {
  id: string;
  kind: 'tab' | 'subpage' | 'user' | 'bug';
  label: string;
  sub?: string;
  icon: React.ReactNode;
  navigate: () => void;
  // Lower-cased searchable text built once at construction
  searchText: string;
}

interface CmdUser { id: string; email: string | null; name: string | null }
interface CmdBug  { id: number; message: string; severity: string }

export function CommandPalette({
  open,
  onClose,
  tabs,
  goTab,
}: {
  open: boolean;
  onClose: () => void;
  tabs: { id: string; label: string }[];
  goTab: (tabId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [users, setUsers] = useState<CmdUser[]>([]);
  const [bugs,  setBugs]  = useState<CmdBug[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // Lazy-fetch users + bug reports the first time the palette opens.
  // No need to re-fetch on every open — palette stays cheap.
  useEffect(() => {
    if (!open) return;
    if (users.length === 0) {
      fetch('/api/admin/users?limit=200')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.users) return;
          setUsers(d.users.map((u: any) => ({ id: String(u.id), email: u.email ?? null, name: u.name ?? null })));
        })
        .catch(() => {});
    }
    if (bugs.length === 0) {
      fetch('/api/feedback?status=open&limit=50')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.success || !Array.isArray(d.data)) return;
          setBugs(d.data.map((b: any) => ({ id: Number(b.id), message: String(b.message ?? ''), severity: String(b.severity ?? 'normal') })));
        })
        .catch(() => {});
    }
    // Reset state when reopening
    setQuery('');
    setActive(0);
    // Focus input after the dialog renders
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the searchable item list — recomputed when tabs/users/bugs change
  const allItems: CmdItem[] = useMemo(() => {
    const out: CmdItem[] = [];

    // Tabs
    for (const t of tabs) {
      out.push({
        id: `tab:${t.id}`,
        kind: 'tab',
        label: t.label,
        sub: 'Tab',
        icon: <Hash style={{ width: 13, height: 13, color: 'var(--fg-muted)' }} />,
        navigate: () => goTab(t.id),
        searchText: t.label.toLowerCase(),
      });
    }

    // Sub-pages
    out.push({
      id: 'sub:affiliates',
      kind: 'subpage',
      label: 'Affiliate Program',
      sub: 'Sub-page · /admin-panel/affiliates',
      icon: <Gift style={{ width: 13, height: 13, color: '#34d399' }} />,
      navigate: () => { window.location.href = '/admin-panel/affiliates'; },
      searchText: 'affiliate program payouts earners',
    });
    out.push({
      id: 'sub:broadcast',
      kind: 'subpage',
      label: 'Broadcast Composer',
      sub: 'Sub-page · /admin-panel/broadcast',
      icon: <Send style={{ width: 13, height: 13, color: '#fcd34d' }} />,
      navigate: () => { window.location.href = '/admin-panel/broadcast'; },
      searchText: 'broadcast composer push telegram',
    });
    out.push({
      id: 'panel:mod',
      kind: 'subpage',
      label: 'Mod Panel',
      sub: 'Surface · /mod-panel · tickets + spam + users + feedback',
      icon: <MessageSquare style={{ width: 13, height: 13, color: '#7dd3fc' }} />,
      navigate: () => { window.location.href = '/mod-panel'; },
      searchText: 'moderator mod panel tickets spam abuse',
    });
    out.push({
      id: 'panel:marketing',
      kind: 'subpage',
      label: 'Marketing Panel',
      sub: 'Surface · /marketing-panel · growth + acquisition + campaigns',
      icon: <Megaphone style={{ width: 13, height: 13, color: '#c4b5fd' }} />,
      navigate: () => { window.location.href = '/marketing-panel'; },
      searchText: 'marketing campaigns acquisition utm growth',
    });
    out.push({
      id: 'panel:support',
      kind: 'subpage',
      label: 'Support Panel',
      sub: 'Surface · /support-panel · tickets only',
      icon: <Headphones style={{ width: 13, height: 13, color: '#fdba74' }} />,
      navigate: () => { window.location.href = '/support-panel'; },
      searchText: 'support customer service tickets',
    });
    out.push({
      id: 'page:leaderboard',
      kind: 'subpage',
      label: 'Public Leaderboard',
      sub: 'Public · /leaderboard · affiliate ranking',
      icon: <Trophy style={{ width: 13, height: 13, color: '#fbbf24' }} />,
      navigate: () => { window.location.href = '/leaderboard'; },
      searchText: 'leaderboard public affiliate referral ranking earned',
    });

    // Users — push the user id into sessionStorage and jump to Users tab
    for (const u of users) {
      const label = u.name || (u.email ? u.email.split('@')[0] : `(${u.id.slice(0, 6)}…)`);
      out.push({
        id: `user:${u.id}`,
        kind: 'user',
        label,
        sub: u.email ?? u.id,
        icon: <User style={{ width: 13, height: 13, color: '#7dd3fc' }} />,
        navigate: () => {
          try { sessionStorage.setItem('admin:open_user_id', u.id); } catch {}
          goTab('users');
        },
        searchText: `${(u.name || '').toLowerCase()} ${(u.email || '').toLowerCase()} ${u.id.toLowerCase()}`,
      });
    }

    // Bug reports
    for (const b of bugs) {
      out.push({
        id: `bug:${b.id}`,
        kind: 'bug',
        label: `Report #${b.id}`,
        sub: b.message.slice(0, 80),
        icon: <Bug style={{ width: 13, height: 13, color: b.severity === 'high' ? '#f87171' : '#fcd34d' }} />,
        navigate: () => goTab('feedback'),
        searchText: `report bug ${b.id} ${b.message.toLowerCase()}`,
      });
    }

    return out;
  }, [tabs, users, bugs, goTab]);

  // Filter against the query — simple substring match against searchText
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 30);
    const tokens = q.split(/\s+/).filter(Boolean);
    return allItems
      .filter(item => tokens.every(t => item.searchText.includes(t)))
      .slice(0, 30);
  }, [allItems, query]);

  // Keep selection in range when results change
  useEffect(() => {
    if (active >= filtered.length) setActive(Math.max(0, filtered.length - 1));
  }, [filtered, active]);

  // Esc + arrow + enter handling
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(a => Math.min(filtered.length - 1, a + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(a => Math.max(0, a - 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[active];
        if (item) {
          item.navigate();
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, active, onClose]);

  // Scroll the active row into view inside the list when arrow-navigating
  useEffect(() => {
    if (!listRef.current) return;
    const node = listRef.current.querySelector(`[data-cmd-idx="${active}"]`) as HTMLElement | null;
    if (node) node.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--hub-darker)',
          border: '1px solid var(--hub-border-subtle)',
          borderRadius: 12,
          width: 'min(640px, 92vw)',
          maxHeight: 'min(540px, 75vh)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header / input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid var(--hub-border-subtle)',
        }}>
          <Search style={{ width: 14, height: 14, color: 'var(--fg-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            placeholder="Search tabs · users · bug reports · sub-pages"
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 0, outline: 0,
              color: '#fff', fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--hub-border-subtle)',
            borderRadius: 4, padding: '1px 5px',
          }}>esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--fg-faint)', fontSize: 12 }}>
              No matches.
            </div>
          ) : filtered.map((item, i) => (
            <button
              key={item.id}
              data-cmd-idx={i}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => { item.navigate(); onClose(); }}
              style={{
                display: 'grid',
                gridTemplateColumns: '18px 1fr 14px',
                alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 14px',
                background: i === active ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
                border: 0, color: 'inherit', cursor: 'pointer',
                textAlign: 'left',
                borderLeft: `2px solid ${i === active ? '#fbbf24' : 'transparent'}`,
              }}
            >
              {item.icon}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </div>
                {item.sub && (
                  <div style={{ fontSize: 10.5, color: 'var(--fg-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: item.kind === 'user' ? 'var(--font-mono)' : 'inherit' }}>
                    {item.sub}
                  </div>
                )}
              </div>
              <ArrowRight style={{ width: 13, height: 13, color: i === active ? '#fbbf24' : 'transparent' }} />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px',
          borderTop: '1px solid var(--hub-border-subtle)',
          fontSize: 10, color: 'var(--fg-faint)',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        }}>
          <span>{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</span>
          <span><kbd>↑↓</kbd> navigate · <kbd>↵</kbd> open</span>
        </div>
      </div>
    </div>
  );
}
