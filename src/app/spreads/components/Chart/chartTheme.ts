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
    fontSize: 10,
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
    scaleMargins: { top: 0.05, bottom: 0.05 },
  },
  timeScale: {
    borderVisible: false,
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 5,
    barSpacing: 6,
  },
  handleScale: {
    axisPressedMouseMove: { time: true, price: true },
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
): DeepPartial<LineStyleOptions & SeriesOptionsCommon> {
  return {
    color,
    lineWidth,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 3,
    lastValueVisible: true,
    priceLineVisible: false,
  };
}
