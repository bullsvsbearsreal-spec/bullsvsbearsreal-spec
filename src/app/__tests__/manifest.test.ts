import { describe, it, expect } from 'vitest';
import manifest from '../manifest';

describe('manifest() — PWA manifest', () => {
  const m = manifest();

  it('returns the expected app name + short name', () => {
    expect(m.name).toContain('InfoHub');
    expect(m.short_name).toBe('InfoHub');
  });

  it('describes the app (used by app stores + share previews)', () => {
    expect(m.description).toBeTruthy();
    expect(m.description!.length).toBeGreaterThan(20);
    // Smoke check: should mention at least one of the core product areas
    const desc = m.description!.toLowerCase();
    const hasProductTerm = ['funding', 'open interest', 'liquidations', 'arbitrage', 'derivatives']
      .some((term) => desc.includes(term));
    expect(hasProductTerm).toBe(true);
  });

  it('start_url is root /', () => {
    expect(m.start_url).toBe('/');
  });

  it('display mode is "standalone" (installable PWA, no browser chrome)', () => {
    expect(m.display).toBe('standalone');
  });

  it('background + theme colors are valid hex', () => {
    expect(m.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(m.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('background is dark (matches the hub-black aesthetic)', () => {
    // Background should be a dark color
    expect(m.background_color).toBe('#0a0a0a');
  });

  it('theme_color is the orange brand accent (#FFA500)', () => {
    expect(m.theme_color).toBe('#FFA500');
  });

  it('icons array has 192x192 + 512x512 PNG entries', () => {
    expect(m.icons).toBeDefined();
    const icons = m.icons!;
    expect(icons.length).toBeGreaterThanOrEqual(2);

    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    icons.forEach((icon) => {
      expect(icon.src).toMatch(/\.(png|jpg|svg|webp)$/i);
      expect(icon.type).toBeTruthy();
    });
  });

  it('icon src paths start with / (root-relative)', () => {
    m.icons!.forEach((icon) => {
      expect(icon.src.startsWith('/')).toBe(true);
    });
  });
});
