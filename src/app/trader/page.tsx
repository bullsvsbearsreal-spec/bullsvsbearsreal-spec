// /trader (no address) — redirect to the HL traders leaderboard.
// Per-wallet trader pages live at /trader/[address].
import { redirect } from 'next/navigation';

export default function TraderIndex() {
  redirect('/hl-traders');
}
