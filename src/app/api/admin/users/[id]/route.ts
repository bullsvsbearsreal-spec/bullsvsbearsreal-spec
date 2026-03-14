import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { getUserDetailForAdmin } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  const { id } = await params;
  const user = await getUserDetailForAdmin(id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user });
}
