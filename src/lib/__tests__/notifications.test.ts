import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = { send: vi.fn().mockResolvedValue({ id: 'mock-id' }) };
    },
  };
});

vi.mock('../telegram', () => ({
  sendMessage: vi.fn().mockResolvedValue(true),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn().mockResolvedValue({}),
}));

import type { TriggeredAlertInfo } from '../notifications';

const sampleAlert: TriggeredAlertInfo = {
  alertId: 'a1',
  symbol: 'BTC',
  metric: 'price',
  operator: 'gt',
  threshold: 80000,
  actualValue: 85000,
};

const sampleProximityAlert: TriggeredAlertInfo = {
  alertId: 'a2',
  symbol: 'ETH',
  metric: 'liqProximity',
  operator: 'gt',
  threshold: 3000,
  actualValue: 3100,
  proximityPct: 5,
};

const sampleExchangeAlert: TriggeredAlertInfo = {
  alertId: 'a3',
  symbol: 'SOL',
  metric: 'fundingRate',
  operator: 'gt',
  threshold: 0.05,
  actualValue: 0.08,
  exchange: 'Binance',
};

// --- sendAlertEmail ---

describe('sendAlertEmail', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false when no alerts provided', async () => {
    const { sendAlertEmail } = await import('../notifications');
    const result = await sendAlertEmail('test@example.com', []);
    expect(result).toBe(false);
  });

  it('returns false when Resend is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendAlertEmail } = await import('../notifications');
    const result = await sendAlertEmail('test@example.com', [sampleAlert]);
    expect(result).toBe(false);
  });

  it('sends email when Resend is configured', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const { sendAlertEmail } = await import('../notifications');
    const result = await sendAlertEmail('test@example.com', [sampleAlert]);
    expect(result).toBe(true);
  });

  it('handles multiple alerts in one email', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const { sendAlertEmail } = await import('../notifications');
    const result = await sendAlertEmail('test@example.com', [
      sampleAlert, sampleProximityAlert, sampleExchangeAlert,
    ]);
    expect(result).toBe(true);
  });
});

// --- sendAlertTelegram ---

describe('sendAlertTelegram', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false for empty alerts', async () => {
    const { sendAlertTelegram } = await import('../notifications');
    const result = await sendAlertTelegram(12345, []);
    expect(result).toBe(false);
  });

  it('sends telegram message for valid alerts', async () => {
    const { sendAlertTelegram } = await import('../notifications');
    const result = await sendAlertTelegram(12345, [sampleAlert]);
    expect(result).toBe(true);
  });

  it('handles proximity alerts formatting', async () => {
    const { sendAlertTelegram } = await import('../notifications');
    const result = await sendAlertTelegram(12345, [sampleProximityAlert]);
    expect(result).toBe(true);
  });
});

// --- sendAlertPush ---

describe('sendAlertPush', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns zeros for empty subscriptions', async () => {
    const { sendAlertPush } = await import('../notifications');
    const result = await sendAlertPush([], [sampleAlert]);
    expect(result).toEqual({ sent: 0, failed: 0, expiredEndpoints: [] });
  });

  it('returns zeros for empty alerts', async () => {
    const { sendAlertPush } = await import('../notifications');
    const result = await sendAlertPush(
      [{ endpoint: 'https://push.example.com', p256dh: 'key1', auth: 'auth1' }],
      [],
    );
    expect(result).toEqual({ sent: 0, failed: 0, expiredEndpoints: [] });
  });
});

// --- sendAlertDiscord ---

describe('sendAlertDiscord', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it('returns false for empty alerts', async () => {
    const { sendAlertDiscord } = await import('../notifications');
    const result = await sendAlertDiscord('https://discord.com/api/webhooks/123456789/abcdef-token123', []);
    expect(result).toBe(false);
  });

  it('sends discord webhook for valid alerts', async () => {
    const { sendAlertDiscord } = await import('../notifications');
    const result = await sendAlertDiscord('https://discord.com/api/webhooks/123456789/abcdef-token123', [sampleAlert]);
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/123456789/abcdef-token123',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// --- sendAlertWhatsApp ---

describe('sendAlertWhatsApp', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false for empty alerts', async () => {
    const { sendAlertWhatsApp } = await import('../notifications');
    const result = await sendAlertWhatsApp('+1234567890', []);
    expect(result).toBe(false);
  });

  it('returns false when Twilio is not configured', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;
    const { sendAlertWhatsApp } = await import('../notifications');
    const result = await sendAlertWhatsApp('+1234567890', [sampleAlert]);
    expect(result).toBe(false);
  });
});
