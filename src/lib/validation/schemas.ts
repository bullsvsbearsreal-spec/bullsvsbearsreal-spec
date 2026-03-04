/**
 * Zod validation schemas for API request parameters and response data.
 * Used at API route entry points to validate query params and at exchange
 * fetcher boundaries to validate external API responses.
 */
import { z } from 'zod/v4';

// ─── API Query Parameter Schemas ────────────────────────────────────────────

/** Valid asset class filter values for the funding route */
export const AssetClassSchema = z.enum(['crypto', 'stocks', 'forex', 'commodities', 'all']);
export type AssetClassFilter = z.infer<typeof AssetClassSchema>;

/** Funding route query params: ?assetClass=crypto */
export const FundingQuerySchema = z.object({
  assetClass: AssetClassSchema.default('crypto'),
});

/** Tickers route query params: ?symbols=BTC,ETH,SOL */
export const TickersQuerySchema = z.object({
  symbols: z
    .string()
    .max(1000)
    .transform(s => s.split(',').map(v => v.trim().toUpperCase()).filter(Boolean))
    .optional(),
});

/** Liquidations route query params: ?symbol=BTC&exchange=okx&limit=100 */
export const LiquidationsQuerySchema = z.object({
  symbol: z
    .string()
    .min(1, 'Missing symbol parameter')
    .max(20)
    .transform(s => s.toUpperCase()),
  exchange: z
    .string()
    .max(20)
    .transform(s => s.toLowerCase())
    .default('okx'),
  limit: z
    .string()
    .default('100')
    .transform(s => Math.min(Math.max(parseInt(s, 10) || 100, 1), 100)),
});

// ─── Core Data Type Schemas ─────────────────────────────────────────────────
// Used to validate exchange API responses at the boundary.

/** Individual ticker entry from an exchange */
export const TickerDataSchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  price: z.number().optional(),
  price24hAgo: z.number().optional(),
  change24h: z.number().optional(),
  volume24h: z.number().optional(),
  high24h: z.number().optional(),
  low24h: z.number().optional(),
});

/** Individual funding rate entry from an exchange */
export const FundingRateSchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  fundingRate: z.number(),
  fundingInterval: z.string().optional(),
  markPrice: z.number().optional(),
  indexPrice: z.number().optional(),
  predictedRate: z.number().optional(),
  openInterest: z.number().optional(),
  type: z.enum(['cex', 'dex']).optional(),
  assetClass: z.string().optional(),
});

/** Individual open interest entry from an exchange */
export const OpenInterestSchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  openInterest: z.number(),
  notionalValue: z.number().optional(),
});

/** Individual liquidation entry */
export const LiquidationSchema = z.object({
  side: z.enum(['long', 'short']),
  size: z.number(),
  price: z.number(),
  value: z.number(),
  timestamp: z.number(),
});

// ─── Helper: Safe Parse with Logging ────────────────────────────────────────

/**
 * Parse an array of exchange responses, filtering out invalid entries
 * and logging validation errors instead of crashing.
 */
export function safeParseArray<T>(
  data: unknown[],
  schema: z.ZodType<T>,
  context?: string,
): T[] {
  const results: T[] = [];
  let errorCount = 0;

  for (const item of data) {
    const parsed = schema.safeParse(item);
    if (parsed.success) {
      results.push(parsed.data);
    } else {
      errorCount++;
      if (errorCount <= 3) {
        // Log first few errors, don't spam
        console.warn(
          `[Validation] ${context || 'Unknown'}: Invalid entry skipped`,
          parsed.error.issues?.[0],
        );
      }
    }
  }

  if (errorCount > 0) {
    console.warn(`[Validation] ${context || 'Unknown'}: ${errorCount}/${data.length} entries failed validation`);
  }

  return results;
}
