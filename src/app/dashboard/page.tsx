'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { type WidgetLayout, DEFAULT_LAYOUT } from '@/components/dashboard/types';

const LAYOUT_STORAGE_KEY = 'infohub-dashboard-layout';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [layout, setLayout] = useState<WidgetLayout[]>(DEFAULT_LAYOUT);
  const [loaded, setLoaded] = useState(false);

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

  // Debounced DB save — localStorage is immediate, DB save waits 1.5s
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current); };
  }, []);

  // Save layout changes
  const handleLayoutChange = useCallback(
    (newLayout: WidgetLayout[]) => {
      setLayout(newLayout);

      // Save to localStorage immediately
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout));
      } catch {}

      // Debounce DB save (1.5s) to avoid hammering on rapid reorders
      if (session?.user) {
        if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current);
        dbSaveTimerRef.current = setTimeout(() => {
          fetch('/api/user/data', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dashboardLayout: newLayout }),
          }).catch(() => {});
        }, 1500);
      }
    },
    [session],
  );

  if (!loaded) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="text-white">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
            {/* Header skeleton */}
            <div className="mb-5">
              <div className="h-6 w-48 rounded bg-white/[0.04] animate-pulse" />
              <div className="flex gap-4 mt-2">
                <div className="h-4 w-24 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-4 w-20 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-4 w-16 rounded bg-white/[0.04] animate-pulse" />
              </div>
            </div>
            {/* Widget grid skeleton — mimics 2-col layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-white/[0.04] animate-pulse" />
                    <div className="h-3 rounded bg-white/[0.04] animate-pulse" style={{ width: `${60 + (n % 3) * 20}px` }} />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-white/[0.04] animate-pulse" />
                    <div className="h-3 w-full rounded bg-white/[0.04] animate-pulse" />
                    <div className="h-3 w-4/5 rounded bg-white/[0.04] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
          <DashboardHeader userName={session?.user?.name || session?.user?.email?.split('@')[0] || 'User'} />

          <DashboardGrid layout={layout} onLayoutChange={handleLayoutChange} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
