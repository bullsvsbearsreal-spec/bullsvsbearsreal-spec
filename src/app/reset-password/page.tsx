'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const pwStrength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 4 ? 1 : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPw) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={24} className="text-red-400" />
        </div>
        <p className="text-sm text-neutral-400 mb-4">Invalid or missing reset link.</p>
        <Link href="/forgot-password" className="text-sm text-hub-yellow hover:underline">
          Request a new one
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <CheckCircle size={24} className="text-green-400" />
        </div>
        <div className="text-center">
          <p className="text-sm text-neutral-400 leading-relaxed mb-4">
            Your password has been reset successfully.
          </p>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center px-6 rounded-lg bg-hub-yellow text-black font-medium text-sm hover:brightness-110 transition-all"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2.5 mb-4">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="New password (min 8 chars)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
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

        <div className="relative">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            required
            minLength={8}
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/30 focus:bg-white/[0.04] transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 rounded-lg bg-hub-yellow text-black font-medium text-sm hover:brightness-110 disabled:opacity-50 transition-all relative overflow-hidden"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Resetting...
            </span>
          ) : 'Reset password'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-8 group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to sign in
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">New password</h1>
          <p className="text-neutral-500 text-sm mt-1.5">Choose a strong password for your account</p>
        </div>

        <Suspense fallback={
          <div className="flex justify-center py-8">
            <span className="w-5 h-5 border-2 border-neutral-600 border-t-hub-yellow rounded-full animate-spin" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
