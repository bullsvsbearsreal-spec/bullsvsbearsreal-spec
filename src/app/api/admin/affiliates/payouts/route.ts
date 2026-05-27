/**
 * GET /api/admin/affiliates/payouts
 *
 * Returns affiliate operational data for the admin affiliates sub-page:
 *   · top earners        — referrers ranked by lifetime commission_usd
 *   · pending payouts    — un-paid conversions waiting to be wired
 *   · clicks→signups     — last 30d daily aggregate for the chart
 *   · LTV attribution    — for each affiliate, lifetime referred-user
 *                          spend (proxy for value attributed)
 */
import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const db = getSQL();

    const [
      topEarners,
      pendingPayouts,
      clicksSignups,
      tally,
    ] = await Promise.all([
      // Top earners — sum of commission_usd from referral_events,
      // joined to users so we can show name/email.
      db`
        SELECT
          u.id, u.email, u.name, u.referral_code,
          u.usdt_payout_wallet, u.usdt_payout_chain,
          COALESCE(SUM(CASE WHEN re.event_type IN ('conversion','payout') THEN re.commission_usd END), 0)::numeric AS lifetime_commission,
          COALESCE(SUM(CASE WHEN re.event_type = 'signup' THEN 1 END), 0)::int AS signups,
          COALESCE(SUM(CASE WHEN re.event_type = 'conversion' THEN 1 END), 0)::int AS conversions
        FROM users u
        LEFT JOIN referral_events re ON re.affiliate_user_id = u.id
        WHERE u.referral_code IS NOT NULL
        GROUP BY u.id, u.email, u.name, u.referral_code, u.usdt_payout_wallet, u.usdt_payout_chain
        HAVING COALESCE(SUM(CASE WHEN re.event_type = 'signup' THEN 1 END), 0) > 0
            OR COALESCE(SUM(CASE WHEN re.event_type IN ('conversion','payout') THEN re.commission_usd END), 0) > 0
        ORDER BY lifetime_commission DESC, signups DESC
        LIMIT 50
      `.catch(() => []),

      // Pending payouts — conversions that haven't been paid yet.
      // Sum unpaid commission per affiliate. We treat any 'conversion'
      // not followed by a 'payout' of equal amount as still owed.
      db`
        SELECT
          u.id, u.email, u.name, u.usdt_payout_wallet, u.usdt_payout_chain,
          COALESCE(SUM(CASE WHEN re.event_type = 'conversion'  THEN re.commission_usd END), 0)::numeric
            - COALESCE(SUM(CASE WHEN re.event_type = 'payout' THEN re.commission_usd END), 0)::numeric AS owed
        FROM users u
        JOIN referral_events re ON re.affiliate_user_id = u.id
        GROUP BY u.id, u.email, u.name, u.usdt_payout_wallet, u.usdt_payout_chain
        HAVING COALESCE(SUM(CASE WHEN re.event_type = 'conversion' THEN re.commission_usd END), 0)
             - COALESCE(SUM(CASE WHEN re.event_type = 'payout'     THEN re.commission_usd END), 0) > 0
        ORDER BY owed DESC
        LIMIT 100
      `.catch(() => []),

      // Daily clicks vs signups, last 30d. Two counts joined on day.
      db`
        WITH days AS (
          SELECT generate_series(
            (NOW() - INTERVAL '29 days')::date,
            NOW()::date,
            INTERVAL '1 day'
          )::date AS day
        )
        SELECT
          d.day,
          COALESCE(c.clicks, 0)::int   AS clicks,
          COALESCE(s.signups, 0)::int  AS signups
        FROM days d
        LEFT JOIN (
          SELECT created_at::date AS day, COUNT(*) AS clicks
          FROM referral_events
          WHERE event_type = 'click' AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY 1
        ) c ON c.day = d.day
        LEFT JOIN (
          SELECT created_at::date AS day, COUNT(*) AS signups
          FROM referral_events
          WHERE event_type = 'signup' AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY 1
        ) s ON s.day = d.day
        ORDER BY d.day
      `.catch(() => []),

      // Quick tally for the top-of-page KPI strip
      db`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'click')      AS clicks_30d,
          COUNT(*) FILTER (WHERE event_type = 'signup')     AS signups_30d,
          COUNT(*) FILTER (WHERE event_type = 'conversion') AS conversions_30d,
          COALESCE(SUM(CASE WHEN event_type = 'conversion' THEN amount_usd END), 0)::numeric AS revenue_30d
        FROM referral_events
        WHERE created_at > NOW() - INTERVAL '30 days'
      `.catch(() => []),
    ]);

    return NextResponse.json({
      topEarners: (topEarners as any[]).map(r => ({
        id: String(r.id),
        email: r.email ?? null,
        name: r.name ?? null,
        referralCode: r.referral_code ?? null,
        payoutWallet: r.usdt_payout_wallet ?? null,
        payoutChain: r.usdt_payout_chain ?? null,
        lifetimeCommissionUsd: Number(r.lifetime_commission ?? 0),
        signups: Number(r.signups ?? 0),
        conversions: Number(r.conversions ?? 0),
      })),
      pendingPayouts: (pendingPayouts as any[]).map(r => ({
        id: String(r.id),
        email: r.email ?? null,
        name: r.name ?? null,
        payoutWallet: r.usdt_payout_wallet ?? null,
        payoutChain: r.usdt_payout_chain ?? null,
        owedUsd: Number(r.owed ?? 0),
      })),
      clicksSignups: (clicksSignups as any[]).map(r => ({
        day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day),
        clicks:  Number(r.clicks  ?? 0),
        signups: Number(r.signups ?? 0),
      })),
      tally: {
        clicks30d:      Number((tally as any[])[0]?.clicks_30d      ?? 0),
        signups30d:     Number((tally as any[])[0]?.signups_30d     ?? 0),
        conversions30d: Number((tally as any[])[0]?.conversions_30d ?? 0),
        revenue30dUsd:  Number((tally as any[])[0]?.revenue_30d     ?? 0),
      },
    });
  } catch (e) {
    console.error('Admin affiliates payouts error:', e);
    return NextResponse.json({ error: 'Failed to load affiliate data' }, { status: 500 });
  }
}
