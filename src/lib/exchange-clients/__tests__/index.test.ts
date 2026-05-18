import { describe, it, expect } from 'vitest';
import { getExchangeClient } from '../index';
import type { SupportedExchange } from '@/lib/portfolio/supported-exchanges';

describe('getExchangeClient', () => {
  const supported: SupportedExchange[] = ['Binance', 'Bybit', 'OKX', 'Bitget', 'MEXC'];

  it.each(supported)('returns a non-null client for %s', (exchange) => {
    const client = getExchangeClient(exchange);
    expect(client).toBeDefined();
    expect(client).not.toBeNull();
  });

  it('every returned client has the expected exchange name', () => {
    supported.forEach((ex) => {
      const client = getExchangeClient(ex);
      expect(client.exchange).toBe(ex);
    });
  });

  it('every client exposes validateKey + fetchPositions', () => {
    supported.forEach((ex) => {
      const client = getExchangeClient(ex);
      expect(typeof client.validateKey).toBe('function');
      expect(typeof client.fetchPositions).toBe('function');
    });
  });

  it('routes to distinct client instances (no accidental aliasing)', () => {
    const binance = getExchangeClient('Binance');
    const bybit = getExchangeClient('Bybit');
    expect(binance).not.toBe(bybit);
    expect(binance.exchange).not.toBe(bybit.exchange);
  });

  it('returns the same instance on repeat calls (clients are singletons)', () => {
    const a = getExchangeClient('Binance');
    const b = getExchangeClient('Binance');
    expect(a).toBe(b);
  });
});
