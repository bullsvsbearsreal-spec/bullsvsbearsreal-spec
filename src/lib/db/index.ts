/**
 * Database client for DigitalOcean Managed PostgreSQL.
 * Uses 'postgres' (Postgres.js) — lightweight, modern, Edge-compatible driver.
 *
 * Connection string from env: DATABASE_URL
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || '';

let sql: ReturnType<typeof postgres> | null = null;

export function getSQL() {
  if (!DATABASE_URL) {
    // Return a tagged-template proxy that throws on actual use (not on import).
    // This allows modules to call getSQL() at init time without crashing the build.
    return new Proxy((() => {}) as any, {
      apply() { throw new Error('No database URL configured. Set DATABASE_URL env var.'); },
      get(_, prop) {
        if (prop === 'then') return undefined; // not a thenable
        return () => { throw new Error('No database URL configured. Set DATABASE_URL env var.'); };
      },
    }) as ReturnType<typeof postgres>;
  }
  if (!sql) {
    sql = postgres(DATABASE_URL, {
      max: 3,                // small pool per serverless instance (PgBouncer handles global pooling)
      idle_timeout: 5,       // release idle connections after 5s
      connect_timeout: 10,   // 10s connection timeout
      max_lifetime: 60 * 2,  // recycle connections every 2 min
      prepare: false,        // required for PgBouncer transaction mode
      ssl: 'require',
    });
  }
  return sql;
}

// ─── Schema initialization ──────────────────────────────────────────────────

let initPromise: Promise<void> | null = null;

export async function initDB(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = _doInitDB().catch((err) => {
    // Reset on failure so the next caller retries instead of inheriting
    // the rejected promise forever. Without this a transient cold-start
    // DB hiccup leaves the process serving 503 until it's restarted.
    initPromise = null;
    throw err;
  });
  return initPromise;
}

async function _doInitDB(): Promise<void> {
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS api_cache (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS funding_snapshots (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      rate REAL NOT NULL,
      predicted REAL,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_funding_sym_ts ON funding_snapshots(symbol, ts DESC)`;

  // Add mark_price column (added Mar 2026 for price gap tracking)
  await sql`ALTER TABLE funding_snapshots ADD COLUMN IF NOT EXISTS mark_price REAL`;
  // Allow rate to be NULL — the snapshot cron writes mark-price-only rows
  // every minute and was previously forced to store rate=0 as a placeholder.
  // Those rows then polluted the "latest funding rate" lookup on /positions
  // because they out-numbered the real funding ticks (every 10 min) 10:1.
  await sql`ALTER TABLE funding_snapshots ALTER COLUMN rate DROP NOT NULL`;
  // Skew-based DEXes (GMX V2, gTrade) charge ASYMMETRIC funding to longs and
  // shorts because the receiving side's rate is scaled by the OI ratio.
  // CEXes are symmetric (longs pay = shorts receive). `rate` stores the
  // canonical "longs pay" rate; `rate_short` stores the side-specific "shorts
  // pay" rate when the venue exposes it. Position-API picks the right one
  // based on side. Null on CEX / venues without per-side data.
  await sql`ALTER TABLE funding_snapshots ADD COLUMN IF NOT EXISTS rate_short REAL`;
  // Per-symbol funding settlement interval in hours. Most CEX perps are
  // 8h but Binance/MEXC/Bybit have moved high-volume symbols to 4h, and
  // certain alts go to 2h or 1h. Without this column we forced every
  // position into the per-exchange default in lib/funding-intervals.ts,
  // producing wrong APR projections for any non-default symbol —
  // christian's MEXC feedback May 2026 ("you default to 8hrs but some
  // tokens are 4hrs"). NULL = unknown, caller falls back to the
  // per-exchange default in intervalHoursFor.
  await sql`ALTER TABLE funding_snapshots ADD COLUMN IF NOT EXISTS interval_h SMALLINT`;
  // Partial index for price-multi queries (only rows with mark_price)
  await sql`CREATE INDEX IF NOT EXISTS idx_funding_mark_price ON funding_snapshots(symbol, exchange, ts DESC) WHERE mark_price IS NOT NULL AND mark_price > 0`;

  await sql`
    CREATE TABLE IF NOT EXISTS oi_snapshots (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      oi_usd REAL NOT NULL,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_oi_sym_ts ON oi_snapshots(symbol, ts DESC)`;

  // Spread snapshots for historical tracking
  await sql`
    CREATE TABLE IF NOT EXISTS spread_snapshots (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      spread_usd REAL NOT NULL,
      spread_pct REAL NOT NULL,
      high_exchange TEXT,
      low_exchange TEXT,
      high_price REAL,
      low_price REAL,
      exchange_count INT DEFAULT 0,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_spread_sym_ts ON spread_snapshots(symbol, ts DESC)`;

  // Arbitrage opportunity tracker
  await sql`
    CREATE TABLE IF NOT EXISTS arb_opportunities (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      spread_usd REAL NOT NULL,
      spread_pct REAL NOT NULL,
      high_exchange TEXT NOT NULL,
      low_exchange TEXT NOT NULL,
      max_spread_usd REAL NOT NULL,
      max_spread_pct REAL NOT NULL,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      status TEXT DEFAULT 'open'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_arb_opp_sym_status ON arb_opportunities(symbol, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_arb_opp_opened ON arb_opportunities(opened_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS watchlists (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, symbol)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_prefs (
      user_id TEXT PRIMARY KEY,
      prefs JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_prt_email ON password_reset_tokens(email)`;

  await sql`
    CREATE TABLE IF NOT EXISTS alert_notifications (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      alert_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      metric TEXT NOT NULL,
      threshold REAL NOT NULL,
      actual_value REAL NOT NULL,
      channel TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_alert_notif_user ON alert_notifications(user_id, alert_id, sent_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_alert_notif_user_channel ON alert_notifications(user_id, alert_id, channel, sent_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      total_value REAL NOT NULL,
      total_pnl REAL NOT NULL,
      holdings JSONB,
      ts TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_portfolio_user_ts ON portfolio_snapshots(user_id, ts DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS liquidation_snapshots (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      side TEXT NOT NULL,
      price REAL NOT NULL,
      quantity REAL NOT NULL,
      value_usd REAL NOT NULL,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_liq_sym_ts ON liquidation_snapshots(symbol, ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_liq_sym_ex_ts ON liquidation_snapshots(symbol, exchange, ts DESC)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_liq_dedup ON liquidation_snapshots(symbol, exchange, side, price, ts)`;

  // Compound indexes for faster history queries
  await sql`CREATE INDEX IF NOT EXISTS idx_funding_sym_ex_ts ON funding_snapshots(symbol, exchange, ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_oi_sym_ex_ts ON oi_snapshots(symbol, exchange, ts DESC)`;

  // Email verification codes
  await sql`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_evc_user ON email_verification_codes(user_id, used)`;

  // 2FA login codes (one-time codes sent via email during login)
  await sql`
    CREATE TABLE IF NOT EXISTS twofa_login_codes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_twofa_login_codes_email ON twofa_login_codes (email, used, expires_at)`;

  // 2FA nonces (issued after successful 2FA validation)
  await sql`
    CREATE TABLE IF NOT EXISTS twofa_nonces (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      nonce TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Two-factor authentication
  await sql`
    CREATE TABLE IF NOT EXISTS user_2fa (
      user_id TEXT PRIMARY KEY,
      totp_secret TEXT,
      totp_enabled BOOLEAN DEFAULT false,
      email_2fa_enabled BOOLEAN DEFAULT false,
      backup_codes TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // TOTP code replay protection. otpauth's `window: 1` accepts the
  // previous + next 30s code, so a stolen code (phishing, MITM) is
  // valid for up to 90s. Without tracking which codes have been
  // consumed, an attacker can replay the same code multiple times
  // within that window. After a successful validation, we INSERT
  // (user_id, code, expires_at) and reject any pre-existing match.
  await sql`
    CREATE TABLE IF NOT EXISTS totp_used_codes (
      user_id TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (user_id, code)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_totp_used_codes_expires ON totp_used_codes (expires_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions (user_id)`;

  await initTelegramTables();

  // Email verification column
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ DEFAULT NULL`;
  // User roles (admin, user)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`;
  // Billing tier — 'free' | 'trader' | 'pro' | 'whale'. Drives the
  // per-tier limits in lib/constants/tiers.ts (rate limit, alert count,
  // watched wallet cap, history window). NULL or unknown = 'free'. Admin
  // role auto-resolves to 'whale' via resolveUserTier regardless of this
  // column.
  //
  // Tier-rename migration (May 2026): we split the old "Pro" $12 tier
  // into Trader $12 + Pro $29. Existing 'pro' billing_tier rows stay
  // 'pro' (they auto-bump to the new $29 tier — a generous grandfather
  // since paid is free during launch anyway). 'trader' is a new value.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_tier TEXT NOT NULL DEFAULT 'free'`;
  // User-to-user referrals (legacy invite system): stores the inviter's
  // invite code (the HMAC string from lib/invite.ts), not a user ID —
  // keeps the link opaque and avoids a self-FK that PostgreSQL would
  // have to validate on every signup. Counts roll up via index on this
  // column.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_code TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_referred_by_code ON users(referred_by_code) WHERE referred_by_code IS NOT NULL`;

  // ─── Affiliate system (May 2026) ────────────────────────────────────
  // Per-user shareable referral code (the public slug they share). Distinct
  // from the legacy `referred_by_code` invite system above. Auto-generated
  // on signup, stored uppercase (humans type it). 8 chars from a no-confusing-
  // characters alphabet = ~1.1e12 codes, plenty of room before collisions.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL`;
  // When a user signs up via someone else's referral code, store the
  // inviter's user_id here. Used for the 20% recurring commission
  // calculation once payments wire up. Nullable for organic signups.
  // NOTE: users.id is TEXT in this codebase (string UUIDs, not UUID
  // native type), so the FK column must also be TEXT — Postgres rejects
  // cross-type FKs.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id ON users(referred_by_user_id) WHERE referred_by_user_id IS NOT NULL`;
  // Affiliate payout config. We pay 20% recurring commissions in USDT
  // on Solana / Arbitrum / Base (low gas). `usdt_payout_wallet` is the
  // destination address; `usdt_payout_chain` is one of those three.
  // Both nullable until the affiliate fills in their settings.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS usdt_payout_wallet TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS usdt_payout_chain TEXT`;

  // referral_events — event log for the affiliate flywheel. We record:
  //   'click'      — ?ref=CODE landing-page hit (cookie set, no auth)
  //   'signup'     — referred user completed signup
  //   'conversion' — referred user's first paid month confirmed (when
  //                  NowPayments webhook lands — held until then)
  //   'payout'     — USDT payout sent to the affiliate's wallet
  // Amount/currency only present on conversion + payout rows.
  await sql`
    CREATE TABLE IF NOT EXISTS referral_events (
      id BIGSERIAL PRIMARY KEY,
      affiliate_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      amount_usd NUMERIC(12,2),
      commission_usd NUMERIC(12,2),
      tx_hash TEXT,
      chain TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_referral_events_affiliate ON referral_events(affiliate_user_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_referral_events_type ON referral_events(event_type, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_referral_events_referred ON referral_events(referred_user_id) WHERE referred_user_id IS NOT NULL`;

  // ─── Custom dashboard layouts (Pro tier feature, May 2026) ──────────
  // Single row per user holding their personalised widget grid. JSONB
  // because the schema evolves as we add widget types — no migration
  // hassle when a new widget config field lands. ON DELETE CASCADE so
  // account deletion sweeps cleanly.
  await sql`
    CREATE TABLE IF NOT EXISTS user_dashboard_layouts (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      widgets JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Seed admin accounts
  const adminEmail = process.env.ADMIN_EMAIL || 'ocelotcex1638a@gmail.com';
  await sql`UPDATE users SET role = 'admin' WHERE email = ${adminEmail} AND role != 'admin'`;
  // Backfill: every existing API key owned by an admin gets bumped to
  // 'whale' tier (resolveUserTier's admin→whale rule applies to keys
  // too — admins should never be artificially throttled). Without this,
  // pre-existing admin keys stay on 'free' until they regenerate.
  await sql`
    UPDATE api_keys SET tier = 'whale'
    WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')
      AND tier != 'whale'
  `;

  // Admin monitoring metrics (DB size history, coverage snapshots)
  await sql`
    CREATE TABLE IF NOT EXISTS admin_monitoring (
      id SERIAL PRIMARY KEY,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_mon_metric_ts ON admin_monitoring(metric, recorded_at DESC)`;
  await sql`ALTER TABLE admin_monitoring ADD COLUMN IF NOT EXISTS details JSONB DEFAULT NULL`;

  // ── One-time cleanup: nuke base64 data URIs from users.image ──
  // These bloat JWT cookies past Vercel's 32KB header limit (494 error).
  // Safe to run repeatedly — only affects rows with data: prefix.
  await sql`UPDATE users SET image = NULL WHERE image LIKE 'data:%'`;

  // API keys for public API (v1)
  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Default',
      tier TEXT NOT NULL DEFAULT 'free',
      is_active BOOLEAN DEFAULT true,
      last_used_at TIMESTAMPTZ,
      requests_today INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`;

  // ── Optimization indexes (Mar 2026) ──
  // Alert notifications: time-range aggregation queries
  await sql`CREATE INDEX IF NOT EXISTS idx_alert_notif_sent_at ON alert_notifications(sent_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_alert_notif_sent_symbol ON alert_notifications(sent_at DESC, symbol)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_alert_notif_sent_channel ON alert_notifications(sent_at DESC, channel)`;
  // Watchlists: user lookups
  await sql`CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlists(user_id)`;
  // Time-series aggregation without exchange filter
  await sql`CREATE INDEX IF NOT EXISTS idx_oi_ts_symbol ON oi_snapshots(ts DESC, symbol)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_funding_ts_symbol ON funding_snapshots(ts DESC, symbol)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_liq_ts_symbol_exchange ON liquidation_snapshots(ts DESC, symbol, exchange)`;
  // Cache expiry cleanup
  await sql`CREATE INDEX IF NOT EXISTS idx_api_cache_expires_at ON api_cache(expires_at DESC)`;

  // ── Whale wallet trade tracking (Apr 2026) ──
  await sql`
    CREATE TABLE IF NOT EXISTS whale_tracked_wallets (
      id SERIAL PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      address TEXT NOT NULL,
      chain TEXT NOT NULL,
      label TEXT,
      notify_channels TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(owner_id, address, chain)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_whale_tracked_owner ON whale_tracked_wallets(owner_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_whale_tracked_addr ON whale_tracked_wallets(address, chain)`;

  await sql`
    CREATE TABLE IF NOT EXISTS whale_trade_events (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL,
      chain TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      log_index INT DEFAULT 0,
      dex TEXT,
      action TEXT NOT NULL DEFAULT 'swap',
      token_in TEXT,
      token_in_symbol TEXT,
      amount_in REAL,
      token_out TEXT,
      token_out_symbol TEXT,
      amount_out REAL,
      value_usd REAL,
      block_number BIGINT,
      block_time TIMESTAMPTZ NOT NULL,
      discovered_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tx_hash, log_index)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_whale_events_addr_time ON whale_trade_events(address, chain, block_time DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_whale_events_discovered ON whale_trade_events(discovered_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS whale_alert_notifications (
      id SERIAL PRIMARY KEY,
      owner_id TEXT NOT NULL,
      trade_event_id INT NOT NULL,
      channel TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(owner_id, trade_event_id, channel)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_whale_notif_owner ON whale_alert_notifications(owner_id, sent_at DESC)`;

  // ── Hyperliquid wallet position watcher (May 2026) ──
  // Each user can watch any HL wallet; the cron diffs each wallet's
  // clearinghouseState every 60s and fires per-user Telegram pings
  // for the trigger types they enabled.
  await sql`
    CREATE TABLE IF NOT EXISTS hl_watched_wallets (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      address TEXT NOT NULL,
      label TEXT,
      -- bitfield of enabled triggers; default: all on
      trigger_opened BOOLEAN DEFAULT TRUE,
      trigger_closed BOOLEAN DEFAULT TRUE,
      trigger_size_changed BOOLEAN DEFAULT TRUE,
      trigger_liq_danger BOOLEAN DEFAULT TRUE,
      trigger_realized_pnl BOOLEAN DEFAULT TRUE,
      trigger_funding_paid BOOLEAN DEFAULT TRUE,
      -- thresholds (sane defaults; user can override)
      size_change_pct REAL DEFAULT 0.10,         -- 10% notional delta
      liq_danger_pct REAL DEFAULT 0.05,          -- <5% from liq
      realized_pnl_usd REAL DEFAULT 1000,        -- |realized PnL| > $1k
      funding_paid_usd REAL DEFAULT 1000,        -- |Δ cumFunding| > $1k
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, address)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hl_watched_user ON hl_watched_wallets(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hl_watched_addr ON hl_watched_wallets(address)`;

  // Latest snapshot per address × venue (one row per pair, used by diff cron).
  // Venue can be 'hyperliquid' or 'gtrade' today; future venues add rows
  // without schema change. Existing pre-venue rows are migrated below.
  await sql`
    CREATE TABLE IF NOT EXISTS hl_position_snapshots (
      address TEXT NOT NULL,
      venue TEXT NOT NULL DEFAULT 'hyperliquid',
      positions JSONB NOT NULL,
      account_value REAL,
      ts TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (address, venue)
    )
  `;
  // Migration: if an older single-column PK shape already exists, add the
  // venue column then swap the PK to the composite (address, venue) so the
  // ON CONFLICT (address, venue) upsert in the cron has a matching unique
  // constraint to target. Each step is guarded so it's idempotent and
  // safe on fresh installs.
  try { await sql`ALTER TABLE hl_position_snapshots ADD COLUMN IF NOT EXISTS venue TEXT NOT NULL DEFAULT 'hyperliquid'` } catch {}
  try { await sql`ALTER TABLE hl_position_snapshots DROP CONSTRAINT IF EXISTS hl_position_snapshots_pkey` } catch {}
  try { await sql`ALTER TABLE hl_position_snapshots ADD PRIMARY KEY (address, venue)` } catch {}
  await sql`CREATE INDEX IF NOT EXISTS idx_hl_snap_ts ON hl_position_snapshots(ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hl_snap_addr_venue ON hl_position_snapshots(address, venue)`;

  // Event log (per address × venue, fanned out to users on read)
  await sql`
    CREATE TABLE IF NOT EXISTS hl_position_events (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL,
      venue TEXT NOT NULL DEFAULT 'hyperliquid',
      symbol TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload JSONB,
      ts TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  try { await sql`ALTER TABLE hl_position_events ADD COLUMN IF NOT EXISTS venue TEXT NOT NULL DEFAULT 'hyperliquid'` } catch {}
  await sql`CREATE INDEX IF NOT EXISTS idx_hl_events_addr ON hl_position_events(address, ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hl_events_ts ON hl_position_events(ts DESC)`;

  // Per-user dedup so a single global event only pings each subscriber once
  await sql`
    CREATE TABLE IF NOT EXISTS hl_event_notifications (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id INT NOT NULL REFERENCES hl_position_events(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, event_id, channel)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hl_notif_user ON hl_event_notifications(user_id, sent_at DESC)`;

  // Worker heartbeats — droplet/cron health monitoring
  await sql`
    CREATE TABLE IF NOT EXISTS worker_heartbeats (
      worker TEXT PRIMARY KEY,
      last_beat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'ok',
      details JSONB DEFAULT NULL
    )
  `;

  // Rate limit events — persistent cross-instance rate limiting
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limit_events (
      id SERIAL PRIMARY KEY,
      limiter TEXT NOT NULL,
      key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_rle_lookup ON rate_limit_events(limiter, key, created_at)`;

  // Social-feed posts — KOL Twitter/X posts pulled via the social-fetch cron.
  // `id` is the natural composite "${handle}_${tweetId}" so re-fetches are
  // idempotent. `source` tracks the upstream (nitter / rsshub / rss.app /
  // x-api) so we can debug feeds breaking when a source dies.
  await sql`
    CREATE TABLE IF NOT EXISTS social_posts (
      id           TEXT PRIMARY KEY,
      handle       TEXT NOT NULL,
      display_name TEXT,
      body         TEXT NOT NULL,
      body_html    TEXT,
      link         TEXT NOT NULL,
      pub_date     TIMESTAMPTZ NOT NULL,
      fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source       TEXT NOT NULL DEFAULT 'nitter'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_social_posts_pub_date ON social_posts(pub_date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_social_posts_handle ON social_posts(handle, pub_date DESC)`;

  // ─── Portfolio: user-supplied exchange keys + wallets + aggregated positions
  //
  // user_exchange_keys: API key (encrypted) for a CEX. AES-256-GCM with the
  //   key from EXCHANGE_KEY_ENCRYPTION_KEY env var. Encrypted blob format is
  //   "nonce.ciphertext.tag" (base64-joined). `key_prefix` is the first 8
  //   chars of the API key — safe to display in UI for identification.
  //   `permissions` is whatever the exchange returned at validation time
  //   (free-form jsonb so we don't lock the schema to a single exchange).
  await sql`
    CREATE TABLE IF NOT EXISTS user_exchange_keys (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT NOT NULL,
      exchange        TEXT NOT NULL,
      label           TEXT,
      key_prefix      TEXT NOT NULL,
      encrypted_key   TEXT NOT NULL,
      encrypted_secret TEXT NOT NULL,
      encrypted_passphrase TEXT,
      permissions     JSONB,
      last_synced_at  TIMESTAMPTZ,
      last_error      TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, exchange, key_prefix)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_exchange_keys_user ON user_exchange_keys(user_id)`;

  // user_wallets: read-only wallet addresses (DEX position tracking).
  // No private keys ever stored. `chain` is one of 'ethereum', 'arbitrum',
  // 'solana', 'base', 'hyperliquid' (HL is its own L1).
  await sql`
    CREATE TABLE IF NOT EXISTS user_wallets (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      chain       TEXT NOT NULL,
      address     TEXT NOT NULL,
      label       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, chain, address)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_wallets_user ON user_wallets(user_id)`;

  // user_position_alerts: minimal MVP alert rules. One row per (user, kind)
  //   combination — Phase D ships with a single global "funding flip" rule per
  //   user. More granular per-position rules can come later by adding more
  //   `kind` values + a JSONB `params` column.
  //
  //   `last_fired_at` is consulted by the cron to enforce a cooldown so a
  //   user doesn't get spammed every 5 min while funding stays flipped.
  await sql`
    CREATE TABLE IF NOT EXISTS user_position_alerts (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT NOT NULL,
      kind            TEXT NOT NULL,
      enabled         BOOLEAN NOT NULL DEFAULT true,
      channels        TEXT[] NOT NULL DEFAULT ARRAY['telegram'],
      cooldown_min    INT NOT NULL DEFAULT 60,
      last_fired_at   TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, kind)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_alerts_user ON user_position_alerts(user_id)`;

  // user_positions: aggregated open positions, refreshed by the position
  //   sync cron every minute. `source_type` tells us whether the source row
  //   lives in user_exchange_keys (cex) or user_wallets (dex). UPSERT key is
  //   (user_id, source_type, source_id, exchange, symbol, side) so closing
  //   a position deletes its row on the next sync.
  await sql`
    CREATE TABLE IF NOT EXISTS user_positions (
      id                SERIAL PRIMARY KEY,
      user_id           TEXT NOT NULL,
      source_type       TEXT NOT NULL,
      source_id         INT NOT NULL,
      exchange          TEXT NOT NULL,
      symbol            TEXT NOT NULL,
      side              TEXT NOT NULL,
      size              DOUBLE PRECISION NOT NULL,
      entry_price       DOUBLE PRECISION NOT NULL,
      mark_price        DOUBLE PRECISION,
      position_value    DOUBLE PRECISION,
      unrealized_pnl    DOUBLE PRECISION,
      leverage          DOUBLE PRECISION,
      margin_used       DOUBLE PRECISION,
      liquidation_price DOUBLE PRECISION,
      tp_price          DOUBLE PRECISION,
      sl_price          DOUBLE PRECISION,
      cumulative_funding DOUBLE PRECISION,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, source_type, source_id, exchange, symbol, side)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_positions_user ON user_positions(user_id, updated_at DESC)`;

  // user_account_balances: per-source equity snapshot (cash + uPnL +
  //   margin). Refreshed by sync-positions cron via the optional
  //   fetchAccountBalance() method on each exchange/wallet client.
  //   /api/account/positions reads this to compute TRUE equity (not just
  //   per-position margin sum, which understates cross-margin accounts
  //   by the value of their free wallet balance — christian's MEXC
  //   feedback May 2026).
  await sql`
    CREATE TABLE IF NOT EXISTS user_account_balances (
      user_id         TEXT NOT NULL,
      source_type     TEXT NOT NULL,           -- 'cex' | 'dex'
      source_id       INT NOT NULL,            -- FK to user_exchange_keys.id or user_wallets.id
      exchange        TEXT NOT NULL,           -- display label, matches user_positions.exchange
      equity_usd      DOUBLE PRECISION NOT NULL,
      available_usd   DOUBLE PRECISION NOT NULL,
      margin_used_usd DOUBLE PRECISION NOT NULL,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, source_type, source_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_account_balances_user ON user_account_balances(user_id)`;

  // User trade history (Sprint 3 — May 2026).
  // Append-only fill log per connected wallet/key. Powers the Trade Journal,
  // Tax aggregator, and Strategy Backtest tools. Dedup by venue_trade_id —
  // each fill from upstream gets one row, idempotently re-inserted on every
  // sync. Realized PnL is captured ON THE TRADE that closed the position
  // (some venues report it directly, others we compute from fills).
  await sql`
    CREATE TABLE IF NOT EXISTS user_trades (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_type TEXT NOT NULL,        -- 'cex' | 'dex'
      source_id INT NOT NULL,           -- FK to user_wallets.id or user_exchange_keys.id
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      /** 'buy' | 'sell' (CEX) or specific direction tag (DEX) — see venue client. */
      side TEXT NOT NULL,
      /** Direction qualifier for derivatives: 'open' | 'close' | 'reduce' | 'add'. */
      direction TEXT,
      /** Original venue-side fill / trade id; used for dedup. */
      venue_trade_id TEXT NOT NULL,
      size DOUBLE PRECISION NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      value_usd DOUBLE PRECISION NOT NULL,
      fee_usd DOUBLE PRECISION,
      /** Realised PnL in USD if this fill CLOSED part of a position; null on opens. */
      realized_pnl_usd DOUBLE PRECISION,
      ts TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, exchange, venue_trade_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_trades_user_ts ON user_trades(user_id, ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_trades_user_symbol ON user_trades(user_id, symbol, ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_trades_user_exchange ON user_trades(user_id, exchange, ts DESC)`;

  // ─── Bug reports (per-page report button writes here) ──────────────────
  // user_id is nullable so anonymous reports work; everything else is
  // captured automatically by the report widget so users only have to
  // type a description.
  await sql`
    CREATE TABLE IF NOT EXISTS bug_reports (
      id           SERIAL PRIMARY KEY,
      user_id      TEXT,
      user_email   TEXT,
      page_url     TEXT NOT NULL,
      page_title   TEXT,
      user_agent   TEXT,
      viewport     TEXT,
      message      TEXT NOT NULL,
      severity     TEXT NOT NULL DEFAULT 'normal',
      status       TEXT NOT NULL DEFAULT 'open',
      ip_hash      TEXT,
      admin_notes  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at  TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_bug_reports_status_created ON bug_reports(status, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON bug_reports(user_id, created_at DESC)`;

  // ── Auto-tweet event log (May 2026) ──
  // The auto-tweet cron stores every event it detected here. UNIQUE
  // constraint on event_id is the dedup primitive — if the same event
  // is detected on two consecutive ticks, the second INSERT fails
  // silently and we never double-tweet. `posted_at` is null for
  // dry-run rows (no creds / AUTO_TWEET_DRY_RUN=true) so the admin
  // panel can render those distinctly as "queued, would-be-posted".
  await sql`
    CREATE TABLE IF NOT EXISTS auto_tweets (
      id          SERIAL PRIMARY KEY,
      event_id    TEXT UNIQUE NOT NULL,
      event_kind  TEXT NOT NULL,
      symbol      TEXT,
      venue       TEXT,
      value       REAL,
      tweet_text  TEXT NOT NULL,
      posted_at   TIMESTAMPTZ,
      twitter_id  TEXT,
      dry_run     BOOLEAN NOT NULL DEFAULT TRUE,
      error       TEXT,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_auto_tweets_kind_created ON auto_tweets(event_kind, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auto_tweets_created ON auto_tweets(created_at DESC)`;
}

// ─── API Cache (L2 — survives Edge cold starts) ────────────────────────────

export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT data FROM api_cache
      WHERE key = ${key} AND expires_at > NOW()
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    // Handle double-encoded JSON (driver may return jsonb as string)
    const raw = rows[0].data;
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
  } catch (e) {
    console.error('DB getCache error:', e);
    return null;
  }
}

export async function setCache(key: string, data: any, ttlSeconds: number): Promise<void> {
  try {
    const sql = getSQL();
    const jsonData = JSON.stringify(data);
    await sql`
      INSERT INTO api_cache (key, data, expires_at, updated_at)
      VALUES (${key}, ${jsonData}::jsonb, NOW() + ${`${ttlSeconds} seconds`}::interval, NOW())
      ON CONFLICT (key) DO UPDATE
      SET data = ${jsonData}::jsonb,
          expires_at = NOW() + ${`${ttlSeconds} seconds`}::interval,
          updated_at = NOW()
    `;
  } catch (e) {
    console.error('DB setCache error:', e);
  }
}

// ─── Funding Rate Snapshots ─────────────────────────────────────────────────

interface FundingSnapshotEntry {
  symbol: string;
  exchange: string;
  /** Funding rate in PERCENT (e.g. 0.00125 = 0.00125% per native interval).
   *  Pass null on price-only writes (mark-price tracking) — see the
   *  snapshot cron's mark_price block. Rate=0 used to pollute the
   *  "latest funding rate" lookup on /positions. */
  rate: number | null;
  predicted?: number;
  markPrice?: number;
  /** Side-specific rate for skew-based DEXes (GMX V2, gTrade) where longs
   *  and shorts can have different magnitudes due to OI weighting. Null
   *  on symmetric venues (every CEX) — caller should fall back to `rate`. */
  rateShort?: number;
  /** Settlement interval in hours (e.g. 1, 4, 8). When set, /api/account/
   *  positions uses this for the per-position APR projection instead of
   *  falling back to the per-exchange default. Critical for venues that
   *  use different intervals for different symbols (Binance/MEXC have
   *  moved some high-volume perps to 4h while keeping 8h for others). */
  intervalH?: number;
}

export async function saveFundingSnapshot(entries: FundingSnapshotEntry[]): Promise<number> {
  if (entries.length === 0) return 0;
  const sql = getSQL();

  let inserted = 0;
  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500);
    const symbols = chunk.map(e => e.symbol);
    const exchanges = chunk.map(e => e.exchange);
    // Allow null rate on price-only writes (mark_price tracking); was
    // previously stored as 0 which polluted "latest funding rate" lookups.
    const rates = chunk.map(e => (e.rate == null ? null : e.rate));
    const predicteds = chunk.map(e => e.predicted ?? null);
    const markPrices = chunk.map(e => e.markPrice ?? null);
    const rateShorts = chunk.map(e => e.rateShort ?? null);
    const intervalHs = chunk.map(e =>
      e.intervalH != null && Number.isFinite(e.intervalH) && e.intervalH > 0
        ? Math.round(e.intervalH)
        : null,
    );
    await sql`
      INSERT INTO funding_snapshots (symbol, exchange, rate, predicted, mark_price, rate_short, interval_h)
      SELECT * FROM UNNEST(
        ${sql.array(symbols)}::text[],
        ${sql.array(exchanges)}::text[],
        ${sql.array(rates)}::real[],
        ${sql.array(predicteds)}::real[],
        ${sql.array(markPrices)}::real[],
        ${sql.array(rateShorts)}::real[],
        ${sql.array(intervalHs)}::smallint[]
      )`;
    inserted += chunk.length;
  }

  return inserted;
}

// ─── Open Interest Snapshots ────────────────────────────────────────────────

interface OISnapshotEntry {
  symbol: string;
  exchange: string;
  oiUsd: number;
}

export async function saveOISnapshot(entries: OISnapshotEntry[]): Promise<number> {
  if (entries.length === 0) return 0;
  const sql = getSQL();

  let inserted = 0;
  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500);
    const symbols = chunk.map(e => e.symbol);
    const exchanges = chunk.map(e => e.exchange);
    const oiUsds = chunk.map(e => e.oiUsd);
    await sql`
      INSERT INTO oi_snapshots (symbol, exchange, oi_usd)
      SELECT * FROM UNNEST(
        ${sql.array(symbols)}::text[],
        ${sql.array(exchanges)}::text[],
        ${sql.array(oiUsds)}::real[]
      )`;
    inserted += chunk.length;
  }

  return inserted;
}

// ─── Liquidation Snapshots ──────────────────────────────────────────────────

interface LiquidationSnapshotEntry {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  timestamp?: number; // unix ms — defaults to NOW()
}

export async function saveLiquidationSnapshot(entries: LiquidationSnapshotEntry[]): Promise<number> {
  if (entries.length === 0) return 0;
  const sql = getSQL();

  let inserted = 0;
  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500);
    const symbols = chunk.map(e => e.symbol);
    const exchanges = chunk.map(e => e.exchange);
    const sides = chunk.map(e => e.side);
    const prices = chunk.map(e => Math.round(e.price * 100) / 100);
    const quantities = chunk.map(e => e.quantity);
    const valueUsds = chunk.map(e => e.valueUsd);
    const timestamps = chunk.map(e => {
      const rawTs = e.timestamp ? new Date(e.timestamp) : new Date();
      rawTs.setMilliseconds(0);
      return rawTs.toISOString();
    });
    const result = await sql`
      INSERT INTO liquidation_snapshots (symbol, exchange, side, price, quantity, value_usd, ts)
      SELECT * FROM UNNEST(
        ${sql.array(symbols)}::text[],
        ${sql.array(exchanges)}::text[],
        ${sql.array(sides)}::text[],
        ${sql.array(prices)}::real[],
        ${sql.array(quantities)}::real[],
        ${sql.array(valueUsds)}::real[],
        ${sql.array(timestamps)}::timestamptz[]
      )
      ON CONFLICT (symbol, exchange, side, price, ts) DO NOTHING`;
    inserted += result.count ?? chunk.length;
  }

  return inserted;
}

// ─── Liquidation Heatmap Queries ────────────────────────────────────────────

export interface LiquidationRawEvent {
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  ts: number; // unix ms
}

/**
 * Get raw liquidation events for heatmap rendering.
 * <=24h: individual events. >24h: pre-aggregated 30-min buckets.
 */
export async function getLiquidationHeatmapData(
  symbol: string,
  hours: number,
): Promise<LiquidationRawEvent[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;

    if (hours <= 24) {
      const rows = await sql`
        SELECT exchange, side, price, quantity, value_usd,
               EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
        FROM liquidation_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        ORDER BY ts ASC
      `;
      return rows.map((r: any) => ({
        exchange: r.exchange,
        side: r.side as 'long' | 'short',
        price: Number(r.price),
        quantity: Number(r.quantity),
        valueUsd: Number(r.value_usd),
        ts: Number(r.ts_ms),
      }));
    } else {
      // 7d+: aggregate into 30-min buckets to limit row count
      const rows = await sql`
        SELECT
          exchange, side,
          AVG(price) AS price,
          SUM(quantity) AS quantity,
          SUM(value_usd) AS value_usd,
          (FLOOR(EXTRACT(EPOCH FROM ts) / 1800) * 1800 * 1000) AS ts_ms
        FROM liquidation_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        GROUP BY exchange, side, FLOOR(EXTRACT(EPOCH FROM ts) / 1800)
        ORDER BY ts_ms ASC
      `;
      return rows.map((r: any) => ({
        exchange: r.exchange,
        side: r.side as 'long' | 'short',
        price: Number(r.price),
        quantity: Number(r.quantity),
        valueUsd: Number(r.value_usd),
        ts: Number(r.ts_ms),
      }));
    }
  } catch (e) {
    console.error('DB getLiquidationHeatmapData error:', e);
    return [];
  }
}

export interface LiquidationSummaryDB {
  totalCount: number;
  totalVolume: number;
  longVolume: number;
  shortVolume: number;
  largestPrice: number;
  largestVolume: number;
  largestSide: 'long' | 'short';
  largestExchange: string;
  largestTime: number;
}

/**
 * Get aggregate summary statistics for liquidation events in a time window.
 */
export async function getLiquidationSummary(
  symbol: string,
  hours: number,
): Promise<LiquidationSummaryDB | null> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;

    const [stats, largest] = await Promise.all([
      sql`
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(value_usd), 0) AS total_volume,
          COALESCE(SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END), 0) AS long_volume,
          COALESCE(SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END), 0) AS short_volume
        FROM liquidation_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
      `,
      sql`
        SELECT price, value_usd, side, exchange,
               EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
        FROM liquidation_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        ORDER BY value_usd DESC
        LIMIT 1
      `,
    ]);

    if (stats.length === 0) return null;
    const r = stats[0];
    const lg = largest[0];

    return {
      totalCount: Number(r.total_count),
      totalVolume: Number(r.total_volume),
      longVolume: Number(r.long_volume),
      shortVolume: Number(r.short_volume),
      largestPrice: lg ? Number(lg.price) : 0,
      largestVolume: lg ? Number(lg.value_usd) : 0,
      largestSide: lg ? (lg.side as 'long' | 'short') : 'long',
      largestExchange: lg ? lg.exchange : '',
      largestTime: lg ? Number(lg.ts_ms) : 0,
    };
  } catch (e) {
    console.error('DB getLiquidationSummary error:', e);
    return null;
  }
}

/**
 * Get recent liquidation events for the events table.
 */
export async function getRecentLiquidations(
  symbol: string,
  hours: number,
  limit: number = 50,
): Promise<LiquidationRawEvent[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;
    const rows = await sql`
      SELECT exchange, side, price, quantity, value_usd,
             EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
      FROM liquidation_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      ORDER BY ts DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      exchange: r.exchange,
      side: r.side as 'long' | 'short',
      price: Number(r.price),
      quantity: Number(r.quantity),
      valueUsd: Number(r.value_usd),
      ts: Number(r.ts_ms),
    }));
  } catch (e) {
    console.error('DB getRecentLiquidations error:', e);
    return [];
  }
}

/**
 * Get all recent liquidation events across ALL symbols for the feed view.
 * Used by the liquidations page to pre-fill data from DB on load / timeframe change.
 */
export async function getAllRecentLiquidations(
  hours: number,
  limit: number = 500,
): Promise<Array<{
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  ts: number;
}>> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;
    const rows = await sql`
      SELECT symbol, exchange, side, price, quantity, value_usd,
             EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
      FROM liquidation_snapshots
      WHERE ts > NOW() - ${intervalStr}::interval
      ORDER BY ts DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      symbol: r.symbol as string,
      exchange: r.exchange as string,
      side: r.side as 'long' | 'short',
      price: Number(r.price),
      quantity: Number(r.quantity),
      valueUsd: Number(r.value_usd),
      ts: Number(r.ts_ms),
    }));
  } catch (e) {
    console.error('DB getAllRecentLiquidations error:', e);
    return [];
  }
}

/**
 * Get aggregated liquidation data grouped by symbol for treemap visualization.
 * Returns total value, long/short breakdown, and event count per symbol.
 */
export async function getLiquidationTreemap(
  hours: number,
  limit: number = 30,
): Promise<Array<{
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
  count: number;
}>> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;
    const rows = await sql`
      SELECT symbol,
             SUM(value_usd) AS total_value,
             SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END) AS long_value,
             SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END) AS short_value,
             COUNT(*) AS count
      FROM liquidation_snapshots
      WHERE ts > NOW() - ${intervalStr}::interval
      GROUP BY symbol
      HAVING SUM(value_usd) > 0
      ORDER BY total_value DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      symbol: r.symbol as string,
      totalValue: Number(r.total_value),
      longValue: Number(r.long_value),
      shortValue: Number(r.short_value),
      count: Number(r.count),
    }));
  } catch (e) {
    console.error('DB getLiquidationTreemap error:', e);
    return [];
  }
}

/**
 * Get filtered liquidation feed with optional exchange and side filters.
 * Same shape as getAllRecentLiquidations but with additional filter support.
 */
export async function getLiquidationFeedFiltered(
  hours: number,
  limit: number = 200,
  exchange?: string,
  side?: 'long' | 'short',
  symbol?: string,
): Promise<Array<{
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  ts: number;
}>> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;
    const rows = await sql`
      SELECT symbol, exchange, side, price, quantity, value_usd,
             EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
      FROM liquidation_snapshots
      WHERE ts > NOW() - ${intervalStr}::interval
        ${exchange ? sql`AND exchange = ${exchange}` : sql``}
        ${side ? sql`AND side = ${side}` : sql``}
        ${symbol ? sql`AND symbol = ${symbol}` : sql``}
      ORDER BY ts DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      symbol: r.symbol as string,
      exchange: r.exchange as string,
      side: r.side as 'long' | 'short',
      price: Number(r.price),
      quantity: Number(r.quantity),
      valueUsd: Number(r.value_usd),
      ts: Number(r.ts_ms),
    }));
  } catch (e) {
    console.error('DB getLiquidationFeedFiltered error:', e);
    return [];
  }
}

export interface LiquidationHistoryPoint {
  t: number;
  value: number;
  count: number;
  longValue: number;
  shortValue: number;
}

/**
 * Get aggregated liquidation history bucketed by hour.
 * Returns total value, count, long/short breakdown per bucket.
 */
export async function getLiquidationHistory(
  symbol: string,
  days: number = 7,
): Promise<LiquidationHistoryPoint[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT
        EXTRACT(EPOCH FROM date_trunc('hour', ts)) * 1000 AS t,
        SUM(value_usd) AS value,
        COUNT(*) AS count,
        SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END) AS long_value,
        SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END) AS short_value
      FROM liquidation_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      GROUP BY date_trunc('hour', ts)
      ORDER BY t ASC
    `;
    return rows.map((r: any) => ({
      t: Number(r.t),
      value: Number(r.value),
      count: Number(r.count),
      longValue: Number(r.long_value),
      shortValue: Number(r.short_value),
    }));
  } catch (e) {
    console.error('DB getLiquidationHistory error:', e);
    return [];
  }
}

/**
 * Get aggregated liquidation stats per exchange for a symbol.
 */
export async function getLiquidationsByExchange(
  symbol: string,
  days: number = 7,
): Promise<Array<{ exchange: string; value: number; count: number; longValue: number; shortValue: number }>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT
        exchange,
        SUM(value_usd) AS value,
        COUNT(*) AS count,
        SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END) AS long_value,
        SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END) AS short_value
      FROM liquidation_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      GROUP BY exchange
      ORDER BY value DESC
      LIMIT 100
    `;
    return rows.map((r: any) => ({
      exchange: r.exchange,
      value: Number(r.value),
      count: Number(r.count),
      longValue: Number(r.long_value),
      shortValue: Number(r.short_value),
    }));
  } catch (e) {
    console.error('DB getLiquidationsByExchange error:', e);
    return [];
  }
}

/**
 * Get top liquidated symbols by total value.
 */
export async function getTopLiquidatedSymbols(
  days: number = 1,
  limit: number = 20,
): Promise<Array<{ symbol: string; value: number; count: number; longValue: number; shortValue: number }>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT
        symbol,
        SUM(value_usd) AS value,
        COUNT(*) AS count,
        SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END) AS long_value,
        SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END) AS short_value
      FROM liquidation_snapshots
      WHERE ts > NOW() - ${intervalStr}::interval
      GROUP BY symbol
      ORDER BY value DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      symbol: r.symbol,
      value: Number(r.value),
      count: Number(r.count),
      longValue: Number(r.long_value),
      shortValue: Number(r.short_value),
    }));
  } catch (e) {
    console.error('DB getTopLiquidatedSymbols error:', e);
    return [];
  }
}

// ─── Historical Data Queries ────────────────────────────────────────────────

export interface HistoryPoint {
  t: number;
  rate: number;
}

export interface OIHistoryPoint {
  t: number;
  oi: number;
}

export async function getFundingHistory(
  symbol: string,
  exchange?: string,
  days: number = 30
): Promise<HistoryPoint[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    let rows;
    if (exchange) {
      rows = await sql`
        SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, rate
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND exchange = ${exchange}
          AND ts > NOW() - ${intervalStr}::interval
          AND rate IS NOT NULL
          AND rate <> 0
        ORDER BY ts ASC
      `;
    } else {
      // Group by minute — `ts` is microsecond-precision so the previous
      // GROUP BY ts produced one group per row and AVG(rate) just returned
      // each row's own rate (no aggregation actually happened). Funding
      // snapshots come in roughly every minute from many exchanges; this
      // averages across exchanges within each minute window, which is the
      // meaningful "all-exchange average" the caller expects.
      rows = await sql`
        SELECT EXTRACT(EPOCH FROM date_trunc('minute', ts)) * 1000 AS t,
               AVG(rate) AS rate
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
          AND rate IS NOT NULL
          AND rate <> 0
        GROUP BY date_trunc('minute', ts)
        ORDER BY t ASC
      `;
    }
    return rows.map((r: any) => ({ t: Number(r.t), rate: Number(r.rate) }));
  } catch (e) {
    console.error('DB getFundingHistory error:', e);
    return [];
  }
}

/**
 * Bulk fetch daily-average funding rates for multiple symbols over N days.
 * Returns Map<symbol, Array<{ day: string (YYYY-MM-DD), rate: number }>>
 */
export async function getBulkFundingHistory(
  symbols: string[],
  days: number = 7,
): Promise<Map<string, Array<{ day: string; rate: number }>>> {
  const result = new Map<string, Array<{ day: string; rate: number }>>();
  if (symbols.length === 0) return result;

  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT symbol,
             DATE(ts) AS day,
             AVG(rate) AS rate
      FROM funding_snapshots
      WHERE symbol = ANY(${symbols})
        AND ts > NOW() - ${intervalStr}::interval
      GROUP BY symbol, DATE(ts)
      ORDER BY symbol, day
    `;

    rows.forEach((r: any) => {
      const sym = r.symbol as string;
      if (!result.has(sym)) result.set(sym, []);
      result.get(sym)!.push({
        day: String(r.day).slice(0, 10),
        rate: Number(r.rate),
      });
    });
  } catch (e) {
    console.error('DB getBulkFundingHistory error:', e);
  }
  return result;
}

/**
 * Get hourly-bucketed average funding rates for the top N symbols (by snapshot count).
 * Returns { symbol, hour (ISO string), avg_rate }[] sorted by symbol then hour.
 */
export async function getTopFundingHistoryAggregated(
  topN: number = 10,
  days: number = 7,
): Promise<Array<{ symbol: string; hour: string; avg_rate: number }>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      WITH top_symbols AS (
        SELECT symbol
        FROM funding_snapshots
        WHERE ts > NOW() - ${intervalStr}::interval
        GROUP BY symbol
        ORDER BY COUNT(*) DESC
        LIMIT ${topN}
      )
      SELECT
        f.symbol,
        date_trunc('hour', f.ts) AS hour,
        AVG(f.rate) AS avg_rate
      FROM funding_snapshots f
      INNER JOIN top_symbols t ON f.symbol = t.symbol
      WHERE f.ts > NOW() - ${intervalStr}::interval
        AND f.rate IS NOT NULL
        AND f.rate <> 0
      GROUP BY f.symbol, date_trunc('hour', f.ts)
      ORDER BY f.symbol, hour ASC
    `;
    return rows.map((r: any) => ({
      symbol: r.symbol as string,
      hour: new Date(r.hour).toISOString(),
      avg_rate: Number(r.avg_rate),
    }));
  } catch (e) {
    console.error('DB getTopFundingHistoryAggregated error:', e);
    return [];
  }
}

export async function getOIHistory(
  symbol: string,
  days: number = 7
): Promise<OIHistoryPoint[]> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, SUM(oi_usd) AS oi
      FROM oi_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      GROUP BY ts
      ORDER BY ts ASC
      LIMIT 5000
    `;
    return rows.map((r: any) => ({ t: Number(r.t), oi: Number(r.oi) }));
  } catch (e) {
    console.error('DB getOIHistory error:', e);
    return [];
  }
}

// ─── OI Delta Queries ──────────────────────────────────────────────────────

export interface OIDelta {
  symbol: string;
  currentOI: number;
  change1h: number | null;
  change4h: number | null;
  change24h: number | null;
}

/**
 * Get OI deltas by comparing latest snapshot with past snapshots.
 * Returns per-symbol aggregated OI with 1h/4h/24h percentage changes.
 */
export async function getOIDeltas(): Promise<OIDelta[]> {
  try {
    const sql = getSQL();

    // For each (exchange, symbol) pair, pick the LATEST snapshot in each
    // window, then SUM those across exchanges. This is what "total OI" means.
    //
    // Earlier this used SUM(oi_usd) over the entire 12-min window, which
    // counted every cron tick. That's only stable if exchange coverage is
    // identical across all four windows — when it isn't, the SUMs become
    // incomparable, producing fake "+83%" / "+856%" deltas.
    //
    // Earlier-still attempt used a single big UNION ALL CTE with a
    // DISTINCT ON over (window, exchange, symbol) that returned 0 rows in
    // production despite the table having data in every window — the
    // ORDER BY combined with DISTINCT ON inside the nested derived table
    // turned out to be brittle on Neon's Postgres (probably parallel-query
    // related, hard to repro locally). Replaced with explicit per-window
    // subqueries + LEFT JOIN on symbol — slower by a hair but unambiguous.
    const rows = await sql`
      WITH cur AS (
        SELECT symbol, SUM(oi_usd)::float8 AS oi
        FROM (
          SELECT DISTINCT ON (exchange, symbol) exchange, symbol, oi_usd
          FROM oi_snapshots
          WHERE ts >= NOW() - INTERVAL '12 minutes'
          ORDER BY exchange, symbol, ts DESC
        ) latest
        GROUP BY symbol
      ),
      h1 AS (
        SELECT symbol, SUM(oi_usd)::float8 AS oi
        FROM (
          SELECT DISTINCT ON (exchange, symbol) exchange, symbol, oi_usd
          FROM oi_snapshots
          WHERE ts BETWEEN NOW() - INTERVAL '66 minutes' AND NOW() - INTERVAL '54 minutes'
          ORDER BY exchange, symbol, ts DESC
        ) latest
        GROUP BY symbol
      ),
      h4 AS (
        SELECT symbol, SUM(oi_usd)::float8 AS oi
        FROM (
          SELECT DISTINCT ON (exchange, symbol) exchange, symbol, oi_usd
          FROM oi_snapshots
          WHERE ts BETWEEN NOW() - INTERVAL '246 minutes' AND NOW() - INTERVAL '234 minutes'
          ORDER BY exchange, symbol, ts DESC
        ) latest
        GROUP BY symbol
      ),
      h24 AS (
        SELECT symbol, SUM(oi_usd)::float8 AS oi
        FROM (
          SELECT DISTINCT ON (exchange, symbol) exchange, symbol, oi_usd
          FROM oi_snapshots
          WHERE ts BETWEEN NOW() - INTERVAL '1446 minutes' AND NOW() - INTERVAL '1434 minutes'
          ORDER BY exchange, symbol, ts DESC
        ) latest
        GROUP BY symbol
      )
      SELECT
        cur.symbol,
        cur.oi AS current_oi,
        COALESCE(h1.oi, 0)  AS oi_1h,
        COALESCE(h4.oi, 0)  AS oi_4h,
        COALESCE(h24.oi, 0) AS oi_24h
      FROM cur
      LEFT JOIN h1  ON cur.symbol = h1.symbol
      LEFT JOIN h4  ON cur.symbol = h4.symbol
      LEFT JOIN h24 ON cur.symbol = h24.symbol
      WHERE cur.oi > 0
      ORDER BY cur.oi DESC
    `;

    return rows.map((r: any) => {
      const current = Number(r.current_oi);
      const h1 = Number(r.oi_1h);
      const h4v = Number(r.oi_4h);
      const h24 = Number(r.oi_24h);
      return {
        symbol: r.symbol,
        currentOI: current,
        change1h: h1 > 0 ? ((current - h1) / h1 * 100) : null,
        change4h: h4v > 0 ? ((current - h4v) / h4v * 100) : null,
        change24h: h24 > 0 ? ((current - h24) / h24 * 100) : null,
      };
    });
  } catch (e) {
    console.error('DB getOIDeltas error:', e);
    return [];
  }
}

// ─── Data Pruning ───────────────────────────────────────────────────────────

export async function pruneOldData(keepDays: number = 90): Promise<{ funding: number; oi: number; liquidations: number }> {
  try {
    const sql = getSQL();
    const intervalStr = `${keepDays} days`;

    const fr = await sql`
      DELETE FROM funding_snapshots WHERE ts < NOW() - ${intervalStr}::interval
    `;
    const oi = await sql`
      DELETE FROM oi_snapshots WHERE ts < NOW() - ${intervalStr}::interval
    `;
    const liq = await sql`
      DELETE FROM liquidation_snapshots WHERE ts < NOW() - ${intervalStr}::interval
    `;

    // Also clean expired cache entries and stale auth codes
    await sql`DELETE FROM api_cache WHERE expires_at < NOW()`;
    await sql`DELETE FROM email_verification_codes WHERE expires_at < NOW()`.catch(e => console.warn('[db] email_verification cleanup:', e));
    await sql`DELETE FROM twofa_login_codes WHERE expires_at < NOW()`.catch(e => console.warn('[db] twofa_login cleanup:', e));
    await sql`DELETE FROM rate_limit_events WHERE created_at < NOW() - INTERVAL '1 day'`.catch(e => console.warn('[db] rate_limit cleanup:', e));

    return {
      funding: fr.count ?? 0,
      oi: oi.count ?? 0,
      liquidations: liq.count ?? 0,
    };
  } catch (e) {
    console.error('DB pruneOldData error:', e);
    return { funding: 0, oi: 0, liquidations: 0 };
  }
}

// ─── User Data (synced localStorage data) ──────────────────────────────────

export interface NotificationPrefs {
  email: boolean;
  cooldownMinutes: number;
  discordWebhookUrl?: string;  // Discord webhook URL for alert delivery
  discordEnabled?: boolean;     // Toggle discord notifications
  whatsappPhone?: string;       // WhatsApp phone number (E.164 format)
  whatsappEnabled?: boolean;    // Toggle WhatsApp notifications
  /** Daily market-digest email (rolling summary of fired alerts +
   *  any movement of interest). Off by default; opt-in. */
  emailDailyDigest?: boolean;
  /** Email backup if Telegram delivery is failing — sends the same
   *  alert to the user's email so a broken bot link doesn't drop pings. */
  emailAlertBackup?: boolean;
  /** Whale-tier custom HTTPS webhook target. URL + HMAC secret are
   *  set via PUT /api/account/webhook (tier-gated to whale). The
   *  alerts cron POSTs signed payloads here for every fired alert
   *  when the rule has 'webhook' in its channels list. */
  webhook?: {
    url: string;
    secret: string;
    createdAt: string;
  };
}

export interface FundingPrefs {
  cellColors?: boolean;       // true = colored bg fills, false = text-only (default: false)
  gridSpacing?: 'compact' | 'normal' | 'spacious';  // default: 'normal'
  hiddenExchanges?: string[]; // exchanges to hide from heatmap grid
  fontSize?: 'small' | 'medium' | 'large';  // default: 'medium'
  showPredicted?: boolean;    // always show predicted next rate (default: false — only on hover)
  showLongShort?: boolean;    // show L/S breakdown when available (default: true)
  showAccumulated?: boolean;  // show 7D accumulated funding in symbol column (default: true)
}

export interface UserData {
  watchlist?: string[];
  portfolio?: any[];
  alerts?: any[];
  screenerPresets?: any[];
  wallets?: any[];
  notificationPrefs?: NotificationPrefs;
  theme?: string;
  fundingPrefs?: FundingPrefs;
  bio?: string;
  displayPrefs?: { currency?: string; defaultExchange?: string; fundingDisplay?: string };
  dashboardLayout?: any[];
}

export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT prefs FROM user_prefs WHERE user_id = ${userId}
    `;
    if (rows.length === 0) return null;
    let prefs = rows[0].prefs;
    // Guard against JSONB string scalars (double-encoded) or corrupted data
    if (typeof prefs === 'string') {
      try { prefs = JSON.parse(prefs); } catch { return null; }
    }
    // Guard against character-exploded objects (keys like "0","1","2"...)
    if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
      const keys = Object.keys(prefs);
      if (keys.length > 100 && keys.every(k => /^\d+$/.test(k))) {
        console.warn('getUserData: detected corrupted char-exploded prefs for', userId);
        return null;
      }
    }
    return prefs as UserData;
  } catch (e) {
    console.error('DB getUserData error:', e);
    return null;
  }
}

export async function setUserData(userId: string, data: UserData): Promise<void> {
  try {
    const sql = getSQL();
    const jsonData = JSON.stringify(data);
    await sql`
      INSERT INTO user_prefs (user_id, prefs, updated_at)
      VALUES (${userId}, ${jsonData}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET prefs = ${jsonData}::jsonb,
          updated_at = NOW()
    `;
  } catch (e) {
    console.error('DB setUserData error:', e);
  }
}

// ─── Telegram Radar Bot — link codes + linked accounts ─────────────────────

async function initTelegramTables(): Promise<void> {
  const sql = getSQL();

  // Linked Telegram accounts (chat_id ↔ user_id)
  await sql`
    CREATE TABLE IF NOT EXISTS telegram_links (
      chat_id BIGINT PRIMARY KEY,
      user_id TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      muted_until TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tg_links_user ON telegram_links (user_id)`;

  // Temporary link codes (expire after 10 min)
  await sql`
    CREATE TABLE IF NOT EXISTS telegram_link_codes (
      code TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;

  // Hub bot v2 AI-chat experiment was reverted (May 2026). The
  // telegram_conversations + bot_trade_ideas tables and the
  // idea_notifications column on telegram_links are intentionally NOT
  // dropped here — leaving them with no writers is safe and avoids a
  // destructive migration during the rollback. They can be dropped
  // manually later via:
  //   DROP TABLE IF EXISTS telegram_conversations;
  //   DROP TABLE IF EXISTS bot_trade_ideas;
  //   ALTER TABLE telegram_links DROP COLUMN IF EXISTS idea_notifications;
}

// No longer needed — replaced by telegram_links
async function initTelegramAlertTables(): Promise<void> {}

export interface TelegramLink {
  chat_id: number;
  user_id: string;
  active: boolean;
  muted_until: Date | null;
}

/** Create a link code for a logged-in user (expires in 10 min). */
export async function createTelegramLinkCode(userId: string, code: string): Promise<void> {
  try {
    const sql = getSQL();
    // Remove any existing codes for this user first
    await sql`DELETE FROM telegram_link_codes WHERE user_id = ${userId}`;
    await sql`
      INSERT INTO telegram_link_codes (code, user_id, expires_at)
      VALUES (${code}, ${userId}, NOW() + INTERVAL '10 minutes')
    `;
  } catch (e) {
    console.error('DB createTelegramLinkCode error:', e);
  }
}

/** Verify and consume a link code. Returns user_id if valid, null if expired/invalid. */
export async function consumeTelegramLinkCode(code: string): Promise<string | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      DELETE FROM telegram_link_codes
      WHERE code = ${code} AND expires_at > NOW()
      RETURNING user_id
    `;
    return rows.length > 0 ? rows[0].user_id : null;
  } catch (e) {
    console.error('DB consumeTelegramLinkCode error:', e);
    return null;
  }
}

/** Link a Telegram chat_id to a user_id. */
export async function linkTelegramChat(chatId: number, userId: string): Promise<void> {
  try {
    const sql = getSQL();
    await sql`
      INSERT INTO telegram_links (chat_id, user_id, active, created_at)
      VALUES (${chatId}, ${userId}, true, NOW())
      ON CONFLICT (chat_id) DO UPDATE SET
        user_id = ${userId}, active = true, muted_until = NULL
    `;
  } catch (e) {
    console.error('DB linkTelegramChat error:', e);
  }
}

/** Unlink / deactivate a Telegram chat. */
export async function unlinkTelegramChat(chatId: number): Promise<void> {
  try {
    const sql = getSQL();
    await sql`UPDATE telegram_links SET active = false WHERE chat_id = ${chatId}`;
  } catch (e) {
    console.error('DB unlinkTelegramChat error:', e);
  }
}

/** Reactivate a previously stopped chat. */
export async function reactivateTelegramChat(chatId: number): Promise<boolean> {
  try {
    const sql = getSQL();
    const rows = await sql`
      UPDATE telegram_links SET active = true, muted_until = NULL
      WHERE chat_id = ${chatId}
      RETURNING chat_id
    `;
    return rows.length > 0;
  } catch (e) {
    console.error('DB reactivateTelegramChat error:', e);
    return false;
  }
}

/** Mute a chat until a specific time. */
export async function muteTelegramChat(chatId: number, until: Date): Promise<void> {
  try {
    const sql = getSQL();
    await sql`UPDATE telegram_links SET muted_until = ${until} WHERE chat_id = ${chatId}`;
  } catch (e) {
    console.error('DB muteTelegramChat error:', e);
  }
}

/** Clear mute without changing active status. */
export async function unmuteTelegramChat(chatId: number): Promise<void> {
  try {
    const sql = getSQL();
    await sql`UPDATE telegram_links SET muted_until = NULL WHERE chat_id = ${chatId}`;
  } catch (e) {
    console.error('DB unmuteTelegramChat error:', e);
  }
}

/** Get a linked Telegram chat by chat_id. */
export async function getTelegramLink(chatId: number): Promise<TelegramLink | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT chat_id, user_id, active, muted_until
      FROM telegram_links WHERE chat_id = ${chatId}
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      chat_id: Number(r.chat_id),
      user_id: r.user_id,
      active: Boolean(r.active),
      muted_until: r.muted_until ? new Date(r.muted_until) : null,
    };
  } catch (e) {
    console.error('DB getTelegramLink error:', e);
    return null;
  }
}

/** Get a linked Telegram chat by user_id. */
export async function getTelegramLinkByUser(userId: string): Promise<TelegramLink | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT chat_id, user_id, active, muted_until
      FROM telegram_links WHERE user_id = ${userId}
      ORDER BY active DESC, created_at DESC
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      chat_id: Number(r.chat_id),
      user_id: r.user_id,
      active: Boolean(r.active),
      muted_until: r.muted_until ? new Date(r.muted_until) : null,
    };
  } catch (e) {
    console.error('DB getTelegramLinkByUser error:', e);
    return null;
  }
}

/** Get all active, unmuted Telegram links (for alert delivery). */
export async function getActiveTelegramLinks(): Promise<TelegramLink[]> {
  try {
    const sql = getSQL();
    // LIMIT 10000 — used to fan out per-alert notifications. Without
    // a cap this scales linearly with linked-account count.
    const rows = await sql`
      SELECT chat_id, user_id, active, muted_until
      FROM telegram_links
      WHERE active = true
        AND (muted_until IS NULL OR muted_until < NOW())
      LIMIT 10000
    `;
    return rows.map((r: any) => ({
      chat_id: Number(r.chat_id),
      user_id: r.user_id,
      active: true,
      muted_until: r.muted_until ? new Date(r.muted_until) : null,
    }));
  } catch (e) {
    console.error('DB getActiveTelegramLinks error:', e);
    return [];
  }
}

/** Get all active Telegram chat IDs (for broadcast). */
export async function getAllActiveTelegramChatIds(): Promise<number[]> {
  try {
    const sql = getSQL();
    const rows = await sql`SELECT chat_id FROM telegram_links WHERE active = true LIMIT 10000`;
    return rows.map((r: any) => Number(r.chat_id));
  } catch (e) {
    console.error('DB getAllActiveTelegramChatIds error:', e);
    return [];
  }
}

/** Prune expired link codes. */
export async function pruneExpiredLinkCodes(): Promise<void> {
  try {
    const sql = getSQL();
    await sql`DELETE FROM telegram_link_codes WHERE expires_at < NOW()`;
  } catch (e) {
    console.error('DB pruneExpiredLinkCodes error:', e);
  }
}

// ─── Alert Notification Functions ────────────────────────────────────────────

export interface AlertUserRow {
  userId: string;
  email: string;
  alerts: any[];
  notificationPrefs?: NotificationPrefs;
}

/**
 * Get all users who have enabled alerts in their prefs JSONB.
 */
export async function getAllUsersWithAlerts(): Promise<AlertUserRow[]> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT
        up.user_id,
        u.email,
        up.prefs->'alerts' AS alerts,
        up.prefs->'notificationPrefs' AS notification_prefs
      FROM user_prefs up
      JOIN users u ON up.user_id = u.id
      WHERE jsonb_array_length(COALESCE(up.prefs->'alerts', '[]'::jsonb)) > 0
    `;
    // postgres.js sometimes returns JSONB columns as strings instead of
    // parsed objects. The alert cron iterates `alerts` directly — if it
    // gets a string back, `.length` returns the character count and
    // every index access is undefined → silent failure of every alert
    // fire path. Parse defensively (matches the pattern in getUserData).
    const parseJsonb = (raw: unknown) => {
      if (raw == null) return raw;
      if (typeof raw !== 'string') return raw;
      try { return JSON.parse(raw); } catch { return null; }
    };
    return rows.map((r: any) => ({
      userId: r.user_id,
      email: r.email,
      alerts: (Array.isArray(parseJsonb(r.alerts)) ? parseJsonb(r.alerts) : []) as any[],
      notificationPrefs: parseJsonb(r.notification_prefs) as NotificationPrefs | undefined,
    }));
  } catch (e) {
    console.error('DB getAllUsersWithAlerts error:', e);
    return [];
  }
}

/**
 * Check if an alert notification was sent within the cooldown window.
 */
export async function getAlertCooldown(
  userId: string,
  alertId: string,
  cooldownMinutes: number = 60,
  channel?: string,
): Promise<boolean> {
  try {
    const sql = getSQL();
    const intervalStr = `${cooldownMinutes} minutes`;
    // When channel is specified, only check cooldown for that specific channel.
    // This prevents a successful email from blocking a failed Discord retry.
    const rows = channel
      ? await sql`
          SELECT 1 FROM alert_notifications
          WHERE user_id = ${userId}
            AND alert_id = ${alertId}
            AND channel = ${channel}
            AND sent_at > NOW() - ${intervalStr}::interval
          LIMIT 1
        `
      : await sql`
          SELECT 1 FROM alert_notifications
          WHERE user_id = ${userId}
            AND alert_id = ${alertId}
            AND sent_at > NOW() - ${intervalStr}::interval
          LIMIT 1
        `;
    return rows.length > 0;
  } catch (e) {
    console.error('DB getAlertCooldown error:', e);
    return true; // fail closed — assume in cooldown
  }
}

/**
 * Log a sent alert notification.
 */
export async function logAlertNotification(
  userId: string,
  alertId: string,
  symbol: string,
  metric: string,
  threshold: number,
  actualValue: number,
  channel: string,
): Promise<void> {
  try {
    const sql = getSQL();
    await sql`
      INSERT INTO alert_notifications (user_id, alert_id, symbol, metric, threshold, actual_value, channel)
      VALUES (${userId}, ${alertId}, ${symbol}, ${metric}, ${threshold}, ${actualValue}, ${channel})
    `;
  } catch (e) {
    console.error('DB logAlertNotification error:', e);
  }
}

/**
 * Clean up old alert notifications (keep 30 days).
 */
export async function pruneAlertNotifications(): Promise<number> {
  try {
    const sql = getSQL();
    const result = await sql`
      DELETE FROM alert_notifications WHERE sent_at < NOW() - INTERVAL '30 days'
    `;
    return result.count ?? 0;
  } catch (e) {
    console.error('DB pruneAlertNotifications error:', e);
    return 0;
  }
}

// ─── User Account Stats ─────────────────────────────────────────────────────

/**
 * Get user creation date from the users table.
 */
export async function getUserCreatedAt(userId: string): Promise<string | null> {
  try {
    const sql = getSQL();
    // NextAuth users table may not have created_at — use email_verified as fallback
    const rows = await sql`
      SELECT COALESCE(
        TO_CHAR(email_verified, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ) AS created_at
      FROM users WHERE id = ${userId}
    `;
    return rows[0]?.created_at || null;
  } catch (e) {
    console.error('DB getUserCreatedAt error:', e);
    return null;
  }
}

/**
 * Get recent alert notification history for a user.
 */
export async function getRecentAlertNotifications(
  userId: string,
  limit: number = 10,
): Promise<Array<{
  symbol: string;
  metric: string;
  threshold: number;
  actualValue: number;
  channel: string;
  sentAt: string;
}>> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT symbol, metric, threshold, actual_value, channel,
             TO_CHAR(sent_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS sent_at
      FROM alert_notifications
      WHERE user_id = ${userId}
      ORDER BY sent_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      symbol: r.symbol,
      metric: r.metric,
      threshold: Number(r.threshold),
      actualValue: Number(r.actual_value),
      channel: r.channel,
      sentAt: r.sent_at,
    }));
  } catch (e) {
    console.error('DB getRecentAlertNotifications error:', e);
    return [];
  }
}

/**
 * Get OAuth providers connected to a user account.
 */
export async function getUserConnectedProviders(userId: string): Promise<string[]> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT DISTINCT provider FROM accounts WHERE user_id = ${userId} LIMIT 50
    `;
    return rows.map((r: any) => r.provider as string);
  } catch (e) {
    console.error('DB getUserConnectedProviders error:', e);
    return [];
  }
}

// ─── Push Subscriptions ──────────────────────────────────────────────────────

export async function getPushSubscriptionsForUser(
  userId: string,
): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId} LIMIT 100
    `;
    return rows as any[];
  } catch (e) {
    console.error('DB getPushSubscriptions error:', e);
    return [];
  }
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  try {
    const sql = getSQL();
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
  } catch (e) {
    console.error('DB deletePushSubscription error:', e);
  }
}

// ─── Multi-Exchange Funding History ─────────────────────────────────────────

export interface ExchangeHistoryPoint {
  t: number;
  rate: number;
}

/**
 * Get funding history for all exchanges that traded a symbol.
 * For >7 days, buckets into hourly averages to reduce data points.
 */
export async function getFundingHistoryMulti(
  symbol: string,
  days: number = 7,
): Promise<Record<string, ExchangeHistoryPoint[]>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    let rows;

    if (days > 7) {
      rows = await sql`
        SELECT exchange,
               EXTRACT(EPOCH FROM date_trunc('hour', ts)) * 1000 AS t,
               AVG(rate) AS rate
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        GROUP BY exchange, date_trunc('hour', ts)
        ORDER BY exchange, t ASC
      `;
    } else {
      rows = await sql`
        SELECT exchange,
               EXTRACT(EPOCH FROM ts) * 1000 AS t,
               rate
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND ts > NOW() - ${intervalStr}::interval
        ORDER BY exchange, ts ASC
      `;
    }

    const result: Record<string, ExchangeHistoryPoint[]> = {};
    rows.forEach((r: any) => {
      const ex = r.exchange as string;
      if (!result[ex]) result[ex] = [];
      result[ex].push({ t: Number(r.t), rate: Number(r.rate) });
    });
    return result;
  } catch (e) {
    console.error('DB getFundingHistoryMulti error:', e);
    return {};
  }
}

/**
 * Get mark price history per exchange for a symbol.
 * For >7 days, buckets into hourly averages to reduce data points.
 */
export async function getPriceHistoryMulti(
  symbol: string,
  days: number = 7,
): Promise<Record<string, { t: number; price: number }[]>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    let rows;

    if (days > 7) {
      rows = await sql`
        SELECT exchange,
               EXTRACT(EPOCH FROM date_trunc('hour', ts)) * 1000 AS t,
               AVG(mark_price) AS price
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND mark_price IS NOT NULL AND mark_price > 0
          AND ts > NOW() - ${intervalStr}::interval
        GROUP BY exchange, date_trunc('hour', ts)
        ORDER BY exchange, t ASC
      `;
    } else {
      rows = await sql`
        SELECT exchange,
               EXTRACT(EPOCH FROM ts) * 1000 AS t,
               mark_price AS price
        FROM funding_snapshots
        WHERE symbol = ${symbol}
          AND mark_price IS NOT NULL AND mark_price > 0
          AND ts > NOW() - ${intervalStr}::interval
        ORDER BY exchange, ts ASC
      `;
    }

    const result: Record<string, { t: number; price: number }[]> = {};
    rows.forEach((r: any) => {
      const ex = r.exchange as string;
      if (!result[ex]) result[ex] = [];
      result[ex].push({ t: Number(r.t), price: Number(r.price) });
    });
    return result;
  } catch (e) {
    console.error('DB getPriceHistoryMulti error:', e);
    return {};
  }
}

/**
 * Get OI history per exchange for a symbol.
 */
export async function getOIHistoryMulti(
  symbol: string,
  days: number = 7,
): Promise<Record<string, Array<{ t: number; oi: number }>>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = await sql`
      SELECT exchange,
             EXTRACT(EPOCH FROM ts) * 1000 AS t,
             oi_usd AS oi
      FROM oi_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${intervalStr}::interval
      ORDER BY exchange, ts ASC
      LIMIT 50000
    `;
    const result: Record<string, Array<{ t: number; oi: number }>> = {};
    rows.forEach((r: any) => {
      const ex = r.exchange as string;
      if (!result[ex]) result[ex] = [];
      result[ex].push({ t: Number(r.t), oi: Number(r.oi) });
    });
    return result;
  } catch (e) {
    console.error('DB getOIHistoryMulti error:', e);
    return {};
  }
}

// ─── Portfolio Snapshots ────────────────────────────────────────────────────

export async function savePortfolioSnapshot(
  userId: string,
  totalValue: number,
  totalPnl: number,
  holdings: any[],
): Promise<void> {
  try {
    const sql = getSQL();
    const holdingsJson = JSON.stringify(holdings);
    await sql`
      INSERT INTO portfolio_snapshots (user_id, total_value, total_pnl, holdings)
      VALUES (${userId}, ${totalValue}, ${totalPnl}, ${holdingsJson}::jsonb)
    `;
  } catch (e) {
    console.error('DB savePortfolioSnapshot error:', e);
  }
}

export async function getPortfolioHistory(
  userId: string,
  days: number = 30,
): Promise<Array<{ t: number; value: number; pnl: number }>> {
  try {
    const sql = getSQL();
    // Hard cap on `days` — the daily snapshot cron writes one row per
    // user per day so 5000 days is decades. Without this an API caller
    // passing days=999999 would scan the entire user partition.
    const safeDays = Math.min(Math.max(1, Math.floor(days)), 5000);
    const intervalStr = `${safeDays} days`;
    const rows = await sql`
      SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, total_value, total_pnl
      FROM portfolio_snapshots
      WHERE user_id = ${userId}
        AND ts > NOW() - ${intervalStr}::interval
      ORDER BY ts ASC
      LIMIT 5000
    `;
    return rows.map((r: any) => ({
      t: Number(r.t),
      value: Number(r.total_value),
      pnl: Number(r.total_pnl),
    }));
  } catch (e) {
    console.error('DB getPortfolioHistory error:', e);
    return [];
  }
}

/**
 * Get all users with portfolio holdings for snapshotting.
 */
export async function getUsersWithPortfolios(): Promise<Array<{ userId: string; portfolio: any[] }>> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT user_id, prefs->'portfolio' AS portfolio
      FROM user_prefs
      WHERE jsonb_array_length(COALESCE(prefs->'portfolio', '[]'::jsonb)) > 0
    `;
    return rows.map((r: any) => ({
      userId: r.user_id,
      portfolio: (r.portfolio ?? []) as any[],
    }));
  } catch (e) {
    console.error('DB getUsersWithPortfolios error:', e);
    return [];
  }
}

// ─── Admin Monitoring ────────────────────────────────────────────────────────

export async function getCollectorHealth(): Promise<{
  lastFunding: string | null;
  lastOI: string | null;
  lastLiq: string | null;
  avgIntervalMin: number | null;
  last24h: { funding: number; oi: number; liq: number };
}> {
  try {
    const db = getSQL();
    const [timestamps, funding24, oi24, liq24, intervals] = await Promise.all([
      db`SELECT
        (SELECT MAX(ts) FROM funding_snapshots) AS last_funding,
        (SELECT MAX(ts) FROM oi_snapshots) AS last_oi,
        (SELECT MAX(ts) FROM liquidation_snapshots) AS last_liq`,
      db`SELECT COUNT(*) AS c FROM funding_snapshots WHERE ts > NOW() - INTERVAL '24 hours'`,
      db`SELECT COUNT(*) AS c FROM oi_snapshots WHERE ts > NOW() - INTERVAL '24 hours'`,
      db`SELECT COUNT(*) AS c FROM liquidation_snapshots WHERE ts > NOW() - INTERVAL '24 hours'`,
      db`SELECT AVG(gap) AS avg_gap FROM (
        SELECT EXTRACT(EPOCH FROM ts - LAG(ts) OVER (ORDER BY ts)) AS gap
        FROM (SELECT DISTINCT ts FROM funding_snapshots ORDER BY ts DESC LIMIT 20) sub
      ) gaps WHERE gap IS NOT NULL AND gap > 0 AND gap < 7200`,
    ]);
    return {
      lastFunding: timestamps[0].last_funding?.toISOString() ?? null,
      lastOI: timestamps[0].last_oi?.toISOString() ?? null,
      lastLiq: timestamps[0].last_liq?.toISOString() ?? null,
      avgIntervalMin: intervals[0].avg_gap ? Math.round(Number(intervals[0].avg_gap) / 60 * 10) / 10 : null,
      last24h: {
        funding: Number(funding24[0].c),
        oi: Number(oi24[0].c),
        liq: Number(liq24[0].c),
      },
    };
  } catch (e) {
    console.error('DB getCollectorHealth error:', e);
    return { lastFunding: null, lastOI: null, lastLiq: null, avgIntervalMin: null, last24h: { funding: 0, oi: 0, liq: 0 } };
  }
}

export async function getAlertHealthMetrics(): Promise<{
  today: { total: number; email: number; push: number; telegram: number; uniqueUsers: number; uniqueSymbols: number };
  last7d: Array<{ date: string; fired: number; email: number; push: number; telegram: number }>;
  topSymbols: Array<{ symbol: string; count: number }>;
  topUsers: Array<{ userId: string; email: string; count: number }>;
  config: { usersWithAlerts: number; enabledAlerts: number; telegramAlerts: number; byMetric: Record<string, number> };
}> {
  try {
    const db = getSQL();
    const [todayByChannel, todayUnique, daily, topSym, topUsr, alertConfig, tgAlertCount] = await Promise.all([
      db`SELECT channel, COUNT(*) AS c FROM alert_notifications WHERE sent_at > CURRENT_DATE GROUP BY channel`,
      db`SELECT COUNT(DISTINCT user_id) AS users, COUNT(DISTINCT symbol) AS symbols FROM alert_notifications WHERE sent_at > CURRENT_DATE`,
      db`SELECT DATE(sent_at) AS day, COUNT(*) AS total,
        COUNT(*) FILTER (WHERE channel='email') AS email,
        COUNT(*) FILTER (WHERE channel='push') AS push,
        COUNT(*) FILTER (WHERE channel='telegram') AS telegram
        FROM alert_notifications WHERE sent_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(sent_at) ORDER BY day`,
      db`SELECT symbol, COUNT(*) AS c FROM alert_notifications WHERE sent_at > CURRENT_DATE GROUP BY symbol ORDER BY c DESC LIMIT 10`,
      db`SELECT an.user_id, COALESCE(u.email, an.user_id) AS email, COUNT(*) AS c
        FROM alert_notifications an LEFT JOIN users u ON an.user_id = u.id
        WHERE an.sent_at > CURRENT_DATE GROUP BY an.user_id, u.email ORDER BY c DESC LIMIT 10`,
      db`SELECT
        COUNT(DISTINCT user_id) AS users_with_alerts,
        SUM(jsonb_array_length(COALESCE(prefs->'alerts','[]'::jsonb))) AS total_alerts
        FROM user_prefs WHERE jsonb_array_length(COALESCE(prefs->'alerts','[]'::jsonb)) > 0`,
      db`SELECT COUNT(*) AS c FROM telegram_links WHERE active = true`.catch(() => [{ c: 0 }]),
    ]);

    const channelMap: Record<string, number> = {};
    for (const r of todayByChannel) channelMap[r.channel] = Number(r.c);
    const todayTotal = Object.values(channelMap).reduce((a, b) => a + b, 0);

    // Get alert metric breakdown from user_prefs
    let byMetric: Record<string, number> = {};
    try {
      const metricRows = await db`
        SELECT m->>'metric' AS metric, COUNT(*) AS c
        FROM user_prefs, jsonb_array_elements(COALESCE(prefs->'alerts','[]'::jsonb)) AS m
        WHERE (m->>'enabled')::boolean = true
        GROUP BY m->>'metric'`;
      for (const r of metricRows) byMetric[r.metric] = Number(r.c);
    } catch { /* jsonb query may fail if no alerts */ }

    return {
      today: {
        total: todayTotal,
        email: channelMap['email'] || 0,
        push: channelMap['push'] || 0,
        telegram: channelMap['telegram'] || 0,
        uniqueUsers: Number(todayUnique[0].users),
        uniqueSymbols: Number(todayUnique[0].symbols),
      },
      last7d: daily.map((r: any) => ({
        date: r.day instanceof Date ? r.day.toISOString().split('T')[0] : String(r.day),
        fired: Number(r.total),
        email: Number(r.email),
        push: Number(r.push),
        telegram: Number(r.telegram),
      })),
      topSymbols: topSym.map((r: any) => ({ symbol: r.symbol, count: Number(r.c) })),
      topUsers: topUsr.map((r: any) => ({ userId: r.user_id, email: r.email, count: Number(r.c) })),
      config: {
        usersWithAlerts: Number(alertConfig[0].users_with_alerts),
        enabledAlerts: Number(alertConfig[0].total_alerts || 0),
        telegramAlerts: Number(tgAlertCount[0].c),
        byMetric,
      },
    };
  } catch (e) {
    console.error('DB getAlertHealthMetrics error:', e);
    return {
      today: { total: 0, email: 0, push: 0, telegram: 0, uniqueUsers: 0, uniqueSymbols: 0 },
      last7d: [], topSymbols: [], topUsers: [],
      config: { usersWithAlerts: 0, enabledAlerts: 0, telegramAlerts: 0, byMetric: {} },
    };
  }
}

export async function getDatabaseMetrics(): Promise<{
  currentSize: string;
  currentSizeBytes: number;
  tables: Array<{ name: string; rowCount: number; sizeBytes: number; sizePretty: string }>;
  growthRate: { fundingPerDay: number; oiPerDay: number; liqPerDay: number };
  sizeHistory: Array<{ date: string; sizeBytes: number }>;
}> {
  try {
    const db = getSQL();
    const [dbSize, tableSizes, growth, history] = await Promise.all([
      db`SELECT pg_database_size(current_database()) AS size_bytes,
        pg_size_pretty(pg_database_size(current_database())) AS size_pretty`,
      db`SELECT relname AS table_name,
        n_live_tup AS row_count,
        pg_total_relation_size(schemaname || '.' || relname) AS size_bytes,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS size_pretty
        FROM pg_stat_user_tables WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname || '.' || relname) DESC`,
      db`SELECT 'funding' AS type, COUNT(*)::float / GREATEST(1, EXTRACT(EPOCH FROM NOW() - MIN(ts)) / 86400) AS per_day
        FROM funding_snapshots WHERE ts > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT 'oi', COUNT(*)::float / GREATEST(1, EXTRACT(EPOCH FROM NOW() - MIN(ts)) / 86400)
        FROM oi_snapshots WHERE ts > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT 'liq', COUNT(*)::float / GREATEST(1, EXTRACT(EPOCH FROM NOW() - MIN(ts)) / 86400)
        FROM liquidation_snapshots WHERE ts > NOW() - INTERVAL '7 days'`,
      db`SELECT recorded_at::date AS date, value AS size_bytes
        FROM admin_monitoring WHERE metric = 'db_size'
        ORDER BY recorded_at DESC LIMIT 30`.catch(() => []),
    ]);

    const growthMap: Record<string, number> = {};
    for (const r of growth) growthMap[r.type] = Math.round(Number(r.per_day));

    return {
      currentSize: dbSize[0].size_pretty,
      currentSizeBytes: Number(dbSize[0].size_bytes),
      tables: tableSizes.map((r: any) => ({
        name: r.table_name,
        rowCount: Number(r.row_count),
        sizeBytes: Number(r.size_bytes),
        sizePretty: r.size_pretty,
      })),
      growthRate: {
        fundingPerDay: growthMap['funding'] || 0,
        oiPerDay: growthMap['oi'] || 0,
        liqPerDay: growthMap['liq'] || 0,
      },
      sizeHistory: (history as any[]).map((r: any) => ({
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
        sizeBytes: Number(r.size_bytes),
      })),
    };
  } catch (e) {
    console.error('DB getDatabaseMetrics error:', e);
    return { currentSize: 'unknown', currentSizeBytes: 0, tables: [], growthRate: { fundingPerDay: 0, oiPerDay: 0, liqPerDay: 0 }, sizeHistory: [] };
  }
}

export async function recordAdminMetric(metric: string, value: number): Promise<void> {
  try {
    const db = getSQL();
    await db`INSERT INTO admin_monitoring (metric, value) VALUES (${metric}, ${value})`;
  } catch (e) {
    console.error('DB recordAdminMetric error:', e);
  }
}

/**
 * Prune old wallet-watch data so the events table doesn't grow
 * unboundedly. With 1 wallet × 60s ticks × 6 trigger types the worst-
 * case is ~1500 rows/day per active user; a 90-day retention window
 * is plenty for "show me what fired this quarter" while keeping the
 * table bounded.
 *
 * Returns counts of deleted rows so the caller can log + alert if the
 * deletion is unusually large.
 */
export async function pruneOldWatchData(retentionDays = 90): Promise<{
  events: number; notifications: number;
}> {
  if (!isDBConfigured()) return { events: 0, notifications: 0 };
  const sql = getSQL();
  try {
    const evRes = await sql`
      DELETE FROM hl_position_events
      WHERE ts < NOW() - (${retentionDays}::int || ' days')::interval
    ` as { count?: number };
    const notRes = await sql`
      DELETE FROM hl_event_notifications
      WHERE sent_at < NOW() - (${retentionDays}::int || ' days')::interval
    ` as { count?: number };
    return {
      events: Number(evRes.count ?? 0),
      notifications: Number(notRes.count ?? 0),
    };
  } catch (e) {
    console.error('[db] pruneOldWatchData error:', e);
    return { events: 0, notifications: 0 };
  }
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

/**
 * Claim a TOTP code for replay protection. Returns true if the code
 * was successfully claimed (first use within the 90s window) or false
 * if it was already used. Caller MUST gate the actual auth on this
 * return value — calling validate() on an OTPAuth.TOTP isn't enough,
 * because the same code is valid for the entire 90s window with the
 * default `window: 1` setting.
 *
 * Codes are pruned automatically by the cleanup query at the start of
 * each call (cheap because of the idx_totp_used_codes_expires index).
 */
export async function claimTotpCode(userId: string, code: string, ttlSeconds = 90): Promise<boolean> {
  try {
    const sql = getSQL();
    // Best-effort cleanup — drops expired rows so the table doesn't
    // grow unboundedly. The expires_at index makes this an O(log n)
    // sweep, fine to run on every claim.
    await sql`DELETE FROM totp_used_codes WHERE expires_at < NOW()`;
    const ttl = Math.min(Math.max(30, Math.floor(ttlSeconds)), 600);
    const intervalStr = `${ttl} seconds`;
    const rows = await sql`
      INSERT INTO totp_used_codes (user_id, code, expires_at)
      VALUES (${userId}, ${code}, NOW() + ${intervalStr}::interval)
      ON CONFLICT (user_id, code) DO NOTHING
      RETURNING user_id
    `;
    return rows.length > 0;
  } catch (e) {
    // If the DB is down, fail CLOSED — refuse the code rather than
    // letting a replay slip through. The caller will return 503-ish
    // and the user can retry.
    console.error('claimTotpCode error:', e);
    return false;
  }
}

export async function recordAuditEvent(
  type: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = getSQL();
    await db`INSERT INTO admin_monitoring (metric, value, details) VALUES (${`audit_${type}`}, ${0}, ${JSON.stringify(details)})`;
  } catch (e) {
    console.error('DB recordAuditEvent error:', e);
  }
}

export async function getAuditLog(limit = 50): Promise<Array<{ id: number; type: string; details: Record<string, unknown> | null; timestamp: string }>> {
  try {
    const db = getSQL();
    const rows = await db`
      SELECT id, metric, details, recorded_at
      FROM admin_monitoring
      WHERE metric LIKE 'audit_%'
      ORDER BY recorded_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      id: r.id,
      type: (r.metric as string).replace('audit_', ''),
      details: r.details,
      timestamp: r.recorded_at?.toISOString?.() ?? String(r.recorded_at),
    }));
  } catch (e) {
    console.error('DB getAuditLog error:', e);
    return [];
  }
}

export async function flushApiCache(): Promise<number> {
  try {
    const db = getSQL();
    const result = await db`DELETE FROM api_cache`;
    return result.count ?? 0;
  } catch (e) {
    console.error('DB flushApiCache error:', e);
    return 0;
  }
}

export async function getUserDetailForAdmin(userId: string) {
  try {
    const db = getSQL();

    const [user] = await db`SELECT id, name, email, image, email_verified, role FROM users WHERE id = ${userId}`;
    if (!user) return null;

    const accounts = await db`SELECT provider FROM accounts WHERE user_id = ${userId}`;
    const providers = accounts.map((a: any) => a.provider);

    let watchlist: string[] = [];
    let alerts: any[] = [];
    let portfolio: any[] = [];
    try {
      const [prefs] = await db`SELECT prefs FROM user_prefs WHERE user_id = ${userId}`;
      if (prefs?.prefs) {
        const p = typeof prefs.prefs === 'string' ? JSON.parse(prefs.prefs) : prefs.prefs;
        watchlist = p.watchlist || [];
        alerts = p.alerts || [];
        portfolio = p.portfolio || [];
      }
    } catch { /* user_prefs may not exist */ }

    let recentNotifications: any[] = [];
    try {
      recentNotifications = await db`
        SELECT id, symbol, metric, threshold, actual_value, channel, sent_at
        FROM alert_notifications
        WHERE user_id = ${userId}
        ORDER BY sent_at DESC
        LIMIT 20
      `;
    } catch { /* table may not exist */ }

    let pushCount = 0;
    try {
      const [row] = await db`SELECT COUNT(*)::int AS cnt FROM push_subscriptions WHERE user_id = ${userId}`;
      pushCount = row?.cnt ?? 0;
    } catch { /* table may not exist */ }

    return {
      ...user,
      providers,
      watchlist,
      alerts,
      portfolio,
      recentNotifications,
      pushSubscriptions: pushCount,
    };
  } catch (e) {
    console.error('DB getUserDetailForAdmin error:', e);
    return null;
  }
}

export async function getAllPushSubscriptions() {
  try {
    const db = getSQL();
    // LIMIT 10000 — push_subscriptions grows with every browser opt-in.
    // Without a cap, alert delivery code loads the entire table into
    // memory. Matches the pattern in getAllActiveTelegramChatIds.
    const rows = await db`SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions LIMIT 10000`;
    return rows.map((r: any) => ({
      userId: r.user_id,
      subscription: { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
    }));
  } catch (e) {
    console.error('DB getAllPushSubscriptions error:', e);
    return [];
  }
}

// ─── API Key Management (Public API v1) ─────────────────────────────────────

import { randomBytes, createHash } from 'crypto';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function createApiKey(userId: string, name: string = 'Default'): Promise<{ id: string; key: string; prefix: string }> {
  const db = getSQL();
  const raw = 'ih_' + randomBytes(24).toString('base64url'); // e.g. ih_a1b2c3d4...
  const prefix = raw.slice(0, 10); // "ih_a1b2c3d" for display
  const keyHash = hashApiKey(raw);

  // Inherit the user's billing tier on key creation. Admins → 'whale'
  // (their role grandfathers them); everyone else gets the tier
  // currently stored on users.billing_tier (default 'free'). Without
  // this, every key was 'free' regardless of who owned it — which
  // meant /pricing's "Pro 600/min" promise wasn't actually granted to
  // Pro users.
  const tierRows = await db`SELECT role, billing_tier FROM users WHERE id = ${userId}` as Array<{ role: string | null; billing_tier: string | null }>;
  const userRole = tierRows[0]?.role ?? null;
  const userBillingTier = tierRows[0]?.billing_tier ?? null;
  const tier = userRole === 'admin'
    ? 'whale'
    : (userBillingTier === 'pro' || userBillingTier === 'whale')
      ? userBillingTier
      : 'free';

  const rows = await db`
    INSERT INTO api_keys (user_id, key_hash, key_prefix, name, tier)
    VALUES (${userId}, ${keyHash}, ${prefix}, ${name}, ${tier})
    RETURNING id
  `;
  return { id: rows[0].id, key: raw, prefix };
}

export async function validateApiKey(rawKey: string): Promise<{ userId: string; tier: string; keyId: string } | null> {
  try {
    const db = getSQL();
    const keyHash = hashApiKey(rawKey);
    const rows = await db`
      SELECT id, user_id, tier FROM api_keys
      WHERE key_hash = ${keyHash} AND is_active = true
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    // Update last_used timestamp async (don't block response)
    db`UPDATE api_keys SET last_used_at = NOW(), requests_today = requests_today + 1 WHERE id = ${rows[0].id}`.catch(e => console.warn('[db] api_key last_used update:', e));
    return { userId: rows[0].user_id, tier: rows[0].tier, keyId: rows[0].id };
  } catch (e) {
    console.error('DB validateApiKey error:', e);
    return null;
  }
}

export async function listApiKeys(userId: string): Promise<Array<{ id: string; prefix: string; name: string; tier: string; lastUsedAt: string | null; requestsToday: number; createdAt: string }>> {
  try {
    const db = getSQL();
    const rows = await db`
      SELECT id, key_prefix, name, tier, last_used_at, requests_today, created_at
      FROM api_keys WHERE user_id = ${userId} AND is_active = true
      ORDER BY created_at DESC
    `;
    return rows.map((r: any) => ({
      id: r.id,
      prefix: r.key_prefix,
      name: r.name,
      tier: r.tier,
      lastUsedAt: r.last_used_at?.toISOString() ?? null,
      requestsToday: r.requests_today ?? 0,
      createdAt: r.created_at?.toISOString() ?? '',
    }));
  } catch (e) {
    console.error('DB listApiKeys error:', e);
    return [];
  }
}

export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  try {
    const db = getSQL();
    const rows = await db`
      UPDATE api_keys SET is_active = false
      WHERE id = ${keyId} AND user_id = ${userId}
      RETURNING id
    `;
    return rows.length > 0;
  } catch (e) {
    console.error('DB revokeApiKey error:', e);
    return false;
  }
}

export async function countUserApiKeys(userId: string): Promise<number> {
  try {
    const db = getSQL();
    const rows = await db`SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ${userId} AND is_active = true`;
    return Number(rows[0].cnt);
  } catch (e) {
    return 0;
  }
}

// ─── Spread Snapshots ───────────────────────────────────────────────────────

export async function saveSpreadSnapshot(data: {
  symbol: string; spreadUsd: number; spreadPct: number;
  highExchange: string; lowExchange: string;
  highPrice: number; lowPrice: number; exchangeCount: number;
}): Promise<void> {
  try {
    const sql = getSQL();
    await sql`INSERT INTO spread_snapshots (symbol, spread_usd, spread_pct, high_exchange, low_exchange, high_price, low_price, exchange_count)
      VALUES (${data.symbol}, ${data.spreadUsd}, ${data.spreadPct}, ${data.highExchange}, ${data.lowExchange}, ${data.highPrice}, ${data.lowPrice}, ${data.exchangeCount})`;
  } catch (e) {
    console.error('DB saveSpreadSnapshot error:', e);
  }
}

export async function getSpreadHistory(
  symbol: string, days: number = 7
): Promise<Array<{ t: number; spread: number; pct: number; high_ex: string; low_ex: string }>> {
  try {
    const sql = getSQL();
    const intervalStr = `${days} days`;
    const rows = days > 7
      ? await sql`
          SELECT EXTRACT(EPOCH FROM date_trunc('hour', ts)) * 1000 AS t,
                 AVG(spread_usd) AS spread, AVG(spread_pct) AS pct,
                 MODE() WITHIN GROUP (ORDER BY high_exchange) AS high_ex,
                 MODE() WITHIN GROUP (ORDER BY low_exchange) AS low_ex
          FROM spread_snapshots
          WHERE symbol = ${symbol} AND ts > NOW() - ${intervalStr}::interval
          GROUP BY date_trunc('hour', ts) ORDER BY t ASC`
      : await sql`
          SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, spread_usd AS spread,
                 spread_pct AS pct, high_exchange AS high_ex, low_exchange AS low_ex
          FROM spread_snapshots
          WHERE symbol = ${symbol} AND ts > NOW() - ${intervalStr}::interval
          ORDER BY ts ASC`;
    return rows.map((r: any) => ({
      t: Number(r.t), spread: Number(r.spread), pct: Number(r.pct),
      high_ex: r.high_ex, low_ex: r.low_ex,
    }));
  } catch (e) {
    console.error('DB getSpreadHistory error:', e);
    return [];
  }
}

// ─── Whale Trade Tracking ──────────────────────────────────────────────────

export interface WhaleTrackedWallet {
  id: number;
  ownerType: string;
  ownerId: string;
  address: string;
  chain: string;
  label: string | null;
  notifyChannels: string[];
  createdAt: string;
  // Notification config (joined from user_prefs when ownerType = 'user')
  discordWebhookUrl?: string;
  whatsappPhone?: string;
  email?: string;
  minValueUsd?: number;
}

export interface WhaleTradeEvent {
  id: number;
  address: string;
  chain: string;
  txHash: string;
  logIndex: number;
  dex: string | null;
  action: string;
  tokenIn: string | null;
  tokenInSymbol: string | null;
  amountIn: number | null;
  tokenOut: string | null;
  tokenOutSymbol: string | null;
  amountOut: number | null;
  valueUsd: number | null;
  blockNumber: number | null;
  blockTime: string;
  discoveredAt: string;
}

const MAX_TRACKED_WALLETS_PER_OWNER = 10;

export async function addTrackedWallet(
  ownerType: 'user' | 'telegram',
  ownerId: string,
  address: string,
  chain: string,
  label?: string,
  notifyChannels: string[] = ['telegram'],
  minValueUsd?: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sql = getSQL();
    const existing = await sql`
      SELECT COUNT(*)::int AS cnt FROM whale_tracked_wallets WHERE owner_id = ${ownerId}
    `;
    if (existing[0].cnt >= MAX_TRACKED_WALLETS_PER_OWNER) {
      return { ok: false, error: `Maximum ${MAX_TRACKED_WALLETS_PER_OWNER} tracked wallets allowed` };
    }
    await sql`
      INSERT INTO whale_tracked_wallets (owner_type, owner_id, address, chain, label, notify_channels, min_value_usd)
      VALUES (${ownerType}, ${ownerId}, ${address.toLowerCase()}, ${chain}, ${label || null}, ${notifyChannels}, ${minValueUsd ?? null})
      ON CONFLICT (owner_id, address, chain) DO UPDATE SET
        label = COALESCE(EXCLUDED.label, whale_tracked_wallets.label),
        notify_channels = EXCLUDED.notify_channels,
        min_value_usd = EXCLUDED.min_value_usd
    `;
    return { ok: true };
  } catch (e) {
    console.error('addTrackedWallet error:', e);
    return { ok: false, error: 'Database error' };
  }
}

export async function removeTrackedWallet(ownerId: string, address: string, chain?: string): Promise<boolean> {
  try {
    const sql = getSQL();
    const addr = address.toLowerCase();
    if (chain) {
      const res = await sql`DELETE FROM whale_tracked_wallets WHERE owner_id = ${ownerId} AND address = ${addr} AND chain = ${chain} RETURNING id`;
      return res.length > 0;
    }
    const res = await sql`DELETE FROM whale_tracked_wallets WHERE owner_id = ${ownerId} AND address = ${addr} RETURNING id`;
    return res.length > 0;
  } catch (e) {
    console.error('removeTrackedWallet error:', e);
    return false;
  }
}

export async function getTrackedWalletsForOwner(ownerId: string): Promise<WhaleTrackedWallet[]> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT id, owner_type, owner_id, address, chain, label, notify_channels, created_at
      FROM whale_tracked_wallets WHERE owner_id = ${ownerId} ORDER BY created_at ASC
    `;
    return rows.map((r: any) => ({
      id: r.id, ownerType: r.owner_type, ownerId: r.owner_id,
      address: r.address, chain: r.chain, label: r.label,
      notifyChannels: r.notify_channels || [], createdAt: r.created_at,
    }));
  } catch (e) {
    console.error('getTrackedWalletsForOwner error:', e);
    return [];
  }
}

export async function getDistinctTrackedWallets(): Promise<Array<{ address: string; chain: string }>> {
  try {
    const sql = getSQL();
    const rows = await sql`SELECT DISTINCT address, chain FROM whale_tracked_wallets`;
    return rows.map((r: any) => ({ address: r.address, chain: r.chain }));
  } catch (e) {
    console.error('getDistinctTrackedWallets error:', e);
    return [];
  }
}

export async function insertWhaleTradeEvents(events: Array<{
  address: string; chain: string; txHash: string; logIndex?: number;
  dex?: string; action?: string;
  tokenIn?: string; tokenInSymbol?: string; amountIn?: number;
  tokenOut?: string; tokenOutSymbol?: string; amountOut?: number;
  valueUsd?: number; blockNumber?: number; blockTime: Date;
}>): Promise<number> {
  if (events.length === 0) return 0;
  try {
    const sql = getSQL();
    // Bulk INSERT via UNNEST — was N round-trips, now 1. Sibling
    // saveFundingSnapshot/saveOISnapshot/saveUserTrades all use this
    // pattern; whale trades was the outlier. With typical 50-row batches
    // this collapses 50 sequential round-trips to a single call.
    const addresses = events.map(e => e.address.toLowerCase());
    const chains = events.map(e => e.chain);
    const txHashes = events.map(e => e.txHash);
    const logIndices = events.map(e => e.logIndex ?? 0);
    const dexes = events.map(e => e.dex ?? null);
    const actions = events.map(e => e.action ?? 'swap');
    const tokenIns = events.map(e => e.tokenIn ?? null);
    const tokenInSymbols = events.map(e => e.tokenInSymbol ?? null);
    const amountIns = events.map(e => e.amountIn ?? null);
    const tokenOuts = events.map(e => e.tokenOut ?? null);
    const tokenOutSymbols = events.map(e => e.tokenOutSymbol ?? null);
    const amountOuts = events.map(e => e.amountOut ?? null);
    const valueUsds = events.map(e => e.valueUsd ?? null);
    const blockNumbers = events.map(e => e.blockNumber ?? null);
    const blockTimes = events.map(e => e.blockTime.toISOString());

    const res = await sql`
      INSERT INTO whale_trade_events (address, chain, tx_hash, log_index, dex, action,
        token_in, token_in_symbol, amount_in, token_out, token_out_symbol, amount_out,
        value_usd, block_number, block_time)
      SELECT * FROM UNNEST(
        ${sql.array(addresses)}::text[],
        ${sql.array(chains)}::text[],
        ${sql.array(txHashes)}::text[],
        ${sql.array(logIndices)}::int[],
        ${sql.array(dexes)}::text[],
        ${sql.array(actions)}::text[],
        ${sql.array(tokenIns)}::text[],
        ${sql.array(tokenInSymbols)}::text[],
        ${sql.array(amountIns)}::numeric[],
        ${sql.array(tokenOuts)}::text[],
        ${sql.array(tokenOutSymbols)}::text[],
        ${sql.array(amountOuts)}::numeric[],
        ${sql.array(valueUsds)}::numeric[],
        ${sql.array(blockNumbers)}::bigint[],
        ${sql.array(blockTimes)}::timestamptz[]
      )
      ON CONFLICT (tx_hash, log_index) DO NOTHING
      RETURNING id
    `;
    return res.length;
  } catch (e) {
    console.error('insertWhaleTradeEvents error:', e);
    return 0;
  }
}

export async function getRecentTradesForWallet(
  address: string, chain?: string, limit = 20,
): Promise<WhaleTradeEvent[]> {
  try {
    const sql = getSQL();
    const addr = address.toLowerCase();
    const rows = chain
      ? await sql`
          SELECT * FROM whale_trade_events
          WHERE address = ${addr} AND chain = ${chain}
          ORDER BY block_time DESC LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM whale_trade_events
          WHERE address = ${addr}
          ORDER BY block_time DESC LIMIT ${limit}
        `;
    return rows.map((r: any) => ({
      id: r.id, address: r.address, chain: r.chain, txHash: r.tx_hash,
      logIndex: r.log_index, dex: r.dex, action: r.action,
      tokenIn: r.token_in, tokenInSymbol: r.token_in_symbol, amountIn: r.amount_in,
      tokenOut: r.token_out, tokenOutSymbol: r.token_out_symbol, amountOut: r.amount_out,
      valueUsd: r.value_usd, blockNumber: r.block_number,
      blockTime: r.block_time, discoveredAt: r.discovered_at,
    }));
  } catch (e) {
    console.error('getRecentTradesForWallet error:', e);
    return [];
  }
}

/**
 * Recent whale trades across ALL tracked wallets (for the public v1
 * feed). Filters by min USD value + optional chain. Pure recent-feed
 * read, paged by `limit` newest-first.
 */
export async function getRecentWhaleTradesGlobal(opts: {
  limit?: number;
  minValueUsd?: number;
  chain?: string;
} = {}): Promise<WhaleTradeEvent[]> {
  try {
    const sql = getSQL();
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const minValue = opts.minValueUsd ?? 0;
    const rows = opts.chain
      ? await sql`
          SELECT * FROM whale_trade_events
          WHERE chain = ${opts.chain}
            AND value_usd >= ${minValue}
          ORDER BY block_time DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM whale_trade_events
          WHERE value_usd >= ${minValue}
          ORDER BY block_time DESC
          LIMIT ${limit}
        `;
    return rows.map((r: any) => ({
      id: r.id, address: r.address, chain: r.chain, txHash: r.tx_hash,
      logIndex: r.log_index, dex: r.dex, action: r.action,
      tokenIn: r.token_in, tokenInSymbol: r.token_in_symbol, amountIn: r.amount_in,
      tokenOut: r.token_out, tokenOutSymbol: r.token_out_symbol, amountOut: r.amount_out,
      valueUsd: r.value_usd, blockNumber: r.block_number,
      blockTime: r.block_time, discoveredAt: r.discovered_at,
    }));
  } catch (e) {
    console.error('getRecentWhaleTradesGlobal error:', e);
    return [];
  }
}

export async function getTradeSubscribers(address: string, chain: string): Promise<WhaleTrackedWallet[]> {
  try {
    const sql = getSQL();
    // Left-join user_prefs to get Discord/WhatsApp config for 'user' owner types
    const rows = await sql`
      SELECT w.id, w.owner_type, w.owner_id, w.address, w.chain, w.label, w.notify_channels, w.created_at,
             up.prefs->'notificationPrefs'->>'discordWebhookUrl' AS discord_webhook_url,
             up.prefs->'notificationPrefs'->>'whatsappPhone' AS whatsapp_phone,
             u.email AS user_email,
             w.min_value_usd
      FROM whale_tracked_wallets w
      LEFT JOIN user_prefs up ON w.owner_type = 'user' AND w.owner_id = up.user_id
      LEFT JOIN users u ON w.owner_type = 'user' AND w.owner_id = u.id
      WHERE w.address = ${address.toLowerCase()} AND w.chain = ${chain}
    `;
    return rows.map((r: any) => ({
      id: r.id, ownerType: r.owner_type, ownerId: r.owner_id,
      address: r.address, chain: r.chain, label: r.label,
      notifyChannels: r.notify_channels || [], createdAt: r.created_at,
      discordWebhookUrl: r.discord_webhook_url || undefined,
      whatsappPhone: r.whatsapp_phone || undefined,
      email: r.user_email || undefined,
      minValueUsd: r.min_value_usd ? Number(r.min_value_usd) : undefined,
    }));
  } catch (e) {
    console.error('getTradeSubscribers error:', e);
    return [];
  }
}

export async function hasWhaleNotifBeenSent(ownerId: string, tradeEventId: number, channel: string): Promise<boolean> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT 1 FROM whale_alert_notifications
      WHERE owner_id = ${ownerId} AND trade_event_id = ${tradeEventId} AND channel = ${channel}
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (e) {
    // CRITICAL: must NOT return `false` on a DB error — that signals
    // "notification not sent" to the caller and re-fires the same
    // Telegram alert on every subsequent cron tick (every 2 min)
    // for the duration of the outage. Instead surface the failure to
    // the caller (return `true` = "treat as sent, skip resend"), and
    // log so the admin panel + Sentry capture the real problem.
    console.error('[hasWhaleNotifBeenSent] DB error — fail-safe to TRUE to prevent duplicate pings:', e);
    return true;
  }
}

export async function logWhaleNotification(ownerId: string, tradeEventId: number, channel: string): Promise<void> {
  try {
    const sql = getSQL();
    await sql`
      INSERT INTO whale_alert_notifications (owner_id, trade_event_id, channel)
      VALUES (${ownerId}, ${tradeEventId}, ${channel})
      ON CONFLICT (owner_id, trade_event_id, channel) DO NOTHING
    `;
  } catch (e) {
    console.error('logWhaleNotification error:', e);
  }
}

export async function pruneOldWhaleData(keepDays = 30): Promise<{ events: number; notifs: number }> {
  try {
    const sql = getSQL();
    // Build the interval string in JS first, then pass as a parameter.
    // The previous form `${keepDays + ' days'}` worked but is fragile —
    // if `keepDays` is ever passed as a non-number, the JS concatenation
    // produces e.g. `"undefined days"` which Postgres throws on at the
    // ::interval cast. Safer to coerce + clamp here.
    const safeDays = Math.min(Math.max(1, Math.floor(Number(keepDays) || 30)), 3650);
    const interval = `${safeDays} days`;
    const e = await sql`DELETE FROM whale_trade_events WHERE block_time < NOW() - ${interval}::interval`;
    const n = await sql`DELETE FROM whale_alert_notifications WHERE sent_at < NOW() - ${interval}::interval`;
    return { events: e.count, notifs: n.count };
  } catch (e) {
    console.error('pruneOldWhaleData error:', e);
    return { events: 0, notifs: 0 };
  }
}

// ─── Worker Heartbeats ────────────────────────────────────────────────────

export async function upsertWorkerHeartbeat(
  worker: string,
  status: string = 'ok',
  details?: Record<string, any>,
): Promise<void> {
  try {
    const sql = getSQL();
    await sql`
      INSERT INTO worker_heartbeats (worker, last_beat, status, details)
      VALUES (${worker}, NOW(), ${status}, ${details ? JSON.stringify(details) : null})
      ON CONFLICT (worker) DO UPDATE SET
        last_beat = NOW(),
        status = ${status},
        details = ${details ? JSON.stringify(details) : null}
    `;
  } catch (e) {
    console.error('upsertWorkerHeartbeat error:', e);
  }
}

export interface WorkerHeartbeat {
  worker: string;
  lastBeat: string;
  status: string;
  details: Record<string, any> | null;
  stale: boolean;
}

export async function getWorkerHeartbeats(staleMinutes: number = 15): Promise<WorkerHeartbeat[]> {
  try {
    const sql = getSQL();
    const safeMins = Math.min(Math.max(1, Math.floor(Number(staleMinutes) || 15)), 1440);
    const interval = `${safeMins} minutes`;
    const rows = await sql`
      SELECT worker, last_beat, status, details,
             last_beat < NOW() - ${interval}::interval AS stale
      FROM worker_heartbeats
      ORDER BY worker ASC
      LIMIT 100
    `;
    return rows.map((r: any) => ({
      worker: r.worker,
      lastBeat: r.last_beat,
      status: r.status,
      details: r.details,
      stale: r.stale,
    }));
  } catch (e) {
    console.error('getWorkerHeartbeats error:', e);
    return [];
  }
}

// ─── Social posts (KOL Twitter feed) ────────────────────────────────────────

export interface SocialPostRow {
  id: string;
  handle: string;
  displayName: string | null;
  body: string;
  bodyHtml: string | null;
  link: string;
  pubDate: Date;
  fetchedAt: Date;
  source: string;
}

interface SocialPostInsert {
  id: string;
  handle: string;
  displayName?: string;
  body: string;
  bodyHtml?: string;
  link: string;
  pubDate: Date;
  source?: string;
}

/**
 * Bulk-upsert social posts. Uses ON CONFLICT (id) DO NOTHING so the cron is
 * idempotent — re-fetching the same handle's RSS feed every 15 min is fine.
 * Returns the count of NEW rows inserted (excluding dupes).
 */
export async function saveSocialPosts(posts: SocialPostInsert[]): Promise<number> {
  if (posts.length === 0) return 0;
  const sql = getSQL();

  let inserted = 0;
  for (let i = 0; i < posts.length; i += 200) {
    const chunk = posts.slice(i, i + 200);
    const result = await sql`
      INSERT INTO social_posts (id, handle, display_name, body, body_html, link, pub_date, source)
      SELECT * FROM UNNEST(
        ${sql.array(chunk.map(p => p.id))}::text[],
        ${sql.array(chunk.map(p => p.handle))}::text[],
        ${sql.array(chunk.map(p => p.displayName ?? null))}::text[],
        ${sql.array(chunk.map(p => p.body))}::text[],
        ${sql.array(chunk.map(p => p.bodyHtml ?? null))}::text[],
        ${sql.array(chunk.map(p => p.link))}::text[],
        ${sql.array(chunk.map(p => p.pubDate.toISOString()))}::timestamptz[],
        ${sql.array(chunk.map(p => p.source ?? 'nitter'))}::text[]
      )
      ON CONFLICT (id) DO NOTHING
    `;
    // postgres-js exposes affected rows on the returned result.
    inserted += (result as unknown as { count?: number }).count ?? 0;
  }

  return inserted;
}

/**
 * Read recent posts for the social-feed UI.
 * @param limit  Cap rows returned (1..200, defaults to 50).
 * @param handle Optional case-insensitive handle filter (no `@`).
 */
export async function getRecentSocialPosts(
  limit: number = 50,
  handle?: string,
): Promise<SocialPostRow[]> {
  try {
    const sql = getSQL();
    const cappedLimit = Math.min(Math.max(limit, 1), 200);
    const rows = handle
      ? await sql`
          SELECT id, handle, display_name, body, body_html, link, pub_date, fetched_at, source
          FROM social_posts
          WHERE handle = ${handle.toLowerCase()}
          ORDER BY pub_date DESC
          LIMIT ${cappedLimit}
        `
      : await sql`
          SELECT id, handle, display_name, body, body_html, link, pub_date, fetched_at, source
          FROM social_posts
          ORDER BY pub_date DESC
          LIMIT ${cappedLimit}
        `;
    return rows.map((r: any) => ({
      id: r.id,
      handle: r.handle,
      displayName: r.display_name,
      body: r.body,
      bodyHtml: r.body_html,
      link: r.link,
      pubDate: r.pub_date,
      fetchedAt: r.fetched_at,
      source: r.source,
    }));
  } catch (e) {
    console.error('getRecentSocialPosts error:', e);
    return [];
  }
}

/**
 * Watchdog query — returns handles whose latest post is older than `hours`,
 * or who have no posts at all. Used to detect when an upstream (nitter)
 * silently breaks for a specific account.
 */
export async function getStaleSocialHandles(
  watchedHandles: readonly string[],
  hours: number = 12,
): Promise<{ handle: string; latestPubDate: Date | null }[]> {
  if (watchedHandles.length === 0) return [];
  try {
    const sql = getSQL();
    const lower = watchedHandles.map(h => h.toLowerCase());
    const safeHours = Math.min(Math.max(1, Math.floor(Number(hours) || 12)), 168);
    const interval = `${safeHours} hours`;
    const rows = await sql`
      WITH watched AS (
        SELECT UNNEST(${sql.array(lower)}::text[]) AS handle
      )
      SELECT w.handle, MAX(s.pub_date) AS latest
      FROM watched w
      LEFT JOIN social_posts s ON s.handle = w.handle
      GROUP BY w.handle
      HAVING MAX(s.pub_date) IS NULL
          OR MAX(s.pub_date) < NOW() - ${interval}::interval
      ORDER BY w.handle
    `;
    return rows.map((r: any) => ({ handle: r.handle, latestPubDate: r.latest }));
  } catch (e) {
    console.error('getStaleSocialHandles error:', e);
    return [];
  }
}

// ─── Portfolio: user-supplied exchange keys + wallets + positions ──────────
//
// These helpers never expose the raw encrypted blobs through the API layer.
// `getDecryptedExchangeKey` returns plaintext — only call it from a server-
// side context that's about to make an authenticated upstream call.

export interface ExchangeKeyMeta {
  id: number;
  exchange: string;
  label: string | null;
  keyPrefix: string;
  permissions: unknown | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

export interface ExchangeKeySecrets {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

export interface UserWallet {
  id: number;
  chain: string;
  address: string;
  label: string | null;
  createdAt: Date;
}

export async function listUserExchangeKeys(userId: string): Promise<ExchangeKeyMeta[]> {
  if (!DATABASE_URL) return [];
  const sql = getSQL();
  const rows = await sql`
    SELECT id, exchange, label, key_prefix, permissions,
           last_synced_at, last_error, created_at
    FROM user_exchange_keys
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    exchange: r.exchange,
    label: r.label,
    keyPrefix: r.key_prefix,
    permissions: r.permissions,
    lastSyncedAt: r.last_synced_at,
    lastError: r.last_error,
    createdAt: r.created_at,
  }));
}

export async function addUserExchangeKey(params: {
  userId: string;
  exchange: string;
  label: string | null;
  keyPrefix: string;
  encryptedKey: string;
  encryptedSecret: string;
  encryptedPassphrase: string | null;
  permissions: unknown | null;
}): Promise<{ id: number }> {
  const sql = getSQL();
  const rows = await sql`
    INSERT INTO user_exchange_keys
      (user_id, exchange, label, key_prefix, encrypted_key, encrypted_secret,
       encrypted_passphrase, permissions)
    VALUES
      (${params.userId}, ${params.exchange}, ${params.label}, ${params.keyPrefix},
       ${params.encryptedKey}, ${params.encryptedSecret},
       ${params.encryptedPassphrase}, ${params.permissions as any})
    RETURNING id
  `;
  return { id: rows[0].id };
}

export async function deleteUserExchangeKey(userId: string, id: number): Promise<boolean> {
  const sql = getSQL();
  const rows = await sql`
    DELETE FROM user_exchange_keys
    WHERE user_id = ${userId} AND id = ${id}
    RETURNING id
  `;
  // Cascade-delete positions tied to this CEX source so they don't haunt
  // /positions forever (sync-positions never iterates this key again).
  if (rows.length > 0) {
    await sql`
      DELETE FROM user_positions
      WHERE user_id = ${userId}
        AND source_type = 'cex'
        AND source_id = ${id}
    `;
  }
  return rows.length > 0;
}

/**
 * Server-side only — returns the decrypted secrets for a single key.
 * Throws if the row doesn't exist or doesn't belong to the user.
 * Caller is responsible for never sending these over the wire.
 */
export async function getDecryptedExchangeKey(
  userId: string,
  id: number,
  decryptFn: (blob: string) => string,
): Promise<ExchangeKeySecrets | null> {
  const sql = getSQL();
  const rows = await sql`
    SELECT exchange, encrypted_key, encrypted_secret, encrypted_passphrase
    FROM user_exchange_keys
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as any;
  return {
    exchange: r.exchange,
    apiKey: decryptFn(r.encrypted_key),
    apiSecret: decryptFn(r.encrypted_secret),
    passphrase: r.encrypted_passphrase ? decryptFn(r.encrypted_passphrase) : undefined,
  };
}

export async function listUserWallets(userId: string): Promise<UserWallet[]> {
  if (!DATABASE_URL) return [];
  const sql = getSQL();
  const rows = await sql`
    SELECT id, chain, address, label, created_at
    FROM user_wallets
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    chain: r.chain,
    address: r.address,
    label: r.label,
    createdAt: r.created_at,
  }));
}

export async function addUserWallet(params: {
  userId: string;
  chain: string;
  address: string;
  label: string | null;
}): Promise<{ id: number }> {
  const sql = getSQL();
  const rows = await sql`
    INSERT INTO user_wallets (user_id, chain, address, label)
    VALUES (${params.userId}, ${params.chain}, ${params.address.toLowerCase()}, ${params.label})
    ON CONFLICT (user_id, chain, address) DO UPDATE SET label = EXCLUDED.label
    RETURNING id
  `;
  return { id: rows[0].id };
}

export async function deleteUserWallet(userId: string, id: number): Promise<boolean> {
  const sql = getSQL();
  const rows = await sql`
    DELETE FROM user_wallets
    WHERE user_id = ${userId} AND id = ${id}
    RETURNING id
  `;
  // Also wipe any positions still tied to this wallet — sync-positions
  // would never iterate this source again, so leftover rows would haunt
  // /positions forever (the user removes the wallet but the positions
  // keep showing up). Tied to the user_id too as a defence-in-depth check.
  if (rows.length > 0) {
    await sql`
      DELETE FROM user_positions
      WHERE user_id = ${userId}
        AND source_type = 'dex'
        AND source_id = ${id}
    `;
  }
  return rows.length > 0;
}

// ─── User positions sync (Phase B) ──────────────────────────────────────────

export interface UserPositionRow {
  id: number;
  userId: string;
  sourceType: 'cex' | 'dex';
  sourceId: number;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number | null;
  positionValue: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  marginUsed: number | null;
  liquidationPrice: number | null;
  tpPrice: number | null;
  slPrice: number | null;
  cumulativeFunding: number | null;
  updatedAt: Date;
}

interface UpsertPosition {
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number | null;
  positionValue: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  marginUsed: number | null;
  liquidationPrice: number | null;
  tpPrice: number | null;
  slPrice: number | null;
  cumulativeFunding: number | null;
}

/**
 * Replace every position for a single (user, source) pair atomically:
 * - Delete the existing rows for this source
 * - Insert the freshly fetched ones
 *
 * "Source" here means a single exchange-key OR a single wallet — never mixed.
 * The transaction means a user never sees a half-synced state where some
 * positions are gone and others are stale.
 */
export async function replaceUserPositionsForSource(
  userId: string,
  sourceType: 'cex' | 'dex',
  sourceId: number,
  positions: UpsertPosition[],
): Promise<{ deleted: number; inserted: number }> {
  const sqlx = getSQL();
  // postgres-js exposes the transaction via tagged templates at runtime,
  // but the inferred type omits the call signature in this version. Cast
  // to `any` so we keep the BEGIN/COMMIT atomicity without TS noise.
  return sqlx.begin(async (txRaw) => {
    const tx = txRaw as any;
    const del = await tx`
      DELETE FROM user_positions
      WHERE user_id = ${userId} AND source_type = ${sourceType} AND source_id = ${sourceId}
      RETURNING id
    `;
    if (positions.length === 0) {
      return { deleted: del.length, inserted: 0 };
    }
    await tx`
      INSERT INTO user_positions
        (user_id, source_type, source_id, exchange, symbol, side, size,
         entry_price, mark_price, position_value, unrealized_pnl,
         leverage, margin_used, liquidation_price, tp_price, sl_price,
         cumulative_funding, updated_at)
      SELECT * FROM UNNEST(
        ${tx.array(positions.map(() => userId))}::text[],
        ${tx.array(positions.map(() => sourceType))}::text[],
        ${tx.array(positions.map(() => sourceId))}::int[],
        ${tx.array(positions.map(p => p.exchange))}::text[],
        ${tx.array(positions.map(p => p.symbol))}::text[],
        ${tx.array(positions.map(p => p.side))}::text[],
        ${tx.array(positions.map(p => p.size))}::float8[],
        ${tx.array(positions.map(p => p.entryPrice))}::float8[],
        ${tx.array(positions.map(p => p.markPrice ?? null))}::float8[],
        ${tx.array(positions.map(p => p.positionValue ?? null))}::float8[],
        ${tx.array(positions.map(p => p.unrealizedPnl ?? null))}::float8[],
        ${tx.array(positions.map(p => p.leverage ?? null))}::float8[],
        ${tx.array(positions.map(p => p.marginUsed ?? null))}::float8[],
        ${tx.array(positions.map(p => p.liquidationPrice ?? null))}::float8[],
        ${tx.array(positions.map(p => p.tpPrice ?? null))}::float8[],
        ${tx.array(positions.map(p => p.slPrice ?? null))}::float8[],
        ${tx.array(positions.map(p => p.cumulativeFunding ?? null))}::float8[],
        ${tx.array(positions.map(() => new Date().toISOString()))}::timestamptz[]
      )
    `;
    return { deleted: del.length, inserted: positions.length };
  });
}

/**
 * Persist a single per-source account balance row (cash + uPnL + margin
 * for that one exchange-key or wallet). UPSERT keyed by (user, source,
 * sourceId) so the cron can call this every minute without dupes.
 *
 * Passing `null` deletes the row — useful when fetchAccountBalance
 * returns null on auth/permission failure so we don't keep stale data.
 */
export async function upsertUserAccountBalance(params: {
  userId: string;
  sourceType: 'cex' | 'dex';
  sourceId: number;
  exchange: string;
  equityUsd: number;
  availableUsd: number;
  marginUsedUsd: number;
} | null, deleteKey?: { userId: string; sourceType: 'cex' | 'dex'; sourceId: number }): Promise<void> {
  const sqlx = getSQL();
  if (params === null && deleteKey) {
    await sqlx`
      DELETE FROM user_account_balances
      WHERE user_id = ${deleteKey.userId}
        AND source_type = ${deleteKey.sourceType}
        AND source_id = ${deleteKey.sourceId}
    `;
    return;
  }
  if (!params) return;
  await sqlx`
    INSERT INTO user_account_balances
      (user_id, source_type, source_id, exchange, equity_usd, available_usd, margin_used_usd, updated_at)
    VALUES
      (${params.userId}, ${params.sourceType}, ${params.sourceId}, ${params.exchange},
       ${params.equityUsd}, ${params.availableUsd}, ${params.marginUsedUsd}, NOW())
    ON CONFLICT (user_id, source_type, source_id) DO UPDATE SET
      exchange        = EXCLUDED.exchange,
      equity_usd      = EXCLUDED.equity_usd,
      available_usd   = EXCLUDED.available_usd,
      margin_used_usd = EXCLUDED.margin_used_usd,
      updated_at      = NOW()
  `;
}

export interface UserAccountBalanceRow {
  sourceType: 'cex' | 'dex';
  sourceId: number;
  exchange: string;
  equityUsd: number;
  availableUsd: number;
  marginUsedUsd: number;
  updatedAt: Date;
}

/** All per-source balances for a user. /api/account/positions sums these
 *  to get the TRUE summary equity (vs the margin-sum that understates
 *  cross-margin accounts). */
export async function listUserAccountBalances(userId: string): Promise<UserAccountBalanceRow[]> {
  if (!DATABASE_URL) return [];
  const sql = getSQL();
  const rows = await sql`
    SELECT source_type, source_id, exchange, equity_usd, available_usd, margin_used_usd, updated_at
    FROM user_account_balances
    WHERE user_id = ${userId}
    ORDER BY exchange
  `;
  return rows.map((r: any) => ({
    sourceType: r.source_type,
    sourceId: r.source_id,
    exchange: r.exchange,
    equityUsd: Number(r.equity_usd),
    availableUsd: Number(r.available_usd),
    marginUsedUsd: Number(r.margin_used_usd),
    updatedAt: r.updated_at,
  }));
}

/** Mark a key's last sync result. NULL `error` clears the previous error. */
export async function setExchangeKeyLastSync(
  keyId: number,
  error: string | null,
  permissions: unknown | null,
): Promise<void> {
  const sql = getSQL();
  if (permissions !== null && permissions !== undefined) {
    await sql`
      UPDATE user_exchange_keys
      SET last_synced_at = NOW(), last_error = ${error}, permissions = ${permissions as any}
      WHERE id = ${keyId}
    `;
  } else {
    await sql`
      UPDATE user_exchange_keys
      SET last_synced_at = NOW(), last_error = ${error}
      WHERE id = ${keyId}
    `;
  }
}

/** Read all positions for one user, newest-updated first. */
export async function listUserPositions(userId: string): Promise<UserPositionRow[]> {
  if (!DATABASE_URL) return [];
  const sql = getSQL();
  const rows = await sql`
    SELECT id, user_id, source_type, source_id, exchange, symbol, side, size,
           entry_price, mark_price, position_value, unrealized_pnl,
           leverage, margin_used, liquidation_price, tp_price, sl_price,
           cumulative_funding, updated_at
    FROM user_positions
    WHERE user_id = ${userId}
    ORDER BY position_value DESC NULLS LAST, updated_at DESC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    sourceType: r.source_type,
    sourceId: r.source_id,
    exchange: r.exchange,
    symbol: r.symbol,
    side: r.side,
    size: Number(r.size),
    entryPrice: Number(r.entry_price),
    markPrice: r.mark_price === null ? null : Number(r.mark_price),
    positionValue: r.position_value === null ? null : Number(r.position_value),
    unrealizedPnl: r.unrealized_pnl === null ? null : Number(r.unrealized_pnl),
    leverage: r.leverage === null ? null : Number(r.leverage),
    marginUsed: r.margin_used === null ? null : Number(r.margin_used),
    liquidationPrice: r.liquidation_price === null ? null : Number(r.liquidation_price),
    tpPrice: r.tp_price === null ? null : Number(r.tp_price),
    slPrice: r.sl_price === null ? null : Number(r.sl_price),
    cumulativeFunding: r.cumulative_funding === null ? null : Number(r.cumulative_funding),
    updatedAt: r.updated_at,
  }));
}

// ─── User trade history (Sprint 3) ──────────────────────────────────────────

export interface UserTradeRow {
  id: string;            // BIGSERIAL → string to avoid JS Number overflow
  userId: string;
  sourceType: 'cex' | 'dex';
  sourceId: number;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell' | string;
  direction: 'open' | 'close' | 'reduce' | 'add' | null;
  venueTradeId: string;
  size: number;
  price: number;
  valueUsd: number;
  feeUsd: number | null;
  realizedPnlUsd: number | null;
  ts: Date;
}

export interface UserTradeInsert {
  sourceType: 'cex' | 'dex';
  sourceId: number;
  exchange: string;
  symbol: string;
  side: string;
  direction?: 'open' | 'close' | 'reduce' | 'add' | null;
  venueTradeId: string;
  size: number;
  price: number;
  valueUsd: number;
  feeUsd?: number | null;
  realizedPnlUsd?: number | null;
  ts: Date;
}

/**
 * Bulk-insert trade fills with idempotent dedup. UNIQUE (user_id, exchange,
 * venue_trade_id) means upserting the same fill twice is a no-op — safe to
 * call from a cron that re-fetches the same window.
 *
 * Returns the count of NEW rows inserted (excluding conflict-skipped).
 */
export async function saveUserTrades(userId: string, trades: UserTradeInsert[]): Promise<number> {
  if (trades.length === 0 || !DATABASE_URL) return 0;
  const sql = getSQL();

  let totalInserted = 0;
  for (let i = 0; i < trades.length; i += 500) {
    const chunk = trades.slice(i, i + 500);
    const result = await sql`
      INSERT INTO user_trades (
        user_id, source_type, source_id, exchange, symbol, side, direction,
        venue_trade_id, size, price, value_usd, fee_usd, realized_pnl_usd, ts
      )
      SELECT * FROM UNNEST(
        ${sql.array(chunk.map(() => userId))}::text[],
        ${sql.array(chunk.map(t => t.sourceType))}::text[],
        ${sql.array(chunk.map(t => t.sourceId))}::int[],
        ${sql.array(chunk.map(t => t.exchange))}::text[],
        ${sql.array(chunk.map(t => t.symbol))}::text[],
        ${sql.array(chunk.map(t => t.side))}::text[],
        ${sql.array(chunk.map(t => t.direction ?? null))}::text[],
        ${sql.array(chunk.map(t => t.venueTradeId))}::text[],
        ${sql.array(chunk.map(t => t.size))}::float8[],
        ${sql.array(chunk.map(t => t.price))}::float8[],
        ${sql.array(chunk.map(t => t.valueUsd))}::float8[],
        ${sql.array(chunk.map(t => t.feeUsd ?? null))}::float8[],
        ${sql.array(chunk.map(t => t.realizedPnlUsd ?? null))}::float8[],
        ${sql.array(chunk.map(t => t.ts.toISOString()))}::timestamptz[]
      )
      ON CONFLICT (user_id, exchange, venue_trade_id) DO NOTHING
    `;
    // postgres-js exposes .count as a string of actually-affected rows;
    // ON CONFLICT skips don't count, so this gives a true "new rows" tally.
    // Don't fall back to chunk.length on zero — that overcounts every dedup
    // batch as a full insert and inflates the cron metrics.
    const inserted = parseInt(String((result as any).count ?? '0'), 10);
    totalInserted += Number.isFinite(inserted) ? inserted : 0;
  }
  return totalInserted;
}

/**
 * Read user's trade history newest-first. Optional filters narrow the
 * working set on the way out so the API route doesn't have to over-fetch.
 */
export async function listUserTrades(
  userId: string,
  opts: { symbol?: string; exchange?: string; limit?: number; offset?: number; sinceMs?: number } = {},
): Promise<UserTradeRow[]> {
  if (!DATABASE_URL) return [];
  const sql = getSQL();
  // Cap raised 1000 → 50000 so the tax/cost-basis FIFO walk can include
  // the full history of active traders. The `idx_user_trades_user_ts`
  // index makes the lookup O(50k * log N) under that limit. Paginated
  // callers (the trades/journal endpoint) bound their own request size
  // far below this — they pass their own limit. Was 1000 which forced
  // tax CSV exports to surface a misleading "1000 fills · full export
  // coming soon" message even for moderately active accounts.
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 50_000);
  const offset = Math.max(opts.offset ?? 0, 0);
  const since = opts.sinceMs ? new Date(opts.sinceMs).toISOString() : null;

  // Single query with optional filters via COALESCE-style guards. Each
  // filter is a no-op when its parameter is null.
  const rows = await sql`
    SELECT id, user_id, source_type, source_id, exchange, symbol, side, direction,
           venue_trade_id, size, price, value_usd, fee_usd, realized_pnl_usd, ts
    FROM user_trades
    WHERE user_id = ${userId}
      AND (${opts.symbol ?? null}::text IS NULL OR symbol = ${opts.symbol ?? null})
      AND (${opts.exchange ?? null}::text IS NULL OR exchange = ${opts.exchange ?? null})
      AND (${since}::timestamptz IS NULL OR ts >= ${since})
    ORDER BY ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return (rows as any[]).map((r): UserTradeRow => ({
    id: String(r.id),
    userId: r.user_id,
    sourceType: r.source_type,
    sourceId: r.source_id,
    exchange: r.exchange,
    symbol: r.symbol,
    side: r.side,
    direction: r.direction,
    venueTradeId: r.venue_trade_id,
    size: Number(r.size),
    price: Number(r.price),
    valueUsd: Number(r.value_usd),
    feeUsd: r.fee_usd === null ? null : Number(r.fee_usd),
    realizedPnlUsd: r.realized_pnl_usd === null ? null : Number(r.realized_pnl_usd),
    ts: r.ts,
  }));
}

/**
 * Most-recent trade timestamp per (exchange, source_id) — used by the
 * sync cron to ask each upstream "give me fills since X" instead of
 * always re-fetching the whole 90-day window.
 */
export async function getLastTradeTsBySource(userId: string): Promise<Map<string, Date>> {
  if (!DATABASE_URL) return new Map();
  const sql = getSQL();
  const rows = await sql`
    SELECT exchange, source_id, MAX(ts) AS last_ts
    FROM user_trades
    WHERE user_id = ${userId}
    GROUP BY exchange, source_id
  `;
  const map = new Map<string, Date>();
  for (const r of rows as any[]) {
    map.set(`${r.exchange}|${r.source_id}`, r.last_ts);
  }
  return map;
}

/**
 * Aggregate stats for the journal header. Computes:
 *   - all-time realised PnL
 *   - total fees paid
 *   - count of closing trades, win rate
 *   - largest win, largest loss
 *   - cumulative PnL series for chart (daily)
 */
export interface UserTradeStats {
  totalTrades: number;
  closingTrades: number;
  realisedPnlAllTime: number;
  realisedPnlLast30d: number;
  realisedPnlLast7d: number;
  realisedPnlLast24h: number;
  feesPaidAllTime: number;
  winRatePct: number | null;     // null when no closing trades
  largestWin: number;
  largestLoss: number;
  bySymbol: Array<{ symbol: string; realised: number; trades: number }>;
  byExchange: Array<{ exchange: string; realised: number; trades: number }>;
}

export async function getUserTradeStats(userId: string): Promise<UserTradeStats> {
  if (!DATABASE_URL) {
    return {
      totalTrades: 0, closingTrades: 0, realisedPnlAllTime: 0,
      realisedPnlLast30d: 0, realisedPnlLast7d: 0, realisedPnlLast24h: 0,
      feesPaidAllTime: 0, winRatePct: null, largestWin: 0, largestLoss: 0,
      bySymbol: [], byExchange: [],
    };
  }
  const sql = getSQL();

  const [global, perSymbol, perExchange] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS total_trades,
        COUNT(*) FILTER (WHERE realized_pnl_usd IS NOT NULL)::int AS closing_trades,
        COALESCE(SUM(realized_pnl_usd), 0) AS realised_all,
        COALESCE(SUM(realized_pnl_usd) FILTER (WHERE ts > NOW() - INTERVAL '30 days'), 0) AS realised_30d,
        COALESCE(SUM(realized_pnl_usd) FILTER (WHERE ts > NOW() - INTERVAL '7 days'), 0) AS realised_7d,
        COALESCE(SUM(realized_pnl_usd) FILTER (WHERE ts > NOW() - INTERVAL '24 hours'), 0) AS realised_24h,
        COALESCE(SUM(fee_usd), 0) AS fees,
        COUNT(*) FILTER (WHERE realized_pnl_usd > 0)::int AS wins,
        MAX(realized_pnl_usd) AS biggest_win,
        MIN(realized_pnl_usd) AS biggest_loss
      FROM user_trades
      WHERE user_id = ${userId}
    `,
    sql`
      SELECT symbol, COALESCE(SUM(realized_pnl_usd), 0) AS realised, COUNT(*)::int AS trades
      FROM user_trades
      WHERE user_id = ${userId}
      GROUP BY symbol
      ORDER BY realised DESC NULLS LAST
      LIMIT 20
    `,
    sql`
      SELECT exchange, COALESCE(SUM(realized_pnl_usd), 0) AS realised, COUNT(*)::int AS trades
      FROM user_trades
      WHERE user_id = ${userId}
      GROUP BY exchange
      ORDER BY realised DESC NULLS LAST
    `,
  ]);

  const row: any = (global as any[])[0] ?? {};
  const closingTrades = Number(row.closing_trades ?? 0);
  const wins = Number(row.wins ?? 0);
  const winRatePct = closingTrades > 0 ? (wins / closingTrades) * 100 : null;

  return {
    totalTrades: Number(row.total_trades ?? 0),
    closingTrades,
    realisedPnlAllTime: Number(row.realised_all ?? 0),
    realisedPnlLast30d: Number(row.realised_30d ?? 0),
    realisedPnlLast7d: Number(row.realised_7d ?? 0),
    realisedPnlLast24h: Number(row.realised_24h ?? 0),
    feesPaidAllTime: Number(row.fees ?? 0),
    winRatePct,
    largestWin: Number(row.biggest_win ?? 0) || 0,
    largestLoss: Number(row.biggest_loss ?? 0) || 0,
    bySymbol: (perSymbol as any[]).map(r => ({
      symbol: r.symbol,
      realised: Number(r.realised ?? 0),
      trades: Number(r.trades ?? 0),
    })),
    byExchange: (perExchange as any[]).map(r => ({
      exchange: r.exchange,
      realised: Number(r.realised ?? 0),
      trades: Number(r.trades ?? 0),
    })),
  };
}

/**
 * Daily cumulative realised PnL series for the journal chart. Returns
 * one row per day with the cumulative sum at end-of-day.
 */
export async function getUserDailyPnlSeries(userId: string, days = 90): Promise<Array<{ date: string; realised: number; cumulative: number }>> {
  if (!DATABASE_URL) return [];
  const sql = getSQL();
  const rows = await sql`
    WITH daily AS (
      SELECT DATE_TRUNC('day', ts)::date AS day,
             COALESCE(SUM(realized_pnl_usd), 0) AS realised
      FROM user_trades
      WHERE user_id = ${userId}
        AND ts > NOW() - (${days} || ' days')::interval
        AND realized_pnl_usd IS NOT NULL
      GROUP BY 1
    )
    SELECT day, realised,
           SUM(realised) OVER (ORDER BY day) AS cumulative
    FROM daily
    ORDER BY day ASC
  `;
  return (rows as any[]).map(r => ({
    date: typeof r.day === 'string' ? r.day : r.day.toISOString().slice(0, 10),
    realised: Number(r.realised ?? 0),
    cumulative: Number(r.cumulative ?? 0),
  }));
}

/**
 * For the sync cron: enumerate every user that has at least one connected
 * source, returning the source list per user. Used as `for (const u of users)
 * for (const s of u.sources) sync(s)`.
 */
export async function listAllSyncTargets(): Promise<Array<{
  userId: string;
  exchangeKeys: Array<{ id: number; exchange: string; encryptedKey: string; encryptedSecret: string; encryptedPassphrase: string | null }>;
  wallets: Array<{ id: number; chain: string; address: string }>;
}>> {
  if (!DATABASE_URL) return [];
  const sql = getSQL();
  // LIMIT 50000 on each — at scale this prevents loading the entire
  // encrypted-credential table into a single heap allocation. The sync
  // cron runs every 60s; if user counts grow past 50k connected sources
  // we'd need cursor-based pagination, but until then this hard cap is
  // a safety net against memory exhaustion.
  const keys = await sql`
    SELECT user_id, id, exchange, encrypted_key, encrypted_secret, encrypted_passphrase
    FROM user_exchange_keys
    ORDER BY user_id, id
    LIMIT 50000
  `;
  const wallets = await sql`
    SELECT user_id, id, chain, address
    FROM user_wallets
    ORDER BY user_id, id
    LIMIT 50000
  `;
  type SyncEntry = {
    userId: string;
    exchangeKeys: Array<{ id: number; exchange: string; encryptedKey: string; encryptedSecret: string; encryptedPassphrase: string | null }>;
    wallets: Array<{ id: number; chain: string; address: string }>;
  };
  const map = new Map<string, SyncEntry>();
  for (const k of keys) {
    const entry: SyncEntry = map.get(k.user_id) ?? { userId: k.user_id, exchangeKeys: [], wallets: [] };
    entry.exchangeKeys.push({
      id: k.id,
      exchange: k.exchange,
      encryptedKey: k.encrypted_key,
      encryptedSecret: k.encrypted_secret,
      encryptedPassphrase: k.encrypted_passphrase,
    });
    map.set(k.user_id, entry);
  }
  for (const w of wallets) {
    const entry: SyncEntry = map.get(w.user_id) ?? { userId: w.user_id, exchangeKeys: [], wallets: [] };
    entry.wallets.push({ id: w.id, chain: w.chain, address: w.address });
    map.set(w.user_id, entry);
  }
  return Array.from(map.values());
}

// ─── Position alerts (Phase D) ──────────────────────────────────────────────

export interface PositionAlertRule {
  id: number;
  userId: string;
  kind: string;            // 'funding_flip' for the MVP
  enabled: boolean;
  channels: string[];      // ['telegram'] | ['telegram','email'] | …
  cooldownMin: number;
  lastFiredAt: Date | null;
  createdAt: Date;
}

export async function listUserAlertRules(userId: string): Promise<PositionAlertRule[]> {
  if (!DATABASE_URL) return [];
  const sql = getSQL();
  const rows = await sql`
    SELECT id, user_id, kind, enabled, channels, cooldown_min,
           last_fired_at, created_at
    FROM user_position_alerts
    WHERE user_id = ${userId}
    ORDER BY id
  `;
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    enabled: r.enabled,
    channels: r.channels ?? [],
    cooldownMin: r.cooldown_min,
    lastFiredAt: r.last_fired_at,
    createdAt: r.created_at,
  }));
}

/**
 * Upsert a rule by (user_id, kind). Creating the row on first call, updating
 * `enabled`/`channels`/`cooldown_min` on subsequent calls. Used by the simple
 * "Enable funding flip alerts" toggle in /account/connections.
 */
export async function upsertUserAlertRule(params: {
  userId: string;
  kind: string;
  enabled: boolean;
  channels: string[];
  cooldownMin?: number;
}): Promise<{ id: number }> {
  const sql = getSQL();
  const cd = params.cooldownMin ?? 60;
  const rows = await sql`
    INSERT INTO user_position_alerts (user_id, kind, enabled, channels, cooldown_min)
    VALUES (${params.userId}, ${params.kind}, ${params.enabled},
            ${sql.array(params.channels)}::text[], ${cd})
    ON CONFLICT (user_id, kind) DO UPDATE
      SET enabled = EXCLUDED.enabled,
          channels = EXCLUDED.channels,
          cooldown_min = EXCLUDED.cooldown_min
    RETURNING id
  `;
  return { id: rows[0].id };
}

export async function markAlertFired(ruleId: number): Promise<void> {
  const sql = getSQL();
  await sql`UPDATE user_position_alerts SET last_fired_at = NOW() WHERE id = ${ruleId}`;
}

/** Used by the alert cron when sending via email channel. Returns the user's
 *  verified email or null if absent. */
export async function getUserEmail(userId: string): Promise<string | null> {
  if (!DATABASE_URL) return null;
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT email, email_verified FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (rows.length === 0) return null;
    const r = rows[0] as any;
    if (!r.email || !r.email_verified) return null;
    return String(r.email);
  } catch (e) {
    console.error('getUserEmail error:', e);
    return null;
  }
}

/**
 * For the alert cron — pull every enabled rule across all users in one shot,
 * paired with that user's open positions. Single round-trip.
 */
export async function listEnabledAlertsWithPositions(): Promise<Array<{
  rule: PositionAlertRule;
  positions: UserPositionRow[];
}>> {
  if (!DATABASE_URL) return [];
  const sql = getSQL();
  const rules = await sql`
    SELECT id, user_id, kind, enabled, channels, cooldown_min,
           last_fired_at, created_at
    FROM user_position_alerts
    WHERE enabled = true
  `;
  if (rules.length === 0) return [];

  // Bulk-fetch every position for every rule-owning user in ONE query
  // and group in app code, instead of issuing one SELECT per rule.
  // With N enabled alert rules, the previous loop did N+1 round-trips
  // — at 100+ rules and a 3-connection pool that starves the cron's
  // 60-second budget under any real load.
  const userIds = Array.from(new Set((rules as any[]).map(r => r.user_id)));
  const allPositions = (await sql`
    SELECT id, user_id, source_type, source_id, exchange, symbol, side, size,
           entry_price, mark_price, position_value, unrealized_pnl,
           leverage, margin_used, liquidation_price, tp_price, sl_price,
           cumulative_funding, updated_at
    FROM user_positions
    WHERE user_id = ANY(${userIds}::text[])
    ORDER BY position_value DESC NULLS LAST, updated_at DESC
  `) as any[];

  const positionsByUser = new Map<string, UserPositionRow[]>();
  for (const r of allPositions) {
    const row: UserPositionRow = {
      id: r.id,
      userId: r.user_id,
      sourceType: r.source_type,
      sourceId: r.source_id,
      exchange: r.exchange,
      symbol: r.symbol,
      side: r.side,
      size: Number(r.size),
      entryPrice: Number(r.entry_price),
      markPrice: r.mark_price === null ? null : Number(r.mark_price),
      positionValue: r.position_value === null ? null : Number(r.position_value),
      unrealizedPnl: r.unrealized_pnl === null ? null : Number(r.unrealized_pnl),
      leverage: r.leverage === null ? null : Number(r.leverage),
      marginUsed: r.margin_used === null ? null : Number(r.margin_used),
      liquidationPrice: r.liquidation_price === null ? null : Number(r.liquidation_price),
      tpPrice: r.tp_price === null ? null : Number(r.tp_price),
      slPrice: r.sl_price === null ? null : Number(r.sl_price),
      cumulativeFunding: r.cumulative_funding === null ? null : Number(r.cumulative_funding),
      updatedAt: r.updated_at,
    };
    const list = positionsByUser.get(r.user_id) ?? [];
    list.push(row);
    positionsByUser.set(r.user_id, list);
  }

  return (rules as any[]).map(r => ({
    rule: {
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      enabled: r.enabled,
      channels: r.channels ?? [],
      cooldownMin: r.cooldown_min,
      lastFiredAt: r.last_fired_at,
      createdAt: r.created_at,
    } as PositionAlertRule,
    positions: positionsByUser.get(r.user_id) ?? [],
  }));
}

// ─── Bug Reports (per-page report widget) ───────────────────────────────

export interface BugReportInput {
  userId?: string | null;
  userEmail?: string | null;
  pageUrl: string;
  pageTitle?: string | null;
  userAgent?: string | null;
  viewport?: string | null;
  message: string;
  severity?: 'low' | 'normal' | 'high';
  ipHash?: string | null;
}

export interface BugReportRow {
  id: number;
  userId: string | null;
  userEmail: string | null;
  pageUrl: string;
  pageTitle: string | null;
  userAgent: string | null;
  viewport: string | null;
  message: string;
  severity: 'low' | 'normal' | 'high';
  status: 'open' | 'resolved' | 'wontfix';
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function insertBugReport(input: BugReportInput): Promise<number | null> {
  try {
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO bug_reports (
        user_id, user_email, page_url, page_title, user_agent,
        viewport, message, severity, ip_hash
      ) VALUES (
        ${input.userId ?? null},
        ${input.userEmail ?? null},
        ${input.pageUrl},
        ${input.pageTitle ?? null},
        ${input.userAgent ?? null},
        ${input.viewport ?? null},
        ${input.message},
        ${input.severity ?? 'normal'},
        ${input.ipHash ?? null}
      )
      RETURNING id
    `;
    return (rows[0] as any)?.id ?? null;
  } catch (e) {
    console.error('DB insertBugReport error:', e);
    return null;
  }
}

export async function listBugReports(opts: {
  status?: 'open' | 'resolved' | 'wontfix' | 'all';
  limit?: number;
} = {}): Promise<BugReportRow[]> {
  try {
    const sql = getSQL();
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const status = opts.status ?? 'open';
    const rows = status === 'all'
      ? await sql`
          SELECT * FROM bug_reports ORDER BY created_at DESC LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM bug_reports WHERE status = ${status}
          ORDER BY created_at DESC LIMIT ${limit}
        `;
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      pageUrl: r.page_url,
      pageTitle: r.page_title,
      userAgent: r.user_agent,
      viewport: r.viewport,
      message: r.message,
      severity: r.severity,
      status: r.status,
      adminNotes: r.admin_notes,
      createdAt: r.created_at?.toISOString?.() ?? String(r.created_at),
      resolvedAt: r.resolved_at?.toISOString?.() ?? null,
    }));
  } catch (e) {
    console.error('DB listBugReports error:', e);
    return [];
  }
}

export async function updateBugReportStatus(
  id: number,
  status: 'open' | 'resolved' | 'wontfix',
  adminNotes?: string,
): Promise<boolean> {
  try {
    const sql = getSQL();
    const resolvedAt = status === 'open' ? null : new Date();
    const rows = await sql`
      UPDATE bug_reports
      SET status = ${status},
          resolved_at = ${resolvedAt as any},
          admin_notes = COALESCE(${adminNotes ?? null}, admin_notes)
      WHERE id = ${id}
      RETURNING id
    `;
    return rows.length > 0;
  } catch (e) {
    console.error('DB updateBugReportStatus error:', e);
    return false;
  }
}

export async function getBugReportCounts(): Promise<{ open: number; resolved: number; wontfix: number }> {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT status, COUNT(*) AS c FROM bug_reports GROUP BY status
    `;
    const out = { open: 0, resolved: 0, wontfix: 0 };
    for (const r of rows as any[]) {
      if (r.status in out) (out as any)[r.status] = Number(r.c);
    }
    return out;
  } catch (e) {
    console.error('DB getBugReportCounts error:', e);
    return { open: 0, resolved: 0, wontfix: 0 };
  }
}

// ─── Affiliate / Referral system (May 2026) ─────────────────────────────────

/** 8-char crypto-secure code from a no-confusing-characters alphabet (no
 *  0/O/1/I/L). ~1.1e12 unique codes — collision risk is negligible at
 *  any realistic user count. Uppercase, humans type it. */
function generateReferralCode(): string {
  const { randomBytes } = require('crypto') as typeof import('crypto');
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

/**
 * Ensure the user has a referral_code. Idempotent — if one exists,
 * returns it; otherwise generates + stores one. On the (very rare)
 * collision path, retries up to 5 times. Returns null on DB failure.
 */
export async function ensureUserReferralCode(userId: string): Promise<string | null> {
  if (!isDBConfigured()) return null;
  try {
    const db = getSQL();
    const existing = await db`SELECT referral_code FROM users WHERE id = ${userId}` as Array<{ referral_code: string | null }>;
    if (existing[0]?.referral_code) return existing[0].referral_code;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      const updated = await db`
        UPDATE users
        SET referral_code = ${code}
        WHERE id = ${userId}
          AND referral_code IS NULL
          AND NOT EXISTS (SELECT 1 FROM users WHERE referral_code = ${code})
        RETURNING referral_code
      ` as Array<{ referral_code: string }>;
      if (updated[0]?.referral_code) return updated[0].referral_code;
    }
    return null;
  } catch (e) {
    console.error('DB ensureUserReferralCode error:', e);
    return null;
  }
}

/**
 * Resolve a referral_code → affiliate user_id. Used on signup to
 * attribute the new user to the referrer. Returns null for invalid /
 * unknown codes.
 */
export async function getUserIdByReferralCode(code: string): Promise<string | null> {
  if (!isDBConfigured() || !code) return null;
  try {
    const db = getSQL();
    const rows = await db`SELECT id FROM users WHERE referral_code = ${code.toUpperCase()} LIMIT 1` as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  } catch (e) {
    console.error('DB getUserIdByReferralCode error:', e);
    return null;
  }
}

/**
 * Stamp the new user's `referred_by_user_id` if they signed up via a
 * referral cookie. Idempotent — silently skips if already set so a
 * stale cookie on a returning user can't overwrite the original
 * attribution. Self-referral guarded by SQL `affiliate_user_id != userId`.
 */
export async function attributeReferral(userId: string, affiliateUserId: string): Promise<boolean> {
  if (!isDBConfigured()) return false;
  if (userId === affiliateUserId) return false; // self-referral guard
  try {
    const db = getSQL();
    const updated = await db`
      UPDATE users
      SET referred_by_user_id = ${affiliateUserId}
      WHERE id = ${userId} AND referred_by_user_id IS NULL
      RETURNING id
    ` as Array<{ id: string }>;
    return updated.length > 0;
  } catch (e) {
    console.error('DB attributeReferral error:', e);
    return false;
  }
}

/**
 * Update the affiliate's USDT payout config. `chain` is one of
 * 'solana' | 'arbitrum' | 'base' — caller already validates. Wallet
 * is whatever format is appropriate for the chain (44-char base58 for
 * Solana, 0x-prefixed EVM for Arbitrum/Base — caller validates).
 */
export async function setUsdtPayoutConfig(
  userId: string,
  wallet: string | null,
  chain: 'solana' | 'arbitrum' | 'base' | null,
): Promise<void> {
  if (!isDBConfigured()) return;
  try {
    const db = getSQL();
    await db`
      UPDATE users
      SET usdt_payout_wallet = ${wallet},
          usdt_payout_chain = ${chain}
      WHERE id = ${userId}
    `;
  } catch (e) {
    console.error('DB setUsdtPayoutConfig error:', e);
  }
}

export interface UsdtPayoutConfig {
  wallet: string | null;
  chain: 'solana' | 'arbitrum' | 'base' | null;
}

/** Read the user's current USDT payout config + their referral_code. */
export async function getReferralProfile(userId: string): Promise<{
  referralCode: string | null;
  payout: UsdtPayoutConfig;
} | null> {
  if (!isDBConfigured()) return null;
  try {
    const db = getSQL();
    const rows = await db`
      SELECT referral_code, usdt_payout_wallet, usdt_payout_chain
      FROM users WHERE id = ${userId} LIMIT 1
    ` as Array<{ referral_code: string | null; usdt_payout_wallet: string | null; usdt_payout_chain: string | null }>;
    if (rows.length === 0) return null;
    const chain = rows[0].usdt_payout_chain;
    return {
      referralCode: rows[0].referral_code,
      payout: {
        wallet: rows[0].usdt_payout_wallet,
        chain: chain === 'solana' || chain === 'arbitrum' || chain === 'base' ? chain : null,
      },
    };
  } catch (e) {
    console.error('DB getReferralProfile error:', e);
    return null;
  }
}

export type ReferralEventType = 'click' | 'signup' | 'conversion' | 'payout';

/**
 * Append a referral_events row. `affiliateUserId` is required so all
 * events for one affiliate are queryable on the dashboard. For 'click'
 * events the referredUserId is null (no auth yet).
 */
export async function recordReferralEvent(params: {
  affiliateUserId: string;
  referredUserId?: string | null;
  eventType: ReferralEventType;
  amountUsd?: number | null;
  commissionUsd?: number | null;
  txHash?: string | null;
  chain?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  if (!isDBConfigured()) return;
  try {
    const db = getSQL();
    await db`
      INSERT INTO referral_events
        (affiliate_user_id, referred_user_id, event_type, amount_usd, commission_usd, tx_hash, chain, metadata)
      VALUES (
        ${params.affiliateUserId},
        ${params.referredUserId ?? null},
        ${params.eventType},
        ${params.amountUsd ?? null},
        ${params.commissionUsd ?? null},
        ${params.txHash ?? null},
        ${params.chain ?? null},
        ${params.metadata ? JSON.stringify(params.metadata) : null}
      )
    `;
  } catch (e) {
    console.error('DB recordReferralEvent error:', e);
  }
}

export interface ReferralEventRow {
  id: number;
  eventType: ReferralEventType;
  referredUserId: string | null;
  amountUsd: number | null;
  commissionUsd: number | null;
  txHash: string | null;
  chain: string | null;
  createdAt: Date;
}

/** Recent events for the affiliate's dashboard. Bounded to keep
 *  response size predictable. */
export async function listReferralEvents(affiliateUserId: string, limit: number = 100): Promise<ReferralEventRow[]> {
  if (!isDBConfigured()) return [];
  try {
    const db = getSQL();
    const rows = await db`
      SELECT id, event_type, referred_user_id, amount_usd, commission_usd, tx_hash, chain, created_at
      FROM referral_events
      WHERE affiliate_user_id = ${affiliateUserId}
      ORDER BY created_at DESC
      LIMIT ${Math.max(1, Math.min(500, limit))}
    ` as Array<any>;
    return rows.map((r) => ({
      id: Number(r.id),
      eventType: r.event_type as ReferralEventType,
      referredUserId: r.referred_user_id,
      amountUsd: r.amount_usd === null ? null : Number(r.amount_usd),
      commissionUsd: r.commission_usd === null ? null : Number(r.commission_usd),
      txHash: r.tx_hash,
      chain: r.chain,
      createdAt: new Date(r.created_at),
    }));
  } catch (e) {
    console.error('DB listReferralEvents error:', e);
    return [];
  }
}

export interface ReferralSummary {
  clicks: number;
  signups: number;
  conversions: number;
  totalCommissionUsd: number;
  paidOutUsd: number;
  pendingUsd: number;
}

/** Aggregate stats for the affiliate dashboard. Single query so the
 *  dashboard renders fast even for power referrers. */
export async function getReferralSummary(affiliateUserId: string): Promise<ReferralSummary> {
  const zero: ReferralSummary = { clicks: 0, signups: 0, conversions: 0, totalCommissionUsd: 0, paidOutUsd: 0, pendingUsd: 0 };
  if (!isDBConfigured()) return zero;
  try {
    const db = getSQL();
    const rows = await db`
      SELECT
        COALESCE(SUM(CASE WHEN event_type = 'click'      THEN 1 ELSE 0 END), 0) AS clicks,
        COALESCE(SUM(CASE WHEN event_type = 'signup'     THEN 1 ELSE 0 END), 0) AS signups,
        COALESCE(SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END), 0) AS conversions,
        COALESCE(SUM(CASE WHEN event_type = 'conversion' THEN commission_usd ELSE 0 END), 0) AS total_commission,
        COALESCE(SUM(CASE WHEN event_type = 'payout'     THEN amount_usd       ELSE 0 END), 0) AS paid_out
      FROM referral_events
      WHERE affiliate_user_id = ${affiliateUserId}
    ` as Array<{ clicks: string | number; signups: string | number; conversions: string | number; total_commission: string | number; paid_out: string | number }>;
    if (rows.length === 0) return zero;
    const r = rows[0];
    const totalCommissionUsd = Number(r.total_commission || 0);
    const paidOutUsd = Number(r.paid_out || 0);
    return {
      clicks: Number(r.clicks || 0),
      signups: Number(r.signups || 0),
      conversions: Number(r.conversions || 0),
      totalCommissionUsd,
      paidOutUsd,
      pendingUsd: Math.max(0, totalCommissionUsd - paidOutUsd),
    };
  } catch (e) {
    console.error('DB getReferralSummary error:', e);
    return zero;
  }
}

// ─── Admin affiliate-program stats (May 2026) ───────────────────────────────

export interface AdminAffiliateRow {
  affiliateUserId: string;
  affiliateEmail: string | null;
  affiliateName: string | null;
  referralCode: string | null;
  signups: number;
  conversions: number;
  totalCommissionUsd: number;
  paidOutUsd: number;
  pendingUsd: number;
}

export interface AdminAffiliateOverview {
  totalAffiliates: number;
  totalReferredSignups: number;
  totalConversions: number;
  totalCommissionUsd: number;
  totalPaidOutUsd: number;
  totalPendingUsd: number;
  topByConversions: AdminAffiliateRow[];
  topBySignups: AdminAffiliateRow[];
  recentEvents: Array<{
    id: number;
    affiliateUserId: string;
    affiliateEmail: string | null;
    eventType: string;
    amountUsd: number | null;
    commissionUsd: number | null;
    createdAt: Date;
  }>;
}

/**
 * Aggregate the entire affiliate program into one admin payload.
 * Single function, multiple queries — keeps the /api/admin/affiliates
 * route handler trivial. All queries are SCOPED reads — no writes,
 * safe to call as often as the admin dashboard polls.
 */
export async function getAdminAffiliateOverview(): Promise<AdminAffiliateOverview> {
  const empty: AdminAffiliateOverview = {
    totalAffiliates: 0, totalReferredSignups: 0, totalConversions: 0,
    totalCommissionUsd: 0, totalPaidOutUsd: 0, totalPendingUsd: 0,
    topByConversions: [], topBySignups: [], recentEvents: [],
  };
  if (!isDBConfigured()) return empty;
  try {
    const sql = getSQL();

    // Headline counters — single round-trip via aggregate subqueries.
    const headline = await sql`
      SELECT
        (SELECT COUNT(DISTINCT affiliate_user_id)
           FROM referral_events) AS total_affiliates,
        (SELECT COUNT(*)
           FROM users WHERE referred_by_user_id IS NOT NULL) AS total_referred_signups,
        (SELECT COUNT(*)
           FROM referral_events WHERE event_type='conversion') AS total_conversions,
        (SELECT COALESCE(SUM(commission_usd),0)
           FROM referral_events WHERE event_type='conversion') AS total_commission,
        (SELECT COALESCE(SUM(amount_usd),0)
           FROM referral_events WHERE event_type='payout') AS total_paid_out
    ` as Array<{
      total_affiliates: string | number;
      total_referred_signups: string | number;
      total_conversions: string | number;
      total_commission: string | number;
      total_paid_out: string | number;
    }>;
    const h = headline[0] ?? { total_affiliates: 0, total_referred_signups: 0, total_conversions: 0, total_commission: 0, total_paid_out: 0 };

    // Top affiliates by signups
    const signupRows = await sql`
      SELECT
        re.affiliate_user_id,
        u.email   AS affiliate_email,
        u.name    AS affiliate_name,
        u.referral_code,
        COALESCE(SUM(CASE WHEN re.event_type='signup'     THEN 1 ELSE 0 END), 0) AS signups,
        COALESCE(SUM(CASE WHEN re.event_type='conversion' THEN 1 ELSE 0 END), 0) AS conversions,
        COALESCE(SUM(CASE WHEN re.event_type='conversion' THEN re.commission_usd ELSE 0 END), 0) AS commission,
        COALESCE(SUM(CASE WHEN re.event_type='payout'     THEN re.amount_usd       ELSE 0 END), 0) AS paid_out
      FROM referral_events re
      LEFT JOIN users u ON u.id = re.affiliate_user_id
      GROUP BY re.affiliate_user_id, u.email, u.name, u.referral_code
      ORDER BY signups DESC, commission DESC
      LIMIT 20
    ` as Array<any>;

    // Top affiliates by commission (conversions $)
    const commissionRows = await sql`
      SELECT
        re.affiliate_user_id,
        u.email   AS affiliate_email,
        u.name    AS affiliate_name,
        u.referral_code,
        COALESCE(SUM(CASE WHEN re.event_type='signup'     THEN 1 ELSE 0 END), 0) AS signups,
        COALESCE(SUM(CASE WHEN re.event_type='conversion' THEN 1 ELSE 0 END), 0) AS conversions,
        COALESCE(SUM(CASE WHEN re.event_type='conversion' THEN re.commission_usd ELSE 0 END), 0) AS commission,
        COALESCE(SUM(CASE WHEN re.event_type='payout'     THEN re.amount_usd       ELSE 0 END), 0) AS paid_out
      FROM referral_events re
      LEFT JOIN users u ON u.id = re.affiliate_user_id
      GROUP BY re.affiliate_user_id, u.email, u.name, u.referral_code
      HAVING SUM(CASE WHEN re.event_type='conversion' THEN re.commission_usd ELSE 0 END) > 0
      ORDER BY commission DESC
      LIMIT 20
    ` as Array<any>;

    const mapAffiliateRow = (r: any): AdminAffiliateRow => ({
      affiliateUserId: r.affiliate_user_id,
      affiliateEmail: r.affiliate_email ?? null,
      affiliateName: r.affiliate_name ?? null,
      referralCode: r.referral_code ?? null,
      signups: Number(r.signups || 0),
      conversions: Number(r.conversions || 0),
      totalCommissionUsd: Number(r.commission || 0),
      paidOutUsd: Number(r.paid_out || 0),
      pendingUsd: Math.max(0, Number(r.commission || 0) - Number(r.paid_out || 0)),
    });

    // Most recent activity across the program
    const recentRaw = await sql`
      SELECT re.id, re.affiliate_user_id, u.email AS affiliate_email,
             re.event_type, re.amount_usd, re.commission_usd, re.created_at
      FROM referral_events re
      LEFT JOIN users u ON u.id = re.affiliate_user_id
      ORDER BY re.created_at DESC
      LIMIT 30
    ` as Array<any>;
    const recentEvents = recentRaw.map((r) => ({
      id: Number(r.id),
      affiliateUserId: r.affiliate_user_id,
      affiliateEmail: r.affiliate_email ?? null,
      eventType: r.event_type as string,
      amountUsd: r.amount_usd === null ? null : Number(r.amount_usd),
      commissionUsd: r.commission_usd === null ? null : Number(r.commission_usd),
      createdAt: new Date(r.created_at),
    }));

    const totalCommissionUsd = Number(h.total_commission || 0);
    const totalPaidOutUsd = Number(h.total_paid_out || 0);
    return {
      totalAffiliates: Number(h.total_affiliates || 0),
      totalReferredSignups: Number(h.total_referred_signups || 0),
      totalConversions: Number(h.total_conversions || 0),
      totalCommissionUsd,
      totalPaidOutUsd,
      totalPendingUsd: Math.max(0, totalCommissionUsd - totalPaidOutUsd),
      topByConversions: commissionRows.map(mapAffiliateRow),
      topBySignups: signupRows.map(mapAffiliateRow),
      recentEvents,
    };
  } catch (e) {
    console.error('DB getAdminAffiliateOverview error:', e);
    return empty;
  }
}

// ─── Custom dashboard widget layouts (Pro tier, May 2026) ───────────────────

/**
 * Widget config shape. Stored as JSONB inside user_dashboard_layouts.widgets,
 * always an array (no null/empty differentiation — `[]` is "user reset to
 * empty"; "no row" is "user never saved → use default").
 */
export interface DashboardWidget {
  /** Stable client-generated id (UUID or crypto.randomUUID). Used as the
   *  React key + drag-target identifier. */
  id: string;
  /** Widget type — drives which client component renders. Add a new value
   *  here only when adding a new widget renderer. */
  type:
    | 'funding'      // funding rate for a single symbol
    | 'oi'           // open interest for a single symbol
    | 'liquidations' // 24h liquidations summary
    | 'watchlist'    // user's watchlist mini
    | 'alerts'       // alert summary (count active, recent fires)
    | 'whales'       // recent whale trades
    | 'news'         // recent news headlines
    | 'positions';   // user's open positions summary
  /** Free-form per-widget config (symbol, exchange, max rows, etc.). The
   *  schema is enforced client-side by the widget renderer. */
  config?: Record<string, unknown>;
}

/**
 * Read the user's saved widget layout. Returns `null` when the user has
 * never saved a layout (caller should fall back to the default), or `[]`
 * when they've explicitly cleared their layout.
 */
export async function getUserDashboardLayout(userId: string): Promise<DashboardWidget[] | null> {
  if (!isDBConfigured()) return null;
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT widgets FROM user_dashboard_layouts WHERE user_id = ${userId} LIMIT 1
    ` as Array<{ widgets: unknown }>;
    if (rows.length === 0) return null;
    const w = rows[0].widgets;
    // postgres.js usually returns JSONB as a JS array directly. Defensive
    // string fallback in case the driver hands back a serialized form.
    if (typeof w === 'string') {
      try {
        const parsed = JSON.parse(w);
        return Array.isArray(parsed) ? (parsed as DashboardWidget[]) : [];
      } catch { return []; }
    }
    return Array.isArray(w) ? (w as DashboardWidget[]) : [];
  } catch (e) {
    console.error('DB getUserDashboardLayout error:', e);
    return null;
  }
}

/** Upsert the user's layout. Caps at 24 widgets to prevent abuse + keep
 *  the dashboard rendering snappy. */
export async function setUserDashboardLayout(userId: string, widgets: DashboardWidget[]): Promise<boolean> {
  if (!isDBConfigured()) return false;
  try {
    const sql = getSQL();
    const capped = widgets.slice(0, 24);
    await sql`
      INSERT INTO user_dashboard_layouts (user_id, widgets, updated_at)
      VALUES (${userId}, ${JSON.stringify(capped)}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        widgets = EXCLUDED.widgets,
        updated_at = NOW()
    `;
    return true;
  } catch (e) {
    console.error('DB setUserDashboardLayout error:', e);
    return false;
  }
}

// ─── Check if DB is available ───────────────────────────────────────────────

export function isDBConfigured(): boolean {
  return Boolean(DATABASE_URL);
}
