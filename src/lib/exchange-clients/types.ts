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
}
