'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { LayoutDashboard } from 'lucide-react';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import { type WidgetLayout, DEFAULT_LAYOUT } from '@/components/dashboard/types';

const LAYOUT_STORAGE_KEY = 'infohub-dashboard-layout';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [layout, setLayout] = useState<WidgetLayout[]>(DEFAULT_LAYOUT);
  const [loaded, setLoaded] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load layout from user prefs (DB) or localStorage
  useEffect(() => {
    if (status === 'loading') return;

    const loadLayout = async () => {
      // Try DB first (logged-in users)
      if (session?.user) {
        try {
          const res = await fetch('/api/user/data');
          if (res.ok) {
            const data = await res.json();
            if (data.dashboardLayout && Array.isArray(data.dashboardLayout) && data.dashboardLayout.length > 0) {
              setLayout(data.dashboardLayout);
              setLoaded(true);
              return;
            }
          }
        } catch {}
      }

      // Fallback: localStorage
      try {
        const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLayout(parsed);
            setLoaded(true);
            return;
          }
        }
      } catch {}

      // Default
      setLayout([...DEFAULT_LAYOUT]);
      setLoaded(true);
    };

    loadLayout();
  }, [session, status]);

  // Save layout changes
  const handleLayoutChange = useCallback(
    (newLayout: WidgetLayout[]) => {
      setLayout(newLayout);

      // Save to localStorage immediately
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout));
      } catch {}

      // Save to DB (debounced via fire-and-forget)
      if (session?.user) {
        fetch('/api/user/data', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dashboardLayout: newLayout }),
        }).catch(() => {});
      }
    },
    [session],
  );

  if (status === 'loading' || !loaded) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="mb-4">
            <h1 className="heading-page flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-hub-yellow" />
              Dashboard
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Welcome back, {session.user?.name || session.user?.email?.split('@')[0] || 'User'}
            </p>
          </div>

          <DashboardGrid layout={layout} onLayoutChange={handleLayoutChange} />

          {/* Cloud Sync Info */}
          <div className="mt-6 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            <p className="text-neutral-500 text-xs leading-relaxed">
              Your dashboard layout is synced to the cloud and available across devices.
              Drag widgets to rearrange, or use the + button to add new ones.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
