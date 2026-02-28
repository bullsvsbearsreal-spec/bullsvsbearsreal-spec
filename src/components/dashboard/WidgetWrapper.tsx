'use client';

import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';

interface WidgetWrapperProps {
  title: string;
  index: number;
  colSpan: number;
  accentColor?: string;
  isDragOver: boolean;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onRemove: () => void;
  onToggleSize?: () => void;
  canExpand?: boolean;
  children: React.ReactNode;
}

export default function WidgetWrapper({
  title,
  index,
  colSpan,
  accentColor,
  isDragOver,
  isDragging,
  onPointerDown,
  onRemove,
  onToggleSize,
  canExpand,
  children,
}: WidgetWrapperProps) {
  return (
    <div
      data-widget-index={index}
      onPointerDown={onPointerDown}
      className={`
        bg-hub-darker border rounded-xl overflow-hidden transition-all
        ${colSpan === 2 ? 'col-span-2' : 'col-span-1'}
        ${isDragOver ? 'border-hub-yellow/50 scale-[1.02]' : 'border-white/[0.06]'}
        ${isDragging ? 'opacity-40' : 'opacity-100'}
      `}
      style={{ touchAction: 'none' }}
    >
      {/* Accent bar */}
      {accentColor && (
        <div className="h-[2px] w-full" style={{ backgroundColor: accentColor, opacity: 0.4 }} />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 min-w-0">
          <div data-drag-handle className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-neutral-600 hover:text-neutral-400 transition-colors">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium text-neutral-400 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onToggleSize && canExpand !== undefined && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSize(); }}
              className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors"
              title={colSpan === 2 ? 'Shrink' : 'Expand'}
            >
              {colSpan === 2 ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-neutral-600 hover:text-red-400 transition-colors"
            title="Remove widget"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="p-3">
        {children}
      </div>
    </div>
  );
}
