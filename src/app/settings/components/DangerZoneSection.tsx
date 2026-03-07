'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

export default function DangerZoneSection() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      if (res.ok) {
        const keysToRemove = ['ih_watchlist', 'ih_portfolio', 'ih_alerts', 'ih_screener_presets', 'ih_wallets', 'ih_notification_prefs'];
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        signOut({ callbackUrl: '/' });
      }
    } catch {}
    setDeleting(false);
  };

  return (
    <>
      <div className="bg-hub-darker border border-red-500/20 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone
        </h2>
        <p className="text-xs text-neutral-600 mb-3">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Account
        </button>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-hub-darker border border-white/[0.08] rounded-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Delete Account
            </h3>
            <p className="text-sm text-neutral-400 mb-4">
              This will permanently delete your account, watchlists, alerts, portfolio, and all
              synced data. This cannot be undone.
            </p>
            <div className="mb-4">
              <label className="text-xs text-neutral-500 block mb-1">
                Type <span className="text-red-400 font-mono font-bold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-red-500/50"
                placeholder="DELETE"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Forever
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirm('');
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] text-neutral-400 text-sm hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
