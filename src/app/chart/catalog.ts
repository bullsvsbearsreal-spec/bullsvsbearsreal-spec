/**
 * Symbol catalog for the /chart terminal page. Five asset classes,
 * each with a curated set of pinned TradingView-compatible symbols.
 *
 * Kept separate from page.tsx so:
 *   1. The catalog can be unit-tested + grown without touching the UI
 *   2. The symbol picker modal + the watchlist seed both read the same list
 *   3. Future "search across all assets" features have one source
 *
 * To add a symbol: drop a new AssetSymbol into the right tab. The
 * tvSymbol must be one TradingView recognises (try the symbol on
 * tradingview.com first; the embed widget uses the same names).
 */

export type AssetClass = 'crypto' | 'stocks' | 'forex' | 'commodities' | 'indices';

export interface AssetSymbol {
  /** Display name in the UI: 'BTC', 'AAPL', 'EUR/USD'. */
  label: string;
  /** TradingView-compatible symbol: 'BINANCE:BTCUSDT', 'NASDAQ:AAPL'. */
  tvSymbol: string;
  /** Optional pair suffix shown next to the symbol: '/USDT', '/USD', ''. */
  displayPair?: string;
  /** Crypto-only: icon key for <TokenIconSimple>. Stocks/forex/etc render without an icon. */
  icon?: string;
  /** Optional grouping label inside the picker grid. */
  cat?: string;
}

export interface AssetTab {
  id: AssetClass;
  label: string;
  pinned: AssetSymbol[];
}

export const ASSET_TABS: AssetTab[] = [
  {
    id: 'crypto',
    label: 'Crypto',
    pinned: [
      { label: 'BTC', tvSymbol: 'BINANCE:BTCUSDT', displayPair: '/USDT-PERP', icon: 'btc', cat: 'Top' },
      { label: 'ETH', tvSymbol: 'BINANCE:ETHUSDT', displayPair: '/USDT-PERP', icon: 'eth', cat: 'Top' },
      { label: 'SOL', tvSymbol: 'BINANCE:SOLUSDT', displayPair: '/USDT-PERP', icon: 'sol', cat: 'Top' },
      { label: 'XRP', tvSymbol: 'BINANCE:XRPUSDT', displayPair: '/USDT-PERP', icon: 'xrp', cat: 'Top' },
      { label: 'BNB', tvSymbol: 'BINANCE:BNBUSDT', displayPair: '/USDT-PERP', icon: 'bnb', cat: 'Top' },
      { label: 'DOGE', tvSymbol: 'BINANCE:DOGEUSDT', displayPair: '/USDT-PERP', icon: 'doge', cat: 'Top' },
      { label: 'ADA', tvSymbol: 'BINANCE:ADAUSDT', displayPair: '/USDT-PERP', icon: 'ada', cat: 'Top' },
      { label: 'AVAX', tvSymbol: 'BINANCE:AVAXUSDT', displayPair: '/USDT-PERP', icon: 'avax', cat: 'Top' },
      { label: 'LINK', tvSymbol: 'BINANCE:LINKUSDT', displayPair: '/USDT-PERP', icon: 'link', cat: 'Top' },
      { label: 'DOT', tvSymbol: 'BINANCE:DOTUSDT', displayPair: '/USDT-PERP', icon: 'dot', cat: 'Top' },
      { label: 'TRX', tvSymbol: 'BINANCE:TRXUSDT', displayPair: '/USDT-PERP', icon: 'trx', cat: 'Top' },
      { label: 'TON', tvSymbol: 'BINANCE:TONUSDT', displayPair: '/USDT-PERP', icon: 'ton', cat: 'Top' },
      { label: 'SHIB', tvSymbol: 'BINANCE:SHIBUSDT', displayPair: '/USDT-PERP', icon: 'shib', cat: 'Top' },
      { label: 'SUI', tvSymbol: 'BINANCE:SUIUSDT', displayPair: '/USDT-PERP', icon: 'sui', cat: 'Top' },
      { label: 'NEAR', tvSymbol: 'BINANCE:NEARUSDT', displayPair: '/USDT-PERP', icon: 'near', cat: 'Top' },
      { label: 'APT', tvSymbol: 'BINANCE:APTUSDT', displayPair: '/USDT-PERP', icon: 'apt', cat: 'Top' },
      { label: 'LTC', tvSymbol: 'BINANCE:LTCUSDT', displayPair: '/USDT-PERP', icon: 'ltc', cat: 'Top' },
      { label: 'BCH', tvSymbol: 'BINANCE:BCHUSDT', displayPair: '/USDT-PERP', icon: 'bch', cat: 'Top' },
      { label: 'HBAR', tvSymbol: 'BINANCE:HBARUSDT', displayPair: '/USDT-PERP', icon: 'hbar', cat: 'Top' },
      { label: 'OP', tvSymbol: 'BINANCE:OPUSDT', displayPair: '/USDT-PERP', icon: 'op', cat: 'L2' },
      { label: 'ARB', tvSymbol: 'BINANCE:ARBUSDT', displayPair: '/USDT-PERP', icon: 'arb', cat: 'L2' },
      { label: 'SEI', tvSymbol: 'BINANCE:SEIUSDT', displayPair: '/USDT-PERP', icon: 'sei', cat: 'L2' },
      { label: 'TIA', tvSymbol: 'BINANCE:TIAUSDT', displayPair: '/USDT-PERP', icon: 'tia', cat: 'L2' },
      { label: 'INJ', tvSymbol: 'BINANCE:INJUSDT', displayPair: '/USDT-PERP', icon: 'inj', cat: 'L2' },
      { label: 'UNI', tvSymbol: 'BINANCE:UNIUSDT', displayPair: '/USDT-PERP', icon: 'uni', cat: 'DeFi' },
      { label: 'AAVE', tvSymbol: 'BINANCE:AAVEUSDT', displayPair: '/USDT-PERP', icon: 'aave', cat: 'DeFi' },
      { label: 'MKR', tvSymbol: 'BINANCE:MKRUSDT', displayPair: '/USDT-PERP', icon: 'mkr', cat: 'DeFi' },
      { label: 'CRV', tvSymbol: 'BINANCE:CRVUSDT', displayPair: '/USDT-PERP', icon: 'crv', cat: 'DeFi' },
      { label: 'PENDLE', tvSymbol: 'BINANCE:PENDLEUSDT', displayPair: '/USDT-PERP', icon: 'pendle', cat: 'DeFi' },
      { label: 'ENA', tvSymbol: 'BINANCE:ENAUSDT', displayPair: '/USDT-PERP', icon: 'ena', cat: 'DeFi' },
      { label: 'JUP', tvSymbol: 'BINANCE:JUPUSDT', displayPair: '/USDT-PERP', icon: 'jup', cat: 'DeFi' },
      { label: 'RENDER', tvSymbol: 'BINANCE:RENDERUSDT', displayPair: '/USDT-PERP', icon: 'render', cat: 'AI' },
      { label: 'FET', tvSymbol: 'BINANCE:FETUSDT', displayPair: '/USDT-PERP', icon: 'fet', cat: 'AI' },
      { label: 'TAO', tvSymbol: 'BINANCE:TAOUSDT', displayPair: '/USDT-PERP', icon: 'tao', cat: 'AI' },
      { label: 'PEPE', tvSymbol: 'BINANCE:PEPEUSDT', displayPair: '/USDT-PERP', icon: 'pepe', cat: 'Meme' },
      { label: 'WIF', tvSymbol: 'BINANCE:WIFUSDT', displayPair: '/USDT-PERP', icon: 'wif', cat: 'Meme' },
      { label: 'BONK', tvSymbol: 'BINANCE:BONKUSDT', displayPair: '/USDT-PERP', icon: 'bonk', cat: 'Meme' },
      { label: 'FLOKI', tvSymbol: 'BINANCE:FLOKIUSDT', displayPair: '/USDT-PERP', icon: 'floki', cat: 'Meme' },
      { label: 'HYPE', tvSymbol: 'BINANCE:HYPEUSDT', displayPair: '/USDT-PERP', icon: 'hype', cat: 'Perps' },
      { label: 'DYDX', tvSymbol: 'BINANCE:DYDXUSDT', displayPair: '/USDT-PERP', icon: 'dydx', cat: 'Perps' },
      // --- Expanded universe (popular Binance USDT-M perps). The picker's
      //     "Chart <TICKER>" search row covers anything not pinned here. ---
      { label: 'POL', tvSymbol: 'BINANCE:POLUSDT', displayPair: '/USDT-PERP', icon: 'pol', cat: 'L1' },
      { label: 'ATOM', tvSymbol: 'BINANCE:ATOMUSDT', displayPair: '/USDT-PERP', icon: 'atom', cat: 'L1' },
      { label: 'FIL', tvSymbol: 'BINANCE:FILUSDT', displayPair: '/USDT-PERP', icon: 'fil', cat: 'L1' },
      { label: 'ICP', tvSymbol: 'BINANCE:ICPUSDT', displayPair: '/USDT-PERP', icon: 'icp', cat: 'L1' },
      { label: 'ETC', tvSymbol: 'BINANCE:ETCUSDT', displayPair: '/USDT-PERP', icon: 'etc', cat: 'L1' },
      { label: 'XLM', tvSymbol: 'BINANCE:XLMUSDT', displayPair: '/USDT-PERP', icon: 'xlm', cat: 'L1' },
      { label: 'ALGO', tvSymbol: 'BINANCE:ALGOUSDT', displayPair: '/USDT-PERP', icon: 'algo', cat: 'L1' },
      { label: 'VET', tvSymbol: 'BINANCE:VETUSDT', displayPair: '/USDT-PERP', icon: 'vet', cat: 'L1' },
      { label: 'KAS', tvSymbol: 'BINANCE:KASUSDT', displayPair: '/USDT-PERP', icon: 'kas', cat: 'L1' },
      { label: 'STX', tvSymbol: 'BINANCE:STXUSDT', displayPair: '/USDT-PERP', icon: 'stx', cat: 'L1' },
      { label: 'RUNE', tvSymbol: 'BINANCE:RUNEUSDT', displayPair: '/USDT-PERP', icon: 'rune', cat: 'L1' },
      { label: 'EGLD', tvSymbol: 'BINANCE:EGLDUSDT', displayPair: '/USDT-PERP', icon: 'egld', cat: 'L1' },
      { label: 'FLOW', tvSymbol: 'BINANCE:FLOWUSDT', displayPair: '/USDT-PERP', icon: 'flow', cat: 'L1' },
      { label: 'EOS', tvSymbol: 'BINANCE:EOSUSDT', displayPair: '/USDT-PERP', icon: 'eos', cat: 'L1' },
      { label: 'XTZ', tvSymbol: 'BINANCE:XTZUSDT', displayPair: '/USDT-PERP', icon: 'xtz', cat: 'L1' },
      { label: 'IOTA', tvSymbol: 'BINANCE:IOTAUSDT', displayPair: '/USDT-PERP', icon: 'iota', cat: 'L1' },
      { label: 'KAVA', tvSymbol: 'BINANCE:KAVAUSDT', displayPair: '/USDT-PERP', icon: 'kava', cat: 'L1' },
      { label: 'MINA', tvSymbol: 'BINANCE:MINAUSDT', displayPair: '/USDT-PERP', icon: 'mina', cat: 'L1' },
      { label: 'AR', tvSymbol: 'BINANCE:ARUSDT', displayPair: '/USDT-PERP', icon: 'ar', cat: 'L1' },
      { label: 'NEO', tvSymbol: 'BINANCE:NEOUSDT', displayPair: '/USDT-PERP', icon: 'neo', cat: 'L1' },
      { label: 'STRK', tvSymbol: 'BINANCE:STRKUSDT', displayPair: '/USDT-PERP', icon: 'strk', cat: 'L2' },
      { label: 'ZK', tvSymbol: 'BINANCE:ZKUSDT', displayPair: '/USDT-PERP', icon: 'zk', cat: 'L2' },
      { label: 'MANTA', tvSymbol: 'BINANCE:MANTAUSDT', displayPair: '/USDT-PERP', icon: 'manta', cat: 'L2' },
      { label: 'METIS', tvSymbol: 'BINANCE:METISUSDT', displayPair: '/USDT-PERP', icon: 'metis', cat: 'L2' },
      { label: 'LDO', tvSymbol: 'BINANCE:LDOUSDT', displayPair: '/USDT-PERP', icon: 'ldo', cat: 'DeFi' },
      { label: 'SNX', tvSymbol: 'BINANCE:SNXUSDT', displayPair: '/USDT-PERP', icon: 'snx', cat: 'DeFi' },
      { label: 'COMP', tvSymbol: 'BINANCE:COMPUSDT', displayPair: '/USDT-PERP', icon: 'comp', cat: 'DeFi' },
      { label: 'SUSHI', tvSymbol: 'BINANCE:SUSHIUSDT', displayPair: '/USDT-PERP', icon: 'sushi', cat: 'DeFi' },
      { label: '1INCH', tvSymbol: 'BINANCE:1INCHUSDT', displayPair: '/USDT-PERP', icon: '1inch', cat: 'DeFi' },
      { label: 'GMX', tvSymbol: 'BINANCE:GMXUSDT', displayPair: '/USDT-PERP', icon: 'gmx', cat: 'DeFi' },
      { label: 'CAKE', tvSymbol: 'BINANCE:CAKEUSDT', displayPair: '/USDT-PERP', icon: 'cake', cat: 'DeFi' },
      { label: 'ETHFI', tvSymbol: 'BINANCE:ETHFIUSDT', displayPair: '/USDT-PERP', icon: 'ethfi', cat: 'DeFi' },
      { label: 'EIGEN', tvSymbol: 'BINANCE:EIGENUSDT', displayPair: '/USDT-PERP', icon: 'eigen', cat: 'DeFi' },
      { label: 'ONDO', tvSymbol: 'BINANCE:ONDOUSDT', displayPair: '/USDT-PERP', icon: 'ondo', cat: 'RWA' },
      { label: 'WLD', tvSymbol: 'BINANCE:WLDUSDT', displayPair: '/USDT-PERP', icon: 'wld', cat: 'AI' },
      { label: 'ARKM', tvSymbol: 'BINANCE:ARKMUSDT', displayPair: '/USDT-PERP', icon: 'arkm', cat: 'AI' },
      { label: 'VIRTUAL', tvSymbol: 'BINANCE:VIRTUALUSDT', displayPair: '/USDT-PERP', icon: 'virtual', cat: 'AI' },
      { label: 'IO', tvSymbol: 'BINANCE:IOUSDT', displayPair: '/USDT-PERP', icon: 'io', cat: 'AI' },
      { label: 'GRASS', tvSymbol: 'BINANCE:GRASSUSDT', displayPair: '/USDT-PERP', icon: 'grass', cat: 'AI' },
      { label: 'BOME', tvSymbol: 'BINANCE:BOMEUSDT', displayPair: '/USDT-PERP', icon: 'bome', cat: 'Meme' },
      { label: 'POPCAT', tvSymbol: 'BINANCE:POPCATUSDT', displayPair: '/USDT-PERP', icon: 'popcat', cat: 'Meme' },
      { label: 'TURBO', tvSymbol: 'BINANCE:TURBOUSDT', displayPair: '/USDT-PERP', icon: 'turbo', cat: 'Meme' },
      { label: 'NEIRO', tvSymbol: 'BINANCE:NEIROUSDT', displayPair: '/USDT-PERP', icon: 'neiro', cat: 'Meme' },
      { label: 'PNUT', tvSymbol: 'BINANCE:PNUTUSDT', displayPair: '/USDT-PERP', icon: 'pnut', cat: 'Meme' },
      { label: 'PEOPLE', tvSymbol: 'BINANCE:PEOPLEUSDT', displayPair: '/USDT-PERP', icon: 'people', cat: 'Meme' },
      { label: 'MEW', tvSymbol: 'BINANCE:MEWUSDT', displayPair: '/USDT-PERP', icon: 'mew', cat: 'Meme' },
      { label: 'GOAT', tvSymbol: 'BINANCE:GOATUSDT', displayPair: '/USDT-PERP', icon: 'goat', cat: 'Meme' },
      { label: 'DOGS', tvSymbol: 'BINANCE:DOGSUSDT', displayPair: '/USDT-PERP', icon: 'dogs', cat: 'Meme' },
      { label: 'NOT', tvSymbol: 'BINANCE:NOTUSDT', displayPair: '/USDT-PERP', icon: 'not', cat: 'Meme' },
      { label: 'AXS', tvSymbol: 'BINANCE:AXSUSDT', displayPair: '/USDT-PERP', icon: 'axs', cat: 'Gaming' },
      { label: 'SAND', tvSymbol: 'BINANCE:SANDUSDT', displayPair: '/USDT-PERP', icon: 'sand', cat: 'Gaming' },
      { label: 'MANA', tvSymbol: 'BINANCE:MANAUSDT', displayPair: '/USDT-PERP', icon: 'mana', cat: 'Gaming' },
      { label: 'GALA', tvSymbol: 'BINANCE:GALAUSDT', displayPair: '/USDT-PERP', icon: 'gala', cat: 'Gaming' },
      { label: 'APE', tvSymbol: 'BINANCE:APEUSDT', displayPair: '/USDT-PERP', icon: 'ape', cat: 'Gaming' },
      { label: 'IMX', tvSymbol: 'BINANCE:IMXUSDT', displayPair: '/USDT-PERP', icon: 'imx', cat: 'Gaming' },
      { label: 'GMT', tvSymbol: 'BINANCE:GMTUSDT', displayPair: '/USDT-PERP', icon: 'gmt', cat: 'Gaming' },
      { label: 'JASMY', tvSymbol: 'BINANCE:JASMYUSDT', displayPair: '/USDT-PERP', icon: 'jasmy', cat: 'Gaming' },
      { label: 'PIXEL', tvSymbol: 'BINANCE:PIXELUSDT', displayPair: '/USDT-PERP', icon: 'pixel', cat: 'Gaming' },
      { label: 'JTO', tvSymbol: 'BINANCE:JTOUSDT', displayPair: '/USDT-PERP', icon: 'jto', cat: 'DEX' },
      { label: 'AEVO', tvSymbol: 'BINANCE:AEVOUSDT', displayPair: '/USDT-PERP', icon: 'aevo', cat: 'DEX' },
      { label: 'W', tvSymbol: 'BINANCE:WUSDT', displayPair: '/USDT-PERP', icon: 'w', cat: 'DEX' },
      { label: 'ZRO', tvSymbol: 'BINANCE:ZROUSDT', displayPair: '/USDT-PERP', icon: 'zro', cat: 'DEX' },
    ],
  },
  {
    id: 'stocks',
    label: 'Stocks',
    pinned: [
      { label: 'AAPL', tvSymbol: 'NASDAQ:AAPL', displayPair: '' },
      { label: 'MSFT', tvSymbol: 'NASDAQ:MSFT', displayPair: '' },
      { label: 'NVDA', tvSymbol: 'NASDAQ:NVDA', displayPair: '' },
      { label: 'GOOGL', tvSymbol: 'NASDAQ:GOOGL', displayPair: '' },
      { label: 'AMZN', tvSymbol: 'NASDAQ:AMZN', displayPair: '' },
      { label: 'TSLA', tvSymbol: 'NASDAQ:TSLA', displayPair: '' },
      { label: 'META', tvSymbol: 'NASDAQ:META', displayPair: '' },
      { label: 'AMD', tvSymbol: 'NASDAQ:AMD', displayPair: '' },
      { label: 'NFLX', tvSymbol: 'NASDAQ:NFLX', displayPair: '' },
      { label: 'JPM', tvSymbol: 'NYSE:JPM', displayPair: '' },
      { label: 'V', tvSymbol: 'NYSE:V', displayPair: '' },
      { label: 'BA', tvSymbol: 'NYSE:BA', displayPair: '' },
      { label: 'DIS', tvSymbol: 'NYSE:DIS', displayPair: '' },
      { label: 'COIN', tvSymbol: 'NASDAQ:COIN', displayPair: '' },
      { label: 'MSTR', tvSymbol: 'NASDAQ:MSTR', displayPair: '' },
      { label: 'PLTR', tvSymbol: 'NASDAQ:PLTR', displayPair: '' },
      { label: 'SMCI', tvSymbol: 'NASDAQ:SMCI', displayPair: '' },
      { label: 'ARM', tvSymbol: 'NASDAQ:ARM', displayPair: '' },
    ],
  },
  {
    id: 'forex',
    label: 'Forex',
    pinned: [
      { label: 'EUR/USD', tvSymbol: 'FX:EURUSD', displayPair: '' },
      { label: 'GBP/USD', tvSymbol: 'FX:GBPUSD', displayPair: '' },
      { label: 'USD/JPY', tvSymbol: 'FX:USDJPY', displayPair: '' },
      { label: 'USD/CHF', tvSymbol: 'FX:USDCHF', displayPair: '' },
      { label: 'AUD/USD', tvSymbol: 'FX:AUDUSD', displayPair: '' },
      { label: 'USD/CAD', tvSymbol: 'FX:USDCAD', displayPair: '' },
      { label: 'NZD/USD', tvSymbol: 'FX:NZDUSD', displayPair: '' },
      { label: 'EUR/GBP', tvSymbol: 'FX:EURGBP', displayPair: '' },
      { label: 'EUR/JPY', tvSymbol: 'FX:EURJPY', displayPair: '' },
      { label: 'GBP/JPY', tvSymbol: 'FX:GBPJPY', displayPair: '' },
      { label: 'EUR/CHF', tvSymbol: 'FX:EURCHF', displayPair: '' },
      { label: 'AUD/JPY', tvSymbol: 'FX:AUDJPY', displayPair: '' },
      { label: 'EUR/AUD', tvSymbol: 'FX:EURAUD', displayPair: '' },
      { label: 'USD/MXN', tvSymbol: 'FX:USDMXN', displayPair: '' },
      { label: 'USD/TRY', tvSymbol: 'FX:USDTRY', displayPair: '' },
      { label: 'USD/ZAR', tvSymbol: 'FX:USDZAR', displayPair: '' },
      { label: 'DXY', tvSymbol: 'TVC:DXY', displayPair: '' },
    ],
  },
  {
    id: 'commodities',
    label: 'Commodities',
    pinned: [
      { label: 'Gold', tvSymbol: 'TVC:GOLD', displayPair: '' },
      { label: 'Silver', tvSymbol: 'TVC:SILVER', displayPair: '' },
      { label: 'Crude Oil', tvSymbol: 'TVC:USOIL', displayPair: '' },
      { label: 'Brent', tvSymbol: 'TVC:UKOIL', displayPair: '' },
      { label: 'Natural Gas', tvSymbol: 'PEPPERSTONE:NATGAS', displayPair: '' },
      { label: 'Copper', tvSymbol: 'PEPPERSTONE:COPPER', displayPair: '' },
      { label: 'Platinum', tvSymbol: 'TVC:PLATINUM', displayPair: '' },
      { label: 'Palladium', tvSymbol: 'TVC:PALLADIUM', displayPair: '' },
      { label: 'Wheat', tvSymbol: 'PEPPERSTONE:WHEAT', displayPair: '' },
      { label: 'Corn', tvSymbol: 'PEPPERSTONE:CORN', displayPair: '' },
      { label: 'Soybeans', tvSymbol: 'PEPPERSTONE:SOYBEAN', displayPair: '' },
      { label: 'Coffee', tvSymbol: 'PEPPERSTONE:COFFEE', displayPair: '' },
      { label: 'Cocoa', tvSymbol: 'PEPPERSTONE:COCOA', displayPair: '' },
      { label: 'Sugar', tvSymbol: 'PEPPERSTONE:SUGAR', displayPair: '' },
      { label: 'Cotton', tvSymbol: 'PEPPERSTONE:COTTON', displayPair: '' },
    ],
  },
  {
    id: 'indices',
    label: 'Indices',
    pinned: [
      { label: 'S&P 500', tvSymbol: 'FOREXCOM:SPX500', displayPair: '' },
      { label: 'NASDAQ 100', tvSymbol: 'FOREXCOM:NSXUSD', displayPair: '' },
      { label: 'Dow Jones', tvSymbol: 'FOREXCOM:DJI', displayPair: '' },
      { label: 'Russell 2000', tvSymbol: 'FOREXCOM:RUSS2000', displayPair: '' },
      { label: 'VIX', tvSymbol: 'CAPITALCOM:VIX', displayPair: '' },
      { label: 'DAX', tvSymbol: 'FOREXCOM:DEU40', displayPair: '' },
      { label: 'FTSE 100', tvSymbol: 'FOREXCOM:UK100', displayPair: '' },
      { label: 'CAC 40', tvSymbol: 'FOREXCOM:FRA40', displayPair: '' },
      { label: 'Nikkei 225', tvSymbol: 'FOREXCOM:JPN225', displayPair: '' },
      { label: 'Hang Seng', tvSymbol: 'FOREXCOM:HKG33', displayPair: '' },
      { label: 'Euro Stoxx 50', tvSymbol: 'FOREXCOM:EU50', displayPair: '' },
      { label: 'ASX 200', tvSymbol: 'FOREXCOM:AUS200', displayPair: '' },
      { label: 'SPY ETF', tvSymbol: 'AMEX:SPY', displayPair: '' },
      { label: 'QQQ ETF', tvSymbol: 'NASDAQ:QQQ', displayPair: '' },
    ],
  },
];

export const TIMEFRAMES = [
  { label: '1m',  value: '1' },
  { label: '5m',  value: '5' },
  { label: '15m', value: '15' },
  { label: '1H',  value: '60' },
  { label: '4H',  value: '240' },
  { label: '1D',  value: 'D' },
  { label: '1W',  value: 'W' },
] as const;
export type Timeframe = typeof TIMEFRAMES[number]['value'];

/** Default symbols seeded into the watchlist when a user has none
 *  saved. Keyed by asset class so a user on the Stocks tab sees
 *  AAPL/MSFT/NVDA rather than BTC/ETH/SOL. */
export const WATCHLIST_DEFAULTS_BY_CLASS: Record<AssetClass, string[]> = {
  crypto:      ['BTC', 'ETH', 'SOL', 'HYPE', 'BNB', 'XRP', 'DOGE', 'TRX'],
  stocks:      ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META', 'COIN'],
  forex:       ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'DXY'],
  commodities: ['Gold', 'Silver', 'Crude Oil', 'Brent', 'Natural Gas', 'Copper', 'Platinum', 'Wheat'],
  indices:     ['S&P 500', 'NASDAQ 100', 'Dow Jones', 'VIX', 'DAX', 'FTSE 100', 'Nikkei 225', 'SPY ETF'],
};

/** Back-compat re-export used by code that hasn't been updated yet. */
export const WATCHLIST_DEFAULTS = WATCHLIST_DEFAULTS_BY_CLASS.crypto;

/** Lookup table — keyed by tvSymbol → AssetSymbol. */
export function findBySymbol(label: string): AssetSymbol | undefined {
  for (const tab of ASSET_TABS) {
    const hit = tab.pinned.find(s => s.label === label);
    if (hit) return hit;
  }
  return undefined;
}

/** Lookup table — keyed by label → AssetClass. Used to figure out
 *  which tab a watchlist entry belongs to so we restore the right view. */
export function assetClassFor(label: string): AssetClass | null {
  for (const tab of ASSET_TABS) {
    if (tab.pinned.some(s => s.label === label)) return tab.id;
  }
  return null;
}
