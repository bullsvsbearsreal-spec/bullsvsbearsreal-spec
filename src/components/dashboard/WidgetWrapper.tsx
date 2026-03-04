'use client';

import { useState } from 'react';
import { GripVertical, X, Maximize2, Minimize2, ChevronUp, ChevronDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface WidgetWrapperProps {
  title: string;
  icon?: string;
  widgetType?: string;
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

/** Resolve a lucide icon name string to the actual component */
function getIcon(name?: string) {
  if (!name) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic icon lookup by string name
  const Icon = (LucideIcons as any)[name] as React.ComponentType<{ className?: string }> | undefined;
  return Icon ? <Icon className="w-3 h-3" /> : null;
}

/** Widget types that show a live-updating indicator */
const LIVE_TYPES = new Set([
  'btc-price', 'fear-greed', 'top-movers', 'liquidations', 'market-overview',
  'long-short', 'watchlist', 'portfolio', 'alerts', 'funding-heatmap', 'oi-chart',
]);

export default function WidgetWrapper({
  title,
  icon,
  widgetType,
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
  const iconEl = getIcon(icon);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      data-widget-index={index}
      onPointerDown={onPointerDown}
      className={`
        bg-hub-darker border rounded-xl overflow-hidden transition-all
        ${colSpan === 2 ? 'col-span-1 md:col-span-2' : 'col-span-1'}
        ${isDragOver ? 'border-hub-yellow/50 scale-[1.02]' : 'border-white/[0.06]'}
        ${isDragging ? 'opacity-40' : 'opacity-100'}
      `}
      style={{ touchAction: 'none' }}
    >
      {/* Accent bar — bolder: 2px, 70% opacity, subtle glow */}
      {accentColor && (
        <div
          className="h-[2px] w-full"
          style={{
            backgroundColor: accentColor,
            opacity: 0.7,
            boxShadow: `0 1px 6px ${accentColor}33`,
          }}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 min-w-0">
          <div data-drag-handle className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-neutral-600 hover:text-neutral-400 transition-colors">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          {/* Widget icon */}
          {iconEl && (
            <span className="text-neutral-500" style={accentColor ? { color: accentColor, opacity: 0.6 } : undefined}>
              {iconEl}
            </span>
          )}
          <span className="text-xs font-medium text-neutral-400 truncate">{title}</span>
          {/* Live dot for real-time widgets */}
          {widgetType && LIVE_TYPES.has(widgetType) && (
            <span className="live-dot ml-0.5 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
            className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors md:hidden"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
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
      {/* Content — collapsible on mobile */}
      {!collapsed && (
        <div className="p-3">
          {children}
        </div>
      )}
    </div>
  );
}
