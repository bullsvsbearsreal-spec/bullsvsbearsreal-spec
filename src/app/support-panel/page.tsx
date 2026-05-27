'use client';

/**
 * /support-panel — customer support dashboard.
 *
 * Single tab: support tickets. Slimmer than /mod-panel by design — the
 * 'support' role is for chat-rep / first-line CS staff who shouldn't see
 * the wider mod surfaces (user lookup, spam detector, feedback queue).
 *
 * Visible to: owner, admin, moderator, support.
 */

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Headphones, Lock, MessageSquare } from 'lucide-react';
import { TicketsTab } from '../admin-panel/tabs/Tickets';
import { ToastHost, type ToastMsg } from '../admin-panel/components/primitives';

export default function SupportPanelPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const allowed = role === 'owner' || role === 'admin' || role === 'moderator' || role === 'support';

  const [toast, setToast] = useState<ToastMsg | null>(null);
  const fireToast = useCallback((msg: string, ok: boolean) => setToast({ msg, ok }), []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 32, height: 32, border: '2px solid rgba(253, 186, 116, 0.3)', borderTopColor: '#fdba74', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
          <Lock style={{ width: 28, height: 28, color: '#fdba74', marginBottom: 14 }} />
          <div style={{ color: 'var(--fg-muted)', fontSize: 13, marginBottom: 14 }}>Support access required</div>
          <a href="/login?callbackUrl=/support-panel" style={{ padding: '8px 18px', borderRadius: 8, background: '#fdba74', color: '#000', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Log in</a>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main style={{ color: '#fff' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Headphones style={{ width: 18, height: 18, color: '#fdba74' }} />
                Support Panel
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#fdba74', background: 'rgba(253, 186, 116, 0.12)',
                  padding: '3px 8px', borderRadius: 999,
                  border: '1px solid rgba(253, 186, 116, 0.25)',
                }}>{role}</span>
              </h1>
              <p style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
                Customer support queue · claim tickets to work them · reply privately or with internal notes
              </p>
            </div>
          </div>

          <TicketsTab onToast={fireToast} viewerId={session.user.id} />
        </div>
      </main>
      <Footer />
      <ToastHost toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
