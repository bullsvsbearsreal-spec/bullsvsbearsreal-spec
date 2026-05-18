import { describe, it, expect, vi } from 'vitest';
import { dedupedFetch } from '../inflight';

describe('dedupedFetch', () => {
  it('returns the fetcher result for a single call', async () => {
    const result = await dedupedFetch('key-a', () => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('shares a single in-flight promise across concurrent callers with the same key', async () => {
    let callCount = 0;
    let resolveFn: ((v: number) => void) | null = null;
    const fetcher = () => {
      callCount++;
      return new Promise<number>((res) => { resolveFn = res; });
    };

    // Two concurrent callers with the same key — should share one fetch
    const p1 = dedupedFetch('shared-key', fetcher);
    const p2 = dedupedFetch('shared-key', fetcher);
    const p3 = dedupedFetch('shared-key', fetcher);

    expect(callCount).toBe(1);  // fetcher invoked only once

    resolveFn!(100);
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toBe(100);
    expect(r2).toBe(100);
    expect(r3).toBe(100);
  });

  it('does NOT share the promise across different keys', async () => {
    let aCount = 0, bCount = 0;
    const fetcherA = () => { aCount++; return Promise.resolve('a'); };
    const fetcherB = () => { bCount++; return Promise.resolve('b'); };

    const [a, b] = await Promise.all([
      dedupedFetch('key-x', fetcherA),
      dedupedFetch('key-y', fetcherB),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
    expect(aCount).toBe(1);
    expect(bCount).toBe(1);
  });

  it('removes the key from the in-flight map after resolution (allowing fresh fetch)', async () => {
    let callCount = 0;
    const fetcher = () => { callCount++; return Promise.resolve('v'); };

    await dedupedFetch('refresh-key', fetcher);
    expect(callCount).toBe(1);

    // Second call after first resolves — should call fetcher again
    await dedupedFetch('refresh-key', fetcher);
    expect(callCount).toBe(2);
  });

  it('removes the key after rejection too (so failures can be retried)', async () => {
    let callCount = 0;
    const fetcher = () => { callCount++; return Promise.reject(new Error('boom')); };

    await expect(dedupedFetch('err-key', fetcher)).rejects.toThrow('boom');
    expect(callCount).toBe(1);

    // Second attempt should fire the fetcher again, not return the cached rejection
    await expect(dedupedFetch('err-key', fetcher)).rejects.toThrow('boom');
    expect(callCount).toBe(2);
  });

  it('propagates rejection to all concurrent callers sharing the same in-flight promise', async () => {
    let rejectFn: ((e: Error) => void) | null = null;
    const fetcher = () => new Promise<never>((_, rej) => { rejectFn = rej; });

    const p1 = dedupedFetch('shared-err', fetcher);
    const p2 = dedupedFetch('shared-err', fetcher);

    rejectFn!(new Error('shared boom'));
    await expect(p1).rejects.toThrow('shared boom');
    await expect(p2).rejects.toThrow('shared boom');
  });

  it('handles distinct keys with overlapping resolution timing', async () => {
    const fetcher = (val: string, ms: number) =>
      new Promise<string>((res) => setTimeout(() => res(val), ms));

    const results = await Promise.all([
      dedupedFetch('a', () => fetcher('A', 10)),
      dedupedFetch('b', () => fetcher('B', 5)),
      dedupedFetch('c', () => fetcher('C', 15)),
    ]);
    expect(results).toEqual(['A', 'B', 'C']);
  });

  it('preserves the fetcher return type (generic flow)', async () => {
    interface User { id: number; name: string }
    const user = await dedupedFetch<User>('user-1', () => Promise.resolve({ id: 1, name: 'Alice' }));
    expect(user.id).toBe(1);
    expect(user.name).toBe('Alice');
  });

  it('handles synchronous fetcher exceptions (treated as rejected promise)', async () => {
    // A fetcher that throws synchronously becomes a rejected promise via async/await
    const fetcher = async () => { throw new Error('sync throw'); };
    await expect(dedupedFetch('sync-err', fetcher)).rejects.toThrow('sync throw');
  });
});
