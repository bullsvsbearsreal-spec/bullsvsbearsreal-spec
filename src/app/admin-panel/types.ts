/**
 * Shared admin-dashboard types — mirror the /api/admin/* response shapes.
 * Keeping them in one file avoids each tab redeclaring its own interface
 * and drifting out of sync with the API layer.
 */

export interface StatsResp {
  totals: {
    users: number;
    alertNotifications: number;
    fundingSnapshots: number;
    oiSnapshots: number;
    liquidationSnapshots: number;
    telegramUsers: number;
    pushSubscriptions: number;
  };
  last24h: {
    alertNotifications: number;
    fundingSnapshots: number;
    liquidationSnapshots: number;
  };
  trends?: {
    alerts: number[];
    funding: number[];
    oi: number[];
    liquidations: number[];
  };
  users?: {
    tiers: { tier: string; count: number }[];
    roles: { role: string; count: number }[];
    verified: { verified: number; unverified: number };
    signups: { last7d: number; last30d: number; last90d: number };
    recent: {
      id: string;
      email: string | null;
      name: string | null;
      createdAt: string;
      tier: string;
      role: string;
    }[];
    active: { dau: number; wau: number; mau: number };
  };
  retention?: {
    d1:  { pct: number; total: number } | null;
    d7:  { pct: number; total: number } | null;
    d30: { pct: number; total: number } | null;
  };
  engagement?: {
    activeAlertsTotal: number;
    usersWithAlerts: number;
    watchedWallets: number;
    connectedKeys: number;
    connectedWallets: number;
  };
  notifications?: {
    byChannel: { channel: string; count: number }[];
    sent: number;
    failed: number;
    total: number;
  };
  affiliate?: {
    referredUsers: number;
    payoutsConfigured: number;
  };
  dbSize: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actorEmail?: string | null;
  actorName?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  pctOfTop: number;     // % of step #0
  pctOfPrev: number;    // % of immediately previous step
}

export interface TopPage {
  route: string;
  views: number;
  uniques?: number;
}

/**
 * BugReport — mirrors the existing /api/feedback shape (and the
 * underlying bug_reports table). Keeping the field names here in
 * lock-step with lib/db/index.ts listBugReports() avoids a second
 * adapter layer in the admin panel.
 */
export interface BugReport {
  id: number;
  userId: string | null;
  userEmail: string | null;
  pageUrl: string;
  pageTitle: string | null;
  userAgent: string | null;
  viewport: string | null;
  message: string;
  severity: 'low' | 'normal' | 'high';
  status: 'open' | 'resolved' | 'wontfix';
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}
