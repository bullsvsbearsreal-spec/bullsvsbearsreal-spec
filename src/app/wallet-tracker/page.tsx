/**
 * /wallet-tracker — legacy URL.
 *
 * Pre-/watch wallet tracker. Replaced by /watch in May 2026, which
 * does the same job (track HL + gTrade wallets) plus Telegram alerts
 * on opens/closes/size-changes/liq-danger, per-wallet activity badges,
 * and a clean event log.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function WalletTrackerLegacyRedirect() {
  redirect('/watch');
}
