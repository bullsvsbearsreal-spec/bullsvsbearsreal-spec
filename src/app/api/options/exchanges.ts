/**
 * Multi-exchange options data fetchers.
 * Each fetcher returns normalized option instruments for a given currency (BTC/ETH).
 */

type FetchFn = (url: string, init?: RequestInit, timeout?: number) => Promise<Response>;

export interface OptionInstrument {
  exchange: string;
  instrumentName: string;
  optionType: 'call' | 'put';
  strike: number;
  expiryTimestamp: number;
  openInterestUsd: number;
  markIV: number;
  underlyingPrice: number;
}

export interface OptionsExchangeFetcher {
  name: string;
  fetcher: (fetchFn: FetchFn, currency: string) => Promise<OptionInstrument[]>;
}

export const optionsFetchers: OptionsExchangeFetcher[] = [
  // ─── Deribit ────────────────────────────────────────────────────────────────
  {
    name: 'Deribit',
    fetcher: async (fetchFn, currency) => {
      const res = await fetchFn(
        `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`,
        {},
        10000,
      );
      if (!res.ok) return [];
      const json = await res.json();
      const instruments: any[] = json.result || [];
      if (instruments.length === 0) return [];

      const underlyingPrice = instruments[0]?.underlying_price || 0;

      return instruments.map((inst: any) => {
        const parts = inst.instrument_name.split('-');
        const strike = parseFloat(parts[2]) || 0;
        const optionType = parts[3] === 'C' ? 'call' as const : 'put' as const;

        // Parse expiry from name: "28FEB25" → approximate timestamp
        let expiryTimestamp = 0;
        if (parts[1]) {
          const d = parseExpiryStr(parts[1]);
          if (d) expiryTimestamp = d.getTime();
        }

        return {
          exchange: 'Deribit',
          instrumentName: inst.instrument_name,
          optionType,
          strike,
          expiryTimestamp,
          openInterestUsd: (inst.open_interest || 0) * underlyingPrice,
          markIV: inst.mark_iv || 0,
          underlyingPrice,
        };
      });
    },
  },

  // ─── Binance ────────────────────────────────────────────────────────────────
  {
    name: 'Binance',
    fetcher: async (fetchFn, currency) => {
      // Step 1: Get underlying (index) price
      const indexRes = await fetchFn(
        `https://eapi.binance.com/eapi/v1/index?underlying=${currency}USDT`,
        {},
        8000,
      );
      let underlyingPrice = 0;
      if (indexRes.ok) {
        const indexJson = await indexRes.json();
        underlyingPrice = parseFloat(indexJson.indexPrice) || 0;
      }

      // Step 2: Get all option tickers
      const res = await fetchFn(
        'https://eapi.binance.com/eapi/v1/ticker',
        {},
        10000,
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data
        .filter((t: any) => {
          const sym = t.symbol || '';
          return sym.startsWith(`${currency}-`) && (sym.endsWith('-C') || sym.endsWith('-P'));
        })
        .map((t: any) => {
          // Symbol format: BTC-250228-95000-C
          const parts = t.symbol.split('-');
          const strike = parseFloat(parts[2]) || 0;
          const optionType = parts[3] === 'C' ? 'call' as const : 'put' as const;

          let expiryTimestamp = 0;
          if (parts[1]) {
            // Binance format: 250228 → 2025-02-28
            const yr = 2000 + parseInt(parts[1].slice(0, 2));
            const mo = parseInt(parts[1].slice(2, 4)) - 1;
            const da = parseInt(parts[1].slice(4, 6));
            expiryTimestamp = new Date(yr, mo, da, 8, 0, 0).getTime(); // 08:00 UTC expiry
          }

          const price = underlyingPrice || parseFloat(t.strikePrice) || 0;
          const oiContracts = parseFloat(t.openInterest) || 0;

          return {
            exchange: 'Binance',
            instrumentName: t.symbol,
            optionType,
            strike,
            expiryTimestamp,
            openInterestUsd: oiContracts * price,
            markIV: parseFloat(t.markIV) || 0,
            underlyingPrice: price,
          };
        });
    },
  },

  // ─── OKX ────────────────────────────────────────────────────────────────────
  {
    name: 'OKX',
    fetcher: async (fetchFn, currency) => {
      const instFamily = `${currency}-USD`;

      // Step 1: Get OI data for all options
      const oiRes = await fetchFn(
        `https://www.okx.com/api/v5/public/open-interest?instType=OPTION&instFamily=${instFamily}`,
        {},
        10000,
      );

      // Step 2: Get ticker data for prices + IV
      const tickerRes = await fetchFn(
        `https://www.okx.com/api/v5/market/tickers?instType=OPTION&instFamily=${instFamily}`,
        {},
        10000,
      );

      if (!oiRes.ok) return [];
      const oiJson = await oiRes.json();
      if (oiJson.code !== '0' || !Array.isArray(oiJson.data)) return [];

      // Build ticker map for IV and prices
      const tickerMap = new Map<string, any>();
      if (tickerRes.ok) {
        const tickerJson = await tickerRes.json();
        if (tickerJson.code === '0' && Array.isArray(tickerJson.data)) {
          tickerJson.data.forEach((t: any) => tickerMap.set(t.instId, t));
        }
      }

      // Get underlying price from spot ticker
      let underlyingPrice = 0;
      {
        try {
          const spotRes = await fetchFn(
            `https://www.okx.com/api/v5/market/ticker?instId=${currency}-USDT`,
            {},
            5000,
          );
          if (spotRes.ok) {
            const spotJson = await spotRes.json();
            if (spotJson.code === '0' && spotJson.data?.[0]) {
              underlyingPrice = parseFloat(spotJson.data[0].last) || 0;
            }
          }
        } catch { /* ignore */ }
      }

      return oiJson.data
        .filter((item: any) => {
          const id = item.instId || '';
          return id.includes(currency) && (id.endsWith('-C') || id.endsWith('-P'));
        })
        .map((item: any) => {
          // Format: BTC-USD-250228-95000-C
          const parts = item.instId.split('-');
          const strike = parseFloat(parts[3]) || 0;
          const optionType = parts[4] === 'C' ? 'call' as const : 'put' as const;

          let expiryTimestamp = 0;
          if (parts[2]) {
            const yr = 2000 + parseInt(parts[2].slice(0, 2));
            const mo = parseInt(parts[2].slice(2, 4)) - 1;
            const da = parseInt(parts[2].slice(4, 6));
            expiryTimestamp = new Date(yr, mo, da, 8, 0, 0).getTime();
          }

          const oiContracts = parseFloat(item.oi) || 0;
          const oiCcy = parseFloat(item.oiCcy) || 0;
          const ticker = tickerMap.get(item.instId);
          const markIV = ticker ? (parseFloat(ticker.markIV) || 0) : 0;

          return {
            exchange: 'OKX',
            instrumentName: item.instId,
            optionType,
            strike,
            expiryTimestamp,
            openInterestUsd: oiCcy * (underlyingPrice || 1),
            markIV,
            underlyingPrice,
          };
        });
    },
  },

  // ─── Bybit ──────────────────────────────────────────────────────────────────
  {
    name: 'Bybit',
    fetcher: async (fetchFn, currency) => {
      const res = await fetchFn(
        `https://api.bybit.com/v5/market/tickers?category=option&baseCoin=${currency}`,
        {},
        10000,
      );
      if (!res.ok) return [];
      const json = await res.json();
      if (json.retCode !== 0 || !json.result?.list) return [];

      // Get underlying price from spot
      let underlyingPrice = 0;
      try {
        const spotRes = await fetchFn(
          `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${currency}USDT`,
          {},
          5000,
        );
        if (spotRes.ok) {
          const spotJson = await spotRes.json();
          if (spotJson.retCode === 0 && spotJson.result?.list?.[0]) {
            underlyingPrice = parseFloat(spotJson.result.list[0].lastPrice) || 0;
          }
        }
      } catch { /* ignore */ }

      return json.result.list
        .filter((t: any) => t.symbol && t.openInterest)
        .map((t: any) => {
          // Symbol format: BTC-28FEB25-95000-C
          const parts = t.symbol.split('-');
          const strike = parseFloat(parts[2]) || 0;
          const optionType = parts[3] === 'C' ? 'call' as const : 'put' as const;

          let expiryTimestamp = 0;
          if (parts[1]) {
            const d = parseExpiryStr(parts[1]);
            if (d) expiryTimestamp = d.getTime();
          }

          const oiCoins = parseFloat(t.openInterest) || 0;
          const price = underlyingPrice || parseFloat(t.underlyingPrice) || 0;

          return {
            exchange: 'Bybit',
            instrumentName: t.symbol,
            optionType,
            strike,
            expiryTimestamp,
            openInterestUsd: oiCoins * price,
            markIV: parseFloat(t.markIV) || 0,
            underlyingPrice: price,
          };
        });
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/** Parse expiry strings like "28FEB25" or "28FEB26" → Date */
function parseExpiryStr(s: string): Date | null {
  // Format: DDMMMYY e.g. "28FEB25"
  const match = s.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const month = MONTHS[match[2]];
  const year = 2000 + parseInt(match[3]);
  if (month === undefined || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month, day, 8, 0, 0); // 08:00 UTC standard expiry
}
