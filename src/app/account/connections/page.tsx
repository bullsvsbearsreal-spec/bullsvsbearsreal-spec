'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Key,
  Wallet,
  Plus,
  Trash2,
  Lock,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Bell,
  BellOff,
} from 'lucide-react';

interface ExchangeKey {
  id: number;
  exchange: string;
  label: string | null;
  keyPrefix: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface WalletRow {
  id: number;
  chain: string;
  address: string;
  label: string | null;
  createdAt: string;
}

const NEEDS_PASSPHRASE = new Set(['OKX', 'Bitget']);

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ConnectionsPage() {
  const [keys, setKeys] = useState<ExchangeKey[] | null>(null);
  const [wallets, setWallets] = useState<WalletRow[] | null>(null);
  const [supportedExchanges, setSupportedExchanges] = useState<string[]>([]);
  const [supportedChains, setSupportedChains] = useState<string[]>([]);
  const [authError, setAuthError] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [showWalletForm, setShowWalletForm] = useState(false);

  const loadKeys = useCallback(async () => {
    const res = await fetch('/api/account/exchange-keys', { signal: AbortSignal.timeout(8000) });
    if (res.status === 401) { setAuthError(true); return; }
    if (!res.ok) return;
    const json = await res.json();
    setKeys(json.keys || []);
    setSupportedExchanges(json.supportedExchanges || []);
  }, []);

  const loadWallets = useCallback(async () => {
    const res = await fetch('/api/account/wallets', { signal: AbortSignal.timeout(8000) });
    if (res.status === 401) { setAuthError(true); return; }
    if (!res.ok) return;
    const json = await res.json();
    setWallets(json.wallets || []);
    setSupportedChains(json.supportedChains || []);
  }, []);

  useEffect(() => {
    loadKeys();
    loadWallets();
  }, [loadKeys, loadWallets]);

  const deleteKey = async (id: number) => {
    if (!confirm('Remove this connected key? Positions from it will stop updating.')) return;
    const res = await fetch(`/api/account/exchange-keys/${id}`, { method: 'DELETE' });
    if (res.ok) loadKeys();
  };

  const deleteWallet = async (id: number) => {
    if (!confirm('Remove this connected wallet? Positions from it will stop updating.')) return;
    const res = await fetch(`/api/account/wallets/${id}`, { method: 'DELETE' });
    if (res.ok) loadWallets();
  };

  if (authError) {
    return (
      <>
        <Header />
        <main className="max-w-[900px] mx-auto px-4 py-12 text-center">
          <Lock className="w-10 h-10 mx-auto text-neutral-600 mb-3" />
          <h1 className="text-lg font-semibold text-white mb-2">Sign in required</h1>
          <p className="text-sm text-neutral-500 mb-4">
            Connect your CEX keys + DEX wallets after signing in to your InfoHub account.
          </p>
          <a href="/login" className="inline-block bg-hub-yellow text-black text-sm font-semibold px-4 py-2 rounded-md hover:bg-hub-yellow/90">
            Sign in
          </a>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-[900px] mx-auto w-full px-4 py-6">
        {/* Hero */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white">Connections</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Connect your CEX API keys and wallet addresses so InfoHub can show you a unified
            portfolio view at <a href="/positions" className="text-hub-yellow hover:underline">/positions</a>.
          </p>
        </div>

        {/* Security explainer */}
        <div className="card-premium p-3 mb-5 border border-amber-500/20 bg-amber-500/[0.03]">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300 leading-relaxed">
              <strong className="text-amber-400">Use READ-ONLY API keys.</strong>{' '}
              Disable trade + withdraw permissions on the exchange before pasting them here.
              Keys are encrypted at rest with AES-256-GCM and decrypted only at the moment we
              query positions. We never accept or send these keys back over the wire after you
              save them.
            </div>
          </div>
        </div>

        {/* ─── CEX Keys ─── */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                CEX API Keys
              </h2>
              <span className="text-[11px] text-neutral-600 font-mono">({keys?.length ?? 0})</span>
            </div>
            <button
              onClick={() => setShowKeyForm(v => !v)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30 hover:bg-sky-500/20"
            >
              <Plus className="w-3 h-3" /> {showKeyForm ? 'Cancel' : 'Add key'}
            </button>
          </div>

          {showKeyForm && (
            <AddKeyForm
              exchanges={supportedExchanges}
              onSaved={() => { setShowKeyForm(false); loadKeys(); }}
            />
          )}

          {keys === null ? (
            <div className="card-premium p-4 text-center text-xs text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" /> loading…
            </div>
          ) : keys.length === 0 ? (
            <div className="card-premium p-6 text-center">
              <Key className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">No exchange keys connected yet.</p>
              <p className="text-[11px] text-neutral-600 mt-1">
                Click <em>Add key</em> to connect your first one.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map(k => (
                <div key={k.id} className="card-premium p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{k.exchange}</span>
                      <span className="text-[11px] text-neutral-600 font-mono">•••{k.keyPrefix}</span>
                      {k.label && <span className="text-[11px] text-neutral-500">· {k.label}</span>}
                    </div>
                    <div className="text-[10px] text-neutral-600 mt-0.5">
                      Last sync: {timeAgo(k.lastSyncedAt)}
                      {k.lastError && (
                        <span className="ml-2 text-red-400 inline-flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> {k.lastError}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteKey(k.id)}
                    className="p-1.5 rounded-md text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="Remove key"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Wallets ─── */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Wallets (DEX)
              </h2>
              <span className="text-[11px] text-neutral-600 font-mono">({wallets?.length ?? 0})</span>
            </div>
            <button
              onClick={() => setShowWalletForm(v => !v)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
            >
              <Plus className="w-3 h-3" /> {showWalletForm ? 'Cancel' : 'Add wallet'}
            </button>
          </div>

          {showWalletForm && (
            <AddWalletForm
              chains={supportedChains}
              onSaved={() => { setShowWalletForm(false); loadWallets(); }}
            />
          )}

          {wallets === null ? (
            <div className="card-premium p-4 text-center text-xs text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" /> loading…
            </div>
          ) : wallets.length === 0 ? (
            <div className="card-premium p-6 text-center">
              <Wallet className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">No wallets connected yet.</p>
              <p className="text-[11px] text-neutral-600 mt-1">
                Read-only — paste a wallet address to track its DEX positions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {wallets.map(w => (
                <div key={w.id} className="card-premium p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white capitalize">{w.chain}</span>
                      <span className="text-[11px] text-neutral-500 font-mono">{shortAddr(w.address)}</span>
                      {w.label && <span className="text-[11px] text-neutral-500">· {w.label}</span>}
                    </div>
                    <div className="text-[10px] text-neutral-600 mt-0.5">
                      Added {timeAgo(w.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteWallet(w.id)}
                    className="p-1.5 rounded-md text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="Remove wallet"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Alert rules (Phase D) ─── */}
        <FundingFlipAlert />

        {/* Footer link */}
        <div className="text-center mt-8 text-xs text-neutral-600">
          Once connected, your unified portfolio appears at{' '}
          <a href="/positions" className="text-hub-yellow hover:underline inline-flex items-center gap-1">
            /positions <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}

// ─── Funding-flip alert toggle (Phase D) ───────────────────────────────────

interface AlertRule {
  id: number;
  kind: string;
  enabled: boolean;
  channels: string[];
  cooldownMin: number;
  lastFiredAt: string | null;
}

const ALL_CHANNELS = ['telegram', 'email'] as const;
type Channel = typeof ALL_CHANNELS[number];

function FundingFlipAlert() {
  const [rules, setRules] = useState<AlertRule[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/account/alerts', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const json = await res.json();
      setRules(json.rules || []);
    } catch { /* swallow */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fundingFlip = rules?.find(r => r.kind === 'funding_flip') ?? null;
  const enabled = Boolean(fundingFlip?.enabled);
  const channels: Channel[] = (fundingFlip?.channels?.filter((c): c is Channel => (ALL_CHANNELS as readonly string[]).includes(c)) ?? ['telegram']);

  const persist = async (nextEnabled: boolean, nextChannels: Channel[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/account/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'funding_flip',
          enabled: nextEnabled,
          channels: nextChannels.length > 0 ? nextChannels : ['telegram'],
          cooldownMin: 60,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = () => persist(!enabled, channels);
  const toggleChannel = (c: Channel) => {
    const next = channels.includes(c) ? channels.filter(x => x !== c) : [...channels, c];
    if (next.length === 0) {
      // never persist an empty channel set — silently keep current
      setError('At least one channel required');
      return;
    }
    persist(enabled, next);
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Alerts</h2>
      </div>
      <div className="card-premium p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[0.04] text-neutral-600'}`}>
            {enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-white">Funding flip alerts</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Get notified when funding on any open position flips against your direction.
                  60-min cooldown bundles every flipped position into one notification.
                </p>
              </div>
              <button
                onClick={toggleEnabled}
                disabled={saving}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  enabled
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-sky-500 text-black hover:bg-sky-400'
                }`}
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {enabled ? 'Enabled · click to disable' : 'Enable'}
              </button>
            </div>

            {enabled && (
              <div className="mt-3 pt-3 border-t border-white/[0.05]">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 font-medium">Channels</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_CHANNELS.map(c => {
                    const on = channels.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => toggleChannel(c)}
                        disabled={saving}
                        className={`text-[11px] px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
                          on
                            ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25'
                            : 'bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-neutral-700'}`} />
                        {c === 'telegram' ? 'Telegram' : 'Email'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {fundingFlip?.lastFiredAt && (
              <div className="text-[10px] text-neutral-600 mt-2">
                Last fired: {new Date(fundingFlip.lastFiredAt).toLocaleString()}
              </div>
            )}
            {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
            <div className="text-[10px] text-neutral-600 mt-2 leading-relaxed">
              Telegram requires a linked chat (<a href="/settings/notifications" className="text-hub-yellow hover:underline">connect</a>).
              Email goes to your account address — verify it on <a href="/account" className="text-hub-yellow hover:underline">/account</a> if you haven&apos;t.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Add-key form ──────────────────────────────────────────────────────────

function AddKeyForm({ exchanges, onSaved }: { exchanges: string[]; onSaved: () => void }) {
  const [exchange, setExchange] = useState(exchanges[0] || '');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPassphrase = NEEDS_PASSPHRASE.has(exchange);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/exchange-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          passphrase: showPassphrase ? passphrase.trim() : undefined,
          label: label.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      // Wipe secrets from local state immediately
      setApiKey(''); setApiSecret(''); setPassphrase(''); setLabel('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="card-premium p-4 mb-3 space-y-3 border border-sky-500/20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Exchange</span>
          <select
            value={exchange}
            onChange={e => setExchange(e.target.value)}
            className="w-full bg-white/[0.04] text-white text-sm rounded-md px-2.5 py-1.5 ring-1 ring-white/[0.08] focus:ring-sky-500 outline-none"
          >
            {exchanges.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={60}
            placeholder="main, alt-account, …"
            className="w-full bg-white/[0.04] text-white text-sm rounded-md px-2.5 py-1.5 ring-1 ring-white/[0.08] focus:ring-sky-500 outline-none"
          />
        </label>
      </div>
      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">API key</span>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          required
          minLength={8}
          maxLength={256}
          className="w-full bg-white/[0.04] text-white text-sm rounded-md px-2.5 py-1.5 ring-1 ring-white/[0.08] focus:ring-sky-500 outline-none font-mono"
        />
      </label>
      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">API secret</span>
        <input
          type="password"
          autoComplete="off"
          value={apiSecret}
          onChange={e => setApiSecret(e.target.value)}
          required
          minLength={8}
          maxLength={256}
          className="w-full bg-white/[0.04] text-white text-sm rounded-md px-2.5 py-1.5 ring-1 ring-white/[0.08] focus:ring-sky-500 outline-none font-mono"
        />
      </label>
      {showPassphrase && (
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
            Passphrase <span className="text-neutral-600">(set when you created the key on {exchange})</span>
          </span>
          <input
            type="password"
            autoComplete="off"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            required={showPassphrase}
            maxLength={128}
            className="w-full bg-white/[0.04] text-white text-sm rounded-md px-2.5 py-1.5 ring-1 ring-white/[0.08] focus:ring-sky-500 outline-none font-mono"
          />
        </label>
      )}
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 px-2.5 py-1.5 rounded-md ring-1 ring-red-500/20">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !apiKey || !apiSecret}
          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-sky-500 text-black hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
          Save key
        </button>
      </div>
    </form>
  );
}

// ─── Add-wallet form ───────────────────────────────────────────────────────

function AddWalletForm({ chains, onSaved }: { chains: string[]; onSaved: () => void }) {
  const [chain, setChain] = useState(chains[0] || 'hyperliquid');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain,
          address: address.trim(),
          label: label.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setAddress(''); setLabel('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="card-premium p-4 mb-3 space-y-3 border border-emerald-500/20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Chain</span>
          <select
            value={chain}
            onChange={e => setChain(e.target.value)}
            className="w-full bg-white/[0.04] text-white text-sm rounded-md px-2.5 py-1.5 ring-1 ring-white/[0.08] focus:ring-emerald-500 outline-none capitalize"
          >
            {chains.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={60}
            placeholder="main wallet, hot, …"
            className="w-full bg-white/[0.04] text-white text-sm rounded-md px-2.5 py-1.5 ring-1 ring-white/[0.08] focus:ring-emerald-500 outline-none"
          />
        </label>
      </div>
      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Address (read-only)</span>
        <input
          type="text"
          autoComplete="off"
          value={address}
          onChange={e => setAddress(e.target.value)}
          required
          placeholder={chain === 'solana' ? 'base58 32-44 chars' : '0x… 40 hex chars'}
          className="w-full bg-white/[0.04] text-white text-sm rounded-md px-2.5 py-1.5 ring-1 ring-white/[0.08] focus:ring-emerald-500 outline-none font-mono"
        />
      </label>
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 px-2.5 py-1.5 rounded-md ring-1 ring-red-500/20">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !address}
          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
          Save wallet
        </button>
      </div>
    </form>
  );
}
