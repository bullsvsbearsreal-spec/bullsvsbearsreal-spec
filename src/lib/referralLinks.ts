/**
 * Exchange referral links — used across spreads page, scanner, and exchange tables.
 * Rotates between team members' links randomly per session.
 */

const REFERRAL_URLS: Record<string, string[]> = {
  Bybit: ['https://www.bybit.com/invite?ref=VL792O'],
  Bitget: ['https://share.bitget.com/u/SSFL1S2B'],
  MEXC: ['https://promote.mexc.com/r/7zeuU9AdFM', 'https://promote.mexc.com/r/i98MMJzX'],
  KuCoin: ['https://www.kucoin.com/r/rf/CXEJE3SG', 'https://www.kucoin.com/r/rf/QBS4DW6N'],
  Bitunix: ['https://www.bitunix.com/register?inviteCode=sv6axk'],
  Hyperliquid: ['https://app.hyperliquid.xyz/join/SNAKETHER'],
  GMX: ['https://app.gmx.io/#/trade/?ref=Q9ENQ', 'https://app.gmx.io/#/trade/?ref=snakether'],
  Aster: ['https://www.asterdex.com/en/referral/48aFb9'],
  Lighter: ['https://app.lighter.xyz/?referral=7162321B'],
  gTrade: ['https://gains.trade/referred?by=arasaka'],
};

// Pick a random link per exchange (consistent per page load)
const picked: Record<string, string> = {};

export function getExchangeReferralUrl(exchange: string): string | null {
  if (picked[exchange]) return picked[exchange];
  const urls = REFERRAL_URLS[exchange];
  if (!urls || urls.length === 0) return null;
  picked[exchange] = urls[Math.floor(Math.random() * urls.length)];
  return picked[exchange];
}
