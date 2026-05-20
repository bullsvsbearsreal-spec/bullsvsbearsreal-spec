'use client';

// Reusable v4 terminal layout shell. Wraps any page content in:
// TerminalHeader · MarketTape · RecentChips · Sidebar · main(children) · StatusBar.

import { useEffect, useState, type ReactNode } from 'react';
import TerminalHeader from './TerminalHeader';
import MarketTape from './MarketTape';
import RecentChips from './RecentChips';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import LaunchBanner from '@/components/LaunchBanner';

interface TickerLite { sym: string; price: number; chg: number; }

interface TerminalShellProps {
  children: ReactNode;
  className?: string;
}

const WANT_TAPE = ['BTC', 'ETH', 'SOL', 'HYPE', 'BNB', 'DOGE', 'XRP', 'AVAX', 'LINK', 'TON', 'PEPE', 'WIF'];

export default function TerminalShell({ children, className }: TerminalShellProps) {
  const [tape, setTape] = useState<TickerLite[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetch('/api/tickers');
        if (!r.ok) return;
        const v = await r.json();
        const raw = Array.isArray(v) ? v : v?.data ?? [];
        if (!mounted) return;
        // Per-symbol bucket: collect ALL exchange quotes and pick the median.
        // We were previously picking max(price), which let one outlier exchange
        // (sometimes 10× off — wrong-decimal or stale) blow up the displayed
        // price for the rest of the page (e.g. "ETH $23,226" instead of $2,372).
        const bucket = new Map<string, { prices: number[]; chgs: number[] }>();
        for (const t of raw) {
          const price = t.lastPrice ?? t.price ?? 0;
          const chg = t.priceChangePercent24h ?? t.change24h ?? t.changePercent24h ?? 0;
          if (price > 0 && WANT_TAPE.includes(t.symbol)) {
            const slot = bucket.get(t.symbol) ?? { prices: [], chgs: [] };
            slot.prices.push(price);
            slot.chgs.push(chg);
            bucket.set(t.symbol, slot);
          }
        }
        const median = (xs: number[]) => {
          const s = [...xs].sort((a, b) => a - b);
          return s.length === 0 ? 0 : s[Math.floor(s.length / 2)];
        };
        setTape(
          WANT_TAPE
            .map(s => {
              const slot = bucket.get(s);
              return slot ? { sym: s, price: median(slot.prices), chg: median(slot.chgs) } : null;
            })
            .filter((x): x is TickerLite => !!x),
        );
      } catch (e) {
        // Was silent — empty catch hid network/JSON/processing errors.
        // The MarketTape lives at the top of every page in the terminal
        // shell, so when the fetch broke the tape silently disappeared
        // with no signal. Log so we can detect the issue from Sentry +
        // browser console (the 30s setInterval below will retry).
        if (typeof console !== 'undefined') {
          console.warn('[TerminalShell] tape fetch failed (will retry):', e);
        }
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0, background: 'var(--hub-black)' }}>
      <LaunchBanner />
      <TerminalHeader />
      {tape.length > 0 && <MarketTape items={tape} />}
      <RecentChips
        recent={[
          { href: '/liquidations',  label: 'Liquidations' },
          { href: '/funding',       label: 'Funding Rates' },
          { href: '/dashboard',     label: 'Dashboard' },
          { href: '/news',          label: 'News' },
          { href: '/screener',      label: 'Screener' },
        ]}
        pinned={[
          { href: '/etf',             label: 'ETF Tracker' },
          { href: '/longshort',       label: 'L/S Ratio' },
        ]}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar pulls real online/dex counts from useAggregatorHealth.
            Props `online`/`dexCount`/`msgPerSec` were removed because nothing
            ever passed them — TerminalShell hardcoded `msgPerSec={1247}`
            which rendered as fake "1.2k msg/s" telemetry. */}
        <Sidebar />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            animation: 'page-enter 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
          }}
        >
          {children}
        </main>
      </div>

      <StatusBar />
    </div>
  );
}
