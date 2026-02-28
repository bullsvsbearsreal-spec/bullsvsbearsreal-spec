'use client';

import { X, Plus } from 'lucide-react';
import { WIDGET_CATALOG, WIDGET_CATEGORIES, type WidgetType, type WidgetCategory } from './types';

interface WidgetPickerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: WidgetType) => void;
  activeTypes: WidgetType[];
}

export default function WidgetPicker({ open, onClose, onAdd, activeTypes }: WidgetPickerProps) {
  if (!open) return null;

  // Group widgets by category
  const groups = new Map<WidgetCategory, typeof WIDGET_CATALOG>();
  for (const meta of WIDGET_CATALOG) {
    if (!groups.has(meta.category)) groups.set(meta.category, []);
    groups.get(meta.category)!.push(meta);
  }

  const categoryOrder: WidgetCategory[] = ['market', 'trading', 'portfolio', 'sentiment', 'events'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-hub-darker border border-white/[0.08] rounded-xl max-w-lg w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Add Widget</h3>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[450px] overflow-y-auto space-y-4 pr-1">
          {categoryOrder.map((cat) => {
            const widgets = groups.get(cat);
            if (!widgets || widgets.length === 0) return null;
            const catInfo = WIDGET_CATEGORIES[cat];

            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catInfo.color }} />
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">{catInfo.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {widgets.map((meta) => {
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
                          <p className="text-[10px] text-neutral-600 truncate">{meta.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
