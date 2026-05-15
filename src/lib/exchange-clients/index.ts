/**
 * Routes a SupportedExchange name to its ExchangeClient implementation.
 *
 * Adding a new exchange:
 *   1. Add to SUPPORTED_EXCHANGES in src/lib/portfolio/supported-exchanges.ts
 *   2. Implement src/lib/exchange-clients/<name>.ts satisfying ExchangeClient
 *   3. Wire it in to the CLIENTS map below
 */
import type { SupportedExchange } from '@/lib/portfolio/supported-exchanges';
import type { ExchangeClient } from './types';
import { binanceClient } from './binance';
import { bybitClient } from './bybit';
import { okxClient } from './okx';
import { bitgetClient } from './bitget';
import { mexcClient } from './mexc';

const CLIENTS: Record<SupportedExchange, ExchangeClient> = {
  Binance: binanceClient,
  Bybit: bybitClient,
  OKX: okxClient,
  Bitget: bitgetClient,
  MEXC: mexcClient,
};

export function getExchangeClient(exchange: SupportedExchange): ExchangeClient {
  return CLIENTS[exchange];
}

export type { ExchangeClient, ExchangeCredentials, NormalizedPosition, KeyValidation } from './types';
