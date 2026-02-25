'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, AlertCircle, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong');
        return;
      }

      setSent(true);
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
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-8 group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to sign in
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">Reset password</h1>
          <p className="text-neutral-500 text-sm mt-1.5">
            {sent ? 'Check your inbox for a reset link' : 'Enter your email and we\'ll send you a reset link'}
          </p>
        </div>

        {sent ? (
          /* Success state */
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <CheckCircle size={24} className="text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-sm text-neutral-400 leading-relaxed">
                If an account with <span className="text-white font-medium">{email}</span> exists, you&apos;ll receive a password reset link shortly.
              </p>
              <p className="text-xs text-neutral-600 mt-3">
                Didn&apos;t get the email? Check your spam folder or{' '}
                <button onClick={() => { setSent(false); setEmail(''); }} className="text-hub-yellow hover:underline">try again</button>.
              </p>
            </div>
          </div>
        ) : (
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
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
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
                    Sending...
                  </span>
                ) : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
