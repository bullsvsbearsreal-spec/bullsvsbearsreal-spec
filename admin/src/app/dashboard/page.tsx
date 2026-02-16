'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { HealthResponse } from '@/lib/types';
import StatusOverview from '@/components/StatusOverview';
import ExchangeTable from '@/components/ExchangeTable';
import ErrorLog from '@/components/ErrorLog';

const POLL_INTERVAL = 30_000; // 30 seconds

export default function DashboardPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const router = useRouter();

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json: HealthResponse = await res.json();
      setData(json);
      setError(null);
      setLastPoll(new Date());
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

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-terminal-green text-sm animate-pulse">Connecting to InfoHub...</div>
          <div className="text-neutral-700 text-xs mt-2">Fetching exchange health data</div>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="admin-card max-w-sm text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={fetchHealth}
            className="px-4 py-1.5 rounded text-xs bg-terminal-green/10 text-terminal-green border border-terminal-green/20 hover:bg-terminal-green/20"
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
        {/* Header with logout */}
        <div className="flex items-center justify-between">
          <div />
          <div className="flex items-center gap-4">
            {lastPoll && (
              <span className="text-[11px] text-neutral-700">
                Next poll in {Math.max(0, Math.round((POLL_INTERVAL - (Date.now() - lastPoll.getTime())) / 1000))}s
              </span>
            )}
            <button
              onClick={fetchHealth}
              className="px-2.5 py-1 rounded text-[11px] text-neutral-500 border border-terminal-border hover:text-terminal-green hover:border-terminal-green/20 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded text-[11px] text-neutral-600 border border-terminal-border hover:text-red-400 hover:border-red-500/20 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="admin-card !border-l-red-500/40">
            <span className="text-red-400 text-xs">Poll error: {error}</span>
            <span className="text-neutral-600 text-xs ml-2">(showing last successful data)</span>
          </div>
        )}

        {/* Status overview + cache cards */}
        <StatusOverview data={data} />

        {/* Exchange health table */}
        <ExchangeTable data={data} />

        {/* Error log */}
        <ErrorLog data={data} />
      </div>
    </main>
  );
}
