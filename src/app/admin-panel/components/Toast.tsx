'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const noop = () => {};
const ToastContext = createContext<ToastContextValue>({ toast: noop, success: noop, error: noop, info: noop });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg: string) => toast(msg, 'error'), [toast]);
  const info = useCallback((msg: string) => toast(msg, 'info'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const Icon = item.variant === 'success' ? CheckCircle : item.variant === 'error' ? XCircle : Info;
  const color = item.variant === 'success' ? 'text-green-400' : item.variant === 'error' ? 'text-red-400' : 'text-blue-400';
  const border = item.variant === 'success' ? 'border-green-500/20' : item.variant === 'error' ? 'border-red-500/20' : 'border-blue-500/20';

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[#1a1a1a] border ${border} shadow-lg shadow-black/40 min-w-[260px] max-w-[360px] transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <Icon className={`w-4 h-4 ${color} shrink-0`} />
      <span className="text-[13px] text-white flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="text-neutral-500 hover:text-white shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
