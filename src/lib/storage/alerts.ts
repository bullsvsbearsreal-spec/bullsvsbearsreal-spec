/**
 * Alert system stored in localStorage.
 * Key: ih_alerts
 */

const STORAGE_KEY = 'ih_alerts';
const TRIGGERED_KEY = 'ih_alerts_triggered';

export type AlertMetric = 'price' | 'fundingRate' | 'openInterest' | 'change24h' | 'volume24h' | 'liquidations24h' | 'liqProximity' | 'tpProximity';
export type AlertOperator = 'gt' | 'lt';

export interface Alert {
  id: string;
  symbol: string;
  metric: AlertMetric;
  operator: AlertOperator;
  value: number;
  enabled: boolean;
  createdAt: number;
  /** Optional: specific exchange for per-exchange funding alerts */
  exchange?: string;
  /** For liqProximity/tpProximity: alert when price is within this % of the target price */
  proximityPct?: number;
  /** Optional: restrict notifications to specific channels. Empty/undefined = use global prefs (all channels). */
  channels?: string[];
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
  volume24h: '24h Volume ($)',
  liquidations24h: '24h Liquidations ($)',
  liqProximity: 'Liquidation Price ($)',
  tpProximity: 'Take Profit Price ($)',
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
  const now = Date.now();
  // If already triggered for this alert recently, update it in place (refresh value + time)
  const existingIdx = list.findIndex(
    (t) => t.alertId === triggered.alertId && now - t.triggeredAt < 60 * 60 * 1000 && !t.dismissed,
  );
  if (existingIdx !== -1) {
    list[existingIdx] = { ...triggered, triggeredAt: now, dismissed: false };
    writeTriggered(list);
    return;
  }
  // Remove stale dismissed entries for this alert before adding fresh one
  const cleaned = list.filter(
    (t) => !(t.alertId === triggered.alertId && t.dismissed),
  );
  cleaned.unshift({ ...triggered, triggeredAt: now, dismissed: false });
  // Keep max 50 triggered alerts
  writeTriggered(cleaned.slice(0, 50));
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
