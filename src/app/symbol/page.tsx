// /symbol (no symbol) — redirect to the screener.
// Per-symbol pages live at /symbol/[symbol].
import { redirect } from 'next/navigation';

export default function SymbolIndex() {
  redirect('/screener');
}
