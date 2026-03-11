'use client';

import { useState, useRef, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Shield, Smartphone } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA step
  const [step, setStep] = useState<'credentials' | '2fa' | 'unverified'>('credentials');
  const [twoFaMethods, setTwoFaMethods] = useState<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<'totp' | 'email'>('totp');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Validate credentials WITHOUT issuing a session
      const checkRes = await fetch('/api/auth/check-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const checkData = await checkRes.json();

      if (!checkRes.ok) {
        setError(checkData.error || 'Wrong email or password');
        setLoading(false);
        return;
      }

      // Step 2: Check email verification
      if (!checkData.emailVerified) {
        setStep('unverified');
        setLoading(false);
        return;
      }

      // Step 3: Check 2FA requirement
      if (checkData.requires2FA && checkData.methods?.length > 0) {
        setTwoFaMethods(checkData.methods);
        const defaultMethod = checkData.methods.includes('totp') ? 'totp' : 'email';
        setSelectedMethod(defaultMethod);
        setStep('2fa');

        // If default is email, send challenge code
        if (defaultMethod === 'email') {
          await sendEmailChallenge();
        }

        setLoading(false);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
        return;
      }

      // Step 4: No 2FA — sign in directly
      await completeSignIn();
    } catch {
      setError('Something went wrong');
      setLoading(false);
    }
  }

  async function completeSignIn() {
    try {
      const res = await signIn('credentials', {
        email,
        password,
        twoFactorValidated: 'true',
        redirect: false,
      });

      if (res?.error) {
        setError('Sign in failed. Please try again.');
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function sendEmailChallenge() {
    try {
      const res = await fetch('/api/auth/2fa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResendCooldown(60);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send code');
      }
    } catch {
      setError('Failed to send verification code');
    }
  }

  function handleCodeChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5 && newCode.every(d => d)) {
      handleVerify2FA(newCode.join(''));
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      handleVerify2FA(pasted);
    }
  }

  async function handleVerify2FA(codeStr?: string) {
    const fullCode = codeStr || code.join('');
    if (fullCode.length !== 6) {
      setError('Enter all 6 digits');
      return;
    }

    setError('');
    setVerifying(true);
    try {
      // Validate the 2FA code
      const res = await fetch('/api/auth/2fa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode, method: selectedMethod }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid code');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setVerifying(false);
        return;
      }

      // 2FA valid — NOW issue the session via signIn
      setLoading(true);
      await completeSignIn();
    } catch {
      setError('Something went wrong');
    } finally {
      setVerifying(false);
    }
  }

  async function switchMethod(method: 'totp' | 'email') {
    setSelectedMethod(method);
    setCode(['', '', '', '', '', '']);
    setError('');
    if (method === 'email') {
      await sendEmailChallenge();
    }
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }

  // Handle unverified email — resend verification and redirect to signup verify step
  async function handleResendVerification() {
    setError('');
    setLoading(true);
    try {
      await fetch('/api/auth/verify-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Always redirect to signup verify page (don't reveal if email exists)
      window.location.href = `/signup?verify=${encodeURIComponent(email)}`;
    } catch {
      setError('Failed to resend');
      setLoading(false);
    }
  }

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
          {step === 'credentials' && (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
                <p className="text-neutral-500 text-sm mt-1.5">Sign in to your account</p>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/[0.06] border border-white/[0.1] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-neutral-400">Password</label>
                    <Link href="/forgot-password" className="text-xs text-yellow-500/80 hover:text-yellow-400 transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full h-12 pl-10 pr-11 rounded-xl bg-white/[0.06] border border-white/[0.1] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-1 shadow-lg shadow-yellow-500/20"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {step === '2fa' && (
            <>
              <div className="mb-7 text-center">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                  <Shield size={24} className="text-yellow-500" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Two-factor auth</h1>
                <p className="text-neutral-500 text-sm mt-1.5">
                  {selectedMethod === 'totp'
                    ? 'Enter the code from your authenticator app'
                    : 'Enter the code sent to your email'
                  }
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Method switcher */}
              {twoFaMethods.length > 1 && (
                <div className="flex gap-2 mb-5">
                  {twoFaMethods.includes('totp') && (
                    <button
                      onClick={() => switchMethod('totp')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                        selectedMethod === 'totp'
                          ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500'
                          : 'bg-white/[0.04] border border-white/[0.08] text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Smartphone size={14} />
                      Authenticator
                    </button>
                  )}
                  {twoFaMethods.includes('email') && (
                    <button
                      onClick={() => switchMethod('email')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                        selectedMethod === 'email'
                          ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500'
                          : 'bg-white/[0.04] border border-white/[0.08] text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Mail size={14} />
                      Email code
                    </button>
                  )}
                </div>
              )}

              {/* 6-digit input */}
              <div className="flex gap-2 justify-center mb-6" onPaste={handleCodePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleCodeChange(i, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold text-white rounded-xl bg-white/[0.06] border border-white/[0.1] focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                  />
                ))}
              </div>

              <button
                onClick={() => handleVerify2FA()}
                disabled={verifying || loading || code.some(d => !d)}
                className="w-full h-12 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
              >
                {verifying || loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  'Verify'
                )}
              </button>

              {selectedMethod === 'email' && (
                <div className="text-center mt-4">
                  <button
                    onClick={sendEmailChallenge}
                    disabled={resendCooldown > 0}
                    className="text-xs text-neutral-500 hover:text-yellow-500 transition-colors disabled:text-neutral-700 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Didn't get the code? Resend"
                    }
                  </button>
                </div>
              )}

              <button
                onClick={() => { setStep('credentials'); setError(''); setCode(['', '', '', '', '', '']); }}
                className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300 transition-colors mt-3"
              >
                Back to sign in
              </button>
            </>
          )}

          {step === 'unverified' && (
            <>
              <div className="mb-7 text-center">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                  <Mail size={24} className="text-yellow-500" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Email not verified</h1>
                <p className="text-neutral-500 text-sm mt-1.5">
                  Please verify your email before signing in.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleResendVerification}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : 'Resend verification email'}
              </button>

              <button
                onClick={() => { setStep('credentials'); setError(''); }}
                className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300 transition-colors mt-3"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>

        <p className="text-center text-sm text-neutral-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-yellow-500 hover:text-yellow-400 font-medium transition-colors">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
