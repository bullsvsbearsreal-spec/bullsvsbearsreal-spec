/**
 * Bitget V2 Mix (USDT-M perp futures) client.
 *
 * Endpoints used (read-only):
 *   GET /api/v2/user/api-keys         API key permissions snapshot
 *   GET /api/v2/mix/position/all-position?productType=USDT-FUTURES&marginCoin=USDT
 *
 * Auth (HMAC-SHA256, base64-encoded):
 *   prehash = timestamp + method + requestPath + body
 *   signature = base64(hmac_sha256(apiSecret, prehash))
 *   timestamp = millisecond unix as string
 *
 * Headers:
 *   ACCESS-KEY, ACCESS-SIGN, ACCESS-TIMESTAMP, ACCESS-PASSPHRASE, locale=en-US
 *
 * Docs: https://www.bitget.com/api-doc/contract/intro
 */
import { createHmac } from 'crypto';
import type { ExchangeClient, ExchangeCredentials, KeyValidation, NormalizedPosition } from './types';

const BASE = 'https://api.bitget.com';
const TIMEOUT_MS = 12_000;

function sign(prehash: string, secret: string): string {
  return createHmac('sha256', secret).update(prehash).digest('base64');
}

async function signedGet<T>(path: string, query: string, creds: ExchangeCredentials): Promise<T> {
  if (!creds.passphrase) {
    throw new Error('Bitget requires passphrase');
  }
  const ts = Date.now().toString();
  const requestPath = query ? `${path}?${query}` : path;
  const prehash = `${ts}GET${requestPath}`;
  const signature = sign(prehash, creds.apiSecret);

  const url = `${BASE}${requestPath}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'ACCESS-KEY': creds.apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': ts,
      'ACCESS-PASSPHRASE': creds.passphrase,
      'locale': 'en-US',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bitget ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json?.code && json.code !== '00000') {
    throw new Error(`Bitget ${path} code=${json.code}: ${json.msg ?? 'unknown'}`);
  }
  return json as T;
}

interface BitgetApiKeysResponse {
  code: string;
  data: Array<{
    user_id: string;
    inviter_id: string;
    agent_inviter_code: string;
    channel: string;
    ips: string;
    auths: string[];     // e.g. ["read"], ["read","trade"], ["read","trade","withdraw"]
    parentId: string;
    trader: boolean;
    channel_code: string;
    regis_time: string;
  }>;
}

interface BitgetPositionsResponse {
  code: string;
  data: Array<{
    marginCoin: string;
    symbol: string;
    holdSide: 'long' | 'short';
    openDelegateSize: string;
    marginSize: string;
    available: string;
    locked: string;
    total: string;
    leverage: string;
    achievedProfits: string;
    openPriceAvg: string;
    marginMode: string;
    posMode: string;
    unrealizedPL: string;
    liquidationPrice: string;
    keepMarginRate: string;
    markPrice: string;
    breakEvenPrice: string;
    totalFee: string;
    deductedFee: string;
    cTime: string;
    uTime: string;
    autoMargin: string;
  }>;
}

function symbolToBase(symbol: string): string {
  // BTCUSDT -> BTC, 1000PEPEUSDT -> PEPE
  let s = symbol.replace(/USDT$|USDC$/, '');
  if (s.startsWith('1000')) s = s.slice(4);
  if (s.startsWith('1M')) s = s.slice(2);
  return s;
}

export const bitgetClient: ExchangeClient = {
  exchange: 'Bitget',

  async validateKey(creds): Promise<KeyValidation> {
    try {
      const resp = await signedGet<BitgetApiKeysResponse>('/api/v2/user/api-keys', '', creds);
      const row = resp.data?.[0];
      const auths = (row?.auths ?? []).map(a => a.toLowerCase());
      const perms = {
        auths,
        ips: row?.ips,
      };
      const dangerous: string[] = [];
      if (auths.includes('trade')) dangerous.push('trade');
      if (auths.includes('withdraw')) dangerous.push('withdraw');
      const warning = dangerous.length > 0
        ? `Key has dangerous scopes: ${dangerous.join(', ')}. Set to read-only on Bitget.`
        : undefined;
      return { ok: true, permissions: perms, warning };
    } catch (err) {
      return { ok: false, permissions: {}, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async fetchPositions(creds): Promise<NormalizedPosition[]> {
    const out: NormalizedPosition[] = [];
    const json = await signedGet<BitgetPositionsResponse>(
      '/api/v2/mix/position/all-position',
      'productType=USDT-FUTURES&marginCoin=USDT',
      creds,
    );
    for (const p of json.data ?? []) {
      const size = parseFloat(p.total);
      if (!Number.isFinite(size) || size === 0) continue;

      const entry = parseFloat(p.openPriceAvg) || 0;
      const mark = parseFloat(p.markPrice) || 0;
      const pnl = parseFloat(p.unrealizedPL);
      const liq = parseFloat(p.liquidationPrice);
      const lev = parseFloat(p.leverage);
      const margin = parseFloat(p.marginSize);

      out.push({
        symbol: symbolToBase(p.symbol),
        side: p.holdSide,
        size,
        entryPrice: entry,
        markPrice: mark > 0 ? mark : null,
        positionValue: mark > 0 ? size * mark : null,
        unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
        leverage: Number.isFinite(lev) && lev > 0 ? lev : null,
        marginUsed: Number.isFinite(margin) && margin > 0 ? margin : null,
        liquidationPrice: Number.isFinite(liq) && liq > 0 ? liq : null,
        tpPrice: null,   // Bitget exposes TP/SL via /position/tpsl-position-details (Phase B+)
        slPrice: null,
        cumulativeFunding: null,
      });
    }
    return out;
  },
};
