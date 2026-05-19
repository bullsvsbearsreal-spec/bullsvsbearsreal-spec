import { describe, it, expect } from 'vitest';
import { getClientIP } from '../rate-limit';

function makeRequest(headers: Record<string, string>): Request {
  return new Request('https://info-hub.io/', { headers });
}

describe('getClientIP', () => {
  it('prefers x-real-ip when present', () => {
    const req = makeRequest({ 'x-real-ip': '1.2.3.4' });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('prefers x-real-ip over x-forwarded-for', () => {
    const req = makeRequest({
      'x-real-ip': '1.2.3.4',
      'x-forwarded-for': '5.6.7.8',
    });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('falls back to x-forwarded-for when x-real-ip is missing', () => {
    const req = makeRequest({ 'x-forwarded-for': '5.6.7.8' });
    expect(getClientIP(req)).toBe('5.6.7.8');
  });

  it('extracts the FIRST IP from a multi-hop x-forwarded-for chain', () => {
    // x-forwarded-for can be: "client, proxy1, proxy2" — we want the client IP
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.1, 198.51.100.2, 192.0.2.3',
    });
    expect(getClientIP(req)).toBe('203.0.113.1');
  });

  it('trims whitespace from the chosen IP', () => {
    const req = makeRequest({
      'x-forwarded-for': '  10.0.0.1  ,  10.0.0.2',
    });
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('returns "unknown" when no IP headers are present', () => {
    const req = makeRequest({});
    expect(getClientIP(req)).toBe('unknown');
  });

  it('returns "unknown" when x-forwarded-for is an empty string', () => {
    // The header has empty value — split[0] is empty, trim is empty,
    // so we fall through to 'unknown'
    const req = makeRequest({ 'x-forwarded-for': '' });
    expect(getClientIP(req)).toBe('unknown');
  });

  it('handles IPv6 addresses', () => {
    const req = makeRequest({ 'x-real-ip': '2001:db8::1' });
    expect(getClientIP(req)).toBe('2001:db8::1');
  });

  it('returns the value verbatim — no IP-validity sanity check', () => {
    // The function is permissive — it just returns whatever the header
    // contains. Validation belongs at the rate-limiter (key bucketing).
    const req = makeRequest({ 'x-real-ip': 'not.an.ip' });
    expect(getClientIP(req)).toBe('not.an.ip');
  });
});
