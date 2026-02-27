'use client';

import { X, Plus } from 'lucide-react';
import { WIDGET_CATALOG, type WidgetType } from './types';

interface WidgetPickerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: WidgetType) => void;
  activeTypes: WidgetType[];
}

export default function WidgetPicker({ open, onClose, onAdd, activeTypes }: WidgetPickerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-hub-darker border border-white/[0.08] rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Add Widget</h3>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
          {WIDGET_CATALOG.map((meta) => {
            const isActive = activeTypes.includes(meta.type);
            return (
              <button
                key={meta.type}
                onClick={() => { if (!isActive) { onAdd(meta.type); onClose(); } }}
                disabled={isActive}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors
                  ${isActive
                    ? 'bg-white/[0.02] text-neutral-600 cursor-not-allowed'
                    : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'
                  }
                `}
              >
                <Plus className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-neutral-700' : 'text-hub-yellow'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{meta.name}</p>
                  <p className="text-[10px] text-neutral-600">{meta.defaultW === 2 ? 'Wide' : 'Standard'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
