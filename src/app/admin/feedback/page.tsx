'use client';

/**
 * /admin/feedback — admin-only inbox for user-submitted bug reports.
 *
 * Reads from GET /api/feedback (admin-gated). Lets the admin filter by
 * status (open / resolved / wontfix / all), mark items resolved or
 * wontfix, and add a short triage note.
 *
 * Not linked from the public sidebar — admins navigate via /admin or
 * directly. Linked from the main /admin dashboard for one-click access.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { ArrowLeft, Bug, RefreshCw, Check, X as XIcon, AlertTriangle, ExternalLink, Filter } from 'lucide-react';

interface BugReport {
  id: number;
  userId: string | null;
  userEmail: string | null;
  pageUrl: string;
  pageTitle: string | null;
  userAgent: string | null;
  viewport: string | null;
  message: string;
  severity: 'low' | 'normal' | 'high';
  status: 'open' | 'resolved' | 'wontfix';
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

type Filt = 'open' | 'resolved' | 'wontfix' | 'all';

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function browserFromUA(ua: string | null): string {
  if (!ua) return '—';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  return ua.slice(0, 40) + (ua.length > 40 ? '…' : '');
}

export default function AdminFeedbackPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filt, setFilt] = useState<Filt>('open');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback?status=${filt}&limit=200`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401 || res.status === 403) {
        router.push('/login?callbackUrl=/admin/feedback');
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setReports(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [filt, router]);

  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.role === 'admin') {
      load();
    }
  }, [authStatus, session, load]);

  const setStatus = useCallback(async (id: number, newStatus: 'open' | 'resolved' | 'wontfix') => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/feedback?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, adminNotes: noteDraft[id] || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setUpdatingId(null);
    }
  }, [noteDraft, load]);

  const counts = useMemo(() => ({
    open: reports.filter(r => r.status === 'open').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    wontfix: reports.filter(r => r.status === 'wontfix').length,
    high: reports.filter(r => r.severity === 'high' && r.status === 'open').length,
  }), [reports]);

  // Loading auth
  if (authStatus === 'loading') {
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
  if (!session?.user) {
    router.push('/login?callbackUrl=/admin/feedback');
    return null;
  }
  if (session.user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-12 text-center">
          <h1 className="text-xl font-bold text-white mb-2">Admin only</h1>
          <p className="text-sm text-neutral-500">You don&rsquo;t have permission to view this page.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto px-4 py-6">
        <Link href="/admin" className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> back to admin
        </Link>
        <PageHero
          icon={Bug}
          eyebrow="Admin · triage"
          title="User bug"
          accentNoun="reports"
          accent="orange"
          description={
            <>
              Submitted via the per-page Report widget. {counts.high > 0 && (
                <span className="text-red-400 font-medium">{counts.high} high-severity open · </span>
              )}
              Triage with one click.
            </>
          }
          actions={
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-white"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> refresh
            </button>
          }
        />

        {error && (
          <div className="card-premium p-3 border border-red-400/30 bg-red-500/5 text-sm text-red-300 mb-4 inline-flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 mb-4 text-[11px]">
          <Filter className="w-3 h-3 text-neutral-600" />
          {(['open', 'resolved', 'wontfix', 'all'] as Filt[]).map(f => (
            <button
              key={f}
              onClick={() => setFilt(f)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filt === f
                  ? 'bg-hub-yellow text-black font-semibold'
                  : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Reports list */}
        {loading && reports.length === 0 && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">Loading reports…</div>
        )}
        {!loading && reports.length === 0 && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">
            No reports in this status. The inbox is clean.
          </div>
        )}
        {reports.length > 0 && (
          <div className="space-y-2">
            {reports.map(r => {
              const sevColor = r.severity === 'high'
                ? 'border-red-400/40 bg-red-500/5 text-red-300'
                : r.severity === 'low'
                  ? 'border-white/[0.08] bg-white/[0.02] text-neutral-400'
                  : 'border-amber-400/30 bg-amber-500/[0.04] text-amber-300';
              const statusColor = r.status === 'open'
                ? 'text-emerald-400'
                : r.status === 'resolved'
                  ? 'text-neutral-500'
                  : 'text-neutral-600';
              return (
                <div key={r.id} className={`card-premium p-3 border ${sevColor}`}>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider font-semibold">
                          {r.severity}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wider ${statusColor}`}>
                          · {r.status}
                        </span>
                        <span className="text-[10px] text-neutral-600">· #{r.id}</span>
                        <span className="text-[10px] text-neutral-600">· {fmtAgo(r.createdAt)}</span>
                      </div>
                      <Link
                        href={r.pageUrl}
                        target="_blank"
                        className="text-xs font-mono text-hub-yellow hover:underline inline-flex items-center gap-1"
                      >
                        {r.pageUrl}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  <p className="text-sm text-white whitespace-pre-wrap break-words leading-relaxed mt-2 mb-2">
                    {r.message}
                  </p>

                  {/* Meta row */}
                  <div className="text-[10px] text-neutral-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {r.userEmail
                      ? <span><span className="text-neutral-600">user:</span> {r.userEmail}</span>
                      : <span className="text-neutral-600">anonymous</span>}
                    {r.viewport && <span><span className="text-neutral-600">viewport:</span> {r.viewport}</span>}
                    {r.userAgent && <span><span className="text-neutral-600">browser:</span> {browserFromUA(r.userAgent)}</span>}
                    {r.pageTitle && <span className="truncate max-w-[300px]"><span className="text-neutral-600">title:</span> {r.pageTitle}</span>}
                  </div>

                  {r.adminNotes && (
                    <div className="text-[11px] text-neutral-400 mt-2 p-2 rounded bg-black/20 border border-white/[0.04]">
                      <span className="text-neutral-600">Admin note:</span> {r.adminNotes}
                    </div>
                  )}

                  {/* Triage actions */}
                  {r.status === 'open' && (
                    <div className="flex items-end gap-2 mt-3 pt-2 border-t border-white/[0.04]">
                      <input
                        type="text"
                        placeholder="Optional triage note (e.g. 'fixed in commit abc123')"
                        value={noteDraft[r.id] ?? ''}
                        onChange={e => setNoteDraft({ ...noteDraft, [r.id]: e.target.value })}
                        maxLength={500}
                        className="flex-1 bg-black/30 border border-white/[0.06] rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-400/40"
                      />
                      <button
                        onClick={() => setStatus(r.id, 'resolved')}
                        disabled={updatingId === r.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-medium rounded disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" /> Resolve
                      </button>
                      <button
                        onClick={() => setStatus(r.id, 'wontfix')}
                        disabled={updatingId === r.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-700/50 hover:bg-neutral-700 text-neutral-400 text-[11px] font-medium rounded disabled:opacity-50"
                      >
                        <XIcon className="w-3 h-3" /> Wontfix
                      </button>
                    </div>
                  )}

                  {r.status !== 'open' && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-neutral-600">
                      <span>{r.resolvedAt && `${r.status} ${fmtAgo(r.resolvedAt)}`}</span>
                      <button
                        onClick={() => setStatus(r.id, 'open')}
                        disabled={updatingId === r.id}
                        className="text-neutral-500 hover:text-white"
                      >
                        Reopen
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
