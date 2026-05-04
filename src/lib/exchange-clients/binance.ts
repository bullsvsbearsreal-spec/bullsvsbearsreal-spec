/**
 * Binance USDⓈ-M Futures client.
 *
 * Endpoints used (read-only — no trade scope required):
 *   GET /fapi/v2/account            account snapshot + per-asset positions + permissions
 *   GET /fapi/v2/positionRisk       per-symbol open positions with liquidation, leverage, mark
 *
 * Auth: HMAC-SHA256 over the query string with the API secret.
 * Header: X-MBX-APIKEY: <apiKey>
 *
 * Docs: https://binance-docs.github.io/apidocs/futures/en/#account-information-v2-user_data
 */
import { createHmac } from 'crypto';
import type { ExchangeClient, ExchangeCredentials, KeyValidation, NormalizedPosition } from './types';

const BASE = 'https://fapi.binance.com';
const TIMEOUT_MS = 12_000;
const RECV_WINDOW_MS = 5_000;

function sign(query: string, secret: string): string {
  return createHmac('sha256', secret).update(query).digest('hex');
}

async function signedGet<T>(path: string, params: Record<string, string | number>, creds: ExchangeCredentials): Promise<T> {
  const ts = Date.now();
  const usp = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: String(ts),
    recvWindow: String(RECV_WINDOW_MS),
  });
  const signature = sign(usp.toString(), creds.apiSecret);
  usp.append('signature', signature);
  const url = `${BASE}${path}?${usp.toString()}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'X-MBX-APIKEY': creds.apiKey,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Binance ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface BinanceAccountResponse {
  feeTier: number;
  canTrade: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  positions: Array<{
    symbol: string;
    initialMargin: string;
    maintMargin: string;
    unrealizedProfit: string;
    positionInitialMargin: string;
    leverage: string;
    isolated: boolean;
    entryPrice: string;
    maxNotional: string;
    positionSide: string;
    positionAmt: string;
    notional: string;
    isolatedWallet: string;
    updateTime: number;
  }>;
}

interface BinancePositionRisk {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  isolatedMargin: string;
  positionSide: string;
  notional: string;
}

interface BinanceIncomeRow {
  symbol: string;
  incomeType: string;
  income: string;        // USD value as string (e.g. "-0.0125")
  time: number;
  info?: string;
}

function symbolToBase(s: string): string {
  let sym = s.replace(/USDT$|USDC$|BUSD$/, '');
  if (sym.startsWith('1000')) sym = sym.slice(4);
  if (sym.startsWith('1M')) sym = sym.slice(2);
  return sym;
}

export const binanceClient: ExchangeClient = {
  exchange: 'Binance',

  async validateKey(creds): Promise<KeyValidation> {
    try {
      const acct = await signedGet<BinanceAccountResponse>('/fapi/v2/account', {}, creds);
      const perms = {
        canTrade: acct.canTrade,
        canDeposit: acct.canDeposit,
        canWithdraw: acct.canWithdraw,
        feeTier: acct.feeTier,
      };
      const dangerous: string[] = [];
      if (acct.canTrade) dangerous.push('canTrade');
      if (acct.canWithdraw) dangerous.push('canWithdraw');
      const warning = dangerous.length > 0
        ? `Key has dangerous scopes: ${dangerous.join(', ')}. Disable on Binance for safety.`
        : undefined;
      return { ok: true, permissions: perms, warning };
    } catch (err) {
      return { ok: false, permissions: {}, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async fetchPositions(creds): Promise<NormalizedPosition[]> {
    const rows = await signedGet<BinancePositionRisk[]>('/fapi/v2/positionRisk', {}, creds);
    const out: NormalizedPosition[] = [];
    for (const r of rows) {
      const amt = parseFloat(r.positionAmt);
      if (!Number.isFinite(amt) || amt === 0) continue;

      const side: 'long' | 'short' = amt > 0 ? 'long' : 'short';
      const size = Math.abs(amt);
      const entry = parseFloat(r.entryPrice) || 0;
      const mark = parseFloat(r.markPrice) || 0;
      const pnl = parseFloat(r.unRealizedProfit);
      const liq = parseFloat(r.liquidationPrice);
      const lev = parseFloat(r.leverage);
      const margin = parseFloat(r.isolatedMargin);

      const symbol = symbolToBase(r.symbol);

      out.push({
        symbol,
        side,
        size,
        entryPrice: entry,
        markPrice: mark > 0 ? mark : null,
        positionValue: mark > 0 ? size * mark : null,
        unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
        leverage: Number.isFinite(lev) && lev > 0 ? lev : null,
        marginUsed: Number.isFinite(margin) && margin > 0 ? margin : null,
        liquidationPrice: Number.isFinite(liq) && liq > 0 ? liq : null,
        tpPrice: null,
        slPrice: null,
        cumulativeFunding: null, // populated post-hoc by sync cron via fetchCumulativeFunding
      });
    }
    return out;
  },

  async fetchCumulativeFunding(creds, sinceMs?: number): Promise<Map<string, number>> {
    const since = sinceMs ?? Date.now() - 30 * 86400_000;
    const map = new Map<string, number>();
    // Binance /fapi/v1/income returns up to 1000 rows per call. For a 30-day
    // window even active traders rarely exceed this — single call is enough.
    const rows = await signedGet<BinanceIncomeRow[]>(
      '/fapi/v1/income',
      { incomeType: 'FUNDING_FEE', startTime: since, limit: 1000 },
      creds,
    );
    for (const r of rows) {
      if (r.incomeType !== 'FUNDING_FEE') continue;
      const v = parseFloat(r.income);
      if (!Number.isFinite(v)) continue;
      const sym = symbolToBase(r.symbol);
      map.set(sym, (map.get(sym) ?? 0) + v);
    }
    return map;
  },
};
