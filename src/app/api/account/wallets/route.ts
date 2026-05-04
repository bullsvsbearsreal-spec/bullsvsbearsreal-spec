/**
 * GET  /api/account/wallets       list connected wallet addresses
 * POST /api/account/wallets       add a wallet (read-only — no private keys)
 *
 * Auth-gated. Address is normalised to lowercase before storage so dedup
 * works across mixed-case copy-paste.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, initDB, listUserWallets, addUserWallet } from '@/lib/db';
import {
  isSupportedChain,
  isValidAddress,
  SUPPORTED_CHAINS,
} from '@/lib/portfolio/supported-exchanges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503, headers: NO_STORE });
  }
  const wallets = await listUserWallets(session.user.id);
  return NextResponse.json(
    {
      wallets,
      supportedChains: SUPPORTED_CHAINS,
    },
    { headers: NO_STORE },
  );
}

interface CreateBody {
  chain?: string;
  address?: string;
  label?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503, headers: NO_STORE });
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }

  const chain = body.chain?.trim().toLowerCase();
  const address = body.address?.trim();
  const label = body.label?.trim().slice(0, 60) || null;

  if (!isSupportedChain(chain)) {
    return NextResponse.json(
      { error: `Unsupported chain. Pick one of: ${SUPPORTED_CHAINS.join(', ')}` },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!address || !isValidAddress(chain, address)) {
    return NextResponse.json(
      {
        error: chain === 'solana'
          ? 'Invalid Solana address (expect base58, 32-44 chars)'
          : 'Invalid EVM/Hyperliquid address (expect 0x… 40 hex chars)',
      },
      { status: 400, headers: NO_STORE },
    );
  }

  await initDB();

  const result = await addUserWallet({
    userId: session.user.id,
    chain,
    address,
    label,
  });

  return NextResponse.json(
    { id: result.id, chain, address: address.toLowerCase(), label },
    { status: 201, headers: NO_STORE },
  );
}
