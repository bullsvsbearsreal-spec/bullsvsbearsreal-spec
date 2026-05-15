'use client';

/**
 * /watch — Hyperliquid wallet position watcher.
 *
 * Each user adds 0x addresses they want pinged on. The /api/cron/watch-hl-wallets
 * cron polls every 60s, diffs against last snapshot, and sends Telegram alerts
 * for opens/closes/size changes/liq danger/realized PnL/funding paid based on
 * the per-wallet trigger config.
 */

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Eye, Plus, Trash2, Loader2, Activity, ArrowRight, ExternalLink, Shield,
  Settings, X, Save, Send, CheckCircle2, Sparkles,
} from 'lucide-react';
import type { Venue, WatchEventKind, WatchEventPayload } from '@/lib/hl-watch';

interface Wallet {
  id: number;
  address: string;
  label: string | null;
  trigger_opened: boolean;
  trigger_closed: boolean;
  trigger_size_changed: boolean;
  trigger_liq_danger: boolean;
  trigger_realized_pnl: boolean;
  trigger_funding_paid: boolean;
  size_change_pct: number;
  liq_danger_pct: number;
  realized_pnl_usd: number;
  funding_paid_usd: number;
  created_at: string;
}

interface EventRow {
  id: number;
  address: string;
  venue: Venue;
  symbol: string;
  kind: WatchEventKind;
  payload: WatchEventPayload;
  ts: string;
}

interface SnapshotRow {
  address: string;
  venue: Venue;
  positions: Array<{ coin: string; szi: number; positionValue: number }>;
  account_value: number | null;
  ts: string;
}

interface ApiResponse { wallets: Wallet[]; events: EventRow[]; snapshots: SnapshotRow[] }

interface SuggestedWhale {
  address: string;
  displayName: string | null;
  realizedPnl: number;
  winRate: number;
  liveNotional: number;
  venues: string[];
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function shortAddr(a: string): string {
  if (!a) return '0x…';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtPnl(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${fmtUsd(n)}`;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function relTime(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(ts).toLocaleString();
}

const KIND_TONE: Record<EventRow['kind'], string> = {
  opened:        'bg-emerald-500/10 text-emerald-400 border-emerald-400/30',
  closed:        'bg-rose-500/10 text-rose-400 border-rose-400/30',
  size_changed:  'bg-cyan-500/10 text-cyan-300 border-cyan-400/30',
  liq_danger:    'bg-amber-500/10 text-amber-300 border-amber-400/30',
  realized_pnl:  'bg-violet-500/10 text-violet-300 border-violet-400/30',
  funding_paid:  'bg-orange-500/10 text-orange-300 border-orange-400/30',
};

const KIND_LABEL: Record<EventRow['kind'], string> = {
  opened: 'OPENED', closed: 'CLOSED', size_changed: 'SIZE Δ',
  liq_danger: 'NEAR LIQ', realized_pnl: 'PNL', funding_paid: 'FUNDING',
};

function formatEvent(e: EventRow): string {
  const sym = e.symbol;
  // Defensive: parseJsonbObject in the API may return {} or null when
  // the upstream payload is missing/malformed. Treat null+undefined the
  // same as an empty object so accessing .side doesn't crash the row.
  const p = (e.payload ?? {}) as Partial<EventRow['payload']>;
  const side = p.side === 'short' ? 'SHORT' : 'LONG';
  switch (e.kind) {
    case 'opened':       return `${side} ${sym} · ${fmtUsd(p.sizeUsd ?? 0)}`;
    case 'closed': {
      const pnl = p.realizedPnl ?? 0;
      const sign = pnl >= 0 ? '+' : '';
      return `${side} ${sym} closed · realized ${sign}${fmtUsd(pnl)}`;
    }
    case 'size_changed': {
      const d = p.deltaPct ?? 0;
      return `${side} ${sym} · ${fmtUsd(p.prevSizeUsd ?? 0)} → ${fmtUsd(p.sizeUsd ?? 0)} (${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%)`;
    }
    case 'liq_danger':   return `${side} ${sym} · ${((p.distPct ?? 0) * 100).toFixed(2)}% from liq`;
    case 'realized_pnl': return `${side} ${sym} · realized ${fmtUsd(p.realizedPnl ?? 0)}`;
    case 'funding_paid': return `${side} ${sym} · ${(p.fundingDelta ?? 0) < 0 ? 'paid' : 'received'} ${fmtUsd(Math.abs(p.fundingDelta ?? 0))}`;
    // Future-proof: a kind added server-side before client redeploy
    // would otherwise return undefined and render a broken empty row.
    default: return `${side} ${sym} · ${e.kind}`;
  }
}

function WatchPageInner() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const prefillAddr = searchParams.get('add') ?? '';
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [addrInput, setAddrInput] = useState(prefillAddr);
  const [labelInput, setLabelInput] = useState('');
  // Refs for the deep-link flow: when the user lands here from
  // /trader/[address]'s "Watch positions" CTA the address is
  // already filled — we scroll the add-form into view and focus
  // the label input so they can type a friendly name and submit.
  // Without this, the form sat mid-page below the suggested-whales
  // section and users frequently missed that the address was even
  // prefilled.
  const formRef = useRef<HTMLElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [pingState, setPingState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [pingMsg, setPingMsg] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SuggestedWhale[] | null>(null);
  const [addingAddr, setAddingAddr] = useState<string | null>(null);
  const [filterAddr, setFilterAddr] = useState<string | null>(null);

  // Deep-link affordance: when `?add=` is present the user came from
  // /trader/[address] expecting to add a wallet. Scroll the form into
  // view + focus the label input (since the address is already filled).
  // Runs once on mount — guarded by status so we don't try to focus
  // anything while the auth/loading skeleton is rendering instead of
  // the form.
  useEffect(() => {
    if (!prefillAddr || status !== 'authenticated') return;
    const t = setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      labelInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [prefillAddr, status]);

  const handleTestPing = useCallback(async () => {
    setPingState('sending');
    setPingMsg(null);
    try {
      const res = await fetch('/api/watch/test-ping', { method: 'POST' });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setPingState('error');
        setPingMsg(j.error || `HTTP ${res.status}`);
        return;
      }
      setPingState('sent');
      setPingMsg('Check Telegram — sent.');
      setTimeout(() => { setPingState('idle'); setPingMsg(null); }, 4000);
    } catch (e) {
      setPingState('error');
      setPingMsg(e instanceof Error ? e.message : 'Request failed');
    }
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      // Combine the unmount-cancel signal with the 10s timeout so a slow
      // response after navigation doesn't setState on an unmounted component.
      const timeoutSignal = AbortSignal.timeout(10_000);
      const combined = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;
      const res = await fetch('/api/watch/wallets', { signal: combined });
      if (signal?.aborted) return;
      if (res.status === 401) { setLoading(false); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (signal?.aborted) return;
      setData(j);
    } catch (e) {
      // AbortError on unmount is expected — don't log it
      if ((e as { name?: string })?.name === 'AbortError') return;
      console.error('[watch] load error:', e);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') { setLoading(false); return; }
    // Each tick gets its own controller — the previous one is cancelled
    // before the next fires, and unmount cancels whichever is in flight.
    let current = new AbortController();
    load(current.signal);
    const iv = setInterval(() => {
      current.abort();
      current = new AbortController();
      load(current.signal);
    }, 30_000);
    return () => {
      clearInterval(iv);
      current.abort();
    };
  }, [status, load]);

  // Fetch top wallets from /smart-money to populate the "Suggested whales"
  // section. Was: a single ?include=both call which always returned HL-only
  // suggestions because HL whales have $100-200M lifetime PnL vs GMX top
  // traders at $5-20M — HL always crowded out GMX. Christian's counter-
  // traders (0xabF6, 0xB8ba…) live on Arbitrum GMX, so we now pull both
  // venues separately and interleave 4+4 so the suggestion list is
  // venue-diverse. Same API caching either way (smart-money caches per
  // include= key).
  useEffect(() => {
    if (status !== 'authenticated') return;
    const ac = new AbortController();
    Promise.all([
      fetch('/api/smart-money?limit=4&include=hl', { signal: ac.signal }).then(r => r.ok ? r.json() : null),
      fetch('/api/smart-money?limit=4&include=gmx', { signal: ac.signal }).then(r => r.ok ? r.json() : null),
    ])
      .then(([hl, gmx]) => {
        const hlRows: SuggestedWhale[] = (hl?.data ?? []).slice(0, 4);
        const gmxRows: SuggestedWhale[] = (gmx?.data ?? []).slice(0, 4);
        // Interleave HL + GMX so both venues are visible without the user
        // having to scroll. If one venue returns empty, the other fills.
        const merged: SuggestedWhale[] = [];
        const max = Math.max(hlRows.length, gmxRows.length);
        for (let i = 0; i < max; i++) {
          if (hlRows[i])  merged.push(hlRows[i]);
          if (gmxRows[i]) merged.push(gmxRows[i]);
        }
        setSuggested(merged.slice(0, 8).map(w => ({
          address: w.address,
          displayName: w.displayName ?? null,
          realizedPnl: w.realizedPnl,
          winRate: w.winRate,
          liveNotional: w.liveNotional,
          venues: w.venues ?? [],
        })));
      })
      .catch(() => { /* non-critical, just don't show the section */ });
    return () => ac.abort();
  }, [status]);

  const handleSubscribe = useCallback(async (addr: string, label: string | null) => {
    setAddingAddr(addr);
    try {
      const res = await fetch('/api/watch/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, label }),
      });
      if (res.ok) await load();
    } catch (e) { console.error('[watch] subscribe error:', e); }
    finally { setAddingAddr(null); }
  }, [load]);

  const handleAdd = async () => {
    setError(null);
    const addr = addrInput.trim().toLowerCase();
    if (!ADDR_RE.test(addr)) { setError('Invalid 0x… address'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/watch/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, label: labelInput.trim() || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setAddrInput(''); setLabelInput('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm('Stop watching this wallet?')) return;
    try {
      const res = await fetch(`/api/watch/wallets/${id}`, { method: 'DELETE' });
      // Surface the error if the DELETE failed — was previously silent,
      // so an auth-expired or 500'd delete looked successful (the wallet
      // briefly disappeared from the list during the load() reload, then
      // came back).
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      console.error('[watch] delete error:', e);
      setError(e instanceof Error ? e.message : 'Failed to remove wallet');
    }
  };

  // ── Auth gates ────────────────────────────────────────────────────
  if (status === 'loading') {
    return <div className="min-h-screen bg-hub-black"><Header /><div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 text-neutral-500 animate-spin" /></div><Footer /></div>;
  }
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="max-w-[640px] mx-auto px-4 py-12">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
            <Shield className="w-10 h-10 text-hub-yellow mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Sign in to watch wallets</h1>
            <p className="text-sm text-neutral-400 mb-5">Telegram delivery requires a linked account.</p>
            <Link href="/login?callbackUrl=/watch" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-hub-yellow text-black font-semibold text-sm hover:bg-hub-yellow/90">
              Sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const wallets = data?.wallets ?? [];
  const events = data?.events ?? [];
  const snapshots = data?.snapshots ?? [];
  // Group snapshots per address — a single address can have rows for both
  // Hyperliquid AND gTrade venues, so collapse them into a per-address
  // summary (total open positions across venues, list of venues active).
  const snapByAddr = new Map<string, { venues: SnapshotRow[]; totalPositions: number; latestTs: string | null }>();
  for (const s of snapshots) {
    const existing = snapByAddr.get(s.address);
    if (existing) {
      existing.venues.push(s);
      existing.totalPositions += (s.positions?.length ?? 0);
      if (!existing.latestTs || new Date(s.ts) > new Date(existing.latestTs)) existing.latestTs = s.ts;
    } else {
      snapByAddr.set(s.address, { venues: [s], totalPositions: s.positions?.length ?? 0, latestTs: s.ts });
    }
  }

  // Per-wallet event stats: count events fired in the last 24h. Drives
  // the activity badge on each watchlist row + the page-wide "events 24h"
  // counter in the stats strip.
  const now = Date.now();
  const eventsByAddr = new Map<string, number>();
  let events24h = 0;
  let lastEventTs: string | null = null;
  for (const e of events) {
    const t = new Date(e.ts).getTime();
    if (now - t < 86_400_000) {
      eventsByAddr.set(e.address, (eventsByAddr.get(e.address) ?? 0) + 1);
      events24h++;
    }
    if (!lastEventTs || t > new Date(lastEventTs).getTime()) lastEventTs = e.ts;
  }

  // Apply the click-to-filter — when the user clicks a wallet row, the
  // event log narrows to that address only.
  const filteredEvents = filterAddr
    ? events.filter(e => e.address === filterAddr)
    : events;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="text-white max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Eye className="w-5 h-5 text-hub-yellow" />
            <h1 className="text-2xl font-bold bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
              Wallet Watch
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Hyperliquid
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              gTrade
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleTestPing}
                disabled={pingState === 'sending'}
                className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                  pingState === 'sent'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/40'
                    : pingState === 'error'
                      ? 'bg-rose-500/10 text-rose-300 border-rose-400/40'
                      : 'bg-white/[0.04] text-neutral-300 border-white/[0.08] hover:bg-white/[0.06] hover:text-white'
                }`}
                title="Send a test message to your linked Telegram chat"
              >
                {pingState === 'sending'
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : pingState === 'sent'
                    ? <CheckCircle2 className="w-3 h-3" />
                    : <Send className="w-3 h-3" />}
                {pingState === 'sending' ? 'Sending…' : pingState === 'sent' ? 'Sent' : 'Test ping'}
              </button>
            </div>
          </div>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Get Telegram pings when any wallet you watch opens, closes, resizes, gets near liq, takes realized PnL, or pays funding — across Hyperliquid, gTrade (Arbitrum), <em>and</em> GMX V2 (Arbitrum + Avalanche). Polled every 60s; pings typically arrive within a minute or two.
          </p>
          {pingMsg && (
            <p className={`text-[11px] mt-2 ${pingState === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {pingMsg}
            </p>
          )}
        </header>

        {/* Stats strip — only shown when there are wallets to summarise */}
        {wallets.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatCell label="Watching" value={`${wallets.length}/25`} />
            <StatCell
              label="Events · 24h"
              value={String(events24h)}
              valueClass={events24h > 0 ? 'text-emerald-400' : 'text-neutral-500'}
            />
            <StatCell
              label="Last event"
              value={lastEventTs ? relTime(lastEventTs) : '—'}
              valueClass={lastEventTs ? 'text-white' : 'text-neutral-500'}
            />
          </div>
        )}

        {/* Add form */}
        <section ref={formRef} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-white mb-3 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" />
            Add a wallet
            {prefillAddr && (
              <span className="text-[10px] font-normal text-hub-yellow normal-case tracking-normal">
                · prefilled from trader profile
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
            <input
              type="text" value={addrInput}
              onChange={e => { setAddrInput(e.target.value); setError(null); }}
              placeholder="0x… any Hyperliquid, gTrade, or GMX wallet"
              aria-label="Wallet address"
              aria-describedby={error ? 'watch-addr-error' : undefined}
              aria-invalid={!!error}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40"
              autoComplete="off" spellCheck={false}
            />
            <input
              ref={labelInputRef}
              type="text" value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              placeholder="Label (optional)"
              aria-label="Wallet label (optional)"
              maxLength={80}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40"
            />
            <button
              onClick={handleAdd} disabled={adding || !addrInput.trim()}
              className="px-4 py-2 rounded-lg bg-hub-yellow text-black font-semibold text-sm disabled:opacity-50 hover:bg-hub-yellow/90 inline-flex items-center justify-center gap-1.5"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Watch
            </button>
          </div>
          {error && <div id="watch-addr-error" role="alert" className="text-[11px] text-rose-400 mt-2">{error}</div>}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="text-neutral-600">Or pick from leaderboards:</span>
            <Link href="/hl-traders" className="text-neutral-400 hover:text-hub-yellow inline-flex items-center gap-0.5">
              /hl-traders <ExternalLink className="w-2.5 h-2.5" />
            </Link>
            <Link href="/smart-money" className="text-neutral-400 hover:text-hub-yellow inline-flex items-center gap-0.5">
              /smart-money <ExternalLink className="w-2.5 h-2.5" />
            </Link>
            <Link href="/whale-liq" className="text-neutral-400 hover:text-hub-yellow inline-flex items-center gap-0.5">
              /whale-liq <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>
        </section>

        {/* Suggested whales — shown when user has < 5 wallets so it
            doesn't clutter the page once they've curated their own list */}
        {wallets.length < 5 && suggested && suggested.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-white mb-2 px-1 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-hub-yellow" />
              Suggested whales
              <span className="text-[10px] font-mono text-neutral-600">top traders by realized PnL · click to watch</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {suggested.slice(0, 8).map(w => {
                const alreadyWatching = wallets.some(x => x.address.toLowerCase() === w.address.toLowerCase());
                const submitting = addingAddr === w.address;
                return (
                  <div key={w.address} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <Link href={`/trader/${w.address}`} className="font-mono text-xs text-white hover:text-hub-yellow truncate">
                        {w.displayName || shortAddr(w.address)}
                      </Link>
                      <button
                        onClick={() => handleSubscribe(w.address, w.displayName || null)}
                        disabled={alreadyWatching || submitting}
                        className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors ${
                          alreadyWatching
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/30 cursor-default'
                            : submitting
                              ? 'bg-white/[0.04] text-neutral-500 border-white/[0.08] cursor-wait'
                              : 'bg-hub-yellow/10 text-hub-yellow border-hub-yellow/30 hover:bg-hub-yellow/20'
                        }`}
                      >
                        {alreadyWatching
                          ? <><CheckCircle2 className="w-2.5 h-2.5" /> Watching</>
                          : submitting
                            ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            : <><Plus className="w-2.5 h-2.5" /> Watch</>}
                      </button>
                    </div>
                    <div className="flex items-baseline gap-2 text-[10px] font-mono">
                      <span className={w.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {fmtPnl(w.realizedPnl)}
                      </span>
                      {/* WR is only shown when non-zero — Hyperliquid's leaderboard
                          doesn't expose wins/losses so HL-only traders come back as
                          winRate=0 from /smart-money. Showing "0% WR" looks broken
                          rather than honest "we don't know". */}
                      {w.winRate > 0 && (
                        <>
                          <span className="text-neutral-600">·</span>
                          <span className="text-neutral-400">{w.winRate.toFixed(0)}% WR</span>
                        </>
                      )}
                      {w.liveNotional > 0 && (
                        <>
                          <span className="text-neutral-600">·</span>
                          <span className="text-neutral-400">{fmtUsd(w.liveNotional)} live</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {w.venues.includes('hyperliquid') && (
                        <span className="text-[8px] font-mono uppercase tracking-wider text-emerald-400 border border-emerald-400/30 bg-emerald-500/10 px-1 py-px rounded">HL</span>
                      )}
                      {(w.venues.includes('gmx-arbitrum') || w.venues.includes('gmx-avalanche')) && (
                        <span className="text-[8px] font-mono uppercase tracking-wider text-violet-300 border border-violet-400/30 bg-violet-500/10 px-1 py-px rounded">GMX</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Watchlist */}
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-white mb-3 px-1 flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-neutral-500" />
            Your watchlist
            <span className="text-[10px] font-mono text-neutral-600">({wallets.length}/25)</span>
          </h2>
          {loading && wallets.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-8 text-center text-xs text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-neutral-600" />
              Loading…
            </div>
          ) : wallets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center text-xs text-neutral-500">
              No wallets watched yet. Paste an address above or pick one from a leaderboard.
            </div>
          ) : (
            <ul className="space-y-2">
              {wallets.map(w => {
                const snapInfo = snapByAddr.get(w.address);
                const venues = snapInfo?.venues ?? [];
                const totalPositions = snapInfo?.totalPositions ?? 0;
                const recent24h = eventsByAddr.get(w.address) ?? 0;
                const isFiltered = filterAddr === w.address;
                return (
                  <li
                    key={w.id}
                    className={`rounded-xl border p-3.5 transition-colors cursor-pointer ${
                      isFiltered
                        ? 'border-hub-yellow/40 bg-hub-yellow/[0.06]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03]'
                    }`}
                    onClick={() => setFilterAddr(isFiltered ? null : w.address)}
                    onKeyDown={e => {
                      // Only fire the filter toggle when Enter/Space lands
                      // directly on this <li>. Was: pressing Enter while
                      // focused on the nested <Link>/<button> triggered
                      // both the child's action (navigate / edit / remove)
                      // AND mutated the filter state behind it. e.target
                      // !== e.currentTarget catches all child-focused
                      // keydowns regardless of nesting depth.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFilterAddr(isFiltered ? null : w.address);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isFiltered}
                    title={isFiltered ? 'Click to clear filter' : 'Click to filter event log to this wallet'}
                  >
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/trader/${w.address}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-sm text-white hover:text-hub-yellow truncate"
                          >
                            {w.label || shortAddr(w.address)}
                          </Link>
                          {w.label && <span className="font-mono text-[11px] text-neutral-500">{shortAddr(w.address)}</span>}
                          {/* Activity pill — count of events fired in last 24h */}
                          {recent24h > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-400/30">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                              {recent24h} · 24h
                            </span>
                          )}
                          {snapInfo && (
                            <span className="text-[10px] font-mono text-neutral-600">
                              {totalPositions} pos · synced {snapInfo.latestTs ? relTime(snapInfo.latestTs) : '—'}
                            </span>
                          )}
                          {!snapInfo && <span className="text-[10px] font-mono text-neutral-600 italic">awaiting first poll…</span>}
                        </div>
                        {/* Per-venue mini-strip */}
                        {venues.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {venues.map(v => <VenueChip key={v.venue} venue={v.venue} positions={v.positions?.length ?? 0} />)}
                          </div>
                        )}
                        {/* Trigger badges */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {w.trigger_opened &&        <TrigBadge label="Opens" />}
                          {w.trigger_closed &&        <TrigBadge label="Closes" />}
                          {w.trigger_size_changed &&  <TrigBadge label={`Size ≥${(w.size_change_pct * 100).toFixed(0)}%`} />}
                          {w.trigger_liq_danger &&    <TrigBadge label={`Liq <${(w.liq_danger_pct * 100).toFixed(0)}%`} />}
                          {w.trigger_realized_pnl &&  <TrigBadge label={`PnL ≥${fmtUsd(w.realized_pnl_usd)}`} />}
                          {w.trigger_funding_paid &&  <TrigBadge label={`Funding ≥${fmtUsd(w.funding_paid_usd)}`} />}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditing(w); }}
                          title="Edit triggers + thresholds"
                          className="p-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-hub-yellow hover:border-hub-yellow/30 transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemove(w.id); }}
                          title="Remove"
                          className="p-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-rose-400 hover:border-rose-400/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Event log */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-white mb-3 px-1 flex items-center gap-2 flex-wrap">
            <Activity className="w-3.5 h-3.5 text-neutral-500" />
            Recent events
            {filterAddr ? (
              <>
                <span className="text-[10px] font-mono text-hub-yellow">
                  · filtered to {wallets.find(w => w.address === filterAddr)?.label || shortAddr(filterAddr)}
                </span>
                <button
                  onClick={() => setFilterAddr(null)}
                  className="text-[10px] text-neutral-500 hover:text-white inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-white/[0.08] hover:border-white/[0.15] ml-auto"
                >
                  <X className="w-2.5 h-2.5" />
                  Clear
                </button>
              </>
            ) : (
              <span className="text-[10px] font-mono text-neutral-600">across your watched wallets · click a wallet above to filter</span>
            )}
          </h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {filteredEvents.length === 0 ? (
              <div className="px-3 py-10 text-center text-xs text-neutral-600">
                {wallets.length === 0
                  ? 'Add a wallet above to start collecting events.'
                  : filterAddr
                    ? 'No events for this wallet yet — clear the filter to see all.'
                    : "No events yet — when one of your wallets opens, closes, or resizes a position, it'll show here."}
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {filteredEvents.map(e => {
                  const wallet = wallets.find(w => w.address === e.address);
                  return (
                    <li key={e.id} className="px-3.5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] text-xs">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${KIND_TONE[e.kind]}`}>
                        {KIND_LABEL[e.kind]}
                      </span>
                      <VenueChip venue={e.venue} compact />
                      <span className="font-mono text-neutral-300 truncate">
                        {wallet?.label || shortAddr(e.address)}
                      </span>
                      <span className="text-neutral-500 truncate">·</span>
                      <span className="text-neutral-300 truncate">{formatEvent(e)}</span>
                      <span className="ml-auto text-[10px] text-neutral-600 font-mono shrink-0">{relTime(e.ts)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Footer info */}
        <p className="mt-8 text-[11px] text-neutral-600 max-w-2xl text-center mx-auto">
          Hyperliquid + gTrade Arbitrum + GMX V2 (Arbitrum + Avalanche). Events are polled every 60s — actual Telegram delivery typically arrives within a minute or two of the on-chain change.{' '}
          <Link href="/profile?tab=notifications" className="text-hub-yellow hover:underline">Link Telegram</Link>{' '}
          if you haven&apos;t already, or alerts won&apos;t deliver.
        </p>
      </main>

      {/* Edit modal — per-wallet trigger toggles + threshold tuning */}
      {editing && (
        <EditWalletModal
          wallet={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}

      <Footer />
    </div>
  );
}

/** Compact stat tile for the page-wide summary strip — three are
 *  rendered in a row above the watchlist. */
function StatCell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-medium">{label}</div>
      <div className={`text-base font-bold font-mono tabular-nums mt-0.5 ${valueClass ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

function TrigBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.03] text-neutral-400 border border-white/[0.06]">
      {label}
    </span>
  );
}

/** Small per-venue tag — shown on each event row + in the per-wallet
 *  venue strip so users can see at a glance which venue an event came
 *  from and whether the watcher has data for both venues yet. */
function VenueChip({ venue, positions, compact = false }: { venue: Venue; positions?: number; compact?: boolean }) {
  // GMX added May 2026 alongside HL + gTrade — same chip shape, just
  // a distinct violet tone so christian can see which side an event
  // came from when the same wallet has positions on both DEXes
  // simultaneously (common for cross-protocol farmers).
  const tone = venue === 'gtrade' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/30'
             : venue === 'gmx'    ? 'bg-violet-500/10 text-violet-300 border-violet-400/30'
             : 'bg-emerald-500/10 text-emerald-400 border-emerald-400/30';
  const label = venue === 'gtrade' ? 'gTrade'
              : venue === 'gmx'    ? 'GMX'
              : 'Hyperliquid';
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${tone}`}>
      {label}
      {!compact && positions != null && (
        <span className="font-mono opacity-80">· {positions}</span>
      )}
    </span>
  );
}

/** Per-wallet edit modal — lets the user toggle individual triggers
 *  and tune the four numeric thresholds (size %, liq %, PnL $, funding $).
 *  Persists via PUT /api/watch/wallets/[id]; reload on save. */
function EditWalletModal({
  wallet, onClose, onSaved,
}: { wallet: Wallet; onClose: () => void; onSaved: () => Promise<void> }) {
  const [label, setLabel] = useState(wallet.label ?? '');
  const [opens, setOpens] = useState(wallet.trigger_opened);
  const [closes, setCloses] = useState(wallet.trigger_closed);
  const [sizeOn, setSizeOn] = useState(wallet.trigger_size_changed);
  const [liqOn, setLiqOn] = useState(wallet.trigger_liq_danger);
  const [pnlOn, setPnlOn] = useState(wallet.trigger_realized_pnl);
  const [fundingOn, setFundingOn] = useState(wallet.trigger_funding_paid);
  const [sizePct, setSizePct] = useState(wallet.size_change_pct);
  const [liqPct, setLiqPct] = useState(wallet.liq_danger_pct);
  const [pnlUsd, setPnlUsd] = useState(wallet.realized_pnl_usd);
  const [fundingUsd, setFundingUsd] = useState(wallet.funding_paid_usd);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const body = {
        label: label.trim() || null,
        triggerOpened: opens,
        triggerClosed: closes,
        triggerSizeChanged: sizeOn,
        triggerLiqDanger: liqOn,
        triggerRealizedPnl: pnlOn,
        triggerFundingPaid: fundingOn,
        sizeChangePct: sizePct,
        liqDangerPct: liqPct,
        realizedPnlUsd: pnlUsd,
        fundingPaidUsd: fundingUsd,
      };
      const res = await fetch(`/api/watch/wallets/${wallet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      // Reset saving flag in finally — previously only reset in catch,
      // so if onSaved() ever rejected (load() error during reload), the
      // modal stayed open and the Save button was permanently disabled.
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#111] shadow-2xl">
        <header className="sticky top-0 z-10 px-5 py-3.5 border-b border-white/[0.06] bg-[#111]/95 backdrop-blur-md flex items-center gap-2">
          <Settings className="w-4 h-4 text-hub-yellow" />
          <h3 className="text-sm font-bold text-white">Edit watch</h3>
          <span className="text-[10px] font-mono text-neutral-600 truncate flex-1">{shortAddr(wallet.address)}</span>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          {/* Label */}
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Label</div>
            <input
              type="text" value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Optional nickname for this wallet"
              maxLength={80}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40"
            />
          </label>

          {/* Trigger toggles */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Triggers</div>
            <div className="space-y-1.5">
              <ToggleRow label="Position opened"  desc="Any new symbol on the book"            on={opens}     onChange={setOpens} />
              <ToggleRow label="Position closed"  desc="Symbol gone from book — with realized PnL" on={closes} onChange={setCloses} />
              <ToggleRow label="Size changed"     desc="Notional moved by ≥ threshold"          on={sizeOn}    onChange={setSizeOn} />
              <ToggleRow label="Near liquidation" desc="Distance to liq dropped under threshold" on={liqOn}     onChange={setLiqOn} />
              <ToggleRow label="Realized PnL"     desc="Closed trade with |PnL| ≥ threshold"    on={pnlOn}     onChange={setPnlOn} />
              <ToggleRow label="Funding paid"     desc="Cumulative funding Δ ≥ threshold (HL only)" on={fundingOn} onChange={setFundingOn} />
            </div>
          </div>

          {/* Numeric thresholds */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Thresholds</div>
            <ThresholdRow
              label="Size change"
              value={`≥${(sizePct * 100).toFixed(0)}%`}
              disabled={!sizeOn}
            >
              <input
                type="range" min={0.01} max={0.50} step={0.01}
                value={sizePct} onChange={e => setSizePct(Number(e.target.value))}
                disabled={!sizeOn}
                className="w-full disabled:opacity-40"
              />
            </ThresholdRow>
            <ThresholdRow
              label="Liq distance"
              value={`<${(liqPct * 100).toFixed(0)}%`}
              disabled={!liqOn}
            >
              <input
                type="range" min={0.01} max={0.20} step={0.01}
                value={liqPct} onChange={e => setLiqPct(Number(e.target.value))}
                disabled={!liqOn}
                className="w-full disabled:opacity-40"
              />
            </ThresholdRow>
            <ThresholdRow
              label="Realized PnL"
              value={`≥${fmtUsd(pnlUsd)}`}
              disabled={!pnlOn}
            >
              <input
                type="range" min={100} max={100_000} step={100}
                value={pnlUsd} onChange={e => setPnlUsd(Number(e.target.value))}
                disabled={!pnlOn}
                className="w-full disabled:opacity-40"
              />
            </ThresholdRow>
            <ThresholdRow
              label="Funding paid"
              value={`≥${fmtUsd(fundingUsd)}`}
              disabled={!fundingOn}
            >
              <input
                type="range" min={100} max={100_000} step={100}
                value={fundingUsd} onChange={e => setFundingUsd(Number(e.target.value))}
                disabled={!fundingOn}
                className="w-full disabled:opacity-40"
              />
            </ThresholdRow>
          </div>

          {err && <div className="text-[11px] text-rose-400">{err}</div>}
        </div>

        <footer className="sticky bottom-0 z-10 px-5 py-3 border-t border-white/[0.06] bg-[#111]/95 backdrop-blur-md flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.1] text-neutral-300 hover:bg-white/[0.04] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save} disabled={saving}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-hub-yellow text-black hover:bg-hub-yellow/90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.03] text-left transition-colors"
    >
      <div className={`flex-shrink-0 w-8 rounded-full transition-colors relative ${on ? 'bg-hub-yellow' : 'bg-white/[0.08]'}`} style={{ height: 18 }}>
        <span
          className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform"
          style={{ left: on ? 'calc(100% - 16px)' : '2px' }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold ${on ? 'text-white' : 'text-neutral-400'}`}>{label}</div>
        <div className="text-[10px] text-neutral-600">{desc}</div>
      </div>
    </button>
  );
}

function ThresholdRow({ label, value, disabled, children }: { label: string; value: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className={`px-2.5 py-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</span>
        <span className={`text-xs font-mono tabular-nums ${disabled ? 'text-neutral-600' : 'text-hub-yellow'}`}>{value}</span>
      </div>
      {children}
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-hub-black">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
        </div>
        <Footer />
      </div>
    }>
      <WatchPageInner />
    </Suspense>
  );
}
