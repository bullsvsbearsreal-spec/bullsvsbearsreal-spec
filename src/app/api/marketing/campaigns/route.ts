/**
 * /api/marketing/campaigns
 *
 * GET  — list campaigns + KPIs per campaign (signups, retention,
 *        free→paid conversion, attributed revenue placeholder).
 * POST — create a new campaign. Owner/admin/marketer.
 *
 * Each KPI is computed against users where users.acq_utm_campaign
 * matches the campaign's slug. Retention is calc'd as % of signups
 * that last_seen ≥ N days after created_at.
 *
 * Gated by requireMarketer for both GET and POST.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireMarketer, verifySameOrigin, auth } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;

export async function GET(_req: NextRequest) {
  const denied = await requireMarketer();
  if (denied) return denied;
  if (!isDBConfigured()) return NextResponse.json({ campaigns: [] });

  await initDB();
  const db = getSQL();

  let campaigns: any[] = [];
  try {
    campaigns = await db`
      SELECT c.id, c.slug, c.name, c.notes, c.target_url, c.budget_usd,
             c.archived_at, c.created_at, c.created_by_user_id,
             u.email AS created_by_email,
             COUNT(usr.id)::int AS signups,
             COUNT(usr.id) FILTER (WHERE usr.billing_tier IS NOT NULL AND usr.billing_tier <> 'free')::int AS paid_conversions,
             COUNT(usr.id) FILTER (
               WHERE usr.last_seen IS NOT NULL
                 AND usr.last_seen > usr.created_at + INTERVAL '7 days'
             )::int AS d7_retained,
             COUNT(usr.id) FILTER (
               WHERE usr.last_seen IS NOT NULL
                 AND usr.last_seen > usr.created_at + INTERVAL '30 days'
             )::int AS d30_retained
      FROM marketing_campaigns c
      LEFT JOIN users u ON u.id = c.created_by_user_id
      LEFT JOIN users usr ON usr.acq_utm_campaign = c.slug
      GROUP BY c.id, u.email
      ORDER BY
        CASE WHEN c.archived_at IS NULL THEN 0 ELSE 1 END,
        c.created_at DESC
      LIMIT 200
    ` as any[];
  } catch (e) {
    console.warn('campaign list failed:', e);
    return NextResponse.json({ campaigns: [], error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json({
    campaigns: campaigns.map(c => {
      const signups = Number(c.signups) || 0;
      const paid = Number(c.paid_conversions) || 0;
      const d7 = Number(c.d7_retained) || 0;
      const d30 = Number(c.d30_retained) || 0;
      return {
        id: Number(c.id),
        slug: c.slug,
        name: c.name,
        notes: c.notes,
        targetUrl: c.target_url,
        budgetUsd: c.budget_usd == null ? null : Number(c.budget_usd),
        archivedAt: c.archived_at,
        createdAt: c.created_at,
        createdByEmail: c.created_by_email,
        signups,
        paidConversions: paid,
        conversionPct: signups > 0 ? Math.round((paid / signups) * 1000) / 10 : 0,
        d7Retained: d7,
        d7RetentionPct: signups > 0 ? Math.round((d7 / signups) * 1000) / 10 : 0,
        d30Retained: d30,
        d30RetentionPct: signups > 0 ? Math.round((d30 / signups) * 1000) / 10 : 0,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const denied = await requireMarketer();
  if (denied) return denied;
  if (!isDBConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawSlug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const name    = typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : '';
  const notes   = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 2000) : null;
  const targetUrl = typeof body?.targetUrl === 'string' ? body.targetUrl.trim().slice(0, 500) : null;
  const budget = body?.budgetUsd != null && Number.isFinite(Number(body.budgetUsd))
    ? Number(body.budgetUsd) : null;

  if (!SLUG_RE.test(rawSlug)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric + dashes/underscores, 2-64 chars' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const session = await auth();

  await initDB();
  const db = getSQL();
  try {
    const rows = await db`
      INSERT INTO marketing_campaigns (slug, name, notes, target_url, budget_usd, created_by_user_id)
      VALUES (${rawSlug}, ${name}, ${notes}, ${targetUrl}, ${budget}, ${session?.user?.id ?? null})
      RETURNING id, slug, created_at
    ` as Array<{ id: number; slug: string; created_at: string }>;

    await recordAuditEvent('marketing_campaign_created', {
      campaignId: Number(rows[0].id),
      slug: rows[0].slug,
      actorId: session?.user?.id ?? null,
      actorEmail: session?.user?.email ?? null,
      name,
      budgetUsd: budget,
    }).catch(e => console.warn('audit log failed:', e));

    return NextResponse.json({
      id: Number(rows[0].id),
      slug: rows[0].slug,
      createdAt: rows[0].created_at,
    }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505' || /unique/i.test(String(e?.message ?? ''))) {
      return NextResponse.json({ error: `Campaign slug "${rawSlug}" already exists` }, { status: 409 });
    }
    console.warn('campaign insert failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const denied = await requireMarketer();
  if (denied) return denied;
  if (!isDBConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = Number(body?.id);
  const action = String(body?.action ?? '');
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await initDB();
  const db = getSQL();
  try {
    if (action === 'archive') {
      await db`UPDATE marketing_campaigns SET archived_at = NOW() WHERE id = ${id}`;
    } else if (action === 'unarchive') {
      await db`UPDATE marketing_campaigns SET archived_at = NULL WHERE id = ${id}`;
    } else {
      return NextResponse.json({ error: 'unknown action — expected archive or unarchive' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.warn('campaign patch failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
