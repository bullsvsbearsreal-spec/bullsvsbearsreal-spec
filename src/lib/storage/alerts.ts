/**
 * Alert system stored in localStorage.
 * Key: ih_alerts
 */

const STORAGE_KEY = 'ih_alerts';
const TRIGGERED_KEY = 'ih_alerts_triggered';

export type AlertMetric = 'price' | 'fundingRate' | 'openInterest' | 'change24h';
export type AlertOperator = 'gt' | 'lt';

export interface Alert {
  id: string;
  symbol: string;
  metric: AlertMetric;
  operator: AlertOperator;
  value: number;
  enabled: boolean;
  createdAt: number;
}

export interface TriggeredAlert {
  alertId: string;
  symbol: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  actualValue: number;
  triggeredAt: number;
  dismissed: boolean;
}

export const METRIC_LABELS: Record<AlertMetric, string> = {
  price: 'Price ($)',
  fundingRate: 'Funding Rate (%)',
  openInterest: 'Open Interest ($)',
  change24h: '24h Change (%)',
};

function readAlerts(): Alert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAlerts(alerts: Alert[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // silently ignore
  }
}

function readTriggered(): TriggeredAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRIGGERED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTriggered(triggered: TriggeredAlert[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRIGGERED_KEY, JSON.stringify(triggered));
  } catch {
    // silently ignore
  }
}

export function getAlerts(): Alert[] {
  return readAlerts();
}

export function addAlert(alert: Omit<Alert, 'id' | 'createdAt'>): Alert {
  const newAlert: Alert = {
    ...alert,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const list = readAlerts();
  list.push(newAlert);
  writeAlerts(list);
  return newAlert;
}

export function updateAlert(id: string, updates: Partial<Alert>): void {
  const list = readAlerts().map((a) => (a.id === id ? { ...a, ...updates } : a));
  writeAlerts(list);
}

export function deleteAlert(id: string): void {
  writeAlerts(readAlerts().filter((a) => a.id !== id));
  // Also clean up any triggered entries
  writeTriggered(readTriggered().filter((t) => t.alertId !== id));
}

export function toggleAlert(id: string): void {
  const list = readAlerts().map((a) =>
    a.id === id ? { ...a, enabled: !a.enabled } : a,
  );
  writeAlerts(list);
}

export function getTriggeredAlerts(): TriggeredAlert[] {
  return readTriggered();
}

export function getUndismissedCount(): number {
  return readTriggered().filter((t) => !t.dismissed).length;
}

export function addTriggeredAlert(triggered: Omit<TriggeredAlert, 'triggeredAt' | 'dismissed'>): void {
  const list = readTriggered();
  // Don't re-add if already triggered for this alert in last hour
  const existing = list.find(
    (t) => t.alertId === triggered.alertId && Date.now() - t.triggeredAt < 60 * 60 * 1000,
  );
  if (existing) return;
  list.unshift({ ...triggered, triggeredAt: Date.now(), dismissed: false });
  // Keep max 50 triggered alerts
  writeTriggered(list.slice(0, 50));
}

export function dismissTriggeredAlert(alertId: string): void {
  const list = readTriggered().map((t) =>
    t.alertId === alertId ? { ...t, dismissed: true } : t,
  );
  writeTriggered(list);
}

export function dismissAllTriggered(): void {
  const list = readTriggered().map((t) => ({ ...t, dismissed: true }));
  writeTriggered(list);
}

export function clearTriggered(): void {
  writeTriggered([]);
}
