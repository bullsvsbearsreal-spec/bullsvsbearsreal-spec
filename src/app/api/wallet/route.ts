import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EthTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  gasUsed: string;
  gasPrice: string;
}

interface EthTokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  timeStamp: string;
  contractAddress: string;
}

interface BtcTx {
  hash: string;
  time: number;
  result: number;
  inputs: Array<{ prev_out?: { addr?: string; value: number } }>;
  out: Array<{ addr?: string; value: number }>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonOk(data: unknown) {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

/* ------------------------------------------------------------------ */
/*  ETH wallet handler                                                 */
/* ------------------------------------------------------------------ */

async function fetchEthWallet(address: string) {
  const base = 'https://api.etherscan.io/api';

  // Fetch balance, recent txns, and ERC-20 transfers in parallel
  const [balRes, txRes, tokenRes] = await Promise.all([
    fetch(`${base}?module=account&action=balance&address=${address}&tag=latest`),
    fetch(`${base}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`),
    fetch(`${base}?module=account&action=tokentx&address=${address}&page=1&offset=20&sort=desc`),
  ]);

  const [balJson, txJson, tokenJson] = await Promise.all([
    balRes.json() as Promise<{ status: string; result: string }>,
    txRes.json() as Promise<{ status: string; result: EthTransaction[] }>,
    tokenRes.json() as Promise<{ status: string; result: EthTokenTransfer[] }>,
  ]);

  // Parse balance (wei -> ETH)
  const balanceWei = BigInt(balJson.result || '0');
  const balanceEth = Number(balanceWei) / 1e18;

  // Parse transactions
  const transactions = Array.isArray(txJson.result)
    ? txJson.result.map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: (Number(BigInt(tx.value || '0')) / 1e18).toFixed(6),
        timestamp: Number(tx.timeStamp) * 1000,
        isError: tx.isError === '1',
        direction: tx.to?.toLowerCase() === address.toLowerCase() ? 'in' : 'out',
      }))
    : [];

  // Aggregate ERC-20 tokens by contract address (deduplicate)
  const tokenMap = new Map<string, { symbol: string; name: string; balance: number; decimals: number }>();
  if (Array.isArray(tokenJson.result)) {
    for (const t of tokenJson.result) {
      const key = t.contractAddress.toLowerCase();
      const decimals = Number(t.tokenDecimal) || 18;
      const value = Number(BigInt(t.value || '0')) / Math.pow(10, decimals);
      const existing = tokenMap.get(key);
      if (!existing) {
        tokenMap.set(key, {
          symbol: t.tokenSymbol,
          name: t.tokenName,
          balance: t.to?.toLowerCase() === address.toLowerCase() ? value : -value,
          decimals,
        });
      } else {
        existing.balance += t.to?.toLowerCase() === address.toLowerCase() ? value : -value;
      }
    }
  }

  const tokens = Array.from(tokenMap.values())
    .filter((t) => t.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 20);

  return {
    chain: 'eth' as const,
    address,
    balance: balanceEth.toFixed(6),
    balanceRaw: balanceEth,
    transactions,
    tokens,
  };
}

/* ------------------------------------------------------------------ */
/*  BTC wallet handler                                                 */
/* ------------------------------------------------------------------ */

async function fetchBtcWallet(address: string) {
  const res = await fetch(`https://blockchain.info/rawaddr/${address}?limit=20`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Blockchain.info API error: ${res.status}`);
  }

  const data = await res.json() as {
    final_balance: number;
    txs: BtcTx[];
  };

  // Balance: satoshis -> BTC
  const balanceBtc = (data.final_balance ?? 0) / 1e8;

  const transactions = (data.txs ?? []).map((tx) => {
    // Determine direction: if any input is from our address, it is outgoing
    const isOutgoing = tx.inputs.some(
      (inp) => inp.prev_out?.addr?.toLowerCase() === address.toLowerCase(),
    );
    const valueSats = Math.abs(tx.result ?? 0);
    return {
      hash: tx.hash,
      from: isOutgoing ? address : tx.inputs[0]?.prev_out?.addr || 'unknown',
      to: isOutgoing ? (tx.out[0]?.addr || 'unknown') : address,
      value: (valueSats / 1e8).toFixed(8),
      timestamp: (tx.time ?? 0) * 1000,
      direction: isOutgoing ? 'out' : 'in',
    };
  });

  return {
    chain: 'btc' as const,
    address,
    balance: balanceBtc.toFixed(8),
    balanceRaw: balanceBtc,
    transactions,
    tokens: [],
  };
}

/* ------------------------------------------------------------------ */
/*  SOL wallet handler                                                 */
/* ------------------------------------------------------------------ */

async function fetchSolWallet(address: string) {
  const rpcUrl = 'https://api.mainnet-beta.solana.com';

  // Fetch balance and recent signatures in parallel
  const [balRes, sigRes] = await Promise.all([
    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address],
      }),
    }),
    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 20 }],
      }),
    }),
  ]);

  const balJson = await balRes.json() as {
    result?: { value: number };
    error?: { message: string };
  };
  const sigJson = await sigRes.json() as {
    result?: Array<{
      signature: string;
      blockTime: number | null;
      err: unknown;
      memo: string | null;
    }>;
    error?: { message: string };
  };

  if (balJson.error) {
    throw new Error(`Solana RPC error: ${balJson.error.message}`);
  }

  // Lamports -> SOL
  const lamports = balJson.result?.value ?? 0;
  const balanceSol = lamports / 1e9;

  const transactions = (sigJson.result ?? []).map((sig) => ({
    hash: sig.signature,
    from: address,
    to: '',
    value: '',
    timestamp: (sig.blockTime ?? 0) * 1000,
    direction: 'unknown' as const,
    error: sig.err !== null,
  }));

  return {
    chain: 'sol' as const,
    address,
    balance: balanceSol.toFixed(6),
    balanceRaw: balanceSol,
    transactions,
    tokens: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim();
  const chain = searchParams.get('chain') as 'eth' | 'btc' | 'sol' | null;

  if (!address) {
    return errorResponse('Missing address parameter');
  }
  if (!chain || !['eth', 'btc', 'sol'].includes(chain)) {
    return errorResponse('Invalid or missing chain parameter. Use eth, btc, or sol.');
  }

  try {
    let data;
    switch (chain) {
      case 'eth':
        data = await fetchEthWallet(address);
        break;
      case 'btc':
        data = await fetchBtcWallet(address);
        break;
      case 'sol':
        data = await fetchSolWallet(address);
        break;
    }
    return jsonOk(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching wallet data';
    return errorResponse(message, 502);
  }
}
