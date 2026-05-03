import type { DeepPartial, ChartOptions, LineStyleOptions, SeriesOptionsCommon } from 'lightweight-charts';

export const CHART_BG = '#0c0e14';
export const GRID_COLOR = 'rgba(255,255,255,0.03)';
export const TEXT_COLOR = '#4b5563';
export const CROSSHAIR_COLOR = 'rgba(255,255,255,0.1)';

export const chartOptions: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: CHART_BG },
    textColor: TEXT_COLOR,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 9,
  },
  grid: {
    vertLines: { color: GRID_COLOR },
    horzLines: { color: GRID_COLOR },
  },
  crosshair: {
    vertLine: { color: CROSSHAIR_COLOR, width: 1, style: 3, labelVisible: false },
    horzLine: { color: CROSSHAIR_COLOR, width: 1, style: 3, labelVisible: true },
  },
  rightPriceScale: {
    borderVisible: false,
    borderColor: 'rgba(255,255,255,0.06)',
    scaleMargins: { top: 0.04, bottom: 0.04 },
    autoScale: true,
    mode: 0, // Normal — lightweight-charts auto-fits to visible data
  },
  timeScale: {
    borderVisible: false,
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 5,
    barSpacing: 6,
  },
  handleScale: {
    mouseWheel: true,
    pinch: true,
    axisPressedMouseMove: { time: true, price: true },
    axisDoubleClickReset: { time: true, price: true },
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: false,
  },
};

export function makeLineOptions(
  color: string,
  lineWidth: 1 | 2 | 3 | 4 = 2,
  title?: string,
  lineStyle?: 0 | 2,
): DeepPartial<LineStyleOptions & SeriesOptionsCommon> {
  return {
    color,
    lineWidth,
    lineStyle: lineStyle ?? 0,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 3,
    lastValueVisible: true,
    priceLineVisible: false,
    ...(title ? { title } : {}),
  };
}
