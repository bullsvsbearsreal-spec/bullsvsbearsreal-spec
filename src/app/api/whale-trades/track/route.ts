/**
 * POST /api/whale-trades/track — Add a wallet to track
 * DELETE /api/whale-trades/track — Remove tracking
 *
 * Requires auth (session).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, initDB, addTrackedWallet, removeTrackedWallet } from '@/lib/db';
import { detectChain } from '@/lib/whale-trades';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const address = (body.address || '').trim();
  if (!address || (!/^0x[a-fA-F0-9]{40}$/i.test(address) && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const chain = body.chain || detectChain(address);
  const label = typeof body.label === 'string' ? body.label.slice(0, 100) : undefined;
  const channels = Array.isArray(body.notifyChannels)
    ? body.notifyChannels.filter((c: string) => ['email', 'push', 'telegram', 'discord', 'whatsapp'].includes(c))
    : ['push'];
  const minValueUsd = typeof body.minValueUsd === 'number' && body.minValueUsd > 0 ? body.minValueUsd : undefined;

  await initDB();
  const result = await addTrackedWallet('user', session.user.id, address, chain, label, channels, minValueUsd);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, address: address.toLowerCase(), chain, label });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const address = (body.address || '').trim();
  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  await initDB();
  const removed = await removeTrackedWallet(session.user.id, address, body.chain);
  return NextResponse.json({ ok: removed });
}
