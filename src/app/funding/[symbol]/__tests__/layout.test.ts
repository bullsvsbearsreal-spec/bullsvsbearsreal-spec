import { describe, it, expect } from 'vitest';
import { generateMetadata } from '../layout';
import { ALL_EXCHANGES } from '@/lib/constants';

describe('funding/[symbol] generateMetadata', () => {
  it('returns a title with the actual exchange count (not a stale literal)', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ symbol: 'btc' }) });
    expect(meta.title).toContain(`Across ${ALL_EXCHANGES.length} Exchanges`);
  });

  it('uppercases the symbol in the title and description', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ symbol: 'btc' }) });
    expect(meta.title).toContain('BTC');
    expect(meta.description).toContain('BTC');
  });

  it('description has the "and N more exchanges" count = total - 4 named', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ symbol: 'eth' }) });
    // 4 named exchanges: Binance, Bybit, OKX, Hyperliquid
    const expectedRest = ALL_EXCHANGES.length - 4;
    expect(meta.description).toContain(`and ${expectedRest} more exchanges`);
  });

  it('sets a canonical URL pointing at the uppercase symbol', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ symbol: 'sol' }) });
    expect(meta.alternates?.canonical).toBe('https://info-hub.io/funding/SOL');
  });

  it('builds OG + Twitter card URLs with encoded title and description', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ symbol: 'btc' }) });
    const ogImage = meta.openGraph?.images;
    const twImage = meta.twitter?.images;
    expect(ogImage).toBeDefined();
    expect(twImage).toBeDefined();
    // Both should use the /api/og dynamic OG endpoint
    const ogUrl = Array.isArray(ogImage) ? (ogImage[0] as string) : (ogImage as string);
    expect(ogUrl).toContain('/api/og');
    expect(ogUrl).toContain('title=');
    expect(ogUrl).toContain('desc=');
  });

  it('handles already-uppercase symbols without double-uppercasing', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ symbol: 'PEPE' }) });
    expect(meta.title).toContain('PEPE');
  });

  it('handles a symbol with digits / dashes (degenerate but possible)', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ symbol: '1000pepe' }) });
    expect(meta.title).toContain('1000PEPE');
  });
});
