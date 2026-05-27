/**
 * GET /api/admin/revenue
 *
 * Revenue dashboard data. Until NowPayments wires up actual payment
 * webhooks, "revenue" is computed from:
 *   1. Projected MRR — tier counts × tier monthly price (assumes 100%
 *      of paid tier users pay). Realistic ceiling for the current
 *      user base.
 *   2. Affiliate-attributed revenue — sum of amount_usd on
 *      referral_events where type='conversion'.
 *   3. Affiliate commission paid out — sum of commission_usd on
 *      type='payout' rows.
 *   4. Tier conversion velocity — how many users moved tier in the
 *      last 30 days, derived from admin_monitoring audit events.
 *
 * Once paid tiers go live, swap projected → actual by joining a
 * subscriptions table here.
 */
import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';
import { TIER_PRICE_MONTHLY } from '@/lib/constants/tiers';

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

    const [tierCounts, affiliateRevenue, affiliatePayouts, recentConversions, tierChanges30d] = await Promise.all([
      db`SELECT COALESCE(billing_tier, 'free') AS tier, COUNT(*)::int AS count
           FROM users
           WHERE suspended_at IS NULL
           GROUP BY billing_tier`.catch(() => []),
      db`SELECT
           COALESCE(SUM(amount_usd), 0)::numeric AS revenue_total,
           COUNT(*)::int AS conversions_total,
           COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN amount_usd END), 0)::numeric AS revenue_30d,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS conversions_30d
         FROM referral_events WHERE event_type = 'conversion'`.catch(() => [{}]),
      db`SELECT COALESCE(SUM(commission_usd), 0)::numeric AS payouts_total,
           COUNT(*)::int AS payouts_count
         FROM referral_events WHERE event_type = 'payout'`.catch(() => [{}]),
      db`SELECT re.created_at, re.amount_usd, re.commission_usd, u.email
         FROM referral_events re
         LEFT JOIN users u ON u.id = re.referred_user_id
         WHERE re.event_type = 'conversion'
         ORDER BY re.created_at DESC
         LIMIT 10`.catch(() => []),
      // Tier-change velocity: count of admin_monitoring rows for
      // tier override audit events in the last 30 days.
      db`SELECT COUNT(*)::int AS count
         FROM admin_monitoring
         WHERE metric = 'audit_admin_change_billing_tier'
           AND recorded_at > NOW() - INTERVAL '30 days'`.catch(() => [{ count: 0 }]),
    ]);

    // Build tier counts as a map for easy lookups
    const counts: Record<string, number> = { free: 0, trader: 0, pro: 0, whale: 0 };
    for (const r of tierCounts as any[]) counts[r.tier] = Number(r.count);

    const projectedMrr =
      counts.trader * TIER_PRICE_MONTHLY.trader +
      counts.pro    * TIER_PRICE_MONTHLY.pro +
      counts.whale  * TIER_PRICE_MONTHLY.whale;

    const projectedArr = projectedMrr * 12;

    const aff = (affiliateRevenue as any[])[0] ?? {};
    const payouts = (affiliatePayouts as any[])[0] ?? {};

    return NextResponse.json({
      projected: {
        mrrUsd: projectedMrr,
        arrUsd: projectedArr,
        // Paying-user count (everything except free)
        payingUsers: counts.trader + counts.pro + counts.whale,
        tierBreakdown: [
          { tier: 'trader', count: counts.trader, mrr: counts.trader * TIER_PRICE_MONTHLY.trader, monthlyPrice: TIER_PRICE_MONTHLY.trader },
          { tier: 'pro',    count: counts.pro,    mrr: counts.pro    * TIER_PRICE_MONTHLY.pro,    monthlyPrice: TIER_PRICE_MONTHLY.pro    },
          { tier: 'whale',  count: counts.whale,  mrr: counts.whale  * TIER_PRICE_MONTHLY.whale,  monthlyPrice: TIER_PRICE_MONTHLY.whale  },
        ],
      },
      affiliate: {
        revenueTotalUsd: Number(aff.revenue_total ?? 0),
        revenue30dUsd:   Number(aff.revenue_30d   ?? 0),
        conversionsTotal: Number(aff.conversions_total ?? 0),
        conversions30d:   Number(aff.conversions_30d   ?? 0),
        payoutsTotalUsd: Number(payouts.payouts_total ?? 0),
        payoutsCount:    Number(payouts.payouts_count ?? 0),
        // Net owed = revenue collected (we keep 80%) - payouts already sent.
        // Affiliates earn 20%, so commission owed = revenue × 0.20 - payouts_sent.
        commissionOwedUsd: Math.max(0, Number(aff.revenue_total ?? 0) * 0.20 - Number(payouts.payouts_total ?? 0)),
      },
      recentConversions: (recentConversions as any[]).map(r => ({
        timestamp:    r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        amountUsd:    Number(r.amount_usd ?? 0),
        commissionUsd: Number(r.commission_usd ?? 0),
        email:        r.email ?? null,
      })),
      tierChanges30d: Number((tierChanges30d as any[])[0]?.count ?? 0),
      note: 'Projected MRR/ARR assumes 100% of paid-tier users actively pay. During launch most paid tiers are comped; this view shows the upside ceiling.',
    });
  } catch (e) {
    console.error('Revenue route error:', e);
    return NextResponse.json({ error: 'Failed to compute revenue' }, { status: 500 });
  }
}
