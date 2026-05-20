/**
 * Shared types for the per-CEX position fetchers used by the portfolio sync cron.
 *
 * Each implementation lives in its own file (binance.ts, bybit.ts, …) and
 * exports a single object satisfying ExchangeClient. The router in
 * src/lib/exchange-clients/index.ts dispatches by exchange name.
 */
import type { SupportedExchange } from '@/lib/portfolio/supported-exchanges';

/** Plaintext credentials passed in for a single signed call. Never persisted. */
export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  /** OKX + Bitget only. Other exchanges ignore. */
  passphrase?: string;
}

/**
 * Normalized open position. Fields not provided by the exchange come back as
 * null rather than 0 so the UI can distinguish "unknown" from "zero".
 */
export interface NormalizedPosition {
  /** Base asset, e.g. "BTC". No quote suffix. */
  symbol: string;
  side: 'long' | 'short';
  /** Size in base-asset units (always positive — direction is in `side`). */
  size: number;
  entryPrice: number;
  markPrice: number | null;
  /** size * markPrice, in USD. */
  positionValue: number | null;
  unrealizedPnl: number | null;
  /** Cross / isolated leverage value as a number. */
  leverage: number | null;
  marginUsed: number | null;
  liquidationPrice: number | null;
  /** Optional TP / SL — fetched when the exchange exposes them on the position object. */
  tpPrice: number | null;
  slPrice: number | null;
  /** Per-position cumulative funding paid/received (negative = paid out). USD. */
  cumulativeFunding: number | null;
}

/**
 * Lightweight permissions/metadata snapshot returned at validation time.
 * The shape is exchange-specific — store as JSONB in user_exchange_keys.permissions.
 */
export interface KeyValidation {
  ok: boolean;
  /** Exchange-reported permissions (`canTrade`, `canWithdraw`, etc.). Free-form. */
  permissions: Record<string, unknown>;
  /** Set when ok=false. Human-readable. */
  error?: string;
  /** Set when ok=true and the key has dangerous permissions. UI shows a warning. */
  warning?: string;
}

/**
 * Account-level wallet/equity snapshot. Returned by `fetchAccountBalance()`.
 *
 * This is the TRUE equity: free cash + margin tied up + unrealized PnL.
 * Without this, the /positions page's equity row only counted per-position
 * margin + uPnL — which understates equity for cross-margin users (most
 * MEXC/Binance traders) by the value of their free wallet balance.
 *
 * All fields in USD (quoted in the exchange's USDT/USDC unified balance).
 * If the exchange has multiple wallets (Funding, Spot, Futures, Earn),
 * only the FUTURES/CONTRACT wallet is included — that's what trades
 * margin against.
 */
export interface NormalizedAccountBalance {
  /** Total equity: free cash + margin + uPnL. The headline figure. */
  equityUsd: number;
  /** Free cash not tied up in margin — withdrawable / sizeable into new positions. */
  availableUsd: number;
  /** Margin currently allocated to open positions across all symbols. */
  marginUsedUsd: number;
}

/**
 * One filled trade as returned by an exchange's userTrades / fills /
 * execution-list endpoint. Mirrors NormalizedTrade in wallet-clients
 * so the sync cron can persist DEX + CEX trades through the same path.
 */
export interface NormalizedExchangeTrade {
  symbol: string;
  /** 'buy' | 'sell' (CEX standard). */
  side: 'buy' | 'sell';
  /** Optional finer qualifier for derivatives (open / close / reduce / add). */
  direction?: 'open' | 'close' | 'reduce' | 'add';
  /** Size in base-asset units. */
  size: number;
  price: number;
  /** Filled USD notional. */
  valueUsd: number;
  /** Fees paid in USD (sign-positive). */
  feeUsd?: number | null;
  /** Realised PnL on closing fills. Null for opens. Most CEXes report this. */
  realizedPnlUsd?: number | null;
  /** Original venue trade id (e.g. Binance tradeId). Used for dedup. */
  venueTradeId: string;
  /** Fill timestamp. */
  ts: Date;
}

export interface ExchangeClient {
  readonly exchange: SupportedExchange;

  /**
   * Hit a low-cost authenticated endpoint to confirm the key works AND inspect
   * its permissions. Throws are caught upstream — return ok:false instead so
   * the failure mode is consistent across exchanges.
   */
  validateKey(creds: ExchangeCredentials): Promise<KeyValidation>;

  /** Fetch all open perp positions for the account. Empty array = no positions. */
  fetchPositions(creds: ExchangeCredentials): Promise<NormalizedPosition[]>;

  /**
   * Sum funding paid/received per symbol over the last `sinceMs` window
   * (default 30 days). Returns Map<base-symbol, total USD>.
   *   positive = received funding (favourable)
   *   negative = paid funding   (unfavourable)
   *
   * Approximation: a fixed lookback rather than tracking per-position
   * `opened_at`. For positions newer than the window this is exact;
   * for older positions it's an under-count of total funding paid.
   *
   * Optional — clients that don't expose income history return an empty map.
   * The sync cron treats missing keys as "unknown" (NULL in user_positions),
   * which the UI shows as "—" — same as today.
   */
  fetchCumulativeFunding?(creds: ExchangeCredentials, sinceMs?: number): Promise<Map<string, number>>;

  /**
   * Fetch trade fills since `sinceMs` (default 30 days lookback). Caller
   * dedupes via venueTradeId at the DB layer, so a small overlap window
   * is safe — return whatever the venue gives back.
   *
   * Optional — clients that don't implement just don't contribute to the
   * Trade Journal / Tax aggregator. Failure is non-fatal in the cron.
   */
  fetchTradeHistory?(creds: ExchangeCredentials, sinceMs?: number): Promise<NormalizedExchangeTrade[]>;

  /**
   * Fetch the account-level wallet/equity totals for the FUTURES account.
   * Returns true equity (free balance + margin + uPnL), not just per-
   * position margin. Critical for cross-margin accounts where /positions
   * only shows allocated margin and the bulk of equity sits as free cash.
   *
   * Returns null when the call fails (network/auth/permission) — caller
   * falls back to the margin-sum equity in that case. Failure is non-
   * fatal in the /positions render path.
   *
   * Optional — implementations that haven't wired this yet can omit. The
   * /api/account/positions route degrades gracefully (per-exchange equity
   * stays at the margin-sum figure, with a UI hint that it's
   * "margin only" rather than "true equity").
   */
  fetchAccountBalance?(creds: ExchangeCredentials): Promise<NormalizedAccountBalance | null>;
}
