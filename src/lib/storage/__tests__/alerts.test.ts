import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAlerts,
  addAlert,
  updateAlert,
  deleteAlert,
  toggleAlert,
  getTriggeredAlerts,
  addTriggeredAlert,
  dismissTriggeredAlert,
  dismissAllTriggered,
  clearTriggered,
  getUndismissedCount,
} from '../alerts';

// Mock localStorage
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
// Ensure `typeof window !== 'undefined'` passes in Node
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

beforeEach(() => {
  storage.clear();
  uuidCounter = 0;
});

describe('Alerts CRUD', () => {
  it('starts with empty alerts', () => {
    expect(getAlerts()).toEqual([]);
  });

  it('adds an alert with generated id and timestamp', () => {
    const alert = addAlert({
      symbol: 'BTC',
      metric: 'price',
      operator: 'gt',
      value: 70000,
      enabled: true,
    });
    expect(alert.id).toBe('test-uuid-1');
    expect(alert.symbol).toBe('BTC');
    expect(alert.createdAt).toBeGreaterThan(0);
    expect(getAlerts()).toHaveLength(1);
  });

  it('adds multiple alerts', () => {
    addAlert({ symbol: 'BTC', metric: 'price', operator: 'gt', value: 70000, enabled: true });
    addAlert({ symbol: 'ETH', metric: 'fundingRate', operator: 'lt', value: -0.01, enabled: true });
    expect(getAlerts()).toHaveLength(2);
  });

  it('updates an alert', () => {
    const alert = addAlert({ symbol: 'BTC', metric: 'price', operator: 'gt', value: 70000, enabled: true });
    updateAlert(alert.id, { value: 80000 });
    const updated = getAlerts().find(a => a.id === alert.id);
    expect(updated?.value).toBe(80000);
    expect(updated?.symbol).toBe('BTC'); // unchanged fields preserved
  });

  it('deletes an alert', () => {
    const a1 = addAlert({ symbol: 'BTC', metric: 'price', operator: 'gt', value: 70000, enabled: true });
    addAlert({ symbol: 'ETH', metric: 'price', operator: 'gt', value: 4000, enabled: true });
    deleteAlert(a1.id);
    expect(getAlerts()).toHaveLength(1);
    expect(getAlerts()[0].symbol).toBe('ETH');
  });

  it('toggles alert enabled state', () => {
    const alert = addAlert({ symbol: 'BTC', metric: 'price', operator: 'gt', value: 70000, enabled: true });
    toggleAlert(alert.id);
    expect(getAlerts()[0].enabled).toBe(false);
    toggleAlert(alert.id);
    expect(getAlerts()[0].enabled).toBe(true);
  });
});

describe('Triggered Alerts', () => {
  it('starts empty', () => {
    expect(getTriggeredAlerts()).toEqual([]);
  });

  it('adds a triggered alert', () => {
    addTriggeredAlert({
      alertId: 'alert-1',
      symbol: 'BTC',
      metric: 'price',
      operator: 'gt',
      threshold: 70000,
      actualValue: 71000,
    });
    const triggered = getTriggeredAlerts();
    expect(triggered).toHaveLength(1);
    expect(triggered[0].alertId).toBe('alert-1');
    expect(triggered[0].dismissed).toBe(false);
    expect(triggered[0].triggeredAt).toBeGreaterThan(0);
  });

  it('deduplicates triggered alerts within 1 hour', () => {
    addTriggeredAlert({
      alertId: 'alert-1',
      symbol: 'BTC',
      metric: 'price',
      operator: 'gt',
      threshold: 70000,
      actualValue: 71000,
    });
    addTriggeredAlert({
      alertId: 'alert-1',
      symbol: 'BTC',
      metric: 'price',
      operator: 'gt',
      threshold: 70000,
      actualValue: 72000,
    });
    expect(getTriggeredAlerts()).toHaveLength(1);
  });

  it('caps at 50 triggered alerts', () => {
    for (let i = 0; i < 55; i++) {
      // Use unique alertId so dedup doesn't kick in
      addTriggeredAlert({
        alertId: `alert-${i}`,
        symbol: 'BTC',
        metric: 'price',
        operator: 'gt',
        threshold: 70000,
        actualValue: 71000 + i,
      });
    }
    expect(getTriggeredAlerts().length).toBeLessThanOrEqual(50);
  });

  it('dismisses a triggered alert', () => {
    addTriggeredAlert({
      alertId: 'alert-1',
      symbol: 'BTC',
      metric: 'price',
      operator: 'gt',
      threshold: 70000,
      actualValue: 71000,
    });
    dismissTriggeredAlert('alert-1');
    expect(getTriggeredAlerts()[0].dismissed).toBe(true);
  });

  it('dismisses all triggered alerts', () => {
    addTriggeredAlert({ alertId: 'a1', symbol: 'BTC', metric: 'price', operator: 'gt', threshold: 70000, actualValue: 71000 });
    addTriggeredAlert({ alertId: 'a2', symbol: 'ETH', metric: 'price', operator: 'gt', threshold: 4000, actualValue: 4100 });
    dismissAllTriggered();
    expect(getTriggeredAlerts().every(t => t.dismissed)).toBe(true);
  });

  it('clears all triggered alerts', () => {
    addTriggeredAlert({ alertId: 'a1', symbol: 'BTC', metric: 'price', operator: 'gt', threshold: 70000, actualValue: 71000 });
    clearTriggered();
    expect(getTriggeredAlerts()).toEqual([]);
  });

  it('getUndismissedCount returns correct count', () => {
    addTriggeredAlert({ alertId: 'a1', symbol: 'BTC', metric: 'price', operator: 'gt', threshold: 70000, actualValue: 71000 });
    addTriggeredAlert({ alertId: 'a2', symbol: 'ETH', metric: 'price', operator: 'gt', threshold: 4000, actualValue: 4100 });
    expect(getUndismissedCount()).toBe(2);
    dismissTriggeredAlert('a1');
    expect(getUndismissedCount()).toBe(1);
  });

  it('deleteAlert also cleans up triggered entries', () => {
    const alert = addAlert({ symbol: 'BTC', metric: 'price', operator: 'gt', value: 70000, enabled: true });
    addTriggeredAlert({ alertId: alert.id, symbol: 'BTC', metric: 'price', operator: 'gt', threshold: 70000, actualValue: 71000 });
    deleteAlert(alert.id);
    expect(getTriggeredAlerts()).toEqual([]);
  });

  it('handles corrupt localStorage', () => {
    storage.set('ih_alerts', 'not-json');
    expect(getAlerts()).toEqual([]);
    storage.set('ih_alerts_triggered', '{invalid}');
    expect(getTriggeredAlerts()).toEqual([]);
  });
});
