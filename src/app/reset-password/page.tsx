'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';

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
  const pwLabel = ['', 'Weak', 'Good', 'Strong'][pwStrength];
  const pwColor = ['', '#ef4444', '#f59e0b', '#22c55e'][pwStrength];

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
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm text-neutral-400 mb-4">Invalid or missing reset link.</p>
          <Link href="/forgot-password" className="text-sm text-yellow-500 hover:underline font-medium">
            Request a new one
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white mb-2">Password updated</h2>
          <p className="text-sm text-neutral-400 leading-relaxed mb-5">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center gap-2 px-8 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm transition-all shadow-lg shadow-yellow-500/20"
          >
            Sign in
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">New password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Min 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
              className="w-full h-12 pl-10 pr-11 rounded-xl bg-white/[0.06] border border-white/[0.1] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 transition-all"
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3].map(level => (
                  <div key={level} className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: pwStrength >= level ? pwColor : 'rgba(255,255,255,0.08)' }}
                  />
                ))}
              </div>
              <span className="text-[11px] font-medium" style={{ color: pwColor }}>{pwLabel}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">Confirm password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              required
              minLength={8}
              className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/[0.06] border border-white/[0.1] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 transition-all"
            />
          </div>
          {confirmPw.length > 0 && password !== confirmPw && (
            <p className="text-xs text-red-400 mt-1.5">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-1 shadow-lg shadow-yellow-500/20"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Resetting...
            </span>
          ) : (
            <>
              Reset password
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #eab308, transparent 70%)' }}
        />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)' }}
        />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Logo variant="full" size="lg" />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6 group">
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to sign in
          </Link>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-white tracking-tight">New password</h1>
            <p className="text-neutral-500 text-sm mt-1.5">Choose a strong password for your account</p>
          </div>

          <Suspense fallback={
            <div className="flex justify-center py-8">
              <span className="w-5 h-5 border-2 border-neutral-600 border-t-yellow-500 rounded-full animate-spin" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
