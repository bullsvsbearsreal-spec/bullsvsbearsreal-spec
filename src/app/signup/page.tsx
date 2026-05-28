'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import SuspendedNotice from '@/components/SuspendedNotice';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import { ALL_EXCHANGES } from '@/lib/constants';
import Turnstile from '@/components/Turnstile';

// ── Suspension flag ──────────────────────────────────────────────────
// Flip to false to re-enable signups. The original signup form below
// stays in place so we can light it back up instantly.
const SUSPENDED = false;

export default function SignupPage() {
  if (SUSPENDED) {
    return (
      <SuspendedNotice
        title="Signups paused"
        description="New account signups are temporarily paused while we tune the onboarding flow. Existing accounts continue to work — sign in as usual."
        primaryCta={{ href: '/login', label: 'Sign in' }}
        secondaryCta={{ href: '/', label: 'Back to home' }}
      />
    );
  }
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  // Bounce authenticated users to /home — they don't need to sign up
  // again. Without this, a logged-in user clicking a stale "Sign up"
  // link (from the footer, email, etc.) sees the empty form and gets
  // confused. Use replace() so the back button doesn't re-show signup.
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === 'authenticated') router.replace('/home');
  }, [status, router]);

  const searchParams = useSearchParams();
  const verifyEmail = searchParams.get('verify');
  const rawCallback = searchParams.get('callbackUrl') || '/';
  // Prevent open redirect — only allow relative paths (no protocol-relative // either)
  const callbackUrl = rawCallback.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : '/';
  // Optional invite/referral code from a shared link (?ref=XXXXXXXXXX).
  // Persisted across the verify step via state so the API call has it
  // even if the user clicks "resend code" and waits a few minutes.
  const referralCode = (searchParams.get('ref') || '').toUpperCase().slice(0, 16) || null;

  const [name, setName] = useState('');
  const [email, setEmail] = useState(verifyEmail || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Cloudflare Turnstile token. Empty until the user solves the
  // challenge — see <Turnstile /> below. When NEXT_PUBLIC_TURNSTILE_SITE_KEY
  // is unset the widget renders nothing and we never gate on this.
  const [turnstileToken, setTurnstileToken] = useState('');

  // Verification step — jump straight to verify if ?verify= param present
  const [step, setStep] = useState<'form' | 'verify'>(verifyEmail ? 'verify' : 'form');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasMinLen = password.length >= 8;
  const pwChecks = [hasMinLen, hasUpper, hasLower, hasDigit].filter(Boolean).length;
  const pwStrength = password.length === 0 ? 0 : pwChecks <= 2 ? 1 : pwChecks === 3 ? 2 : 3;
  const pwLabel = ['', 'Weak', 'Good', 'Strong'][pwStrength];
  const pwColor = ['', '#ef4444', '#f59e0b', '#22c55e'][pwStrength];

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!hasMinLen || !hasUpper || !hasLower || !hasDigit) {
      setError('Password needs 8+ characters with uppercase, lowercase, and a number');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          ...(referralCode ? { referredByCode: referralCode } : {}),
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Signup failed');
        return;
      }

      if (data.requiresVerification) {
        setStep('verify');
        setResendCooldown(60);
        // Focus first input after render
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else {
        // No verification needed — sign in directly
        const signInRes = await signIn('credentials', { email, password, redirect: false });
        if (signInRes?.error) {
          window.location.href = '/login';
        } else {
          window.location.href = callbackUrl;
        }
      }
    } catch {
      setError('Network error — could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return; // digits only
    const newCode = [...code];
    newCode[index] = value.slice(-1); // single digit
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newCode.every(d => d)) {
      handleVerify(newCode.join(''));
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
      handleVerify(pasted);
    }
  }

  async function handleVerify(codeStr?: string) {
    const fullCode = codeStr || code.join('');
    if (fullCode.length !== 6) {
      setError('Enter all 6 digits');
      return;
    }

    setError('');
    setVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Email verified — sign in (only if password available from this session)
      if (password) {
        const signInRes = await signIn('credentials', { email, password, redirect: false });
        if (!signInRes?.error) {
          window.location.href = callbackUrl;
          return;
        }
      }
      // No password (URL-based verify) or sign-in failed — redirect to login
      window.location.href = '/login?verified=true';
    } catch {
      setError('Network error — could not verify the code. Check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError('');
    try {
      const res = await fetch('/api/auth/verify-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResendCooldown(60);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to resend code');
      }
    } catch {
      setError('Failed to resend code');
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

      <div className="w-full max-w-[420px] relative z-10 animate-[fadeUp_0.5s_ease-out]">
        {/* Logo + tagline */}
        <div className="flex flex-col items-center mb-8">
          <Logo variant="full" size="lg" />
          <p className="mt-3 text-[11px] text-neutral-500 font-mono tracking-wider uppercase">
            The trader&apos;s data terminal
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-neutral-600 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              {ALL_EXCHANGES.length} venues
            </span>
            <span className="text-neutral-700">·</span>
            <span>live data</span>
            <span className="text-neutral-700">·</span>
            <span>private by default</span>
          </div>
          {referralCode && step === 'form' && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-hub-yellow/[0.08] border border-hub-yellow/20 text-hub-yellow">
              <span className="opacity-70">invited via</span>
              <span className="font-bold tracking-wider">{referralCode}</span>
            </div>
          )}
        </div>

        {/* Card with subtle gradient border */}
        <div
          className="rounded-2xl p-px shadow-2xl shadow-black/40"
          style={{ background: 'linear-gradient(145deg, rgba(234,179,8,0.18), rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.02))' }}
        >
        <div className="rounded-2xl border border-white/[0.04] bg-[#0a0a0a]/85 backdrop-blur-xl p-8">
          {step === 'form' ? (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
                  Create account
                </h1>
                <p className="text-neutral-500 text-sm mt-1.5">Sync watchlists, alerts &amp; settings across devices</p>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">
                    Name <span className="text-neutral-600">(optional)</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      placeholder="Your name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/[0.06] border border-white/[0.1] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 focus:ring-2 focus:ring-hub-yellow/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/[0.06] border border-white/[0.1] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 focus:ring-2 focus:ring-hub-yellow/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full h-12 pl-10 pr-11 rounded-xl bg-white/[0.06] border border-white/[0.1] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 focus:ring-2 focus:ring-hub-yellow/20 transition-all"
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

                {/* Cloudflare Turnstile — gates submit when configured.
                    Renders nothing if NEXT_PUBLIC_TURNSTILE_SITE_KEY is
                    unset (e.g. local dev), so the form stays usable. */}
                <Turnstile onToken={setTurnstileToken} theme="dark" className="flex justify-center" />

                <button
                  type="submit"
                  disabled={
                    loading ||
                    // If the Turnstile env var is configured, block
                    // submit until the user solves the challenge. When
                    // unset, the widget doesn't render so this
                    // condition is always false (no gating).
                    (Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && !turnstileToken)
                  }
                  className="w-full h-12 rounded-xl bg-hub-yellow hover:bg-hub-yellow-light text-black font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-1 shadow-lg shadow-hub-yellow/20"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    <>
                      Create account
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* ─── Verification Step ─── */
            <>
              <div className="mb-7 text-center">
                <div className="w-12 h-12 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center mx-auto mb-4">
                  <Mail size={24} className="text-hub-yellow" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">Check your email</h1>
                <p className="text-neutral-500 text-sm mt-1.5">
                  We sent a 6-digit code to <span className="text-neutral-300">{email}</span>
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* 6-digit code input */}
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
                    className="w-12 h-14 text-center text-xl font-bold text-white rounded-xl bg-white/[0.06] border border-white/[0.1] focus:outline-none focus:border-hub-yellow/50 focus:ring-2 focus:ring-hub-yellow/20 transition-all"
                  />
                ))}
              </div>

              <button
                onClick={() => handleVerify()}
                disabled={verifying || code.some(d => !d)}
                className="w-full h-12 rounded-xl bg-hub-yellow hover:bg-hub-yellow-light text-black font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-hub-yellow/20"
              >
                {verifying ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  <>
                    <CheckCircle size={15} />
                    Verify email
                  </>
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="text-xs text-neutral-500 hover:text-hub-yellow transition-colors disabled:text-neutral-700 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't get the code? Resend"
                  }
                </button>
              </div>
            </>
          )}
        </div>
        </div>

        <p className="text-center text-sm text-neutral-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-hub-yellow hover:text-hub-yellow-light font-medium transition-colors">Sign in</Link>
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
