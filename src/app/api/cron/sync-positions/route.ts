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
  listAllSyncTargets,
  replaceUserPositionsForSource,
  setExchangeKeyLastSync,
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
  error?: string;
}

interface WalletSyncStat {
  walletId: number;
  chain: string;
  positions: number;
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

  await initDB();
  const targets = await listAllSyncTargets();

  const userStats: UserSyncStat[] = [];
  let totalKeys = 0;
  let totalPositions = 0;
  let totalErrors = 0;

  for (const target of targets) {
    const stat: UserSyncStat = { userId: target.userId, keys: [], wallets: [] };

    // ─── CEX keys ───────────────────────────────────────
    const keys = target.exchangeKeys.slice(0, MAX_KEYS_PER_USER);
    await Promise.all(keys.map(async (k) => {
      const ks: KeySyncStat = { keyId: k.id, exchange: k.exchange, positions: 0 };
      try {
        if (!isSupportedExchange(k.exchange)) {
          throw new Error(`unsupported exchange: ${k.exchange}`);
        }
        const client = getExchangeClient(k.exchange);
        const creds = {
          apiKey: decryptSecret(k.encryptedKey),
          apiSecret: decryptSecret(k.encryptedSecret),
          passphrase: k.encryptedPassphrase ? decryptSecret(k.encryptedPassphrase) : undefined,
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
        await setExchangeKeyLastSync(k.id, null, null);
        totalPositions += positions.length;
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
      } catch (err) {
        ws.error = err instanceof Error ? err.message : String(err);
        totalErrors++;
      }
      stat.wallets.push(ws);
    }));

    userStats.push(stat);
  }

  return NextResponse.json(
    {
      users: targets.length,
      totalKeys,
      totalPositions,
      totalErrors,
      stats: userStats,
      ts: Date.now(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
