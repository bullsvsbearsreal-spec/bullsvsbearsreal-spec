export const runtime = 'edge';
export const preferredRegion = 'dxb1';

/* ─── Types ──────────────────────────────────────────────────────── */

interface LlamaProtocol {
  name: string;
  slug: string;
  category: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1d: number | null;
  change_7d: number | null;
  logo: string;
}

interface ExchangeReserve {
  name: string;
  slug: string;
  totalReserve: number;
  change1d: number | null;
  change7d: number | null;
  logo: string;
  chains: Array<{ chain: string; value: number }>;
}

/* ─── Handler ────────────────────────────────────────────────────── */

export async function GET() {
  try {
    // Must use full /protocols — the /lite/v2/protocols strips CEX category
    const res = await fetch('https://api.llama.fi/protocols', {
      next: { revalidate: 300 }, // 5-min cache
    });

    if (!res.ok) throw new Error(`DefiLlama HTTP ${res.status}`);

    const protocols: LlamaProtocol[] = await res.json();

    // Filter to CEX category only
    const cexProtocols = protocols.filter(
      (p) => p.category === 'CEX' && p.tvl > 0,
    );

    // Sort by TVL descending
    cexProtocols.sort((a, b) => b.tvl - a.tvl);

    // Take top 25 exchanges
    const top = cexProtocols.slice(0, 25);

    // Compute totals
    const totalReserves = top.reduce((s, p) => s + p.tvl, 0);

    // Map to our response format
    const exchanges: ExchangeReserve[] = top.map((p) => {
      // Build chain breakdown, sorted by value
      const chains: Array<{ chain: string; value: number }> = [];
      if (p.chainTvls) {
        Object.entries(p.chainTvls).forEach(([chain, value]) => {
          if (value > 0) {
            chains.push({ chain, value: value as number });
          }
        });
        chains.sort((a, b) => b.value - a.value);
      }

      return {
        name: p.name.replace(' CEX', ''),
        slug: p.slug,
        totalReserve: p.tvl,
        change1d: p.change_1d,
        change7d: p.change_7d,
        logo: p.logo || '',
        chains: chains.slice(0, 10), // top 10 chains per exchange
      };
    });

    return Response.json({
      totalReserves,
      exchangeCount: exchanges.length,
      exchanges,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('Reserves API error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch reserves' },
      { status: 500 },
    );
  }
}
