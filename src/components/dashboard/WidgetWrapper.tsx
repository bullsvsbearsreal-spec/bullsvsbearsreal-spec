'use client';

import { useState } from 'react';
import {
  GripVertical, X, Maximize2, Minimize2, ChevronUp, ChevronDown, Lock, Unlock,
  Bitcoin, Globe, TrendingUp, PieChart, Zap, Grid3X3, BarChart3, Flame,
  ArrowLeftRight, Star, Briefcase, Bell, Wallet, Gauge, Newspaper, LineChart,
  Activity, Coins, Calendar, Timer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Lookup map for dynamic icon resolution — avoids `import *` which prevents tree-shaking */
const ICON_MAP: Record<string, LucideIcon> = {
  Bitcoin, Globe, TrendingUp, PieChart, Zap, Grid3X3, BarChart3, Flame,
  ArrowLeftRight, Star, Briefcase, Bell, Wallet, Gauge, Newspaper, LineChart,
  Unlock: Unlock, Activity, Coins, Calendar, Timer,
};

interface WidgetWrapperProps {
  title: string;
  icon?: string;
  widgetType?: string;
  widgetId?: string;
  index: number;
  colSpan: number;
  accentColor?: string;
  isDragOver: boolean;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onRemove: () => void;
  onToggleSize?: () => void;
  onToggleLock?: () => void;
  canExpand?: boolean;
  isLocked?: boolean;
  lockedSymbol?: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

/** Resolve a lucide icon name string to the actual component */
function getIcon(name?: string) {
  if (!name) return null;
  const Icon = ICON_MAP[name];
  return Icon ? <Icon className="w-3 h-3" /> : null;
}

/** Widget types that show a live-updating indicator */
const LIVE_TYPES = new Set([
  'btc-price', 'fear-greed', 'top-movers', 'liquidations', 'market-overview',
  'long-short', 'watchlist', 'portfolio', 'alerts', 'funding-heatmap', 'oi-chart',
  'arbitrage', 'exchange-status', 'fear-greed-chart', 'altseason', 'stablecoin-flows',
  'cvd', 'slippage', 'latency',
]);

export default function WidgetWrapper({
  title,
  icon,
  widgetType,
  widgetId,
  index,
  colSpan,
  accentColor,
  isDragOver,
  isDragging,
  onPointerDown,
  onRemove,
  onToggleSize,
  onToggleLock,
  canExpand,
  isLocked,
  lockedSymbol,
  isLoading,
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
        ${isDragOver ? 'border-hub-yellow/50 scale-[1.02]' : 'border-white/[0.06] hover:border-white/[0.12]'}
        ${isDragging ? 'opacity-40' : 'opacity-100'}
      `}
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
          <div data-drag-handle className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-neutral-600 hover:text-neutral-400 transition-colors" style={{ touchAction: 'none' }}>
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          {/* Widget icon */}
          {iconEl && (
            <span className="text-neutral-500" style={accentColor ? { color: accentColor, opacity: 0.6 } : undefined}>
              {iconEl}
            </span>
          )}
          <span className="text-xs font-medium text-neutral-400 truncate">{title}</span>
          {/* Live heartbeat dot for real-time widgets */}
          {widgetType && LIVE_TYPES.has(widgetType) && (
            <span className="heartbeat-dot ml-0.5 flex-shrink-0" style={{ width: 6, height: 6 }} />
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Locked symbol badge */}
          {isLocked && lockedSymbol && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono bg-hub-yellow/10 text-hub-yellow rounded">
              {lockedSymbol}
            </span>
          )}
          {/* Lock/unlock toggle */}
          {onToggleLock && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
              className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors hidden sm:block"
              title={isLocked ? 'Unlock — follow global symbol' : 'Lock — keep current symbol'}
              aria-pressed={isLocked}
            >
              {isLocked ? <Lock className="w-3 h-3 text-hub-yellow" /> : <Unlock className="w-3 h-3" />}
            </button>
          )}
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
      {/* Content — collapsible on mobile, with skeleton support */}
      {!collapsed && (
        <div className="p-3">
          {isLoading ? (
            <div className="space-y-2">
              <div className="skeleton h-8 w-3/4" />
              <div className="skeleton h-6 w-1/2" />
              <div className="skeleton h-6 w-5/6" />
              <div className="skeleton h-6 w-2/3" />
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
