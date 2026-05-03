// /coin (no id) — redirect to the coin browser at /screener.
// Direct coin pages live at /coin/[id].
import { redirect } from 'next/navigation';

export default function CoinIndex() {
  redirect('/screener');
}
