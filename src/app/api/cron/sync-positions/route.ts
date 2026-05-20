/**
 * Cron: pull latest positions for every connected user, upsert into user_positions.
 *
 * Schedule: every 60s via /etc/systemd/system/infohub-cron-sync-positions.timer
 * Auth:     Authorization: Bearer <CRON_SECRET>  (same as other crons)
 *
 * Per source (each exchange-key OR wallet):
 *   - decrypt creds (if CEX)
 *   - call client.fetchPositions
 *   - replaceUserPositionsForSource (atomic delete + insert)
 *   - update last_synced_at / last_error on the key row
 *
 * Failures are isolated per-source: one bad key doesn't tank the batch.
 * Stats per source come back in the response body for debugging.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  initDB,
  isDBConfigured,
  getSQL,
  listAllSyncTargets,
  replaceUserPositionsForSource,
  setExchangeKeyLastSync,
  saveUserTrades,
  getLastTradeTsBySource,
  upsertWorkerHeartbeat,
  upsertUserAccountBalance,
} from '@/lib/db';
import { decryptSecret, isEncryptionConfigured } from '@/lib/crypto/exchange-keys';
import { getExchangeClient } from '@/lib/exchange-clients';
import { getWalletClients, fetchAllPositionsForChain } from '@/lib/wallet-clients';
import { isSupportedExchange, isSupportedChain } from '@/lib/portfolio/supported-exchanges';
import { verifyCronAuth } from '../_auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Limit per-cycle work so a degenerate user can't blow our 60s timer budget.
const MAX_KEYS_PER_USER = 8;
const MAX_WALLETS_PER_USER = 8;

interface KeySyncStat {
  keyId: number;
  exchange: string;
  positions: number;
  tradesInserted?: number;
  error?: string;
}

interface WalletSyncStat {
  walletId: number;
  chain: string;
  positions: number;
  tradesInserted?: number;
  error?: string;
}

interface UserSyncStat {
  userId: string;
  keys: KeySyncStat[];
  wallets: WalletSyncStat[];
}

export async function GET(req: NextRequest) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      { error: 'EXCHANGE_KEY_ENCRYPTION_KEY not set — cannot decrypt user keys' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Wrap the entire batch in a try/catch — without this, an unhandled
  // throw from initDB (rotated DSN) or any per-source path bubbles up
  // as a 500 HTML page from Next.js. The cron monitor greps for
  // "HTTP 200" and would silently miss broken position sync for hours.
  try {
    await initDB();

  // Garbage-collect orphan positions: rows whose source_id no longer
  // exists in user_wallets / user_exchange_keys. These accumulate when a
  // wallet/key is deleted (we now cascade-delete on remove, but historical
  // orphans from before that fix still need clearing — and any future
  // deletion bug surfaces here as a self-healing safety net).
  let orphansDeleted = 0;
  try {
    const sql = getSQL();
    const r1 = await sql`
      DELETE FROM user_positions
      WHERE source_type = 'dex'
        AND source_id NOT IN (SELECT id FROM user_wallets)
      RETURNING id
    `;
    const r2 = await sql`
      DELETE FROM user_positions
      WHERE source_type = 'cex'
        AND source_id NOT IN (SELECT id FROM user_exchange_keys)
      RETURNING id
    `;
    orphansDeleted = (r1?.length ?? 0) + (r2?.length ?? 0);
  } catch (e) {
    console.warn('[sync-positions] orphan cleanup failed:', e instanceof Error ? e.message : e);
  }

  const targets = await listAllSyncTargets();

  const userStats: UserSyncStat[] = [];
  let totalKeys = 0;
  let totalPositions = 0;
  let totalErrors = 0;
  let totalTradesInserted = 0;

  for (const target of targets) {
    const stat: UserSyncStat = { userId: target.userId, keys: [], wallets: [] };

    // ─── CEX keys ───────────────────────────────────────
    const keys = target.exchangeKeys.slice(0, MAX_KEYS_PER_USER);
    // Pre-load high-water marks for incremental trade sync ONCE per user.
    // Used by both the CEX and DEX branches below — previously each branch
    // made its own redundant query.
    const lastTradeTs = await getLastTradeTsBySource(target.userId).catch(() => new Map<string, Date>());
    const cexLastTradeTs = lastTradeTs;

    await Promise.all(keys.map(async (k) => {
      const ks: KeySyncStat = { keyId: k.id, exchange: k.exchange, positions: 0 };
      try {
        if (!isSupportedExchange(k.exchange)) {
          throw new Error(`unsupported exchange: ${k.exchange}`);
        }
        const client = getExchangeClient(k.exchange);
        // Pass the row's identity as decryption context. v2 blobs were
        // encrypted with AAD = `${userId}:${keyId}`; v1 blobs ignore the
        // ctx (legacy path, no AAD). decryptSecret handles both.
        const decryptCtx = { userId: target.userId, keyId: k.id };
        const creds = {
          apiKey: decryptSecret(k.encryptedKey, decryptCtx),
          apiSecret: decryptSecret(k.encryptedSecret, decryptCtx),
          passphrase: k.encryptedPassphrase ? decryptSecret(k.encryptedPassphrase, decryptCtx) : undefined,
        };
        const positions = await client.fetchPositions(creds);
        // Cumulative funding (last 30d). Best-effort — if the income endpoint
        // errors we still ship positions with NULL funding rather than failing
        // the whole sync.
        let fundingMap = new Map<string, number>();
        if (positions.length > 0 && client.fetchCumulativeFunding) {
          try {
            fundingMap = await client.fetchCumulativeFunding(creds);
          } catch (e) {
            console.warn(`[sync-positions] cumulative funding failed for ${k.exchange} key ${k.id}:`, e instanceof Error ? e.message : e);
          }
        }
        await replaceUserPositionsForSource(
          target.userId,
          'cex',
          k.id,
          positions.map(p => ({
            exchange: k.exchange,
            symbol: p.symbol,
            side: p.side,
            size: p.size,
            entryPrice: p.entryPrice,
            markPrice: p.markPrice,
            positionValue: p.positionValue,
            unrealizedPnl: p.unrealizedPnl,
            leverage: p.leverage,
            marginUsed: p.marginUsed,
            liquidationPrice: p.liquidationPrice,
            tpPrice: p.tpPrice,
            slPrice: p.slPrice,
            cumulativeFunding: fundingMap.get(p.symbol) ?? p.cumulativeFunding,
          })),
        );
        ks.positions = positions.length;

        // True account equity (cash + uPnL + margin). Best-effort: a
        // null return (auth fail / network blip) deletes the stale row
        // rather than keeping it around. Required for the /positions
        // summary equity to actually equal the user's real account
        // value on cross-margin venues — christian's MEXC feedback.
        if (client.fetchAccountBalance) {
          try {
            const balance = await client.fetchAccountBalance(creds);
            if (balance) {
              await upsertUserAccountBalance({
                userId: target.userId,
                sourceType: 'cex',
                sourceId: k.id,
                exchange: k.exchange,
                equityUsd: balance.equityUsd,
                availableUsd: balance.availableUsd,
                marginUsedUsd: balance.marginUsedUsd,
              });
            } else {
              await upsertUserAccountBalance(null, {
                userId: target.userId, sourceType: 'cex', sourceId: k.id,
              });
            }
          } catch (e) {
            console.warn(`[sync-positions] account balance failed for ${k.exchange} key ${k.id}:`, e instanceof Error ? e.message : e);
          }
        }
        await setExchangeKeyLastSync(k.id, null, null);
        totalPositions += positions.length;

        // ─── CEX trade history (best-effort) ────────────────────────
        // Same pattern as the wallet branch: high-water mark per
        // (exchange, key) with a 15min overlap window for late-settling
        // trades. Failure isolated from position sync.
        if (client.fetchTradeHistory) {
          try {
            const key = `${k.exchange}|${k.id}`;
            const since = cexLastTradeTs.get(key);
            const sinceMs = since ? since.getTime() - 15 * 60_000 : undefined;
            const fills = await client.fetchTradeHistory(creds, sinceMs);
            if (fills.length > 0) {
              const inserted = await saveUserTrades(target.userId, fills.map(f => ({
                sourceType: 'cex' as const,
                sourceId: k.id,
                exchange: k.exchange,
                symbol: f.symbol,
                side: f.side,
                direction: f.direction ?? null,
                venueTradeId: f.venueTradeId,
                size: f.size,
                price: f.price,
                valueUsd: f.valueUsd,
                feeUsd: f.feeUsd ?? null,
                realizedPnlUsd: f.realizedPnlUsd ?? null,
                ts: f.ts,
              })));
              ks.tradesInserted = (ks.tradesInserted ?? 0) + inserted;
              totalTradesInserted += inserted;
            }
          } catch (e) {
            console.warn(`[sync-positions] trade history failed for ${k.exchange} key ${k.id}:`, e instanceof Error ? e.message : e);
          }
        }
      } catch (err) {
        ks.error = err instanceof Error ? err.message : String(err);
        await setExchangeKeyLastSync(k.id, ks.error.slice(0, 500), null).catch(() => undefined);
        totalErrors++;
      }
      stat.keys.push(ks);
      totalKeys++;
    }));

    // ─── DEX wallets ────────────────────────────────────
    // Hyperliquid is fully wired here. EVM-chain wallets (ethereum / arbitrum
    // / base / solana) currently fall through to "no client" — those need
    // per-DEX subgraph queries (GMX, Aevo, etc.) and land in follow-ups.
    const wallets = target.wallets.slice(0, MAX_WALLETS_PER_USER);
    // Reuses `lastTradeTs` already loaded above before the CEX branch.
    // High-water marks per (exchange, source_id) → "give me fills since X"
    // so the upstream call returns a small delta instead of the full
    // 90-day window every minute.

    await Promise.all(wallets.map(async (w) => {
      const ws: WalletSyncStat = { walletId: w.id, chain: w.chain, positions: 0 };
      try {
        if (!isSupportedChain(w.chain)) {
          ws.error = `unsupported chain: ${w.chain}`;
          stat.wallets.push(ws);
          return;
        }
        const clients = getWalletClients(w.chain);
        if (clients.length === 0) {
          ws.error = `no fetcher implemented for ${w.chain} yet`;
          stat.wallets.push(ws);
          return;
        }
        // Each position is tagged by `fetchAllPositionsForChain` with the
        // DEX it came from (Hyperliquid / GMX / gTrade / Lighter). Using
        // the per-position label means the funding-rate join in
        // /api/account/positions can match each row to funding_snapshots
        // rows with matching exchange — otherwise GMX positions would
        // show no funding context, etc.
        const positions = await fetchAllPositionsForChain(w.chain, w.address);
        await replaceUserPositionsForSource(
          target.userId,
          'dex',
          w.id,
          positions.map(p => ({
            exchange: p.exchange,
            symbol: p.symbol,
            side: p.side,
            size: p.size,
            entryPrice: p.entryPrice,
            markPrice: p.markPrice,
            positionValue: p.positionValue,
            unrealizedPnl: p.unrealizedPnl,
            leverage: p.leverage,
            marginUsed: p.marginUsed,
            liquidationPrice: p.liquidationPrice,
            tpPrice: p.tpPrice,
            slPrice: p.slPrice,
            cumulativeFunding: p.cumulativeFunding,
          })),
        );
        ws.positions = positions.length;
        totalPositions += positions.length;

        // ─── Per-wallet account balance (best-effort) ───
        // For HL/GMX/etc cross-margin wallets, fetchAccountBalance
        // returns the TRUE account equity (cash + uPnL + margin), not
        // just the per-position margin we'd otherwise sum. Each chain
        // can have multiple clients (e.g. hyperliquid spot + perp);
        // we sum across them for a single per-wallet balance row.
        const balanceRows: { equityUsd: number; availableUsd: number; marginUsedUsd: number; exchange: string }[] = [];
        for (const client of clients) {
          if (!client.fetchAccountBalance) continue;
          try {
            const b = await client.fetchAccountBalance(w.address);
            if (b) balanceRows.push({ ...b, exchange: client.displayName });
          } catch (e) {
            console.warn(`[sync-positions] wallet balance failed for ${w.chain} ${w.address}:`, e instanceof Error ? e.message : e);
          }
        }
        if (balanceRows.length > 0) {
          const sum = balanceRows.reduce(
            (acc, b) => ({
              equityUsd: acc.equityUsd + b.equityUsd,
              availableUsd: acc.availableUsd + b.availableUsd,
              marginUsedUsd: acc.marginUsedUsd + b.marginUsedUsd,
            }),
            { equityUsd: 0, availableUsd: 0, marginUsedUsd: 0 },
          );
          // Use the FIRST client's displayName as the exchange label —
          // matches how positions are labeled when a single wallet has
          // both clients reporting (we'd see both labels in positions,
          // but the summary balance picks one consistently).
          await upsertUserAccountBalance({
            userId: target.userId,
            sourceType: 'dex',
            sourceId: w.id,
            exchange: balanceRows[0].exchange,
            equityUsd: sum.equityUsd,
            availableUsd: sum.availableUsd,
            marginUsedUsd: sum.marginUsedUsd,
          });
        } else {
          // No client implemented fetchAccountBalance — clear any
          // stale row so the summary doesn't show old data.
          await upsertUserAccountBalance(null, {
            userId: target.userId, sourceType: 'dex', sourceId: w.id,
          });
        }

        // ─── Trade history (best-effort; isolated from position sync) ───
        // Each client implements fetchTradeHistory? optionally. We call
        // every client that has it, giving each its own per-source high
        // water mark.
        for (const client of clients) {
          if (!client.fetchTradeHistory) continue;
          try {
            const key = `${client.displayName}|${w.id}`;
            const since = lastTradeTs.get(key);
            // Re-fetch a small overlap window (15 min) to handle late-
            // settling trades. Dedup happens at the DB layer.
            const sinceMs = since ? since.getTime() - 15 * 60_000 : undefined;
            const fills = await client.fetchTradeHistory(w.address, sinceMs);
            if (fills.length === 0) continue;
            const inserted = await saveUserTrades(target.userId, fills.map(f => ({
              sourceType: 'dex' as const,
              sourceId: w.id,
              exchange: client.displayName,
              symbol: f.symbol,
              side: f.side,
              direction: f.direction ?? null,
              venueTradeId: f.venueTradeId,
              size: f.size,
              price: f.price,
              valueUsd: f.valueUsd,
              feeUsd: f.feeUsd ?? null,
              realizedPnlUsd: f.realizedPnlUsd ?? null,
              ts: f.ts,
            })));
            ws.tradesInserted = (ws.tradesInserted ?? 0) + inserted;
            totalTradesInserted += inserted;
          } catch (e) {
            // Don't pollute the position-sync error counter — log only.
            console.warn(`[sync-positions] trade history failed for ${client.displayName} wallet ${w.id}:`,
              e instanceof Error ? e.message : e);
          }
        }
      } catch (err) {
        ws.error = err instanceof Error ? err.message : String(err);
        totalErrors++;
      }
      stat.wallets.push(ws);
    }));

    userStats.push(stat);
  }

    // Heartbeat with degraded status when any source errored. Was: zero
    // heartbeat plumbing — the admin pipeline tab couldn't tell whether
    // sync-positions was running cleanly or quietly burning through
    // half its keys with API errors.
    await upsertWorkerHeartbeat(
      'cron:sync-positions',
      totalErrors === 0 ? 'ok' : 'degraded',
      {
        users: targets.length,
        totalKeys,
        totalPositions,
        totalTradesInserted,
        totalErrors,
        orphansDeleted,
      },
    ).catch(e => console.error('[sync-positions] heartbeat error:', e));

    return NextResponse.json(
      {
        users: targets.length,
        totalKeys,
        totalPositions,
        totalTradesInserted,
        totalErrors,
        orphansDeleted,
        stats: userStats,
        ts: Date.now(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    // Surface the failure: log to Sentry/journalctl AND return non-200
    // so the cron monitor's HTTP grep flags it. Without this, broken
    // initDB/listAllSyncTargets would silently stop syncing positions
    // for every user with no signal.
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[sync-positions] cron failed:', msg);
    await upsertWorkerHeartbeat('cron:sync-positions', 'degraded', {
      error: msg.slice(0, 200),
    }).catch(() => { /* heartbeat best-effort */ });
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
