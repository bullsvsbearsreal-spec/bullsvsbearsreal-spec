'use client';

import { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutGroup {
  label: string;
  shortcuts: { keys: string[]; desc: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    label: 'Global',
    shortcuts: [
      { keys: ['Ctrl', 'K'], desc: 'Search coins, pages & features' },
      { keys: ['?'], desc: 'Show this help' },
      { keys: ['Esc'], desc: 'Close menus, overlays & search' },
    ],
  },
  {
    label: 'Chart Page',
    shortcuts: [
      { keys: ['1'], desc: '1 minute timeframe' },
      { keys: ['2'], desc: '5 minute timeframe' },
      { keys: ['3'], desc: '15 minute timeframe' },
      { keys: ['4'], desc: '1 hour timeframe' },
      { keys: ['5'], desc: '4 hour timeframe' },
      { keys: ['6'], desc: '1 day timeframe' },
      { keys: ['7'], desc: '1 week timeframe' },
      { keys: ['T'], desc: 'Toggle trade tape sidebar' },
    ],
  },
  {
    label: 'Navigation',
    shortcuts: [
      { keys: ['↑', '↓'], desc: 'Navigate search results' },
      { keys: ['Enter'], desc: 'Select highlighted result' },
      { keys: ['Tab'], desc: 'Cycle through filters' },
    ],
  },
];

export default function KeyboardShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={overlayRef}
        className="bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-4 h-4 text-hub-yellow" />
            <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Groups */}
        <div className="p-5 space-y-5">
          {shortcutGroups.map((group) => (
            <div key={group.label}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
                {group.label}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.desc}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-white/[0.03]"
                  >
                    <span className="text-[13px] text-neutral-400">{s.desc}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((key) => (
                        <kbd
                          key={key}
                          className="min-w-[24px] h-6 flex items-center justify-center px-1.5 text-[11px] font-medium text-neutral-300 bg-white/[0.06] border border-white/[0.08] rounded"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06]">
          <p className="text-[11px] text-neutral-600 text-center">
            Press <kbd className="px-1 py-0.5 text-[10px] bg-white/[0.06] border border-white/[0.08] rounded">?</kbd> anytime to show this overlay
          </p>
        </div>
      </div>
    </div>
  );
}
