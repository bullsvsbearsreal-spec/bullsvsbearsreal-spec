import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPresets,
  savePreset,
  deletePreset,
  DEFAULT_PRESETS,
  FIELD_LABELS,
  type ScreenerPreset,
} from '../screenerPresets';

const storage = new Map<string, string>();
const mockLS = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLS, writable: true });
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

beforeEach(() => storage.clear());

describe('screenerPresets — read/write', () => {
  it('starts empty', () => {
    expect(getPresets()).toEqual([]);
  });

  it('saves a preset and reads it back', () => {
    const preset: ScreenerPreset = {
      name: 'Test',
      conditions: [{ field: 'fundingRate', operator: 'gt', value: 0.01 }],
    };
    savePreset(preset);
    expect(getPresets()).toEqual([preset]);
  });

  it('save with same name overwrites (upsert by name)', () => {
    savePreset({
      name: 'Filter',
      conditions: [{ field: 'fundingRate', operator: 'gt', value: 0.01 }],
    });
    savePreset({
      name: 'Filter',
      conditions: [{ field: 'fundingRate', operator: 'gt', value: 0.05 }],
    });
    const list = getPresets();
    expect(list).toHaveLength(1);
    expect(list[0].conditions[0].value).toBe(0.05);
  });

  it('saves multiple distinct-named presets', () => {
    savePreset({ name: 'A', conditions: [{ field: 'price', operator: 'gt', value: 10 }] });
    savePreset({ name: 'B', conditions: [{ field: 'price', operator: 'lt', value: 1 }] });
    expect(getPresets().map(p => p.name)).toEqual(['A', 'B']);
  });
});

describe('screenerPresets — delete', () => {
  it('removes a preset by name', () => {
    savePreset({ name: 'A', conditions: [] });
    savePreset({ name: 'B', conditions: [] });
    deletePreset('A');
    expect(getPresets().map(p => p.name)).toEqual(['B']);
  });

  it('no-op when name does not exist', () => {
    savePreset({ name: 'A', conditions: [] });
    deletePreset('NonExistent');
    expect(getPresets().map(p => p.name)).toEqual(['A']);
  });
});

describe('screenerPresets — defensive: bad localStorage data', () => {
  it('returns empty list on corrupt JSON', () => {
    storage.set('ih_screener_presets', '{not-json');
    expect(getPresets()).toEqual([]);
  });

  it('returns empty list when stored value is not an array', () => {
    storage.set('ih_screener_presets', '{"foo":"bar"}');
    expect(getPresets()).toEqual([]);
  });
});

describe('DEFAULT_PRESETS — schema sanity', () => {
  it('contains the 3 documented defaults', () => {
    expect(DEFAULT_PRESETS).toHaveLength(3);
    expect(DEFAULT_PRESETS.map(p => p.name)).toEqual([
      'High Funding', 'Negative Funding', 'Big OI + Movers',
    ]);
  });

  it('every default has at least one valid condition', () => {
    for (const p of DEFAULT_PRESETS) {
      expect(p.conditions.length).toBeGreaterThan(0);
      for (const c of p.conditions) {
        expect(['gt', 'lt']).toContain(c.operator);
        expect(typeof c.value).toBe('number');
      }
    }
  });

  it('every condition field has a matching FIELD_LABEL entry', () => {
    // Catches a refactor that removes a label without updating defaults.
    for (const p of DEFAULT_PRESETS) {
      for (const c of p.conditions) {
        expect(FIELD_LABELS[c.field], `Missing label for ${c.field}`).toBeTruthy();
      }
    }
  });
});

describe('FIELD_LABELS — schema sanity', () => {
  it('covers all 5 documented fields', () => {
    for (const k of ['fundingRate', 'openInterest', 'change24h', 'volume24h', 'price'] as const) {
      expect(FIELD_LABELS[k]).toBeTruthy();
    }
  });
});
