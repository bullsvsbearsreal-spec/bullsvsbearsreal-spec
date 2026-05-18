import { describe, it, expect } from 'vitest';
import {
  CHART_BG,
  GRID_COLOR,
  TEXT_COLOR,
  CROSSHAIR_COLOR,
  chartOptions,
  makeLineOptions,
} from '../chartTheme';

describe('theme constants', () => {
  it('CHART_BG is the canonical hub-black (#0c0e14)', () => {
    expect(CHART_BG).toBe('#0c0e14');
  });

  it('GRID_COLOR is a low-opacity rgba string', () => {
    expect(GRID_COLOR).toMatch(/^rgba\(/);
    // 0.03 alpha is the InfoHub convention for chart grid
    expect(GRID_COLOR).toContain('0.03');
  });

  it('TEXT_COLOR is a hex string', () => {
    expect(TEXT_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('CROSSHAIR_COLOR is a low-opacity rgba string', () => {
    expect(CROSSHAIR_COLOR).toMatch(/^rgba\(/);
  });
});

describe('chartOptions (lightweight-charts ChartOptions)', () => {
  it('uses CHART_BG for background', () => {
    expect(chartOptions.layout?.background).toEqual({ color: CHART_BG });
  });

  it('uses monospace font (terminal aesthetic)', () => {
    expect(chartOptions.layout?.fontFamily).toContain('monospace');
  });

  it('grid colors match the GRID_COLOR constant', () => {
    expect(chartOptions.grid?.vertLines?.color).toBe(GRID_COLOR);
    expect(chartOptions.grid?.horzLines?.color).toBe(GRID_COLOR);
  });

  it('crosshair has dashed style (style: 3) on both axes', () => {
    expect(chartOptions.crosshair?.vertLine?.style).toBe(3);
    expect(chartOptions.crosshair?.horzLine?.style).toBe(3);
  });

  it('right price scale auto-fits to visible data (autoScale: true)', () => {
    expect(chartOptions.rightPriceScale?.autoScale).toBe(true);
  });

  it('handleScale enables mouse wheel + pinch zoom', () => {
    expect(chartOptions.handleScale?.mouseWheel).toBe(true);
    expect(chartOptions.handleScale?.pinch).toBe(true);
  });

  it('horizontal touch drag is enabled, vertical is disabled (mobile UX)', () => {
    expect(chartOptions.handleScroll?.horzTouchDrag).toBe(true);
    expect(chartOptions.handleScroll?.vertTouchDrag).toBe(false);
  });

  it('time scale shows time but not seconds', () => {
    expect(chartOptions.timeScale?.timeVisible).toBe(true);
    expect(chartOptions.timeScale?.secondsVisible).toBe(false);
  });
});

describe('makeLineOptions', () => {
  it('returns an object with color + line width set', () => {
    const opts = makeLineOptions('#FF0000', 2);
    expect(opts.color).toBe('#FF0000');
    expect(opts.lineWidth).toBe(2);
  });

  it('defaults lineWidth to 2 when omitted', () => {
    const opts = makeLineOptions('#FF0000');
    expect(opts.lineWidth).toBe(2);
  });

  it('defaults lineStyle to 0 (solid) when omitted', () => {
    const opts = makeLineOptions('#FF0000');
    expect(opts.lineStyle).toBe(0);
  });

  it('supports lineStyle override (2 = dashed)', () => {
    const opts = makeLineOptions('#FF0000', 2, undefined, 2);
    expect(opts.lineStyle).toBe(2);
  });

  it('includes title only when provided', () => {
    const withTitle = makeLineOptions('#FF0000', 2, 'BTC');
    const withoutTitle = makeLineOptions('#FF0000', 2);
    expect(withTitle.title).toBe('BTC');
    expect(withoutTitle.title).toBeUndefined();
  });

  it('enables crosshair marker (terminal hover UX)', () => {
    const opts = makeLineOptions('#FF0000');
    expect(opts.crosshairMarkerVisible).toBe(true);
    expect(opts.crosshairMarkerRadius).toBe(3);
  });

  it('shows the last value but hides price line (no horizontal mark across chart)', () => {
    const opts = makeLineOptions('#FF0000');
    expect(opts.lastValueVisible).toBe(true);
    expect(opts.priceLineVisible).toBe(false);
  });

  it('every supported lineWidth value (1-4) works', () => {
    [1, 2, 3, 4].forEach((w) => {
      const opts = makeLineOptions('#FF0000', w as 1 | 2 | 3 | 4);
      expect(opts.lineWidth).toBe(w);
    });
  });
});
