'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { HealthResponse } from '@/lib/types';
import StatusOverview from '@/components/StatusOverview';
import ExchangeTable from '@/components/ExchangeTable';
import ErrorLog from '@/components/ErrorLog';
import StatusBadge from '@/components/StatusBadge';
import ThemeToggle from '@/components/ThemeToggle';

const POLL_INTERVAL = 30_000;

export default function DashboardPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);
  const router = useRouter();

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        if (res.status === 401) { router.push('/'); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      const json: HealthResponse = await res.json();
      setData(json);
      setError(null);
      setLastPoll(new Date());
      setCountdown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="admin-live-dot mx-auto mb-3" style={{ width: 10, height: 10 }} />
          <div className="text-sm" style={{ color: 'var(--admin-accent)' }}>Connecting to InfoHub...</div>
          <div className="text-xs mt-2" style={{ color: 'var(--admin-text-muted)' }}>Fetching exchange health data</div>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="admin-card admin-card-accent max-w-sm text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={fetchHealth}
            className="px-4 py-1.5 rounded text-xs transition-colors"
            style={{
              background: 'rgb(var(--admin-accent-rgb) / 0.1)',
              color: 'var(--admin-accent)',
              border: '1px solid rgb(var(--admin-accent-rgb) / 0.2)',
            }}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="space-y-4">
        {/* Header bar */}
        <div className="admin-card admin-card-accent !rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-0.5">
              <span className="text-white font-black text-sm tracking-tight">Info</span>
              <span
                className="font-black text-sm tracking-tight text-black px-1 py-0.5 rounded"
                style={{ background: 'linear-gradient(135deg, var(--admin-accent-light), var(--admin-accent))' }}
              >
                Hub
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--admin-text-muted)' }}>
              Admin
            </span>

            {/* Live indicator + status */}
            <div className="flex items-center gap-2">
              <div className="admin-live-dot" />
              <StatusBadge status={data.status} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <span className="text-[11px] tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
              {countdown}s
            </span>

            <button
              onClick={fetchHealth}
              className="px-2.5 py-1 rounded text-[11px] transition-colors"
              style={{ color: 'var(--admin-text-secondary)', border: '1px solid var(--admin-border)' }}
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded text-[11px] text-red-400/60 hover:text-red-400 transition-colors"
              style={{ border: '1px solid var(--admin-border)' }}
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="admin-card" style={{ borderLeftColor: 'rgba(239, 68, 68, 0.3)', borderLeftWidth: 2 }}>
            <span className="text-red-400 text-xs">Poll error: {error}</span>
            <span className="text-xs ml-2" style={{ color: 'var(--admin-text-muted)' }}>(showing last successful data)</span>
          </div>
        )}

        <StatusOverview data={data} />
        <ExchangeTable data={data} />
        <ErrorLog data={data} />
      </div>
    </main>
  );
}
