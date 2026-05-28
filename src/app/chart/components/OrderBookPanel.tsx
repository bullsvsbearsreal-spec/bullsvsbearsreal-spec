'use client';

/**
 * Live L2 order book for the /chart terminal.
 *
 * Data sources (per venue):
 *   · Binance Futures  — wss://fstream.binance.com/ws/<sym>@depth20@100ms
 *   · Bybit            — wss://stream.bybit.com/v5/public/linear (orderbook.50)
 *   · OKX              — wss://ws.okx.com:8443/ws/v5/public  (books5)
 *   · Coinbase Pro     — wss://ws-feed.exchange.coinbase.com (level2)
 *
 * For simplicity v1 wires Binance + a venue dropdown placeholder for
 * the others — switching venue resets the WS. Tick-size selector
 * groups adjacent levels (sum of size at each rounded price).
 *
 * Visual: standard bid/ask split with horizontal depth bars behind
 * quantity (color-tinted, opacity scaled to relative volume on each
 * side). Spread highlighted between the two halves.
 *
 * Limitations to be aware of:
 *  · No cross-tab WS reuse — opening 2 tabs of /chart opens 2 WS.
 *    Fine at single-instance Whale scale; if it becomes a problem,
 *    extract to a shared module + SharedWorker.
 *  · No reconnect backoff on persistent failures — the browser's
 *    own retry-after-close is good enough for the median user.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type Venue = 'Binance' | 'Bybit' | 'OKX' | 'Coinbase';
type Level = { price: number; size: number };

const VENUES: Venue[] = ['Binance', 'Bybit', 'OKX', 'Coinbase'];
const MAX_ROWS = 12;

/** Sensible default ticks per asset price-magnitude. BTC trades in
 *  $0.10 increments on Binance Futures; LINK trades in $0.001. */
const TICK_OPTIONS = [0.001, 0.01, 0.1, 1, 10];

function pickDefaultTick(price: number): number {
  if (price >= 10_000) return 1;
  if (price >= 100) return 0.1;
  if (price >= 1) return 0.01;
  return 0.001;
}

/** Binance Futures partial book depth has two shapes in the wild:
 *   1. `btcusdt@depth20@100ms` → diff/partial frames using `b` / `a`
 *   2. Older docs showed snapshot frames with `bids` / `asks`
 *  We accept both — first observed frame wins. */
interface DepthMsg {
  b?: [string, string][];
  a?: [string, string][];
  bids?: [string, string][];
  asks?: [string, string][];
}

function buildBinanceUrl(symbol: string): string {
  const pair = (symbol + 'USDT').toLowerCase();
  return `wss://fstream.binance.com/ws/${pair}@depth20@100ms`;
}

function buildBybitUrl(): string {
  return 'wss://stream.bybit.com/v5/public/linear';
}

/** Group adjacent levels by tick. Floors bid prices, ceils asks so
 *  the grouped midpoint never disappears between the two sides. */
function groupLevels(levels: Level[], tick: number, side: 'bid' | 'ask'): Level[] {
  if (tick <= 0) return levels;
  const grouped = new Map<number, number>();
  for (const { price, size } of levels) {
    const bucket = side === 'bid'
      ? Math.floor(price / tick) * tick
      : Math.ceil(price / tick) * tick;
    grouped.set(bucket, (grouped.get(bucket) ?? 0) + size);
  }
  const out = Array.from(grouped, ([price, size]) => ({ price, size }));
  out.sort((a, b) => side === 'bid' ? b.price - a.price : a.price - b.price);
  return out;
}

export function OrderBookPanel({ symbol }: { symbol: string }) {
  const [venue, setVenue] = useState<Venue>('Binance');
  const [tick, setTick] = useState<number>(0.1);
  const [bids, setBids] = useState<Level[]>([]);
  const [asks, setAsks] = useState<Level[]>([]);
  const [connected, setConnected] = useState(false);
  const [venueMenuOpen, setVenueMenuOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Reset on symbol/venue change + adapt default tick from last seen price
  useEffect(() => {
    setBids([]);
    setAsks([]);
    setConnected(false);

    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* noop */ }
      wsRef.current = null;
    }

    if (!symbol) return;

    // Binance is the v1 implementation; Bybit/OKX/Coinbase use Binance
    // as fallback for now (separate WS protocols, follow-up work).
    const url = buildBinanceUrl(symbol);

    let cancelled = false;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => { if (!cancelled) setConnected(true); };
    ws.onclose = () => { if (!cancelled) setConnected(false); };
    ws.onerror = () => { if (!cancelled) setConnected(false); };
    ws.onmessage = (ev) => {
      if (cancelled) return;
      try {
        const msg: DepthMsg = JSON.parse(ev.data);
        // Binance partial-depth frames use `b`/`a`; some snapshots
        // use `bids`/`asks`. Accept either.
        const rawBids = msg.b ?? msg.bids;
        const rawAsks = msg.a ?? msg.asks;
        if (!rawBids || !rawAsks) return;
        const nextBids: Level[] = rawBids.map(([p, q]) => ({ price: +p, size: +q })).filter(l => l.size > 0 && Number.isFinite(l.price));
        const nextAsks: Level[] = rawAsks.map(([p, q]) => ({ price: +p, size: +q })).filter(l => l.size > 0 && Number.isFinite(l.price));
        if (nextBids.length > 0 || nextAsks.length > 0) {
          setBids(nextBids);
          setAsks(nextAsks);
        }
      } catch { /* swallow malformed frames */ }
    };

    return () => {
      cancelled = true;
      try { ws.close(); } catch { /* noop */ }
      wsRef.current = null;
    };
  }, [symbol, venue]);

  // Auto-pick a tick the first time we get a real price, only if user
  // hasn't moved off the 0.1 default. Stops aggregating ETH at $0.10
  // when LINK arrives at $14.
  useEffect(() => {
    const mid = bids[0]?.price ?? asks[0]?.price;
    if (!mid || mid <= 0) return;
    const target = pickDefaultTick(mid);
    setTick(prev => (prev === 0.1 ? target : prev));
  }, [bids, asks]);

  const groupedBids = useMemo(() => groupLevels(bids, tick, 'bid').slice(0, MAX_ROWS), [bids, tick]);
  const groupedAsks = useMemo(() => groupLevels(asks, tick, 'ask').slice(0, MAX_ROWS), [asks, tick]);

  const maxBidSize = Math.max(1, ...groupedBids.map(l => l.size));
  const maxAskSize = Math.max(1, ...groupedAsks.map(l => l.size));

  const bestBid = groupedBids[0]?.price;
  const bestAsk = groupedAsks[0]?.price;
  const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null;
  const spread = bestBid && bestAsk ? bestAsk - bestBid : null;
  const spreadPct = spread && mid ? (spread / mid) * 100 : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="relative flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Order Book</span>
          <button
            onClick={() => setVenueMenuOpen(o => !o)}
            className="flex items-center gap-1 text-xs text-neutral-300 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/[0.05]"
          >
            {venue} · ${tick}
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
        {/* Dropdown anchored to the header itself, not floating off-screen. */}
        {venueMenuOpen && (
          <>
            {/* Click-out catcher */}
            <div className="fixed inset-0 z-30" onClick={() => setVenueMenuOpen(false)} />
            <div className="absolute left-2 top-full mt-1 z-40 bg-neutral-900 border border-white/[0.08] rounded-md shadow-xl p-2 min-w-[180px]">
              <div className="text-[9px] uppercase tracking-wider text-neutral-500 mb-1 px-1">Venue</div>
              {VENUES.map(v => (
                <button
                  key={v}
                  onClick={() => { setVenue(v); setVenueMenuOpen(false); }}
                  className={`block w-full text-left text-xs px-2 py-1 rounded hover:bg-white/[0.06] ${v === venue ? 'text-yellow-400' : 'text-neutral-300'}`}
                >
                  {v}{v !== 'Binance' && <span className="text-[9px] text-neutral-500 ml-1">(via Binance fallback)</span>}
                </button>
              ))}
              <div className="text-[9px] uppercase tracking-wider text-neutral-500 mt-2 mb-1 px-1">Tick</div>
              <div className="flex flex-wrap gap-1">
                {TICK_OPTIONS.map(t => (
                  <button
                    key={t}
                    onClick={() => { setTick(t); setVenueMenuOpen(false); }}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${t === tick ? 'bg-yellow-400/10 text-yellow-300' : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]'}`}
                  >
                    ${t}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-1 text-[10px] uppercase tracking-wider text-neutral-600">
        <span>Size ({symbol})</span>
        <span>Price</span>
        <span>Sum</span>
      </div>

      {/* Asks (top half, reversed so best ask is closest to mid) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 overflow-hidden flex flex-col justify-end">
          {groupedAsks.slice().reverse().map((l, i) => {
            const widthPct = (l.size / maxAskSize) * 100;
            const sum = groupedAsks.slice(0, groupedAsks.length - i).reduce((acc, lv) => acc + lv.size, 0);
            return (
              <div key={`a-${l.price}`} className="relative flex items-center justify-between px-3 py-[2px] text-[11px] font-mono hover:bg-white/[0.03] cursor-default">
                <div className="absolute inset-y-0 right-0 bg-red-500/10" style={{ width: `${widthPct}%` }} />
                <span className="text-neutral-400 z-10">{l.size.toFixed(3)}</span>
                <span className="text-red-400 z-10 font-semibold">{l.price.toFixed(2)}</span>
                <span className="text-neutral-500 z-10 text-[10px]">{sum.toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* Spread row */}
        <div className="px-3 py-1 border-y border-white/[0.06] bg-white/[0.02] text-[10px] flex items-center justify-between">
          <span className="text-white font-mono text-xs">
            {mid ? `$${mid.toFixed(2)}` : <span className="text-neutral-600">—</span>}
          </span>
          <span className="text-neutral-500">
            spread {spread ? spread.toFixed(2) : '—'}
            {spreadPct !== null && <span className="ml-1">· {spreadPct.toFixed(3)}%</span>}
          </span>
        </div>

        {/* Bids */}
        <div className="flex-1 overflow-hidden">
          {groupedBids.map((l, i) => {
            const widthPct = (l.size / maxBidSize) * 100;
            const sum = groupedBids.slice(0, i + 1).reduce((acc, lv) => acc + lv.size, 0);
            return (
              <div key={`b-${l.price}`} className="relative flex items-center justify-between px-3 py-[2px] text-[11px] font-mono hover:bg-white/[0.03] cursor-default">
                <div className="absolute inset-y-0 right-0 bg-emerald-500/10" style={{ width: `${widthPct}%` }} />
                <span className="text-neutral-400 z-10">{l.size.toFixed(3)}</span>
                <span className="text-emerald-400 z-10 font-semibold">{l.price.toFixed(2)}</span>
                <span className="text-neutral-500 z-10 text-[10px]">{sum.toFixed(2)}</span>
              </div>
            );
          })}
          {groupedBids.length === 0 && (
            <div className="flex items-center justify-center h-full text-[10px] text-neutral-600">
              {connected ? 'waiting for depth…' : 'connecting…'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
