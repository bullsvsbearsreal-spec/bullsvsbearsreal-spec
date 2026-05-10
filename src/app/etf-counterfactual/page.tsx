/**
 * /etf-counterfactual — legacy URL.
 *
 * Was a niche scenario tool ("BTC without ETF flows") that simulated
 * what price action would look like minus institutional ETF demand.
 * Low-traffic, overlapping conceptually with /etf-flows. Consolidated
 * in May 2026.
 *
 * Original implementation backed up at page.tsx.bak.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function EtfCounterfactualLegacyRedirect() {
  redirect('/etf-flows');
}
