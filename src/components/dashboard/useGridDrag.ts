import { useState, useCallback, useRef } from 'react';
import type { WidgetLayout } from './types';

interface DragState {
  dragging: boolean;
  dragIndex: number;
  overIndex: number;
}

export function useGridDrag(
  layout: WidgetLayout[],
  onReorder: (newLayout: WidgetLayout[]) => void,
) {
  const [drag, setDrag] = useState<DragState>({
    dragging: false,
    dragIndex: -1,
    overIndex: -1,
  });

  const dragRef = useRef<{ startX: number; startY: number; el: HTMLElement | null }>({
    startX: 0,
    startY: 0,
    el: null,
  });

  const handleDragStart = useCallback(
    (index: number) => (e: React.PointerEvent) => {
      // Only allow drag from handle (data-drag-handle)
      const target = e.target as HTMLElement;
      if (!target.closest('[data-drag-handle]')) return;

      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, el: e.currentTarget as HTMLElement };
      setDrag({ dragging: true, dragIndex: index, overIndex: index });

      const onMove = (me: PointerEvent) => {
        // Find which widget we're hovering over
        const els = Array.from(document.querySelectorAll('[data-widget-index]'));
        for (const el of els) {
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (
            me.clientX >= rect.left &&
            me.clientX <= rect.right &&
            me.clientY >= rect.top &&
            me.clientY <= rect.bottom
          ) {
            const overIdx = parseInt((el as HTMLElement).dataset.widgetIndex || '-1');
            setDrag((prev) => ({ ...prev, overIndex: overIdx }));
            break;
          }
        }
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);

        setDrag((prev) => {
          if (prev.dragIndex !== prev.overIndex && prev.overIndex >= 0) {
            const newLayout = [...layout];
            const [moved] = newLayout.splice(prev.dragIndex, 1);
            newLayout.splice(prev.overIndex, 0, moved);
            onReorder(newLayout);
          }
          return { dragging: false, dragIndex: -1, overIndex: -1 };
        });
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [layout, onReorder],
  );

  return { drag, handleDragStart };
}
