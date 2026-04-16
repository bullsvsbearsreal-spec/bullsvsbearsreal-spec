import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for notification formatting helpers and channel send functions.
 * External services (Resend, Telegram, Twilio, web-push) are mocked.
 */

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock Resend — must use function keyword for `new` to work
const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'test' } });
vi.mock('resend', () => ({
  Resend: function () { return { emails: { send: mockResendSend } }; },
}));

// Mock telegram sendMessage
const mockTelegramSend = vi.fn().mockResolvedValue(true);
vi.mock('../telegram', () => ({
  sendMessage: (...args: unknown[]) => mockTelegramSend(...args),
}));

// Mock web-push
const mockWebPushSend = vi.fn().mockResolvedValue({});
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockWebPushSend(...args),
  },
}));

// Set env vars before importing module
process.env.RESEND_API_KEY = 'test-key';
process.env.VAPID_PUBLIC_KEY = 'test-pub';
process.env.VAPID_PRIVATE_KEY = 'test-priv';

import {
  sendAlertEmail,
  sendAlertTelegram,
  sendAlertPush,
  sendAlertDiscord,
  sendAlertWhatsApp,
  type TriggeredAlertInfo,
  type PushSubscriptionData,
} from '../notifications';

// ─── Test Data ──────────────────────────────────────────────────────────────

const sampleAlert: TriggeredAlertInfo = {
  alertId: 'alert-1',
  symbol: 'BTC',
  metric: 'price',
  operator: 'gt',
  threshold: 50000,
  actualValue: 52000,
};

const fundingAlert: TriggeredAlertInfo = {
  alertId: 'alert-2',
  symbol: 'ETH',
  metric: 'fundingRate',
  operator: 'lt',
  threshold: -0.01,
  actualValue: -0.02,
  exchange: 'Binance',
};

const proximityAlert: TriggeredAlertInfo = {
  alertId: 'alert-3',
  symbol: 'SOL',
  metric: 'liqProximity',
  operator: 'lt',
  threshold: 100,
  actualValue: 103,
  proximityPct: 5,
};

const tpAlert: TriggeredAlertInfo = {
  alertId: 'alert-4',
  symbol: 'DOGE',
  metric: 'tpProximity',
  operator: 'gt',
  threshold: 0.5,
  actualValue: 0.48,
  proximityPct: 10,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Reset module-level singleton by re-mocking Resend so `_resend` gets reconstructed
  mockResendSend.mockResolvedValue({ data: { id: 'test' } });
});

describe('sendAlertEmail', () => {
  it('sends email for valid alerts', async () => {
    const result = await sendAlertEmail('user@example.com', [sampleAlert]);
    expect(result).toBe(true);
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    const call = mockResendSend.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toContain('BTC');
    expect(call.html).toContain('BTC');
    expect(call.html).toContain('above');
  });

  it('returns false for empty alerts', async () => {
    const result = await sendAlertEmail('user@example.com', []);
    expect(result).toBe(false);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('handles multiple alerts in one email', async () => {
    const result = await sendAlertEmail('user@example.com', [sampleAlert, fundingAlert]);
    expect(result).toBe(true);
    const call = mockResendSend.mock.calls[0][0];
    expect(call.subject).toContain('BTC');
    expect(call.subject).toContain('ETH');
    expect(call.html).toContain('Funding Rate');
    expect(call.html).toContain('Binance');
  });

  it('handles proximity alerts in email', async () => {
    const result = await sendAlertEmail('user@example.com', [proximityAlert]);
    expect(result).toBe(true);
    const call = mockResendSend.mock.calls[0][0];
    expect(call.html).toContain('SOL');
    // Proximity alerts show "within X% of liq price"
    expect(call.html).toContain('liq price');
  });

  it('handles TP proximity alerts in email', async () => {
    const result = await sendAlertEmail('user@example.com', [tpAlert]);
    expect(result).toBe(true);
    const call = mockResendSend.mock.calls[0][0];
    expect(call.html).toContain('DOGE');
    expect(call.html).toContain('TP');
  });

  it('returns false when Resend throws', async () => {
    mockResendSend.mockRejectedValueOnce(new Error('API error'));
    const result = await sendAlertEmail('user@example.com', [sampleAlert]);
    expect(result).toBe(false);
  });
});

describe('sendAlertTelegram', () => {
  it('sends telegram message', async () => {
    const result = await sendAlertTelegram(12345, [sampleAlert]);
    expect(result).toBe(true);
    expect(mockTelegramSend).toHaveBeenCalledTimes(1);
    const [chatId, message, parseMode] = mockTelegramSend.mock.calls[0];
    expect(chatId).toBe(12345);
    expect(message).toContain('BTC');
    expect(message).toContain('above');
    expect(parseMode).toBe('HTML');
  });

  it('returns false for empty alerts', async () => {
    const result = await sendAlertTelegram(12345, []);
    expect(result).toBe(false);
    expect(mockTelegramSend).not.toHaveBeenCalled();
  });

  it('includes exchange info for per-exchange alerts', async () => {
    const result = await sendAlertTelegram(12345, [fundingAlert]);
    expect(result).toBe(true);
    const message = mockTelegramSend.mock.calls[0][1] as string;
    expect(message).toContain('Binance');
    expect(message).toContain('Funding Rate');
  });

  it('formats proximity alerts correctly', async () => {
    const result = await sendAlertTelegram(12345, [proximityAlert]);
    expect(result).toBe(true);
    const message = mockTelegramSend.mock.calls[0][1] as string;
    expect(message).toContain('SOL');
    expect(message).toContain('liquidation price');
  });

  it('returns false when telegram throws', async () => {
    mockTelegramSend.mockRejectedValueOnce(new Error('Network error'));
    const result = await sendAlertTelegram(12345, [sampleAlert]);
    expect(result).toBe(false);
  });
});

describe('sendAlertPush', () => {
  const mockSub: PushSubscriptionData = {
    endpoint: 'https://push.example.com/sub123',
    p256dh: 'test-p256dh',
    auth: 'test-auth',
  };

  it('sends push notification', async () => {
    const result = await sendAlertPush([mockSub], [sampleAlert]);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockWebPushSend).toHaveBeenCalledTimes(1);
  });

  it('returns zeros for empty alerts', async () => {
    const result = await sendAlertPush([mockSub], []);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('returns zeros for empty subscriptions', async () => {
    const result = await sendAlertPush([], [sampleAlert]);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('sends to multiple subscriptions', async () => {
    const sub2: PushSubscriptionData = { ...mockSub, endpoint: 'https://push.example.com/sub456' };
    const result = await sendAlertPush([mockSub, sub2], [sampleAlert]);
    expect(result.sent).toBe(2);
    expect(mockWebPushSend).toHaveBeenCalledTimes(2);
  });

  it('tracks expired endpoints (410 status)', async () => {
    const err: any = new Error('Gone');
    err.statusCode = 410;
    mockWebPushSend.mockRejectedValueOnce(err);
    const result = await sendAlertPush([mockSub], [sampleAlert]);
    expect(result.failed).toBe(1);
    expect(result.expiredEndpoints).toContain(mockSub.endpoint);
  });

  it('tracks expired endpoints (404 status)', async () => {
    const err: any = new Error('Not Found');
    err.statusCode = 404;
    mockWebPushSend.mockRejectedValueOnce(err);
    const result = await sendAlertPush([mockSub], [sampleAlert]);
    expect(result.expiredEndpoints).toContain(mockSub.endpoint);
  });

  it('counts generic failures separately', async () => {
    mockWebPushSend.mockRejectedValueOnce(new Error('Network error'));
    const result = await sendAlertPush([mockSub], [sampleAlert]);
    expect(result.failed).toBe(1);
    expect(result.expiredEndpoints).toHaveLength(0);
  });
});

describe('sendAlertDiscord', () => {
  const validWebhook = 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop';
  const invalidWebhook = 'https://evil.com/steal-data';

  it('returns false for empty alerts', async () => {
    const result = await sendAlertDiscord(validWebhook, []);
    expect(result).toBe(false);
  });

  it('returns false for empty webhook URL', async () => {
    const result = await sendAlertDiscord('', [sampleAlert]);
    expect(result).toBe(false);
  });

  it('rejects invalid webhook URLs', async () => {
    const result = await sendAlertDiscord(invalidWebhook, [sampleAlert]);
    expect(result).toBe(false);
  });

  it('rejects non-Discord webhook URLs', async () => {
    const result = await sendAlertDiscord('https://hooks.slack.com/services/abc', [sampleAlert]);
    expect(result).toBe(false);
  });

  it('sends to valid Discord webhook', async () => {
    // Mock fetch for Discord
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: () => '' });
    global.fetch = mockFetch;

    const result = await sendAlertDiscord(validWebhook, [sampleAlert]);
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(validWebhook);
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.embeds).toHaveLength(1);
    expect(body.embeds[0].title).toContain('Alert');
  });

  it('returns false on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, text: () => 'rate limited' });
    const result = await sendAlertDiscord(validWebhook, [sampleAlert]);
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await sendAlertDiscord(validWebhook, [sampleAlert]);
    expect(result).toBe(false);
  });
});

describe('sendAlertWhatsApp', () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'test_token';
  });

  it('returns false for empty alerts', async () => {
    const result = await sendAlertWhatsApp('+1234567890', []);
    expect(result).toBe(false);
  });

  it('returns false for empty phone', async () => {
    const result = await sendAlertWhatsApp('', [sampleAlert]);
    expect(result).toBe(false);
  });

  it('returns false without Twilio credentials', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    const result = await sendAlertWhatsApp('+1234567890', [sampleAlert]);
    expect(result).toBe(false);
  });

  it('sends WhatsApp message via Twilio', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({ sid: 'SM_test' }) });
    global.fetch = mockFetch;

    const result = await sendAlertWhatsApp('+1234567890', [sampleAlert]);
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('twilio.com');
    expect(url).toContain('AC_test');
    // body is a URL-encoded string (URLSearchParams.toString())
    const body = new URLSearchParams(options.body as string);
    expect(body.get('To')).toBe('whatsapp:+1234567890');
  });

  it('normalizes phone numbers with whatsapp: prefix', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({ sid: 'SM_test' }) });
    global.fetch = mockFetch;

    await sendAlertWhatsApp('whatsapp:+1234567890', [sampleAlert]);
    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body as string);
    expect(body.get('To')).toBe('whatsapp:+1234567890');
  });

  it('adds + prefix to bare numbers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({ sid: 'SM_test' }) });
    global.fetch = mockFetch;

    await sendAlertWhatsApp('1234567890', [sampleAlert]);
    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body as string);
    expect(body.get('To')).toBe('whatsapp:+1234567890');
  });

  it('returns false on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: () => 'Bad Request' });
    const result = await sendAlertWhatsApp('+1234567890', [sampleAlert]);
    expect(result).toBe(false);
  });
});
