/**
 * Curated list of crypto/macro KOLs whose Twitter posts feed the
 * /api/news/social endpoint.
 *
 * Adding/removing handles here automatically picks up on the next
 * /api/cron/social-fetch run (every 15 min via systemd timer on the
 * aggregator droplet — see /etc/systemd/system/infohub-cron-social-fetch.timer).
 *
 * Handles are case-insensitive — the fetcher normalises to lowercase before
 * storing. Use the canonical X username (no @ prefix).
 */
export const TWITTER_KOLS: readonly string[] = [
  'goodalexander',
  'citrini',
  'PolymarketMoney',
  'Polymarket',
  'gametheorizing',
  'TaikiMaeda2',
  'GarrettBullish',
  'Bluntz_Capital',
  'DonAlt',
  'duonine',
  'zachxbt',
  'Trader_XO',
  'Techno_Revenant',
  'smartestmoney',
  'OptimusDelta',
  'game_for_one',
  'thiccyth0t',
  'Gold_Cryptoz',
  'TheTranscript_',
] as const;
