'use client';

/**
 * ReportBugButton — small floating "Report" pill in the bottom-right of every
 * page. Clicking opens a textarea modal; submission POSTs to /api/feedback
 * with the current page URL, viewport size, and user agent auto-attached.
 *
 * Mounted once in the root layout so users can flag a bug from anywhere
 * without us having to wire it into every page individually.
 */
import { useState, useEffect, useCallback } from 'react';
import { Bug, X, Check, Loader2, AlertTriangle } from 'lucide-react';

type Severity = 'low' | 'normal' | 'high';

const STORAGE_KEY = 'infohub-bug-button-hidden';

export default function ReportBugButton() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<Severity>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist user's "hide forever" choice. Cleared by visiting /settings.
  useEffect(() => {
    try { if (localStorage.getItem(STORAGE_KEY) === '1') setHidden(true); } catch {}
  }, []);

  // Close modal on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    // Reset post-success state on next open
    if (submitted) {
      setSubmitted(false);
      setMessage('');
      setSeverity('normal');
    }
    setError(null);
  }, [submitted]);

  const submit = useCallback(async () => {
    if (message.trim().length < 4) {
      setError('Please describe the issue (at least 4 characters).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const viewport = `${window.innerWidth}x${window.innerHeight}`;
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageUrl: window.location.pathname + window.location.search,
          pageTitle: document.title,
          message: message.trim(),
          severity,
          userAgent: navigator.userAgent,
          viewport,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setSubmitted(true);
      // Auto-close after 3s of success
      setTimeout(() => close(), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }, [message, severity, close]);

  const hideForever = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setHidden(true);
    setOpen(false);
  }, []);

  if (hidden) return null;

  return (
    <>
      {/* Floating button — positioned high enough to clear the persistent
          status bar (Streaming/venue indicators on the left, "api/ws/INFOHUB
          V2.0" badge on the right). bottom-14 keeps it visible without
          stomping the existing chrome. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-14 right-3 z-40 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-white/[0.08] text-[11px] text-neutral-400 hover:text-white shadow-lg backdrop-blur transition-all"
        aria-label="Report a bug or issue"
        title="Report a bug or issue"
      >
        <Bug className="w-3 h-3" />
        Report
      </button>

      {open && (
        // Backdrop is decorative only — clicking it closes. The actual
        // dialog role + aria-modal + label belong on the visible panel
        // below, not the full-viewport backdrop. Previously the backdrop
        // carried them, which made screen readers announce the dialog
        // as starting at the backdrop rather than the content card.
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
          onClick={close}
          aria-hidden="true"
        >
          <div
            className="w-full max-w-md bg-neutral-950 border border-white/[0.08] rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Report a bug"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Bug className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Report an issue</h2>
              </div>
              <button
                onClick={close}
                className="text-neutral-500 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {submitted ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <Check className="w-10 h-10 text-emerald-400 mb-2" />
                  <p className="text-sm font-semibold text-white">Thanks — report received.</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    We&rsquo;ll triage it. No need to follow up.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Describe what&rsquo;s wrong. We auto-attach the page URL, your viewport, and
                    user agent so you don&rsquo;t need to.
                  </p>

                  {/* Severity selector */}
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-neutral-500">Severity:</span>
                    {(['low', 'normal', 'high'] as Severity[]).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeverity(s)}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          severity === s
                            ? s === 'high'
                              ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30'
                              : s === 'low'
                                ? 'bg-neutral-700/50 text-neutral-300 ring-1 ring-white/[0.06]'
                                : 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-white/[0.04] text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
                    }}
                    maxLength={2000}
                    rows={5}
                    placeholder="What happened? What did you expect to happen?"
                    autoFocus
                    className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-400/40"
                  />
                  <div className="flex items-center justify-between text-[10px] text-neutral-600">
                    <span>{message.length}/2000 · ⌘/Ctrl + Enter to send</span>
                  </div>

                  {error && (
                    <div className="text-xs text-red-400 inline-flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={hideForever}
                      className="text-[10px] text-neutral-600 hover:text-neutral-400 underline underline-offset-2"
                    >
                      Hide this button
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={close}
                        className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submit}
                        disabled={submitting || message.trim().length < 4}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-semibold rounded-md transition-colors"
                      >
                        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {submitting ? 'Sending…' : 'Send report'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
