import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor, auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST() {
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  const session = await auth();

  try {
    const baseUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const apiKey = process.env.ADMIN_API_KEY || '';

    const res = await fetch(`${baseUrl}/api/health`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(30000),
    });

    const healthResult = await res.json();

    await recordAuditEvent('health_check', {
      admin: session?.user?.email ?? 'unknown',
      status: healthResult?.status ?? 'unknown',
      errorCount: healthResult?.errors?.length ?? 0,
    });

    return NextResponse.json({
      success: true,
      healthResult,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
