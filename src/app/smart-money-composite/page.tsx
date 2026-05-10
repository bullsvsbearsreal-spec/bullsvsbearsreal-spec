/**
 * /smart-money-composite — legacy URL.
 *
 * Was a sub-view of the smart-money rankings showing the composite
 * score. Folded into the main /smart-money page in May 2026.
 *
 * Original implementation backed up at page.tsx.bak.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SmartMoneyCompositeLegacyRedirect() {
  redirect('/smart-money');
}
