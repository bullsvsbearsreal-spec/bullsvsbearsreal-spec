/**
 * Screener filter presets stored in localStorage.
 * Key: ih_screener_presets
 */

const STORAGE_KEY = 'ih_screener_presets';

export interface FilterCondition {
  field: 'fundingRate' | 'openInterest' | 'change24h' | 'volume24h' | 'price';
  operator: 'gt' | 'lt';
  value: number;
}

export interface ScreenerPreset {
  name: string;
  conditions: FilterCondition[];
}

function read(): ScreenerPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function write(presets: ScreenerPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // silently ignore
  }
}

export function getPresets(): ScreenerPreset[] {
  return read();
}

export function savePreset(preset: ScreenerPreset): void {
  const list = read().filter((p) => p.name !== preset.name);
  list.push(preset);
  write(list);
}

export function deletePreset(name: string): void {
  write(read().filter((p) => p.name !== name));
}

export const FIELD_LABELS: Record<FilterCondition['field'], string> = {
  fundingRate: 'Funding Rate (%)',
  openInterest: 'Open Interest ($)',
  change24h: '24h Change (%)',
  volume24h: '24h Volume ($)',
  price: 'Price ($)',
};

export const DEFAULT_PRESETS: ScreenerPreset[] = [
  {
    name: 'High Funding',
    conditions: [{ field: 'fundingRate', operator: 'gt', value: 0.03 }],
  },
  {
    name: 'Negative Funding',
    conditions: [{ field: 'fundingRate', operator: 'lt', value: -0.01 }],
  },
  {
    name: 'Big OI + Movers',
    conditions: [
      { field: 'openInterest', operator: 'gt', value: 100000000 },
      { field: 'change24h', operator: 'gt', value: 3 },
    ],
  },
];
