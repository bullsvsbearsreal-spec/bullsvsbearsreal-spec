'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { DashboardProvider } from '@/components/dashboard/DashboardContext';
import { type WidgetLayout, DEFAULT_LAYOUT } from '@/components/dashboard/types';
import { getPresetLayout } from '@/components/dashboard/LayoutPresets';
import PersonaSelector from '@/components/dashboard/PersonaSelector';
import FeatureHint from '@/components/FeatureHint';
import AuthPromptBanner from '@/components/AuthPromptBanner';
import { UserCircle2 } from 'lucide-react';

const LAYOUT_STORAGE_KEY = 'infohub-dashboard-layout';
const PERSONA_SET_KEY = 'infohub-persona-set';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [layout, setLayout] = useState<WidgetLayout[]>(DEFAULT_LAYOUT);
  const [loaded, setLoaded] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  // Fallback: if auth status stays 'loading' for too long, proceed without session
  const [authTimedOut, setAuthTimedOut] = useState(false);
  useEffect(() => {
    if (status !== 'loading') return;
    const t = setTimeout(() => setAuthTimedOut(true), 2000);
    return () => clearTimeout(t);
  }, [status]);

  // Load layout from user prefs (DB) or localStorage
  useEffect(() => {
    if (status === 'loading' && !authTimedOut) return;
    let mounted = true;

    const loadLayout = async () => {
      // Try DB first (logged-in users)
      if (session?.user) {
        try {
          const res = await fetch('/api/user/data');
          if (!mounted) return;
          if (res.ok) {
            const data = await res.json();
            if (!mounted) return;
            if (data.dashboardLayout && Array.isArray(data.dashboardLayout) && data.dashboardLayout.length > 0) {
              setLayout(data.dashboardLayout);
              setLoaded(true);
              return;
            }
          }
        } catch {}
      }
      if (!mounted) return;

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

      // First-time user: apply Market Pulse and show persona selector
      const personaSet = localStorage.getItem(PERSONA_SET_KEY);
      if (!personaSet) {
        const marketPulse = getPresetLayout('market-pulse');
        if (marketPulse) {
          setLayout(marketPulse);
          setIsFirstVisit(true);
          setShowPersona(true);
        } else {
          setLayout([...DEFAULT_LAYOUT]);
        }
        setLoaded(true);
        return;
      }

      // Default
      setLayout([...DEFAULT_LAYOUT]);
      setLoaded(true);
    };

    loadLayout();
    return () => { mounted = false; };
  }, [session, status, authTimedOut]);

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

  const handlePersonaSelect = useCallback(
    (presetId: string | null) => {
      if (presetId) {
        const presetLayout = getPresetLayout(presetId);
        if (presetLayout) handleLayoutChange(presetLayout);
      }
      localStorage.setItem(PERSONA_SET_KEY, 'true');
      setShowPersona(false);
      setIsFirstVisit(false);
    },
    [handleLayoutChange],
  );

  if (!loaded) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main id="main-content" className="text-white">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
      <main id="main-content" className="text-white">
        <DashboardProvider>
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <DashboardHeader userName={session?.user?.name || session?.user?.email?.split('@')[0] || 'User'} />
              <button
                onClick={() => setShowPersona(true)}
                className="flex items-center gap-1.5 mt-1 px-2.5 py-1.5 text-[11px] text-neutral-500 hover:text-white rounded-lg border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] transition-all shrink-0"
                title="Change dashboard persona"
              >
                <UserCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Persona</span>
              </button>
            </div>

            <FeatureHint page="/dashboard" />

            {isFirstVisit && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-hub-yellow/[0.06] border border-hub-yellow/20 flex items-center justify-between gap-3">
                <p className="text-xs text-neutral-300">
                  <span className="text-hub-yellow font-semibold">Welcome!</span>{' '}
                  This is your default dashboard. Customize it anytime — drag widgets, add new ones, or pick a preset.
                </p>
                <button
                  onClick={() => setIsFirstVisit(false)}
                  className="text-[10px] text-neutral-500 hover:text-white shrink-0 px-2 py-1 rounded hover:bg-white/[0.06] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

            {status !== 'authenticated' && (
              <AuthPromptBanner variant="cloud-sync" dismissKey="dashboard" className="mb-4" />
            )}

            <DashboardGrid layout={layout} onLayoutChange={handleLayoutChange} />
          </div>
        </DashboardProvider>
      </main>
      {showPersona && <PersonaSelector onSelect={handlePersonaSelect} />}
      <ReferralBanner />
      <Footer />
    </div>
  );
}
