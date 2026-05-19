import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logExchangeError, logApiError, logValidationError } from '../index';

describe('logExchangeError', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a console.warn for the given exchange + error message', async () => {
    await logExchangeError('Binance', new Error('rate limited'));
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Binance'));
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('rate limited'));
  });

  it('handles non-Error inputs (string / unknown)', async () => {
    await logExchangeError('Bybit', 'plain string error');
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('plain string error'));
  });

  it('handles object errors via String() coercion', async () => {
    await logExchangeError('OKX', { code: 500, msg: 'server error' });
    // Should log [object Object] without throwing
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('throttles repeated logs from the same exchange within 5 min', async () => {
    // First call logs; second call within 5 min should be suppressed
    await logExchangeError('ThrottleTest1', new Error('first'));
    const firstCallCount = consoleWarnSpy.mock.calls.length;
    await logExchangeError('ThrottleTest1', new Error('second'));
    // Second call should NOT have added to console.warn (still throttled)
    expect(consoleWarnSpy.mock.calls.length).toBe(firstCallCount);
  });

  it('different exchanges are throttled independently', async () => {
    await logExchangeError('IndA', new Error('a'));
    const after1 = consoleWarnSpy.mock.calls.length;
    await logExchangeError('IndB', new Error('b'));
    // Different exchange → logs again
    expect(consoleWarnSpy.mock.calls.length).toBeGreaterThan(after1);
  });

  it('respects optional context (route, endpoint, status) without throwing', async () => {
    await expect(logExchangeError('Bitget', new Error('boom'), {
      route: '/api/funding',
      endpoint: 'https://api.bitget.com/v2/mix/market/funding',
      status: 503,
    })).resolves.toBeUndefined();
  });
});

describe('logApiError', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a console.error with route + message', async () => {
    await logApiError('/api/test', new Error('boom'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('/api/test'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('handles non-Error inputs', async () => {
    await logApiError('/api/route', 'string error');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });

  it('accepts optional context (ip, params) without throwing', async () => {
    await expect(logApiError('/api/users', new Error('not found'), {
      ip: '1.2.3.4',
      params: { id: '42' },
    })).resolves.toBeUndefined();
  });

  it('does NOT throttle (unlike exchange errors — API errors are usually rare + worth seeing)', async () => {
    consoleErrorSpy.mockClear();
    await logApiError('/api/x', new Error('1'));
    await logApiError('/api/x', new Error('2'));
    await logApiError('/api/x', new Error('3'));
    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
  });
});

describe('logValidationError', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs route + issue count', async () => {
    await logValidationError('/api/funding', [{ path: 'symbol', code: 'invalid' }]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/funding'),
      expect.anything(),
    );
  });

  it('handles empty issues array', async () => {
    await logValidationError('/api/empty', []);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('0 issues'),
      expect.anything(),
    );
  });

  it('caps logged issues at 3 (avoid spamming logs with huge zod errors)', async () => {
    const manyIssues = Array.from({ length: 50 }, (_, i) => ({ path: `field${i}` }));
    await logValidationError('/api/big', manyIssues);
    // 2nd argument to console.warn is the sliced issues array (max 3)
    const calls = consoleWarnSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(Array.isArray(lastCall[1])).toBe(true);
    expect((lastCall[1] as unknown[]).length).toBeLessThanOrEqual(3);
  });

  it('accepts optional context.data without throwing', async () => {
    await expect(logValidationError('/api/x', [{ msg: 'bad' }], {
      data: { whatever: 'sample' },
    })).resolves.toBeUndefined();
  });
});
