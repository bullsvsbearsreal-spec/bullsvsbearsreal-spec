import { describe, it, expect } from 'vitest';
import { validateWebhookUrl } from '@/lib/notifications';

/**
 * SSRF defense for the Whale-tier custom HTTPS webhook target.
 * validateWebhookUrl() returns null when the URL is acceptable,
 * or an error string explaining why it's rejected. These tests pin
 * the policy so a future refactor can't accidentally re-open the
 * private network / loopback / metadata-host attack surface.
 */
describe('validateWebhookUrl — SSRF defense', () => {
  describe('rejects', () => {
    it('empty / missing input', () => {
      expect(validateWebhookUrl('')).toMatch(/required/i);
      expect(validateWebhookUrl(null as unknown as string)).toBeTruthy();
      expect(validateWebhookUrl(undefined as unknown as string)).toBeTruthy();
    });

    it('unparseable URLs', () => {
      expect(validateWebhookUrl('not a url')).toMatch(/invalid url/i);
      expect(validateWebhookUrl('javascript:alert(1)')).toMatch(/HTTPS/i);
    });

    it('plain HTTP (no TLS)', () => {
      expect(validateWebhookUrl('http://example.com/hook')).toMatch(/HTTPS/i);
    });

    it('non-HTTPS schemes (file, ftp, gopher)', () => {
      expect(validateWebhookUrl('file:///etc/passwd')).toMatch(/HTTPS/i);
      expect(validateWebhookUrl('ftp://example.com/x')).toMatch(/HTTPS/i);
      expect(validateWebhookUrl('gopher://example.com/x')).toMatch(/HTTPS/i);
    });

    it('localhost variants', () => {
      expect(validateWebhookUrl('https://localhost/hook')).toMatch(/loopback|metadata/i);
      expect(validateWebhookUrl('https://0.0.0.0/hook')).toMatch(/loopback|metadata/i);
    });

    it('cloud metadata hosts (169.254.169.254)', () => {
      expect(validateWebhookUrl('https://169.254.169.254/latest/meta-data/')).toMatch(/loopback|metadata|link-local/i);
    });

    it('loopback range 127.0.0.0/8', () => {
      expect(validateWebhookUrl('https://127.0.0.1/x')).toMatch(/loopback/i);
      expect(validateWebhookUrl('https://127.5.5.5/x')).toMatch(/loopback/i);
    });

    it('private range 10.0.0.0/8', () => {
      expect(validateWebhookUrl('https://10.0.0.1/x')).toMatch(/private/i);
      expect(validateWebhookUrl('https://10.255.255.255/x')).toMatch(/private/i);
    });

    it('private range 172.16.0.0/12', () => {
      expect(validateWebhookUrl('https://172.16.0.1/x')).toMatch(/private/i);
      expect(validateWebhookUrl('https://172.20.5.5/x')).toMatch(/private/i);
      expect(validateWebhookUrl('https://172.31.255.255/x')).toMatch(/private/i);
    });

    it('private range 192.168.0.0/16', () => {
      expect(validateWebhookUrl('https://192.168.0.1/x')).toMatch(/private/i);
      expect(validateWebhookUrl('https://192.168.255.255/x')).toMatch(/private/i);
    });

    it('link-local range 169.254.0.0/16', () => {
      expect(validateWebhookUrl('https://169.254.1.1/x')).toMatch(/link-local|metadata/i);
    });
  });

  describe('accepts', () => {
    it('public HTTPS URLs', () => {
      expect(validateWebhookUrl('https://example.com/hook')).toBeNull();
      expect(validateWebhookUrl('https://api.partner.io/webhooks/infohub')).toBeNull();
    });

    it('HTTPS with non-private public IPs', () => {
      // 8.8.8.8 (public DNS), 1.1.1.1 (Cloudflare), 172.15.x.x (just below private range)
      expect(validateWebhookUrl('https://8.8.8.8/hook')).toBeNull();
      expect(validateWebhookUrl('https://1.1.1.1/hook')).toBeNull();
      expect(validateWebhookUrl('https://172.15.0.1/hook')).toBeNull();
      expect(validateWebhookUrl('https://172.32.0.1/hook')).toBeNull();
    });

    it('HTTPS with non-default ports + query strings + paths', () => {
      expect(validateWebhookUrl('https://example.com:8443/hook?token=abc')).toBeNull();
    });

    it('public range 192.167.x.x (just outside 192.168/16)', () => {
      expect(validateWebhookUrl('https://192.167.0.1/x')).toBeNull();
      expect(validateWebhookUrl('https://192.169.0.1/x')).toBeNull();
    });
  });
});
