/**
 * POST /api/feedback — accept a bug report from the per-page report widget.
 * GET  /api/feedback — admin-only list of recent reports.
 *
 * Body (POST): {
 *   pageUrl: string;       // e.g. "/funding"
 *   pageTitle?: string;
 *   message: string;       // 4..2000 chars
 *   severity?: 'low' | 'normal' | 'high';
 *   userAgent?: string;    // captured client-side
 *   viewport?: string;     // "1280x720"
 * }
 *
 * Auth: anonymous reports OK. If a session cookie is present we attribute
 * the report to that user. Middleware applies the moderate rate limit
 * (120/min/IP) so this is naturally throttled.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  initDB, isDBConfigured,
  insertBugReport, listBugReports, updateBugReportStatus,
} from '@/lib/db';
import { validateBugReport } from '@/lib/utils/validateBugReport';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  // Salted with a constant + DB-only — not reversible by a leaked dump.
  return createHash('sha256').update('infohub:bug-report:' + ip).digest('hex').slice(0, 32);
}

export async function POST(request: NextRequest) {
  if (!isDBConfigured()) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Pure validation logic lives in lib/utils/validateBugReport so it's
  // unit-testable without spinning up a request mock + Postgres.
  const validated = validateBugReport(body);
  if (!validated.ok) {
    return NextResponse.json(
      { success: false, error: validated.error },
      { status: validated.status },
    );
  }
  const { message, pageUrl, severity, pageTitle, viewport } = validated.data;
  // User agent: validateBugReport already capped if provided in body.
  // Fall back to request header if body didn't include one.
  const userAgent = validated.data.userAgent
    ?? ((request.headers.get('user-agent') || '').slice(0, 500) || null);

  // Best-effort session attribution
  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const session = await auth();
    if (session?.user?.id) userId = session.user.id;
    if (session?.user?.email) userEmail = session.user.email;
  } catch { /* anonymous report */ }

  // IP captured for spam triage but hashed so a DB leak doesn't expose IPs.
  const ip = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || null;
  const ipHash = hashIp(ip);

  try {
    await initDB();
    const id = await insertBugReport({
      userId,
      userEmail,
      pageUrl,
      pageTitle,
      userAgent,
      viewport,
      message,
      severity,
      ipHash,
    });
    if (id == null) {
      return NextResponse.json({ success: false, error: 'Failed to record report' }, { status: 500 });
    }
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (e) {
    console.error('feedback POST error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/feedback?status=open&limit=100
 *
 * Admin-only. Returns recent reports for the admin panel.
 */
export async function GET(request: NextRequest) {
  if (!isDBConfigured()) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const statusRaw = searchParams.get('status') || 'open';
  const status = (['open', 'resolved', 'wontfix', 'all'].includes(statusRaw) ? statusRaw : 'open') as
    'open' | 'resolved' | 'wontfix' | 'all';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);

  try {
    await initDB();
    const reports = await listBugReports({ status, limit });
    return NextResponse.json({ success: true, data: reports });
  } catch (e) {
    console.error('feedback GET error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/feedback?id=123
 *
 * Admin-only. Body: { status: 'resolved' | 'wontfix' | 'open', adminNotes?: string }.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const id = parseInt(request.nextUrl.searchParams.get('id') || '', 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid report id' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = ['open', 'resolved', 'wontfix'].includes(body.status)
    ? (body.status as 'open' | 'resolved' | 'wontfix')
    : null;
  if (!status) {
    return NextResponse.json({ success: false, error: 'status must be open|resolved|wontfix' }, { status: 400 });
  }
  const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes.slice(0, 500) : undefined;

  try {
    const ok = await updateBugReportStatus(id, status, adminNotes);
    if (!ok) return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('feedback PATCH error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
