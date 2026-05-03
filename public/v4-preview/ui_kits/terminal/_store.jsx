// ══════════════════════════════════════════════════════════════════
// InfoHub — Mock Backend
// A single source of truth all UI subscribes to. Pub/sub-driven.
// Simulates: price ticks, funding drift, OI flux, liq events, news,
//            order books, trades, watchlist + alerts CRUD.
// ══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── seed data ────────────────────────────────────────────────────
  const SEED = [
    { sym: 'BTC',   name: 'Bitcoin',   px: 112842,    chg: 2.41,  fund: 0.0375,  oi: 12_470_000_000, oi24: 1.82,  vol24: 48_200_000_000, ls: 0.84, mcap: 2_220_000_000_000, sup: 19.7e6,  cat: 'majors',  iconBg: 'linear-gradient(135deg,#f7931a,#ffb547)' },
    { sym: 'ETH',   name: 'Ethereum',  px: 4221.08,   chg: -0.64, fund: -0.0170, oi: 8_210_000_000,  oi24: -0.42, vol24: 22_400_000_000, ls: 0.91, mcap: 508_000_000_000,    sup: 120.3e6, cat: 'majors',  iconBg: 'linear-gradient(135deg,#627eea,#4a5bd0)' },
    { sym: 'SOL',   name: 'Solana',    px: 214.52,    chg: 6.12,  fund: 0.1201,  oi: 2_840_000_000,  oi24: 8.41,  vol24: 5_120_000_000,  ls: 1.24, mcap: 102_000_000_000,    sup: 477e6,   cat: 'layer1',  iconBg: 'linear-gradient(135deg,#9945ff,#14f195)' },
    { sym: 'HYPE',  name: 'Hyperliquid',px: 38.21,    chg: 12.84, fund: 0.2104,  oi: 847_000_000,    oi24: 24.12, vol24: 2_100_000_000,  ls: 1.42, mcap: 12_700_000_000,     sup: 332e6,   cat: 'defi',    iconBg: 'linear-gradient(135deg,#97fce4,#10b981)' },
    { sym: 'BNB',   name: 'BNB',       px: 712.44,    chg: 1.12,  fund: 0.0421,  oi: 1_840_000_000,  oi24: 2.81,  vol24: 2_840_000_000,  ls: 0.96, mcap: 102_000_000_000,    sup: 143e6,   cat: 'majors',  iconBg: 'linear-gradient(135deg,#f3ba2f,#e0a020)' },
    { sym: 'DOGE',  name: 'Dogecoin',  px: 0.4122,    chg: -3.24, fund: -0.0412, oi: 1_120_000_000,  oi24: -4.21, vol24: 1_840_000_000,  ls: 0.74, mcap: 60_000_000_000,     sup: 145.8e9, cat: 'memes',   iconBg: 'linear-gradient(135deg,#c2a633,#fcc85c)' },
    { sym: 'XRP',   name: 'XRP',       px: 2.84,      chg: 0.82,  fund: 0.0211,  oi: 1_240_000_000,  oi24: 1.21,  vol24: 3_120_000_000,  ls: 1.08, mcap: 162_000_000_000,    sup: 57e9,    cat: 'majors',  iconBg: 'linear-gradient(135deg,#23292f,#4d5d6c)' },
    { sym: 'AVAX',  name: 'Avalanche', px: 48.12,     chg: -1.10, fund: -0.0082, oi: 712_000_000,    oi24: -1.42, vol24: 612_000_000,    ls: 0.88, mcap: 19_700_000_000,     sup: 410e6,   cat: 'layer1',  iconBg: 'linear-gradient(135deg,#e84142,#c02728)' },
    { sym: 'LINK',  name: 'Chainlink', px: 24.88,     chg: 4.02,  fund: 0.0520,  oi: 641_000_000,    oi24: 5.24,  vol24: 812_000_000,    ls: 1.14, mcap: 16_200_000_000,     sup: 651e6,   cat: 'defi',    iconBg: 'linear-gradient(135deg,#2a5ada,#1e4bb8)' },
    { sym: 'TON',   name: 'Toncoin',   px: 6.71,      chg: -0.24, fund: 0.0082,  oi: 412_000_000,    oi24: 0.62,  vol24: 412_000_000,    ls: 0.98, mcap: 16_400_000_000,     sup: 2.45e9,  cat: 'layer1',  iconBg: 'linear-gradient(135deg,#0088cc,#005f9e)' },
    { sym: 'PEPE',  name: 'Pepe',      px: 0.0000187, chg: 8.12,  fund: 0.0842,  oi: 421_000_000,    oi24: 14.21, vol24: 1_240_000_000,  ls: 1.18, mcap: 7_800_000_000,      sup: 420e12,  cat: 'memes',   iconBg: 'linear-gradient(135deg,#4d9348,#6bc060)' },
    { sym: 'WIF',   name: 'dogwifhat', px: 3.22,      chg: 4.82,  fund: 0.0612,  oi: 212_000_000,    oi24: 6.42,  vol24: 384_000_000,    ls: 1.08, mcap: 3_200_000_000,      sup: 998e6,   cat: 'memes',   iconBg: 'linear-gradient(135deg,#e4a047,#c47a1d)' },
    { sym: 'ARB',   name: 'Arbitrum',  px: 1.82,      chg: 2.81,  fund: 0.0412,  oi: 384_000_000,    oi24: 3.21,  vol24: 412_000_000,    ls: 1.02, mcap: 9_200_000_000,      sup: 5e9,     cat: 'layer1',  iconBg: 'linear-gradient(135deg,#28a0f0,#1478c4)' },
    { sym: 'OP',    name: 'Optimism',  px: 2.41,      chg: 1.42,  fund: 0.0218,  oi: 284_000_000,    oi24: 2.41,  vol24: 184_000_000,    ls: 1.04, mcap: 4_120_000_000,      sup: 1.7e9,   cat: 'layer1',  iconBg: 'linear-gradient(135deg,#ff0420,#cc0218)' },
    { sym: 'SUI',   name: 'Sui',       px: 4.82,      chg: 5.21,  fund: 0.0712,  oi: 412_000_000,    oi24: 7.81,  vol24: 642_000_000,    ls: 1.18, mcap: 14_200_000_000,     sup: 2.94e9,  cat: 'layer1',  iconBg: 'linear-gradient(135deg,#4ca8ff,#1d7ed8)' },
    { sym: 'APT',   name: 'Aptos',     px: 12.84,     chg: -2.41, fund: -0.0212, oi: 184_000_000,    oi24: -1.81, vol24: 124_000_000,    ls: 0.84, mcap: 7_400_000_000,      sup: 575e6,   cat: 'layer1',  iconBg: 'linear-gradient(135deg,#33d9b2,#1ba88a)' },
    { sym: 'INJ',   name: 'Injective', px: 28.12,     chg: 3.21,  fund: 0.0412,  oi: 184_000_000,    oi24: 4.12,  vol24: 184_000_000,    ls: 1.12, mcap: 2_840_000_000,      sup: 101e6,   cat: 'defi',    iconBg: 'linear-gradient(135deg,#00f2ff,#00b8c4)' },
    { sym: 'TAO',   name: 'Bittensor', px: 412.84,    chg: 7.84,  fund: 0.1042,  oi: 284_000_000,    oi24: 12.42, vol24: 312_000_000,    ls: 1.32, mcap: 3_840_000_000,      sup: 9.2e6,   cat: 'ai',      iconBg: 'linear-gradient(135deg,#ffaa00,#cc7700)' },
    { sym: 'FET',   name: 'Fetch.ai',  px: 1.82,      chg: 4.21,  fund: 0.0412,  oi: 124_000_000,    oi24: 5.21,  vol24: 184_000_000,    ls: 1.18, mcap: 4_640_000_000,      sup: 2.55e9,  cat: 'ai',      iconBg: 'linear-gradient(135deg,#3a37d0,#1e1ca8)' },
    { sym: 'RNDR',  name: 'Render',    px: 8.21,      chg: 6.42,  fund: 0.0612,  oi: 212_000_000,    oi24: 6.84,  vol24: 184_000_000,    ls: 1.22, mcap: 4_240_000_000,      sup: 517e6,   cat: 'ai',      iconBg: 'linear-gradient(135deg,#ff5050,#cc2828)' },
    { sym: 'NEAR',  name: 'NEAR',      px: 7.42,      chg: 1.82,  fund: 0.0312,  oi: 184_000_000,    oi24: 2.41,  vol24: 142_000_000,    ls: 1.04, mcap: 8_240_000_000,      sup: 1.11e9,  cat: 'layer1',  iconBg: 'linear-gradient(135deg,#000000,#444444)' },
    { sym: 'ATOM',  name: 'Cosmos',    px: 8.92,      chg: -0.84, fund: -0.0112, oi: 142_000_000,    oi24: -1.21, vol24: 124_000_000,    ls: 0.92, mcap: 3_490_000_000,      sup: 391e6,   cat: 'layer1',  iconBg: 'linear-gradient(135deg,#2e3148,#5d63a0)' },
    { sym: 'POL',   name: 'Polygon',   px: 0.512,     chg: 0.42,  fund: 0.0118,  oi: 142_000_000,    oi24: 0.81,  vol24: 184_000_000,    ls: 1.02, mcap: 4_840_000_000,      sup: 9.45e9,  cat: 'layer1',  iconBg: 'linear-gradient(135deg,#8247e5,#5d2cb1)' },
    { sym: 'AAVE',  name: 'Aave',      px: 384.21,    chg: 2.81,  fund: 0.0312,  oi: 184_000_000,    oi24: 3.41,  vol24: 142_000_000,    ls: 1.08, mcap: 5_730_000_000,      sup: 14.9e6,  cat: 'defi',    iconBg: 'linear-gradient(135deg,#b6509e,#7d2c6c)' },
    { sym: 'UNI',   name: 'Uniswap',   px: 12.84,     chg: 1.42,  fund: 0.0212,  oi: 124_000_000,    oi24: 1.81,  vol24: 184_000_000,    ls: 1.04, mcap: 7_690_000_000,      sup: 599e6,   cat: 'defi',    iconBg: 'linear-gradient(135deg,#ff007a,#cc0061)' },
    { sym: 'BONK',  name: 'Bonk',      px: 0.0000412, chg: 11.42, fund: 0.1542,  oi: 184_000_000,    oi24: 18.21, vol24: 412_000_000,    ls: 1.41, mcap: 3_180_000_000,      sup: 77e12,   cat: 'memes',   iconBg: 'linear-gradient(135deg,#ff8c00,#ff5500)' },
    { sym: 'JUP',   name: 'Jupiter',   px: 1.42,      chg: 5.21,  fund: 0.0612,  oi: 184_000_000,    oi24: 6.41,  vol24: 184_000_000,    ls: 1.18, mcap: 3_870_000_000,      sup: 2.72e9,  cat: 'defi',    iconBg: 'linear-gradient(135deg,#94c0e0,#3580b3)' },
    { sym: 'PYTH',  name: 'Pyth',      px: 0.412,     chg: 2.41,  fund: 0.0312,  oi: 84_000_000,     oi24: 2.81,  vol24: 84_000_000,     ls: 1.02, mcap: 2_340_000_000,      sup: 5.68e9,  cat: 'defi',    iconBg: 'linear-gradient(135deg,#e6a4d0,#c46aaa)' },
    { sym: 'TIA',   name: 'Celestia',  px: 6.42,      chg: -1.21, fund: -0.0112, oi: 142_000_000,    oi24: -0.81, vol24: 124_000_000,    ls: 0.92, mcap: 4_080_000_000,      sup: 635e6,   cat: 'layer1',  iconBg: 'linear-gradient(135deg,#7b2bf9,#5318c4)' },
    { sym: 'SEI',   name: 'Sei',       px: 0.412,     chg: 3.21,  fund: 0.0412,  oi: 84_000_000,     oi24: 3.81,  vol24: 84_000_000,     ls: 1.12, mcap: 2_240_000_000,      sup: 5.43e9,  cat: 'layer1',  iconBg: 'linear-gradient(135deg,#9d1f19,#6e0f0a)' },
    { sym: 'BLUR',  name: 'Blur',      px: 0.184,     chg: -2.81, fund: -0.0212, oi: 42_000_000,     oi24: -2.41, vol24: 42_000_000,     ls: 0.84, mcap: 412_000_000,        sup: 2.24e9,  cat: 'defi',    iconBg: 'linear-gradient(135deg,#ff6500,#cc4400)' },
    { sym: 'JTO',   name: 'Jito',      px: 3.21,      chg: 4.42,  fund: 0.0512,  oi: 84_000_000,     oi24: 5.21,  vol24: 84_000_000,     ls: 1.18, mcap: 1_080_000_000,      sup: 336e6,   cat: 'defi',    iconBg: 'linear-gradient(135deg,#9bf2c7,#3eb87e)' },
  ];

  const VENUES = ['BINANCE', 'BYBIT', 'OKX', 'BITGET', 'HYPERLIQ', 'DERIBIT', 'COINBASE'];

  // ── pub/sub bus ───────────────────────────────────────────────────
  const subs = new Map(); // event → Set<fn>
  function on(event, fn) {
    if (!subs.has(event)) subs.set(event, new Set());
    subs.get(event).add(fn);
    return () => subs.get(event)?.delete(fn);
  }
  function emit(event, payload) {
    subs.get(event)?.forEach(fn => { try { fn(payload); } catch (e) { /* swallow */ } });
  }

  // ── state ─────────────────────────────────────────────────────────
  const state = {
    coins: SEED.map(c => ({ ...c, venue: pick(VENUES, hash(c.sym)) })),
    events: [],            // ring buffer of stream events
    liqEvents: [],         // dedicated liq feed
    watchlist: new Set(['BTC', 'ETH', 'HYPE', 'SOL']),
    alerts: [
      { id: 1, sym: 'BTC',  cond: 'price > 115000',  state: 'armed',  when: '2h',  fired: false },
      { id: 2, sym: 'HYPE', cond: 'fund > 0.20%',    state: 'firing', when: '2s',  fired: true,  value: '+0.21%' },
      { id: 3, sym: 'ETH',  cond: 'price < 4000',    state: 'armed',  when: '1d',  fired: false },
      { id: 4, sym: 'SOL',  cond: 'oi24 > 10%',      state: 'armed',  when: '4h',  fired: false },
      { id: 5, sym: 'PEPE', cond: 'liquidations > 10M', state: 'fired', when: '12m', fired: true },
    ],
    portfolio: {
      pnl24: 1284.42, pnl24Pct: 4.82, equity: 28482.18, free: 8201.42,
      positions: [
        { sym: 'BTC',  side: 'long',  size: 0.18,    entry: 110820, mark: 112842, lev: '5x', upnl:  364.32 },
        { sym: 'HYPE', side: 'long',  size: 280,     entry: 33.12,  mark: 38.21,  lev: '3x', upnl: 1425.20 },
        { sym: 'ETH',  side: 'short', size: 1.4,     entry: 4280,   mark: 4221,   lev: '2x', upnl:   82.60 },
      ],
    },
    nowMs: Date.now(),
    msgPerSec: 1247,
    apiMs: 142, wsMs: 38,
    speed: 1.0,            // multiplier set by tweaks
  };

  // ── helpers ───────────────────────────────────────────────────────
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function pick(arr, n) { return arr[n % arr.length]; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rndBox(mu = 0, sigma = 1) {
    const u = Math.random() || 1e-9, v = Math.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function fmtUSD(n, opts = {}) {
    const { dp = 2 } = opts;
    if (n == null || isNaN(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9)  return '$' + (n / 1e9).toFixed(2)  + 'B';
    if (abs >= 1e6)  return '$' + (n / 1e6).toFixed(2)  + 'M';
    if (abs >= 1e3)  return '$' + (n / 1e3).toFixed(2)  + 'K';
    return '$' + n.toFixed(dp);
  }
  function fmtPx(n) {
    if (n == null) return '—';
    if (n < 0.0001) return '$' + n.toExponential(2);
    if (n < 1)     return '$' + n.toFixed(4);
    if (n < 100)   return '$' + n.toFixed(2);
    return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // ── tick engine ───────────────────────────────────────────────────
  let tickTimer = null;
  function tick() {
    state.nowMs = Date.now();
    // price + funding drift
    state.coins.forEach((c, i) => {
      const vol = c.cat === 'memes' ? 0.008 : c.cat === 'majors' ? 0.0015 : 0.004;
      const drift = rndBox(0, vol) * c.px;
      const newPx = Math.max(c.px + drift, c.px * 0.5);
      const dir = newPx > c.px ? 1 : newPx < c.px ? -1 : 0;
      c.pxPrev = c.px;
      c.px = newPx;
      c.flashDir = dir;
      c.flashAt = state.nowMs;
      c.fund += rndBox(0, 0.0008);
      c.fund = clamp(c.fund, -0.5, 0.5);
      c.oi *= 1 + rndBox(0, 0.001);
      c.ls += rndBox(0, 0.005);
      c.ls = clamp(c.ls, 0.4, 1.8);
      // chg ~= rolling
      c.chg = ((c.px / SEED[i].px) - 1) * 100;
    });

    // throughput jitter
    state.msgPerSec = 1247 + Math.floor(rndBox(0, 80));
    state.apiMs = clamp(142 + Math.floor(rndBox(0, 12)), 90, 220);
    state.wsMs  = clamp(38  + Math.floor(rndBox(0, 6)),  18, 90);

    emit('tick', state);
  }

  // ── stream events ─────────────────────────────────────────────────
  let evtTimer = null;
  function pushEvent() {
    const c = state.coins[Math.floor(Math.random() * state.coins.length)];
    const venue = pick(VENUES, Math.floor(Math.random() * VENUES.length));
    const r = Math.random();
    let evt;
    if (r < 0.45) {
      // trade
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const size = (Math.random() * 50 + 0.1);
      evt = { kind: 'trade', sym: c.sym, side, size, px: c.px, venue, t: state.nowMs };
    } else if (r < 0.78) {
      // liquidation
      const side = Math.random() > 0.55 ? 'LONG' : 'SHORT';
      const usd = Math.random() < 0.04
        ? Math.floor(Math.random() * 5_000_000 + 500_000)  // whales
        : Math.floor(Math.random() * 80_000 + 1_000);
      evt = { kind: 'liq', sym: c.sym, side, usd, px: c.px, venue, t: state.nowMs };
      state.liqEvents.unshift(evt);
      if (state.liqEvents.length > 60) state.liqEvents.pop();
    } else if (r < 0.92) {
      // funding flip
      evt = { kind: 'funding', sym: c.sym, fund: c.fund, venue, t: state.nowMs };
    } else {
      // alert fired
      evt = { kind: 'alert', sym: c.sym, msg: 'Funding spike', t: state.nowMs };
    }
    state.events.unshift(evt);
    if (state.events.length > 80) state.events.pop();
    emit('event', evt);
  }

  function start() {
    if (tickTimer) return;
    tickTimer = setInterval(tick, 1200 / state.speed);
    evtTimer = setInterval(pushEvent, 380 / state.speed);
  }
  function stop() {
    clearInterval(tickTimer); clearInterval(evtTimer);
    tickTimer = evtTimer = null;
  }
  function setSpeed(s) {
    state.speed = clamp(s, 0.1, 5);
    if (tickTimer) { stop(); start(); }
    emit('speed', state.speed);
  }

  // ── selectors ─────────────────────────────────────────────────────
  function getCoin(sym) { return state.coins.find(c => c.sym === sym); }
  function getCoins(filter) {
    if (!filter || filter === 'all') return state.coins;
    if (filter === 'watchlist') return state.coins.filter(c => state.watchlist.has(c.sym));
    return state.coins.filter(c => c.cat === filter);
  }
  function toggleWatch(sym) {
    if (state.watchlist.has(sym)) state.watchlist.delete(sym);
    else state.watchlist.add(sym);
    emit('watchlist', state.watchlist);
  }
  function isWatched(sym) { return state.watchlist.has(sym); }

  function addAlert(a) {
    const id = Math.max(0, ...state.alerts.map(x => x.id)) + 1;
    state.alerts.unshift({ id, state: 'armed', when: 'now', fired: false, ...a });
    emit('alerts', state.alerts);
  }
  function rmAlert(id) {
    state.alerts = state.alerts.filter(a => a.id !== id);
    emit('alerts', state.alerts);
  }

  // ── React hooks ───────────────────────────────────────────────────
  function useCoins(filter) {
    const [, setT] = React.useState(0);
    React.useEffect(() => on('tick', () => setT(t => t + 1)), []);
    return getCoins(filter);
  }
  function useCoin(sym) {
    const [, setT] = React.useState(0);
    React.useEffect(() => on('tick', () => setT(t => t + 1)), []);
    return getCoin(sym);
  }
  function useEvents() {
    const [, setT] = React.useState(0);
    React.useEffect(() => on('event', () => setT(t => t + 1)), []);
    return state.events;
  }
  function useLiqEvents() {
    const [, setT] = React.useState(0);
    React.useEffect(() => on('event', () => setT(t => t + 1)), []);
    return state.liqEvents;
  }
  function useWatchlist() {
    const [, setT] = React.useState(0);
    React.useEffect(() => on('watchlist', () => setT(t => t + 1)), []);
    return state.watchlist;
  }
  function useAlerts() {
    const [, setT] = React.useState(0);
    React.useEffect(() => on('alerts', () => setT(t => t + 1)), []);
    return state.alerts;
  }
  function useStreamMeta() {
    const [, setT] = React.useState(0);
    React.useEffect(() => on('tick', () => setT(t => t + 1)), []);
    return { msgPerSec: state.msgPerSec, apiMs: state.apiMs, wsMs: state.wsMs };
  }

  // ── start engine on first import ──────────────────────────────────
  start();

  // ── expose ────────────────────────────────────────────────────────
  window.IH = {
    SEED, VENUES, state,
    on, emit,
    start, stop, setSpeed,
    getCoin, getCoins, toggleWatch, isWatched,
    addAlert, rmAlert,
    useCoins, useCoin, useEvents, useLiqEvents, useWatchlist, useAlerts, useStreamMeta,
    fmtUSD, fmtPx,
  };
})();
