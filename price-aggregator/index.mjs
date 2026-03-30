import http from 'http';
import WebSocket from 'ws';
import { gunzipSync } from 'zlib';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// ─── Config ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3100;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ─── Price Store ────────────────────────────────────────────────────────────
// { symbol: { exchange: { price, bid, ask, ts } } }
const prices = {};
const health = {}; // { exchange: { connected, lastUpdate, errors } }

function updatePrice(exchange, symbol, price, bid, ask) {
  if (!prices[symbol]) prices[symbol] = {};
  prices[symbol][exchange] = { price, bid, ask, ts: Date.now() };
  if (!health[exchange]) health[exchange] = { connected: true, lastUpdate: 0, errors: 0 };
  health[exchange].connected = true;
  health[exchange].lastUpdate = Date.now();
  // Feed into kline builder
  klineUpdate(exchange, symbol, price);
}

// ─── Kline Builder ─────────────────────────────────────────────────────────
// Builds 1h candles from live price ticks, keeps up to 31 days (744 candles)
// { "exchange:symbol" -> [ { t, o, h, l, c }, ... ] }
const klines = {};
const MAX_KLINE_CANDLES = 744; // 31 days of 1h candles

function klineBucket(ts) {
  // Floor to current hour
  return Math.floor(ts / 3600000) * 3600000;
}

function klineUpdate(exchange, symbol, price) {
  const key = `${exchange}:${symbol}`;
  if (!klines[key]) klines[key] = [];
  const arr = klines[key];
  const bucket = klineBucket(Date.now());

  if (arr.length > 0 && arr[arr.length - 1].t === bucket) {
    // Update current candle
    const c = arr[arr.length - 1];
    if (price > c.h) c.h = price;
    if (price < c.l) c.l = price;
    c.c = price;
  } else {
    // New candle
    arr.push({ t: bucket, o: price, h: price, l: price, c: price });
    if (arr.length > MAX_KLINE_CANDLES) arr.shift();
  }
}

// ─── Kline Persistence ─────────────────────────────────────────────────────
const KLINE_FILE = path.join(process.cwd(), 'klines.json');

function saveKlines() {
  try {
    // Only save symbols from ALL_SYMS to avoid bloating the file
    const important = new Set(ALL_SYMS.map(s => s.toUpperCase()));
    const filtered = {};
    for (const [key, candles] of Object.entries(klines)) {
      const sym = key.split(':')[1];
      if (important.has(sym) && candles.length > 0) {
        filtered[key] = candles;
      }
    }
    fs.writeFileSync(KLINE_FILE, JSON.stringify(filtered));
  } catch (e) { console.error('[Klines] save error:', e.message); }
}

function loadKlines() {
  try {
    if (!fs.existsSync(KLINE_FILE)) return;
    const data = JSON.parse(fs.readFileSync(KLINE_FILE, 'utf8'));
    let loaded = 0;
    for (const [key, candles] of Object.entries(data)) {
      if (Array.isArray(candles) && candles.length > 0) {
        klines[key] = candles;
        loaded++;
      }
    }
    console.log(`[Klines] loaded ${loaded} series from disk`);
  } catch (e) { console.error('[Klines] load error:', e.message); }
}

// ─── Memory Pruning ────────────────────────────────────────────────────────
// Remove price entries older than 5 minutes for symbols NOT in ALL_SYMS
const IMPORTANT_SYMS = new Set();
function pruneMemory() {
  const now = Date.now();
  const staleMs = 300_000; // 5 min
  let pruned = 0;
  for (const [sym, exPrices] of Object.entries(prices)) {
    if (IMPORTANT_SYMS.has(sym)) continue;
    // Check if all entries for this symbol are stale
    const allStale = Object.values(exPrices).every(p => now - p.ts > staleMs);
    if (allStale && !IMPORTANT_SYMS.has(sym)) {
      delete prices[sym];
      pruned++;
    }
  }
  // Prune kline entries for non-important symbols with no recent updates
  for (const key of Object.keys(klines)) {
    const sym = key.split(':')[1];
    if (!IMPORTANT_SYMS.has(sym) && !prices[sym]) {
      delete klines[key];
    }
  }
  if (pruned > 0) console.log(`[Prune] removed ${pruned} stale symbols, tracking ${Object.keys(prices).length}`);
}

function aggregateCandles(hourly, factor) {
  if (hourly.length === 0) return [];
  const ms = factor * 3600000;
  const result = [];
  let cur = null;
  for (const c of hourly) {
    const bucket = Math.floor(c.t / ms) * ms;
    if (!cur || cur.t !== bucket) {
      if (cur) result.push(cur);
      cur = { t: bucket, o: c.o, h: c.h, l: c.l, c: c.c };
    } else {
      if (c.h > cur.h) cur.h = c.h;
      if (c.l < cur.l) cur.l = c.l;
      cur.c = c.c;
    }
  }
  if (cur) result.push(cur);
  return result;
}

// ─── WebSocket Connections ──────────────────────────────────────────────────

function connectWithRetry(name, createFn, retryMs = 5000) {
  let ws = null;
  let retryTimer = null;
  const connect = () => {
    try {
      ws = createFn();
      if (!health[name]) health[name] = { connected: false, lastUpdate: 0, errors: 0 };
      ws.on('open', () => { health[name].connected = true; console.log(`[WS] ${name} connected`); });
      ws.on('close', () => { health[name].connected = false; console.log(`[WS] ${name} disconnected, retry in ${retryMs}ms`); retryTimer = setTimeout(connect, retryMs); });
      ws.on('error', (err) => { health[name].errors++; console.error(`[WS] ${name} error:`, err.message); });
    } catch (err) { console.error(`[WS] ${name} create failed:`, err.message); retryTimer = setTimeout(connect, retryMs); }
  };
  connect();
  return () => { if (retryTimer) clearTimeout(retryTimer); if (ws) try { ws.close(); } catch {} };
}

// ─── All crypto symbols to subscribe (covers SYMBOLS from symbols.ts) ──────
const ALL_SYMS = [
  'BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','LINK','TON','LTC','BCH','ETC','TRX',
  'ARB','OP','MATIC','STRK','ZK','IMX','MANTA','STX','SEI','METIS','BLAST',
  'TAO','FET','RENDER','RNDR','ARKM','WLD','OCEAN','AGIX','AKT','NEAR','AR',
  'SUI','APT','DOT','FIL','ATOM','INJ','HBAR','TIA','ALGO','VET','FTM','KAS','JASMY','IOTA','EOS','XLM','THETA','EGLD','GRT','SAND',
  'AAVE','UNI','MKR','CRV','DYDX','SNX','COMP','LDO','EIGEN','ENA','ONDO','JUP','PYTH','PENDLE','CAKE','SUSHI','1INCH','GMX','RSR',
  'PEPE','WIF','BONK','FLOKI','SHIB','POPCAT','BRETT','MOG','MEW','TRUMP','PENGU','TURBO','NEIRO','DEGEN','BOME','MYRO','MOODENG',
  'MANA','AXS','GALA','BLUR','ENS','W','ZRO','PIXEL','PORTAL','PRIME','RONIN','BEAM',
];

// ── Binance Futures (bulk stream — ALL USDT-M tickers) ──
function createBinance() {
  const ws = new WebSocket('wss://fstream.binance.com/ws/!miniTicker@arr');
  ws.on('message', (data) => {
    try {
      const tickers = JSON.parse(data);
      for (const t of tickers) {
        if (!t.s?.endsWith('USDT')) continue;
        const sym = t.s.replace('USDT', '');
        const price = +t.c;
        if (price > 0) updatePrice('Binance', sym, price, price, price);
      }
    } catch {}
  });
  return ws;
}

// ── Bybit (bulk stream — ALL linear tickers) ──
function createBybit() {
  const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
  ws.on('open', () => {
    // Subscribe in batches of 10 (Bybit limit per message)
    const args = ALL_SYMS.map(s => `tickers.${s}USDT`);
    for (let i = 0; i < args.length; i += 10) {
      ws.send(JSON.stringify({ op: 'subscribe', args: args.slice(i, i + 10) }));
    }
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.topic?.startsWith('tickers.') && d.data) {
        const t = d.data;
        const sym = t.symbol?.replace('USDT', '') || d.topic.replace('tickers.', '').replace('USDT', '');
        const last = +(t.lastPrice || 0);
        const bid = +(t.bid1Price || last);
        const ask = +(t.ask1Price || last);
        if (last > 0) updatePrice('Bybit', sym, last, bid, ask);
      }
    } catch {}
  });
  const ping = setInterval(() => { try { ws.send(JSON.stringify({ op: 'ping' })); } catch {} }, 20000);
  ws.on('close', () => clearInterval(ping));
  return ws;
}

// ── OKX (all symbols) ──
function createOKX() {
  const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
  ws.on('open', () => {
    // OKX allows large subscription batches
    const args = ALL_SYMS.map(s => ({ channel: 'tickers', instId: `${s}-USDT-SWAP` }));
    for (let i = 0; i < args.length; i += 30) {
      ws.send(JSON.stringify({ op: 'subscribe', args: args.slice(i, i + 30) }));
    }
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.data?.[0]) {
        const t = d.data[0];
        const sym = t.instId?.split('-')[0] || '';
        const last = +(t.last || 0);
        const bid = +(t.bidPx || last);
        const ask = +(t.askPx || last);
        if (last > 0 && sym) updatePrice('OKX', sym, last, bid, ask);
      }
    } catch {}
  });
  return ws;
}

// ── Bitget (all symbols) ──
function createBitget() {
  const ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');
  ws.on('open', () => {
    const args = ALL_SYMS.map(s => ({ instType: 'USDT-FUTURES', channel: 'ticker', instId: `${s}USDT` }));
    for (let i = 0; i < args.length; i += 30) {
      ws.send(JSON.stringify({ op: 'subscribe', args: args.slice(i, i + 30) }));
    }
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.data?.[0]) {
        const t = d.data[0];
        const sym = (t.instId || '').replace('USDT', '');
        const last = +(t.lastPr || t.last || 0);
        const bid = +(t.bidPr || last);
        const ask = +(t.askPr || last);
        if (last > 0 && sym) updatePrice('Bitget', sym, last, bid, ask);
      }
    } catch {}
  });
  const ping = setInterval(() => { try { ws.send('ping'); } catch {} }, 25000);
  ws.on('close', () => clearInterval(ping));
  return ws;
}

// ── MEXC (all symbols) ──
function createMEXC() {
  const ws = new WebSocket('wss://contract.mexc.com/edge');
  ws.on('open', () => {
    // MEXC requires individual subscribe messages
    for (const s of ALL_SYMS) {
      ws.send(JSON.stringify({ method: 'sub.ticker', param: { symbol: `${s}_USDT` } }));
    }
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.channel === 'push.ticker' && d.data && d.symbol) {
        const sym = d.symbol.replace('_USDT', '');
        const t = d.data;
        const last = +(t.lastPrice || t.fairPrice || 0);
        const bid = +(t.bid1 || last);
        const ask = +(t.ask1 || last);
        if (last > 0) updatePrice('MEXC', sym, last, bid, ask);
      }
    } catch {}
  });
  const ping = setInterval(() => { try { ws.send(JSON.stringify({ method: 'ping' })); } catch {} }, 20000);
  ws.on('close', () => clearInterval(ping));
  return ws;
}

// ── Hyperliquid (bulk stream — ALL mids) ──
function createHyperliquid() {
  const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
  ws.on('open', () => { ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } })); });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.channel === 'allMids' && d.data?.mids) {
        for (const [sym, mid] of Object.entries(d.data.mids)) {
          const price = +mid;
          if (price > 0) updatePrice('Hyperliquid', sym, price, price, price);
        }
      }
    } catch {}
  });
  return ws;
}

// ── Kraken Futures (all available products) ──
function createKraken() {
  const ws = new WebSocket('wss://futures.kraken.com/ws/v1');
  const products = [
    'PI_XBTUSD','PI_ETHUSD','PI_SOLUSD','PI_XRPUSD','PI_ADAUSD','PI_DOTUSD',
    'PI_LINKUSD','PI_AVAXUSD','PI_DOGEUSD','PI_LTCUSD','PI_BCHUSD','PI_ATOMUSD',
    'PI_UNIUSD','PI_FILUSD','PI_MATICUSD','PI_NEARUSD','PI_OPUSD','PI_ARBUSD',
    'PI_AAVEUSD','PI_PEPEUSD','PI_SHIBUSD','PI_SUIUSD','PI_APTUSD','PI_INJUSD',
    'PI_TRXUSD','PI_TONUSD','PI_SEIUSD','PI_TIAUSD','PI_FTMUSD',
  ];
  ws.on('open', () => {
    ws.send(JSON.stringify({ event: 'subscribe', feed: 'ticker', product_ids: products }));
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.feed === 'ticker' && d.product_id) {
        let sym = d.product_id.replace('PI_', '').replace('USD', '');
        if (sym === 'XBT') sym = 'BTC';
        const last = +(d.last || d.markPrice || 0);
        const bid = +(d.bid || last);
        const ask = +(d.ask || last);
        if (last > 0) updatePrice('Kraken', sym, last, bid, ask);
      }
    } catch {}
  });
  return ws;
}

// ── Coinbase (expanded symbols) ──
function createCoinbase() {
  const ws = new WebSocket('wss://advanced-trade-ws.coinbase.com');
  const symbols = [
    'BTC-USD','ETH-USD','SOL-USD','XRP-USD','DOGE-USD','ADA-USD','AVAX-USD',
    'LINK-USD','DOT-USD','LTC-USD','UNI-USD','AAVE-USD','NEAR-USD','SUI-USD',
    'APT-USD','ARB-USD','OP-USD','FIL-USD','ATOM-USD','SHIB-USD','PEPE-USD',
    'BONK-USD','MATIC-USD','INJ-USD','SEI-USD','TIA-USD','FET-USD','GRT-USD',
    'RENDER-USD','HBAR-USD','EOS-USD','XLM-USD','ALGO-USD','VET-USD','SAND-USD',
    'MANA-USD','AXS-USD','COMP-USD','SNX-USD','MKR-USD','CRV-USD','LDO-USD',
    'ENS-USD','BLUR-USD','IMX-USD','JASMY-USD','ETC-USD','BCH-USD','FTM-USD',
  ];
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'subscribe', product_ids: symbols, channels: ['ticker'] }));
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.type === 'ticker' && d.product_id) {
        const sym = d.product_id.split('-')[0];
        const last = +(d.price || 0);
        const bid = +(d.best_bid || last);
        const ask = +(d.best_ask || last);
        if (last > 0) updatePrice('Coinbase', sym, last, bid, ask);
      }
    } catch {}
  });
  return ws;
}

// ── BingX (WebSocket — all symbols) ──
function createBingX() {
  const ws = new WebSocket('wss://open-api-swap.bingx.com/swap-market');
  ws.on('open', () => {
    for (const s of ALL_SYMS.slice(0, 50)) { // top 50 symbols
      ws.send(JSON.stringify({ id: s, reqType: 'sub', dataType: `${s}-USDT@ticker` }));
    }
  });
  ws.on('message', (raw) => {
    try {
      // BingX sends gzipped data
      let text;
      if (raw instanceof Buffer) {
        try {
          // gunzipSync imported at top level
          text = gunzipSync(raw).toString();
        } catch { text = raw.toString(); }
      } else { text = raw.toString(); }
      if (text === 'Ping') { ws.send('Pong'); return; }
      const d = JSON.parse(text);
      if (d.data && d.dataType?.includes('@ticker')) {
        const sym = d.dataType.split('-USDT')[0];
        const last = +(d.data.c || d.data.lastPrice || 0);
        const bid = +(d.data.bestBidPrice || last);
        const ask = +(d.data.bestAskPrice || last);
        if (last > 0 && sym) updatePrice('BingX', sym, last, bid, ask);
      }
    } catch {}
  });
  const ping = setInterval(() => { try { ws.send('Ping'); } catch {} }, 15000);
  ws.on('close', () => clearInterval(ping));
  return ws;
}

// ── HTX / Huobi Futures (WebSocket — all symbols) ──
function createHTX() {
  const ws = new WebSocket('wss://api.hbdm.com/linear-swap-ws');
  ws.on('open', () => {
    for (const s of ALL_SYMS.slice(0, 50)) {
      ws.send(JSON.stringify({ sub: `market.${s}-USDT.trade.detail`, id: s }));
    }
  });
  ws.on('message', (raw) => {
    try {
      // HTX sends gzipped data
      // gunzipSync imported at top level
      const text = gunzipSync(raw).toString();
      const d = JSON.parse(text);
      if (d.ping) { ws.send(JSON.stringify({ pong: d.ping })); return; }
      if (d.ch && d.tick?.data?.[0]) {
        const sym = d.ch.split('.')[1].replace('-USDT', '');
        const last = +(d.tick.data[0].price || 0);
        if (last > 0) updatePrice('HTX', sym, last, last, last);
      }
    } catch {}
  });
  return ws;
}

// ── Phemex (WebSocket — all symbols) ──
function createPhemex() {
  const ws = new WebSocket('wss://ws.phemex.com');
  ws.on('open', () => {
    const syms = ALL_SYMS.slice(0, 40).map(s => `${s}USDT`);
    ws.send(JSON.stringify({ id: 1, method: 'tick.subscribe', params: syms }));
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.tick?.symbol) {
        const sym = d.tick.symbol.replace('USDT', '');
        const last = +(d.tick.close || 0) / 1e4;
        const bid = +(d.tick.bid || 0) / 1e4;
        const ask = +(d.tick.ask || 0) / 1e4;
        if (last > 0) updatePrice('Phemex', sym, last, bid || last, ask || last);
      }
    } catch {}
  });
  const ping = setInterval(() => { try { ws.send(JSON.stringify({ id: 0, method: 'server.ping', params: [] })); } catch {} }, 10000);
  ws.on('close', () => clearInterval(ping));
  return ws;
}

// ── Bitfinex (WebSocket — all symbols) ──
function createBitfinex() {
  const ws = new WebSocket('wss://api-pub.bitfinex.com/ws/2');
  const chanMap = {}; // chanId -> symbol
  ws.on('open', () => {
    const bfxSyms = ALL_SYMS.slice(0, 40).map(s => `t${s}USD`);
    for (const sym of bfxSyms) {
      ws.send(JSON.stringify({ event: 'subscribe', channel: 'ticker', symbol: sym }));
    }
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.event === 'subscribed' && d.chanId && d.symbol) {
        chanMap[d.chanId] = d.symbol.replace(/^t/, '').replace(/USD$/, '').replace(/F0$/, '');
        return;
      }
      if (Array.isArray(d) && d.length === 2 && Array.isArray(d[1]) && d[1].length >= 10) {
        const sym = chanMap[d[0]];
        if (!sym) return;
        const [bid, , ask, , , , last] = d[1];
        if (+last > 0) updatePrice('Bitfinex', sym, +last, +bid || +last, +ask || +last);
      }
    } catch {}
  });
  return ws;
}

// ── dYdX v4 (WebSocket) ──
function createDYDX() {
  const ws = new WebSocket('wss://indexer.dydx.trade/v4/ws');
  ws.on('open', () => {
    for (const s of ALL_SYMS.slice(0, 50)) {
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'v4_markets', id: `${s}-USD` }));
    }
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.type === 'channel_data' && d.contents?.markets) {
        for (const [ticker, m] of Object.entries(d.contents.markets)) {
          const sym = ticker.replace('-USD', '');
          const price = +(m.oraclePrice || 0);
          if (price > 0) updatePrice('dYdX', sym, price, price, price);
        }
      }
      if (d.type === 'subscribed' && d.contents?.markets) {
        for (const [ticker, m] of Object.entries(d.contents.markets)) {
          const sym = ticker.replace('-USD', '');
          const price = +(m.oraclePrice || 0);
          if (price > 0) updatePrice('dYdX', sym, price, price, price);
        }
      }
    } catch {}
  });
  return ws;
}

// ── CoinEx (WebSocket) ──
function createCoinEx() {
  const ws = new WebSocket('wss://perpetual.coinex.com/');
  ws.on('open', () => {
    const params = ALL_SYMS.slice(0, 40).map(s => `${s}USDT`);
    ws.send(JSON.stringify({ method: 'state.subscribe', params, id: 1 }));
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.method === 'state.update' && d.params?.[0]) {
        for (const [pair, info] of Object.entries(d.params[0])) {
          const sym = pair.replace('USDT', '');
          const last = +(info.last || 0);
          if (last > 0) updatePrice('CoinEx', sym, last, last, last);
        }
      }
    } catch {}
  });
  const ping = setInterval(() => { try { ws.send(JSON.stringify({ method: 'server.ping', params: [], id: 0 })); } catch {} }, 15000);
  ws.on('close', () => clearInterval(ping));
  return ws;
}

// ── Deribit (WebSocket — BTC, ETH, SOL perpetuals) ──
function createDeribit() {
  const ws = new WebSocket('wss://www.deribit.com/ws/api/v2');
  ws.on('open', () => {
    ws.send(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'public/subscribe',
      params: { channels: ['ticker.BTC-PERPETUAL.100ms', 'ticker.ETH-PERPETUAL.100ms', 'ticker.SOL_USDC-PERPETUAL.100ms'] }
    }));
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.params?.channel?.startsWith('ticker.') && d.params?.data) {
        const t = d.params.data;
        let sym = t.instrument_name?.split('-')[0] || '';
        if (sym === 'SOL_USDC') sym = 'SOL';
        const last = +(t.last_price || t.mark_price || 0);
        const bid = +(t.best_bid_price || last);
        const ask = +(t.best_ask_price || last);
        if (last > 0 && sym) updatePrice('Deribit', sym, last, bid, ask);
      }
    } catch {}
  });
  const hb = setInterval(() => {
    try { ws.send(JSON.stringify({ jsonrpc: '2.0', id: 9999, method: 'public/test', params: {} })); } catch {}
  }, 15000);
  ws.on('close', () => clearInterval(hb));
  return ws;
}

// ── KuCoin Futures (WebSocket — needs token first) ──
function createKuCoin() {
  // KuCoin requires fetching a WS token via REST before connecting
  let ws;
  const init = async () => {
    try {
      const r = await fetch('https://api-futures.kucoin.com/api/v1/bullet-public', { method: 'POST', signal: AbortSignal.timeout(5000) });
      const j = await r.json();
      const endpoint = j?.data?.instanceServers?.[0]?.endpoint;
      const token = j?.data?.token;
      if (!endpoint || !token) throw new Error('No KuCoin WS token');

      ws = new WebSocket(`${endpoint}?token=${token}`);
      ws.on('open', () => {
        // Subscribe to ticker for top symbols
        for (const s of ALL_SYMS.slice(0, 40)) {
          const pair = s === 'BTC' ? 'XBTUSDTM' : `${s}USDTM`;
          ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/contractMarket/tickerV2:${pair}`, privateChannel: false, response: true }));
        }
      });
      ws.on('message', (data) => {
        try {
          const d = JSON.parse(data);
          if (d.type === 'message' && d.topic?.includes('tickerV2') && d.data) {
            let sym = d.data.symbol?.replace('USDTM', '') || '';
            if (sym === 'XBT') sym = 'BTC';
            const last = +(d.data.price || d.data.bestBidPrice || 0);
            const bid = +(d.data.bestBidPrice || last);
            const ask = +(d.data.bestAskPrice || last);
            if (last > 0 && sym) updatePrice('KuCoin', sym, last, bid, ask);
          }
        } catch {}
      });
      const ping = setInterval(() => { try { ws.send(JSON.stringify({ id: Date.now(), type: 'ping' })); } catch {} }, 20000);
      ws.on('close', () => clearInterval(ping));
    } catch (e) { console.error('[KuCoin WS] init error:', e.message); }
  };
  init();
  // Return a dummy object for connectWithRetry compatibility
  const dummy = new EventEmitter();
  setTimeout(() => dummy.emit('open'), 2000);
  return dummy;
}

// ── WhiteBIT (WebSocket) ──
function createWhiteBIT() {
  const ws = new WebSocket('wss://api.whitebit.com/ws');
  ws.on('open', () => {
    const pairs = ALL_SYMS.slice(0, 40).map(s => `${s}_PERP`);
    ws.send(JSON.stringify({ id: 1, method: 'lastprice_subscribe', params: pairs }));
  });
  ws.on('message', (data) => {
    try {
      const d = JSON.parse(data);
      if (d.method === 'lastprice_update' && d.params) {
        const [pair, price] = d.params;
        if (pair && price) {
          const sym = pair.replace('_PERP', '');
          const p = +price;
          if (p > 0) updatePrice('WhiteBIT', sym, p, p, p);
        }
      }
    } catch {}
  });
  const ping = setInterval(() => { try { ws.send(JSON.stringify({ id: 0, method: 'ping', params: [] })); } catch {} }, 15000);
  ws.on('close', () => clearInterval(ping));
  return ws;
}

// ── REST Polled Exchanges (5s interval) ──
const REST_EXCHANGES = [
  // ── CEX ──
  { name: 'KuCoin', url: 'https://api-futures.kucoin.com/api/v1/contracts/active', parse: (data) => {
    return (data?.data || []).filter(c => c.quoteCurrency === 'USDT').map(c => {
      let sym = c.baseCurrency;
      if (sym === 'XBT') sym = 'BTC'; // KuCoin uses XBT for Bitcoin
      return { sym, price: +(c.markPrice || 0), bid: +(c.markPrice || 0), ask: +(c.markPrice || 0) };
    }).filter(c => c.price > 0);
  }},
  { name: 'HTX', url: 'https://api.hbdm.com/linear-swap-ex/market/detail/batch_merged?contract_type=swap&business_type=all', parse: (data) => {
    return (data?.ticks || []).filter(t => t.contract_code?.endsWith('-USDT')).map(t => ({
      sym: t.contract_code.replace('-USDT', ''), price: +(t.close || 0), bid: +(t.bid?.[0] || t.close || 0), ask: +(t.ask?.[0] || t.close || 0)
    })).filter(c => c.price > 0);
  }},
  { name: 'Bitfinex', url: 'https://api-pub.bitfinex.com/v2/tickers?symbols=ALL', parse: (data) => {
    return (data || []).filter(t => {
      const s = t[0];
      return typeof s === 'string' && s.startsWith('t') && (s.endsWith('USD') || s.endsWith('UST')) && !s.includes(':');
    }).map(t => {
      const sym = t[0].replace(/^t/, '').replace(/F0$/, '').replace(/USD[T]?$/, '');
      return { sym, price: +(t[7] || 0), bid: +(t[1] || 0), ask: +(t[3] || 0) };
    }).filter(c => c.price > 0 && c.sym.length >= 2 && c.sym.length <= 6);
  }},
  { name: 'BingX', url: 'https://open-api.bingx.com/openApi/swap/v2/quote/ticker', parse: (data) => {
    return (data?.data || []).map(t => ({
      sym: (t.symbol || '').replace('-USDT', ''), price: +(t.lastPrice || 0), bid: +(t.bestBidPrice || 0), ask: +(t.bestAskPrice || 0)
    })).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Phemex', url: 'https://api.phemex.com/md/v2/ticker/24hr/all', parse: (data) => {
    return (data?.result || []).filter(t => t.symbol?.endsWith('USDT')).map(t => ({
      sym: t.symbol.replace('USDT', '').replace(/^[cs]/, ''), price: +(t.lastEp || 0) / 1e4, bid: +(t.bidEp || 0) / 1e4, ask: +(t.askEp || 0) / 1e4
    })).filter(c => c.price > 0);
  }},
  { name: 'CoinEx', url: 'https://api.coinex.com/v2/futures/ticker', parse: (data) => {
    return (data?.data || []).filter(t => t.market?.endsWith('USDT')).map(t => ({
      sym: t.market.replace('USDT', ''), price: +(t.last || 0), bid: +(t.best_bid_price || 0), ask: +(t.best_ask_price || 0)
    })).filter(c => c.price > 0);
  }},
  { name: 'Bitunix', url: 'https://fapi.bitunix.com/api/v1/futures/market/tickers', parse: (data) => {
    return (data?.data || []).map(t => ({
      sym: (t.symbol || '').replace('USDT', ''), price: +(t.last || t.lastPrice || 0), bid: +(t.last || 0), ask: +(t.last || 0)
    })).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'WhiteBIT', url: 'https://whitebit.com/api/v4/public/ticker', parse: (data) => {
    const entries = [];
    for (const [pair, t] of Object.entries(data || {})) {
      if (!pair.endsWith('_PERP')) continue;
      const sym = pair.replace('_PERP', '').replace('_USDT', '');
      entries.push({ sym, price: +(t.last_price || 0), bid: +(t.best_bid || 0), ask: +(t.best_ask || 0) });
    }
    return entries.filter(c => c.price > 0);
  }},
  { name: 'Deribit', url: 'https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=future', parse: (data) => {
    return (data?.result || []).filter(t => t.instrument_name?.includes('PERPETUAL')).map(t => ({
      sym: t.base_currency || 'BTC', price: +(t.mark_price || t.last || 0), bid: +(t.bid_price || 0), ask: +(t.ask_price || 0)
    })).filter(c => c.price > 0);
  }},
  // ── DEX ──
  { name: 'dYdX', url: 'https://indexer.dydx.trade/v4/perpetualMarkets', parse: (data) => {
    const markets = data?.markets || {};
    return Object.values(markets).map(m => ({
      sym: (m.ticker || '').replace('-USD', ''), price: +(m.oraclePrice || 0), bid: +(m.oraclePrice || 0), ask: +(m.oraclePrice || 0)
    })).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Aster', url: 'https://fapi.asterdex.com/fapi/v1/ticker/24hr', parse: (data) => {
    return (data || []).filter(t => t.symbol?.endsWith('USDT')).map(t => ({
      sym: t.symbol.replace(/USDT$/, ''), price: +(t.lastPrice || 0), bid: +(t.lastPrice || 0), ask: +(t.lastPrice || 0)
    })).filter(c => c.price > 0);
  }},
  { name: 'Lighter', url: 'https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails', parse: (data) => {
    return (data?.order_book_details || []).filter(b => b.market_type === 'perp' && b.status === 'active' && b.last_trade_price).map(b => ({
      sym: b.symbol || '', price: +(b.last_trade_price || 0), bid: +(b.last_trade_price || 0), ask: +(b.last_trade_price || 0)
    })).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Aevo', url: 'https://api.aevo.xyz/markets', parse: (data) => {
    return (data || []).filter(m => m.instrument_type === 'PERPETUAL' && m.is_active && m.mark_price).map(m => ({
      sym: m.underlying_asset || m.instrument_name?.replace('-PERP', '') || '', price: +(m.mark_price || 0), bid: +(m.mark_price || 0), ask: +(m.mark_price || 0)
    })).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Drift', url: 'https://data.api.drift.trade/stats/markets', parse: (data) => {
    return (data?.markets || []).filter(m => m.marketType === 'perp' && m.oraclePrice).map(m => {
      let sym = (m.symbol || '').replace('-PERP', '');
      if (sym.startsWith('1M')) sym = sym.slice(2);
      return { sym, price: +(m.oraclePrice || 0), bid: +(m.oraclePrice || 0), ask: +(m.oraclePrice || 0) };
    }).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Extended', url: 'https://api.starknet.extended.exchange/api/v1/info/markets', parse: (data) => {
    const arr = data?.data || data || [];
    return (Array.isArray(arr) ? arr : []).filter(m => m.active && m.marketStats?.lastPrice).map(m => {
      let sym = m.assetName || m.name?.split('-')[0] || '';
      if (sym.startsWith('1000')) sym = sym.slice(4);
      return { sym, price: +(m.marketStats.lastPrice || 0), bid: +(m.marketStats.lastPrice || 0), ask: +(m.marketStats.lastPrice || 0) };
    }).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Variational', url: 'https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats', parse: (data) => {
    return (data?.listings || []).filter(m => m.ticker && m.mark_price).map(m => {
      let sym = m.ticker; if (sym?.startsWith('1000')) sym = sym.slice(4);
      return { sym, price: +(m.mark_price || 0), bid: +(m.mark_price || 0), ask: +(m.mark_price || 0) };
    }).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Nado', url: 'https://archive.prod.nado.xyz/v2/tickers?market=perp', parse: (data) => {
    return Object.values(data || {}).map(t => {
      let sym = (t.base_currency || '').replace('-PERP', '');
      if (sym.startsWith('k')) sym = sym.slice(1);
      return { sym, price: +(t.last_price || 0), bid: +(t.best_bid || 0), ask: +(t.best_ask || 0) };
    }).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Backpack', url: 'https://api.backpack.exchange/api/v1/tickers', parse: (data) => {
    return (data || []).filter(t => t.symbol?.endsWith('_USDC')).map(t => ({
      sym: t.symbol.replace('_USDC', '').replace('_PERP', ''), price: +(t.lastPrice || 0), bid: +(t.lastPrice || 0), ask: +(t.lastPrice || 0)
    })).filter(c => c.price > 0);
  }},
  { name: 'Orderly', url: 'https://api-evm.orderly.org/v1/public/futures', parse: (data) => {
    const rows = data?.data?.rows || data?.rows || [];
    return rows.map(m => {
      let sym = (m.symbol || '').replace('PERP_', '').replace('_USDC', '').replace('_USDT', '');
      return { sym, price: +(m.mark_price || m.index_price || 0), bid: +(m.mark_price || 0), ask: +(m.mark_price || 0) };
    }).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Paradex', url: 'https://api.prod.paradex.trade/v1/markets/summary?market=ALL', parse: (data) => {
    return (data?.results || []).filter(m => m.symbol?.endsWith('-USD-PERP')).map(m => ({
      sym: m.symbol.replace('-USD-PERP', ''), price: +(m.mark_price || m.last_traded_price || 0), bid: +(m.mark_price || 0), ask: +(m.mark_price || 0)
    })).filter(c => c.price > 0 && c.sym);
  }},
  // ── REST fallbacks for WS exchanges (WS only covers subscribed pairs) ──
  { name: 'Bybit', url: 'https://api.bybit.com/v5/market/tickers?category=linear', parse: (data) => {
    return (data?.result?.list || []).filter(t => t.symbol?.endsWith('USDT')).map(t => ({
      sym: t.symbol.replace('USDT', ''), price: +(t.lastPrice || 0), bid: +(t.bid1Price || 0), ask: +(t.ask1Price || 0)
    })).filter(c => c.price > 0);
  }},
  { name: 'OKX', url: 'https://www.okx.com/api/v5/market/tickers?instType=SWAP', parse: (data) => {
    return (data?.data || []).filter(t => t.instId?.endsWith('-USDT-SWAP')).map(t => ({
      sym: t.instId.split('-')[0], price: +(t.last || 0), bid: +(t.bidPx || 0), ask: +(t.askPx || 0)
    })).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Bitget', url: 'https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES', parse: (data) => {
    return (data?.data || []).filter(t => t.symbol?.endsWith('USDT')).map(t => ({
      sym: t.symbol.replace('USDT', ''), price: +(t.lastPr || t.last || 0), bid: +(t.bidPr || 0), ask: +(t.askPr || 0)
    })).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'MEXC', url: 'https://contract.mexc.com/api/v1/contract/ticker', parse: (data) => {
    return (data?.data || []).filter(t => t.symbol?.endsWith('_USDT')).map(t => ({
      sym: t.symbol.replace('_USDT', ''), price: +(t.lastPrice || t.fairPrice || 0), bid: +(t.bid1 || 0), ask: +(t.ask1 || 0)
    })).filter(c => c.price > 0 && c.sym);
  }},
  { name: 'Kraken', url: 'https://futures.kraken.com/derivatives/api/v3/tickers', parse: (data) => {
    return (data?.tickers || []).filter(t => t.pair?.startsWith('PF_') && t.pair?.endsWith('USD')).map(t => {
      let sym = t.pair.replace('PF_', '').replace('USD', '');
      if (sym === 'XBT') sym = 'BTC';
      return { sym, price: +(t.last || t.markPrice || 0), bid: +(t.bid || 0), ask: +(t.ask || 0) };
    }).filter(c => c.price > 0 && c.sym);
  }},
  // Coinbase handled separately via pollCoinbase() with per-coin tickers
  // ── edgeX (simplified — just meta for now) ──
  { name: 'edgeX', url: 'https://pro.edgex.exchange/api/v1/public/meta/getMetaData', parse: (data) => {
    return (data?.data?.contractList || []).filter(c => c.enableTrade && c.lastPrice).map(c => {
      const sym = (c.contractName || '').replace(/USD.*/, '').toUpperCase();
      return { sym, price: +(c.lastPrice || 0), bid: +(c.lastPrice || 0), ask: +(c.lastPrice || 0) };
    }).filter(c => c.price > 0 && c.sym);
  }},
];

async function pollREST() {
  const promises = REST_EXCHANGES.map(async (ex) => {
    try {
      const r = await fetch(ex.url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return;
      const data = await r.json();
      const entries = ex.parse(data);
      for (const e of entries) {
        if (e.price > 0) updatePrice(ex.name, e.sym, e.price, e.bid || e.price, e.ask || e.price);
      }
    } catch (err) {
      if (!health[ex.name]) health[ex.name] = { connected: false, lastUpdate: 0, errors: 0 };
      health[ex.name].errors++;
    }
  });
  await Promise.allSettled(promises); // parallel fetch all REST exchanges
}

// ── gTrade (uses funding rates API which includes markPrice) ──
async function pollGTrade() {
  try {
    // Use InfoHub's own funding API which already has gTrade markPrices
    const r = await fetch('https://info-hub.io/api/funding', { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const data = await r.json();
    const entries = (data?.data || data || []).filter(f => f.exchange === 'gTrade' && f.markPrice > 0);
    for (const f of entries) {
      updatePrice('gTrade', f.symbol, f.markPrice, f.markPrice, f.markPrice);
    }
  } catch (e) { console.error('[gTrade] error:', e.message); }
}

// ── GMX V2 (uses funding rates API which includes markPrice) ──
async function pollGMX() {
  try {
    const r = await fetch('https://info-hub.io/api/funding', { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const data = await r.json();
    const entries = (data?.data || data || []).filter(f => f.exchange === 'GMX' && f.markPrice > 0);
    for (const f of entries) {
      updatePrice('GMX', f.symbol, f.markPrice, f.markPrice, f.markPrice);
    }
  } catch (e) { console.error('[GMX] error:', e.message); }
}

// ── edgeX + Variational (uses InfoHub tickers API) ──
async function pollFromInfoHub() {
  try {
    const r = await fetch('https://info-hub.io/api/tickers', { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const data = await r.json();
    const target = ['edgeX', 'Variational', 'BitMEX', 'Gate.io'];
    for (const t of (data?.data || data || [])) {
      if (target.includes(t.exchange) && t.lastPrice > 0) {
        updatePrice(t.exchange, t.symbol, t.lastPrice, t.lastPrice, t.lastPrice);
      }
    }
  } catch (e) { console.error('[InfoHub] error:', e.message); }
}

// ── Coinbase (individual tickers for top coins) ──
const CB_COINS = ['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','LINK','DOT','LTC','NEAR','UNI','AAVE','SUI','APT'];
async function pollCoinbase() {
  const promises = CB_COINS.map(async (sym) => {
    try {
      const r = await fetch(`https://api.exchange.coinbase.com/products/${sym}-USD/ticker`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return;
      const t = await r.json();
      const price = +(t.price || 0);
      const bid = +(t.bid || price);
      const ask = +(t.ask || price);
      if (price > 0) updatePrice('Coinbase', sym, price, bid, ask);
    } catch {}
  });
  await Promise.allSettled(promises);
}

// ─── HTTP Server ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/prices') {
    // Optional ?symbol=BTC filter
    const sym = url.searchParams.get('symbol')?.toUpperCase();
    const data = sym ? { [sym]: prices[sym] || {} } : prices;
    res.end(JSON.stringify({ data, ts: Date.now() }));
  } else if (url.pathname === '/spreads') {
    // Pre-computed spreads for all symbols
    const spreads = {};
    for (const [sym, exPrices] of Object.entries(prices)) {
      const entries = Object.entries(exPrices)
        .filter(([, p]) => p.price > 0 && Date.now() - p.ts < 30000) // exclude stale >30s
        .sort((a, b) => b[1].price - a[1].price);
      if (entries.length < 2) continue;
      const high = entries[0];
      const low = entries[entries.length - 1];
      const spread = high[1].price - low[1].price;
      spreads[sym] = { spread, pct: (spread / low[1].price) * 100, high: high[0], low: low[0], highPrice: high[1].price, lowPrice: low[1].price, exchanges: entries.length };
    }
    res.end(JSON.stringify({ data: spreads, ts: Date.now() }));
  } else if (url.pathname === '/klines') {
    // /klines?exchange=Drift&symbol=BTC&interval=1h&limit=24
    const ex = url.searchParams.get('exchange');
    const sym = url.searchParams.get('symbol')?.toUpperCase();
    const interval = url.searchParams.get('interval') || '1h';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 168, MAX_KLINE_CANDLES);

    if (!ex || !sym) {
      res.end(JSON.stringify({ error: 'Required: ?exchange=...&symbol=...' }));
      return;
    }

    const raw = klines[`${ex}:${sym}`] || [];

    // Aggregate 1h candles into larger intervals if needed
    let candles;
    if (interval === '4h') {
      candles = aggregateCandles(raw, 4);
    } else if (interval === '1d') {
      candles = aggregateCandles(raw, 24);
    } else {
      candles = raw;
    }

    // Return last N candles
    const result = candles.slice(-limit);
    res.end(JSON.stringify({ exchange: ex, symbol: sym, interval, candles: result }));
  } else if (url.pathname === '/health') {
    res.end(JSON.stringify({ health, symbolCount: Object.keys(prices).length, uptime: process.uptime() }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found. Endpoints: /prices, /spreads, /health' }));
  }
});

// ─── Start Everything ───────────────────────────────────────────────────────
console.log('Starting InfoHub Price Aggregator...');

// Populate important symbols set for memory pruning
for (const s of ALL_SYMS) IMPORTANT_SYMS.add(s.toUpperCase());

// Load persisted klines from disk
loadKlines();

// WebSocket connections with auto-reconnect (instant updates)
connectWithRetry('Binance', createBinance);       // bulk stream, all USDT-M
connectWithRetry('Bybit', createBybit);           // all symbols
connectWithRetry('OKX', createOKX);               // all symbols
connectWithRetry('Bitget', createBitget);         // all symbols
connectWithRetry('MEXC', createMEXC);             // all symbols
connectWithRetry('Hyperliquid', createHyperliquid); // bulk allMids
connectWithRetry('Kraken', createKraken);         // expanded products
connectWithRetry('Coinbase', createCoinbase);     // expanded symbols
connectWithRetry('BingX', createBingX);           // top 50 symbols
connectWithRetry('HTX', createHTX);               // top 50 symbols
connectWithRetry('Phemex', createPhemex);         // top 40 symbols
connectWithRetry('Bitfinex', createBitfinex);     // top 40 symbols
connectWithRetry('dYdX', createDYDX);             // all markets
connectWithRetry('CoinEx', createCoinEx);         // top 40 symbols
connectWithRetry('Deribit', createDeribit);       // BTC, ETH, SOL perps
connectWithRetry('KuCoin', createKuCoin);         // top 40 symbols
connectWithRetry('WhiteBIT', createWhiteBIT);     // top 40 symbols

// REST polling (fallback for symbols not covered by WS, and REST-only exchanges)
setInterval(pollREST, 2000);        // All REST exchanges every 2s
setInterval(pollGTrade, 8000);      // gTrade via InfoHub funding every 8s
setInterval(pollGMX, 8000);         // GMX via InfoHub funding every 8s
setInterval(pollFromInfoHub, 5000); // edgeX, Variational, BitMEX, Gate.io via InfoHub tickers every 5s

// Kline persistence every 5 minutes
setInterval(saveKlines, 300_000);
// Memory pruning every 2 minutes
setInterval(pruneMemory, 120_000);

pollREST();
pollGTrade();
pollGMX();
pollFromInfoHub();

server.listen(PORT, () => {
  console.log(`Price aggregator running on port ${PORT}`);
  console.log(`Endpoints: /prices, /spreads, /health`);
});
