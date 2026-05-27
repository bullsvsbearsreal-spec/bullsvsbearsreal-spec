/**
 * /funding-predictor — legacy URL.
 *
 * Was a forecasting view that predicted the next-window funding rate
 * per coin (derived from Binance's premium-index running average).
 * Consolidated into /funding in May 2026 — predictions are an
 * enhancement of the main funding rates view, not a separate page.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FundingPredictorLegacyRedirect() {
  redirect('/funding');
}
