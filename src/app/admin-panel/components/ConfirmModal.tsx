'use client';

import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* dialog */}
      <div className="relative w-full max-w-sm mx-4 rounded-xl border border-white/[0.1] bg-[#111] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && (
          <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed">{description}</p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.1] text-neutral-300 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 ${
              danger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-black'
            }`}
          >
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
