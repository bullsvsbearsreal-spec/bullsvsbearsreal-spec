// /trader (no address) — redirect to the bounce leaderboard.
// Per-wallet trader pages live at /trader/[address].
import { redirect } from 'next/navigation';

export default function TraderIndex() {
  redirect('/bounce/leaderboard');
}
