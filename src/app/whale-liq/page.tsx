/**
 * /whale-liq — legacy URL.
 *
 * Was the "Liquidation Roulette" gamified view of large-liquidation
 * data. Same upstream data as /liquidations; consolidated to the
 * canonical feed in May 2026.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function WhaleLiqLegacyRedirect() {
  redirect('/liquidations');
}
