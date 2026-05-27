'use client';

/**
 * /mod-panel — moderator dashboard.
 *
 * Two tabs:
 *   · Users    — searchable user list, click row to open drawer with
 *                profile + activity timeline + shared operator notes.
 *                NO tier-change or suspend buttons (those need admin).
 *   · Feedback — bug reports inbox, identical to the admin view.
 *
 * Visible to: owner, admin, moderator.
 * Other roles redirect to /admin-panel (admin / advisor) or / (else).
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Shield, Users, Bug, RefreshCw, Lock, MessageSquare, AlertTriangle } from 'lucide-react';
import { UsersTab }    from '../admin-panel/tabs/Users';
import { FeedbackTab } from '../admin-panel/tabs/Feedback';
import { TicketsTab }  from '../admin-panel/tabs/Tickets';
import { SpamTab }     from '../admin-panel/tabs/Spam';
import { ToastHost, type ToastMsg } from '../admin-panel/components/primitives';

type TabId = 'tickets' | 'users' | 'spam' | 'feedback';

interface TabDef { id: TabId; label: string; icon: React.ReactNode }
const TABS: TabDef[] = [
  { id: 'tickets',  label: 'Tickets',  icon: <MessageSquare  style={{ width: 13, height: 13 }} /> },
  { id: 'users',    label: 'Users',    icon: <Users          style={{ width: 13, height: 13 }} /> },
  { id: 'spam',     label: 'Spam',     icon: <AlertTriangle  style={{ width: 13, height: 13 }} /> },
  { id: 'feedback', label: 'Feedback', icon: <Bug            style={{ width: 13, height: 13 }} /> },
];

export default function ModPanelPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const allowed = role === 'owner' || role === 'admin' || role === 'moderator';

  const [active, setActive] = useState<TabId>('tickets');
  const [toast, setToast] = useState<ToastMsg | null>(null);

  // Hash routing
  useEffect(() => {
    if (status !== 'authenticated') return;
    const apply = () => {
      const id = (window.location.hash.replace(/^#/, '') || 'tickets') as TabId;
      if (TABS.some(t => t.id === id)) setActive(id);
      else { setActive('tickets'); history.replaceState(null, '', '#tickets'); }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [status]);

  const goTab = useCallback((id: TabId) => {
    history.replaceState(null, '', `#${id}`);
    setActive(id);
  }, []);

  // Keyboard shortcuts (Cmd+1..2, R)
  useEffect(() => {
    if (!allowed) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const digit = parseInt(e.key, 10);
        if (Number.isFinite(digit) && digit >= 1 && digit <= TABS.length) {
          e.preventDefault();
          goTab(TABS[digit - 1].id);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [allowed, goTab]);

  const fireToast = useCallback((msg: string, ok: boolean) => setToast({ msg, ok }), []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 32, height: 32, border: '2px solid rgba(125, 211, 252, 0.3)', borderTopColor: '#7dd3fc', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </main>
        <Footer />
      </div>
    );
  }
  if (!session?.user || !allowed) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 16px', color: '#fff' }}>
          <Lock style={{ width: 28, height: 28, color: '#7dd3fc', marginBottom: 14 }} />
          <div style={{ color: 'var(--fg-muted)', fontSize: 13, marginBottom: 14 }}>Moderator access required</div>
          <a href="/login?callbackUrl=/mod-panel" style={{ padding: '8px 18px', borderRadius: 8, background: '#7dd3fc', color: '#000', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Log in</a>
        </main>
        <Footer />
      </div>
    );
  }

  // Owners/admins are nudged toward the full admin panel
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main style={{ color: '#fff' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare style={{ width: 18, height: 18, color: '#7dd3fc' }} />
                Mod Panel
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#7dd3fc', background: 'rgba(125, 211, 252, 0.12)',
                  padding: '3px 8px', borderRadius: 999,
                  border: '1px solid rgba(125, 211, 252, 0.25)',
                }}>{role}</span>
              </h1>
              <p style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
                Support workspace · user lookup + bug-report triage · notes shared with admins
              </p>
            </div>
            {isOwnerOrAdmin && (
              <a href="/admin-panel" style={{ fontSize: 11, color: 'var(--fg-default)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Shield style={{ width: 13, height: 13, color: '#fbbf24' }} />
                Open full admin panel
              </a>
            )}
          </div>

          <div className="md:hidden" style={{
            background: 'rgba(125, 211, 252, 0.08)',
            border: '1px solid rgba(125, 211, 252, 0.25)',
            borderRadius: 8, padding: 16, marginBottom: 16,
            color: '#7dd3fc', fontSize: 13, textAlign: 'center',
          }}>
            Mod panel is optimised for desktop (1024px+).
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--hub-border-subtle)' }}>
            {TABS.map(t => {
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => goTab(t.id)}
                  style={{
                    padding: '10px 14px', background: 'transparent', border: 0,
                    borderBottom: `2px solid ${isActive ? '#7dd3fc' : 'transparent'}`,
                    color: isActive ? '#fff' : 'var(--fg-muted)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: -1,
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab content — reuse the admin Users + Feedback components. The
              UsersTab's UserDrawer shows the tier-override / suspend buttons
              but the underlying API enforces admin-only; if a moderator
              tries to click them they'll see a 403 toast. */}
          <div style={{ minHeight: 400 }}>
            {active === 'tickets'  && <TicketsTab  onToast={fireToast} viewerId={session.user.id} />}
            {active === 'users'    && <UsersTab    onToast={fireToast} viewerRole={role} />}
            {active === 'spam'     && (
              <SpamTab onToast={fireToast} onOpenUser={(id) => {
                // Cross-tab handoff: stash id and bounce to Users tab
                try { sessionStorage.setItem('admin:open_user_id', id); } catch {}
                goTab('users');
              }} />
            )}
            {active === 'feedback' && <FeedbackTab onToast={fireToast} />}
          </div>
        </div>
      </main>
      <Footer />
      <ToastHost toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
