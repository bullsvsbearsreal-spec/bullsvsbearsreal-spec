'use client';

import { useState } from 'react';
import { Shield, Lock, Loader2, Check } from 'lucide-react';

export default function SecuritySection() {
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('Passwords do not match');
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPwError(json.error || 'Failed to change password');
      } else {
        setPwSuccess(true);
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
        setTimeout(() => {
          setPwSuccess(false);
          setShowPwForm(false);
        }, 2000);
      }
    } catch {
      setPwError('Something went wrong');
    }
    setPwSaving(false);
  };

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-hub-yellow" />
        Account Security
      </h2>
      <div className="space-y-3">
        {!showPwForm ? (
          <button
            onClick={() => setShowPwForm(true)}
            className="flex items-center gap-1.5 text-xs text-hub-yellow hover:text-hub-yellow-light transition-colors"
          >
            <Lock className="w-3 h-3" />
            Change password
          </button>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Current password</label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50"
                placeholder="Enter current password"
                required
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">New password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50"
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50"
                placeholder="Repeat new password"
                minLength={8}
                required
              />
            </div>
            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            {pwSuccess && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Password changed
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pwSaving}
                className="px-4 py-2 rounded-lg bg-hub-yellow text-black text-xs font-semibold hover:bg-hub-yellow-light transition-colors disabled:opacity-50"
              >
                {pwSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPwForm(false);
                  setPwError('');
                  setCurrentPw('');
                  setNewPw('');
                  setConfirmPw('');
                }}
                className="px-4 py-2 rounded-lg bg-white/[0.04] text-neutral-400 text-xs hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
