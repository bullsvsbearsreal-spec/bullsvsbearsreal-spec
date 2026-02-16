'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/dashboard');
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm animate-slide-up relative z-10">
      <div
        className="admin-card admin-card-accent overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 40px var(--admin-accent-glow)' }}
      >
        {/* Logo */}
        <div className="text-center mb-8 pt-2">
          <div className="flex items-center justify-center gap-0.5 mb-3">
            <span className="text-white font-black text-xl tracking-tight">Info</span>
            <span
              className="font-black text-xl tracking-tight text-black px-1.5 py-0.5 rounded"
              style={{ background: 'linear-gradient(135deg, var(--admin-accent-light), var(--admin-accent))' }}
            >
              Hub
            </span>
          </div>
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-[0.15em]"
            style={{
              color: 'var(--admin-accent)',
              background: 'rgb(var(--admin-accent-rgb) / 0.08)',
              border: '1px solid rgb(var(--admin-accent-rgb) / 0.15)',
            }}
          >
            Admin Console
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label
              className="block text-[11px] uppercase tracking-wider mb-1.5 font-medium"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded px-3 py-2.5 text-sm text-white outline-none transition-all duration-200"
              style={{
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgb(var(--admin-accent-rgb) / 0.4)';
                e.target.style.boxShadow = '0 0 0 1px rgb(var(--admin-accent-rgb) / 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--admin-border)';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter admin password"
              autoFocus
            />
          </div>

          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded text-xs"
              style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}
            >
              <span className="text-red-400">✕</span>
              <span className="text-red-400">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 rounded text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--admin-accent-rgb) / 0.15), rgb(var(--admin-accent-rgb) / 0.08))',
              color: 'var(--admin-accent)',
              border: '1px solid rgb(var(--admin-accent-rgb) / 0.2)',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Authenticating...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
