'use client';

import { useState, useEffect } from 'react';
import { KeyRound, Smartphone, Mail, Loader2, ToggleLeft, ToggleRight, Copy } from 'lucide-react';

interface Props {
  email: string;
}

export default function TwoFactorSection({ email }: Props) {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [email2faEnabled, setEmail2faEnabled] = useState(false);
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpQr, setTotpQr] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState('');
  const [totpSaving, setTotpSaving] = useState(false);
  const [totpError, setTotpError] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/2fa/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          const data = await res.json();
          setTotpEnabled(data.methods?.includes('totp') || false);
          setEmail2faEnabled(data.methods?.includes('email') || false);
        }
      } catch {}
      setLoading(false);
    })();
  }, [email]);

  const handleStartTotpSetup = async () => {
    setTotpError('');
    setTotpSaving(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error || 'Setup failed');
        return;
      }
      setTotpQr(data.qrCode);
      setTotpSecret(data.secret);
      setTotpBackupCodes(data.backupCodes);
      setShowTotpSetup(true);
    } catch {
      setTotpError('Setup failed');
    }
    setTotpSaving(false);
  };

  const handleVerifyTotp = async () => {
    if (totpCode.length !== 6) {
      setTotpError('Enter a 6-digit code');
      return;
    }
    setTotpError('');
    setTotpSaving(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error || 'Invalid code');
        setTotpSaving(false);
        return;
      }
      setTotpEnabled(true);
      setShowTotpSetup(false);
      setShowBackupCodes(true);
      setTotpCode('');
    } catch {
      setTotpError('Verification failed');
    }
    setTotpSaving(false);
  };

  const handleDisableTotp = async () => {
    setTotpSaving(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', { method: 'DELETE' });
      if (res.ok) {
        setTotpEnabled(false);
        setShowTotpSetup(false);
      }
    } catch {}
    setTotpSaving(false);
  };

  const handleToggleEmail2fa = async () => {
    setTotpSaving(true);
    try {
      if (email2faEnabled) {
        const res = await fetch('/api/auth/2fa/email', { method: 'DELETE' });
        if (res.ok) setEmail2faEnabled(false);
      } else {
        const res = await fetch('/api/auth/2fa/email', { method: 'POST' });
        if (res.ok) setEmail2faEnabled(true);
      }
    } catch {}
    setTotpSaving(false);
  };

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <KeyRound className="w-4 h-4 text-hub-yellow" />
        Two-Factor Authentication
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Authenticator App */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-neutral-400" />
              <div>
                <p className="text-sm text-white">Authenticator app</p>
                <p className="text-xs text-neutral-600">
                  {totpEnabled ? 'Enabled — using TOTP codes' : 'Use Google Authenticator, Authy, etc.'}
                </p>
              </div>
            </div>
            {totpEnabled ? (
              <button
                onClick={handleDisableTotp}
                disabled={totpSaving}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                Disable
              </button>
            ) : (
              <button
                onClick={handleStartTotpSetup}
                disabled={totpSaving}
                className="px-3 py-1.5 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20 text-xs text-hub-yellow hover:bg-hub-yellow/20 transition-colors disabled:opacity-50"
              >
                {totpSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Enable'}
              </button>
            )}
          </div>

          {/* TOTP Setup */}
          {showTotpSetup && (
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.08] p-4 space-y-4">
              <p className="text-xs text-neutral-400">
                Scan this QR code with your authenticator app, then enter the 6-digit code.
              </p>
              {totpQr && (
                <div className="flex justify-center">
                  <img src={totpQr} alt="QR Code" className="w-48 h-48 rounded-lg" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-neutral-400 bg-white/[0.04] rounded px-2 py-1.5 font-mono truncate">
                  {totpSecret}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(totpSecret)}
                  className="p-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
                  title="Copy secret"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 text-center font-mono tracking-widest"
                />
              </div>
              {totpError && <p className="text-xs text-red-400">{totpError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleVerifyTotp}
                  disabled={totpSaving || totpCode.length !== 6}
                  className="px-4 py-2 rounded-lg bg-hub-yellow text-black text-xs font-semibold hover:bg-hub-yellow-light transition-colors disabled:opacity-50"
                >
                  {totpSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify & Enable'}
                </button>
                <button
                  onClick={() => { setShowTotpSetup(false); setTotpCode(''); setTotpError(''); }}
                  className="px-4 py-2 rounded-lg bg-white/[0.04] text-neutral-400 text-xs hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Backup Codes */}
          {showBackupCodes && totpBackupCodes.length > 0 && (
            <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-4 space-y-3">
              <p className="text-xs text-yellow-500 font-semibold">Save your backup codes</p>
              <p className="text-xs text-neutral-400">
                Store these codes somewhere safe. Each code can only be used once.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {totpBackupCodes.map((c, i) => (
                  <code key={i} className="text-xs font-mono text-neutral-300 bg-white/[0.04] rounded px-2 py-1 text-center">
                    {c}
                  </code>
                ))}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(totpBackupCodes.join('\n'));
                  setShowBackupCodes(false);
                }}
                className="flex items-center gap-1.5 text-xs text-hub-yellow hover:text-hub-yellow-light transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy all & dismiss
              </button>
            </div>
          )}

          {/* Email 2FA */}
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-neutral-400" />
              <div>
                <p className="text-sm text-white">Email verification</p>
                <p className="text-xs text-neutral-600">
                  Receive a code via email when signing in
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleEmail2fa}
              disabled={totpSaving}
              className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              {email2faEnabled ? (
                <ToggleRight className="w-6 h-6 text-hub-yellow" />
              ) : (
                <ToggleLeft className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
