'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { type WidgetLayout, type WidgetType, WIDGET_CATALOG, DEFAULT_LAYOUT } from './types';
import { useGridDrag } from './useGridDrag';
import WidgetWrapper from './WidgetWrapper';
import WidgetPicker from './WidgetPicker';

// Widget components (lazy-ish — just direct imports for now)
import WatchlistWidget from './widgets/WatchlistWidget';
import PortfolioWidget from './widgets/PortfolioWidget';
import AlertsWidget from './widgets/AlertsWidget';
import WalletsWidget from './widgets/WalletsWidget';
import BtcPriceWidget from './widgets/BtcPriceWidget';
import FearGreedWidget from './widgets/FearGreedWidget';
import TopMoversWidget from './widgets/TopMoversWidget';
import LiquidationsWidget from './widgets/LiquidationsWidget';
import BtcChartWidget from './widgets/BtcChartWidget';
import FundingHeatmapWidget from './widgets/FundingHeatmapWidget';
import OiChartWidget from './widgets/OiChartWidget';
import DominanceWidget from './widgets/DominanceWidget';

const WIDGET_COMPONENTS: Record<WidgetType, React.ComponentType<{ wide?: boolean }>> = {
  watchlist: WatchlistWidget,
  portfolio: PortfolioWidget,
  alerts: AlertsWidget,
  wallets: WalletsWidget,
  'btc-price': BtcPriceWidget,
  'fear-greed': FearGreedWidget,
  'top-movers': TopMoversWidget,
  liquidations: LiquidationsWidget,
  'btc-chart': BtcChartWidget,
  'funding-heatmap': FundingHeatmapWidget,
  'oi-chart': OiChartWidget,
  dominance: DominanceWidget,
};

interface DashboardGridProps {
  layout: WidgetLayout[];
  onLayoutChange: (layout: WidgetLayout[]) => void;
}

export default function DashboardGrid({ layout, onLayoutChange }: DashboardGridProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const { drag, handleDragStart } = useGridDrag(layout, onLayoutChange);

  const handleRemove = useCallback(
    (id: string) => {
      onLayoutChange(layout.filter((w) => w.id !== id));
    },
    [layout, onLayoutChange],
  );

  const handleToggleSize = useCallback(
    (id: string) => {
      onLayoutChange(
        layout.map((w) =>
          w.id === id ? { ...w, w: w.w === 1 ? 2 : 1 } : w,
        ),
      );
    },
    [layout, onLayoutChange],
  );

  const handleAdd = useCallback(
    (type: WidgetType) => {
      const meta = WIDGET_CATALOG.find((m) => m.type === type);
      if (!meta) return;
      const newWidget: WidgetLayout = {
        id: `w_${Date.now()}`,
        type,
        w: meta.defaultW,
        h: 1,
      };
      onLayoutChange([...layout, newWidget]);
    },
    [layout, onLayoutChange],
  );

  const handleReset = useCallback(() => {
    onLayoutChange([...DEFAULT_LAYOUT]);
  }, [onLayoutChange]);

  const activeTypes = layout.map((w) => w.type);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hub-yellow text-black text-xs font-semibold hover:bg-hub-yellow-light transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Widget
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
        <span className="text-[10px] text-neutral-600">{layout.length} widget{layout.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {layout.map((widget, index) => {
          const meta = WIDGET_CATALOG.find((m) => m.type === widget.type);
          const Component = WIDGET_COMPONENTS[widget.type];
          if (!meta || !Component) return null;

          return (
            <WidgetWrapper
              key={widget.id}
              title={meta.name}
              index={index}
              colSpan={widget.w}
              isDragOver={drag.dragging && drag.overIndex === index && drag.dragIndex !== index}
              isDragging={drag.dragging && drag.dragIndex === index}
              onPointerDown={handleDragStart(index)}
              onRemove={() => handleRemove(widget.id)}
              onToggleSize={() => handleToggleSize(widget.id)}
              canExpand={widget.w < 2}
            >
              <Component wide={widget.w === 2} />
            </WidgetWrapper>
          );
        })}
      </div>

      {/* Empty state */}
      {layout.length === 0 && (
        <div className="text-center py-12">
          <p className="text-neutral-500 text-sm mb-3">No widgets yet</p>
          <button
            onClick={() => setPickerOpen(true)}
            className="px-4 py-2 rounded-lg bg-hub-yellow text-black text-xs font-semibold hover:bg-hub-yellow-light transition-colors"
          >
            Add your first widget
          </button>
        </div>
      )}

      <WidgetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAdd}
        activeTypes={activeTypes}
      />
    </>
  );
}
