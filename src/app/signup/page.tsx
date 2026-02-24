'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

const OAUTH_ICONS: Record<string, React.ReactNode> = {
  google: <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
  discord: <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>,
  twitter: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
};
const OAUTH_LABELS: Record<string, string> = { google: 'Google', discord: 'Discord', twitter: 'X' };

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<string[]>([]);

  const pwStrength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 4 ? 1 : 0;

  useEffect(() => {
    fetch('/api/auth/providers').then(r => r.json()).then(data => {
      setOauthProviders(Object.keys(data).filter(k => k !== 'credentials'));
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Signup failed');
        return;
      }

      // Auto sign-in after successful signup
      const signInRes = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        window.location.href = '/login';
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-hub-black flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background grain */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* Subtle orange glow */}
      <div className="fixed top-[-20%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,165,0,0.04) 0%, transparent 70%)' }} />

      <div className="w-full max-w-[380px] relative z-10">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-8 group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">Create account</h1>
          <p className="text-neutral-500 text-sm mt-1.5">Sync watchlists, alerts, and settings across devices</p>
        </div>

        {/* OAuth — only shown if providers are configured */}
        {oauthProviders.length > 0 && (
          <>
            <div className="flex gap-3 mb-6">
              {oauthProviders.map(id => (
                <button key={id} onClick={() => signIn(id, { callbackUrl: '/' })}
                  className="flex-1 h-10 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all flex items-center justify-center gap-2 text-sm text-neutral-300">
                  {OAUTH_ICONS[id]}
                  {OAUTH_LABELS[id] || id}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[11px] text-neutral-600 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2.5 mb-4">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/30 focus:bg-white/[0.04] transition-all"
            />
          </div>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/30 focus:bg-white/[0.04] transition-all"
            />
          </div>
          <div>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Password (min 8 chars)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full h-10 pl-9 pr-10 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/30 focus:bg-white/[0.04] transition-all"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400 transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* Password strength */}
            {password.length > 0 && (
              <div className="flex gap-1 mt-2">
                {[1, 2, 3].map(level => (
                  <div key={level} className="h-0.5 flex-1 rounded-full transition-colors duration-300" style={{
                    backgroundColor: pwStrength >= level
                      ? level === 1 ? '#ef4444' : level === 2 ? '#f59e0b' : '#22c55e'
                      : 'rgba(255,255,255,0.06)',
                  }} />
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-hub-yellow text-black font-medium text-sm hover:brightness-110 disabled:opacity-50 transition-all relative overflow-hidden"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Creating account...
              </span>
            ) : 'Create account'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-neutral-600 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-hub-yellow hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
