'use client';

import { memo } from 'react';
import { Bell, X } from 'lucide-react';

interface AlertToastProps {
  message: string;
  onDismiss: () => void;
}

function AlertToastInner({ message, onDismiss }: AlertToastProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300 max-w-lg">
      <div className="bg-amber-500/10 border border-amber-500/30 backdrop-blur-lg rounded-xl px-4 py-3 shadow-2xl flex items-start gap-3">
        <Bell className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-300">Spread Alert</p>
          <p className="text-xs text-neutral-300 mt-0.5">{message}</p>
        </div>
        <button onClick={onDismiss} className="text-neutral-500 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export const AlertToast = memo(AlertToastInner);
