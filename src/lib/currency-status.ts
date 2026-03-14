/**
 * Fetches deposit/withdrawal status from exchanges with public APIs.
 * Only OKX, KuCoin, and Gate.io expose this without authentication.
 */

export interface CurrencyStatus {
  exchange: string;
  symbol: string;
  canDeposit: boolean;
  canWithdraw: boolean;
  network?: string;
}

// Cached status (2 min TTL — status changes rarely)
let statusCache: { data: Map<string, CurrencyStatus[]>; timestamp: number } | null = null;
const STATUS_TTL = 2 * 60 * 1000;

async function fetchOKXStatus(): Promise<CurrencyStatus[]> {
  try {
    const res = await fetch('https://www.okx.com/api/v5/asset/currencies', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.code !== '0' || !Array.isArray(json.data)) return [];
    return json.data.map((c: any) => ({
      exchange: 'OKX',
      symbol: (c.ccy || '').toUpperCase(),
      canDeposit: c.canDep === true || c.canDep === 'true',
      canWithdraw: c.canWd === true || c.canWd === 'true',
      network: c.chain || undefined,
    }));
  } catch { return []; }
}

async function fetchKuCoinStatus(): Promise<CurrencyStatus[]> {
  try {
    const res = await fetch('https://api.kucoin.com/api/v3/currencies', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.code !== '200000' || !Array.isArray(json.data)) return [];
    return json.data.map((c: any) => ({
      exchange: 'KuCoin',
      symbol: (c.currency || '').toUpperCase(),
      canDeposit: c.isDepositEnabled === true,
      canWithdraw: c.isWithdrawEnabled === true,
    }));
  } catch { return []; }
}

async function fetchGateStatus(): Promise<CurrencyStatus[]> {
  try {
    const proxyUrl = process.env.PROXY_URL;
    const targetUrl = 'https://api.gateio.ws/api/v4/spot/currencies';
    const url = proxyUrl
      ? `${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}`
      : targetUrl;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((c: any) => ({
      exchange: 'Gate.io',
      symbol: (c.currency || '').toUpperCase(),
      canDeposit: !c.deposit_disabled,
      canWithdraw: !c.withdraw_disabled,
    }));
  } catch { return []; }
}

/**
 * Returns a map of "EXCHANGE:SYMBOL" → CurrencyStatus
 * Only includes exchanges with public status APIs.
 */
export async function fetchAllCurrencyStatus(): Promise<Map<string, CurrencyStatus>> {
  if (statusCache && Date.now() - statusCache.timestamp < STATUS_TTL) {
    const flat = new Map<string, CurrencyStatus>();
    for (const [, statuses] of Array.from(statusCache.data)) {
      for (const s of statuses) flat.set(`${s.exchange}:${s.symbol}`, s);
    }
    return flat;
  }

  const [okx, kucoin, gate] = await Promise.all([
    fetchOKXStatus(),
    fetchKuCoinStatus(),
    fetchGateStatus(),
  ]);

  const byExchange = new Map<string, CurrencyStatus[]>();
  byExchange.set('OKX', okx);
  byExchange.set('KuCoin', kucoin);
  byExchange.set('Gate.io', gate);

  statusCache = { data: byExchange, timestamp: Date.now() };

  const flat = new Map<string, CurrencyStatus>();
  for (const statuses of [okx, kucoin, gate]) {
    for (const s of statuses) flat.set(`${s.exchange}:${s.symbol}`, s);
  }
  return flat;
}

// Exchanges that have public status APIs
export const STATUS_EXCHANGES = new Set(['OKX', 'KuCoin', 'Gate.io']);
