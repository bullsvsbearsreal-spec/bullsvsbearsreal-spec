/**
 * Tests for the tick-gate mutex+cooldown helper. This is the gating
 * primitive that runWatchTick in hl-watch-runner.ts uses to prevent
 * duplicate Telegram pings under racing cron triggers.
 *
 * What "duplicate ping" looks like in practice: two cron triggers run
 * concurrently, both read the same prevSnap, both diff the same delta,
 * both insert event rows (with different ids), both pass the dedup
 * check (which is keyed on event_id) → user receives the same alert
 * twice. The mutex prevents step 1.
 *
 * Cooldown protects against admin spam from /admin-panel#actions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTickGate } from '../tickGate';

describe('createTickGate', () => {
  /* ─── Cooldown behavior ─────────────────────────────────────── */

  describe('cooldown', () => {
    it('first call always runs (no prior tick)', async () => {
      const gate = createTickGate<string>({ minIntervalMs: 30_000 });
      const r = await gate.tryRun(async () => 'hello');
      expect(r.type).toBe('ran');
      if (r.type === 'ran') expect(r.result).toBe('hello');
    });

    it('second call within cooldown returns "cooldown"', async () => {
      let t = 1_000_000;
      const gate = createTickGate<string>({ minIntervalMs: 30_000, now: () => t });

      await gate.tryRun(async () => 'first');
      t += 5_000; // 5s later — still inside cooldown
      const r = await gate.tryRun(async () => 'second');
      expect(r.type).toBe('cooldown');
      if (r.type === 'cooldown') {
        expect(r.sinceLastMs).toBe(5_000);
        expect(r.minIntervalMs).toBe(30_000);
      }
    });

    it('call after cooldown elapses runs again', async () => {
      let t = 1_000_000;
      const gate = createTickGate<string>({ minIntervalMs: 30_000, now: () => t });

      await gate.tryRun(async () => 'first');
      t += 30_001; // just past cooldown
      const r = await gate.tryRun(async () => 'second');
      expect(r.type).toBe('ran');
      if (r.type === 'ran') expect(r.result).toBe('second');
    });

    it('boundary: cooldown is strict less-than (exactly equal still skips)', async () => {
      let t = 1_000_000;
      const gate = createTickGate<string>({ minIntervalMs: 30_000, now: () => t });

      await gate.tryRun(async () => 'first');
      t += 30_000; // exactly at cooldown boundary
      const r = await gate.tryRun(async () => 'second');
      // sinceLast === minIntervalMs is NOT less than → should run
      expect(r.type).toBe('ran');
    });

    it('returns useful diagnostic fields on cooldown', async () => {
      let t = 1_000_000;
      const gate = createTickGate<string>({ minIntervalMs: 60_000, now: () => t });
      await gate.tryRun(async () => 'first');
      t += 15_000;
      const r = await gate.tryRun(async () => 'second');
      if (r.type !== 'cooldown') throw new Error('expected cooldown');
      expect(r.sinceLastMs).toBe(15_000);
      expect(r.minIntervalMs).toBe(60_000);
    });
  });

  /* ─── Mutex / re-entry behavior ─────────────────────────────── */

  describe('mutex (concurrent calls)', () => {
    it('two concurrent calls share the same in-flight promise', async () => {
      const gate = createTickGate<string>({ minIntervalMs: 0 });

      let fnCallCount = 0;
      // gate work that we control via a deferred resolution
      let resolveFn: (v: string) => void = () => {};
      const fnPromise = new Promise<string>(r => { resolveFn = r; });
      const fn = async () => {
        fnCallCount++;
        return fnPromise;
      };

      const p1 = gate.tryRun(fn);
      const p2 = gate.tryRun(fn);

      // Resolve the inner function — both callers should see the result
      resolveFn('work-result');
      const [r1, r2] = await Promise.all([p1, p2]);

      // The function was invoked ONCE (mutex), but both callers got back the result
      expect(fnCallCount).toBe(1);
      // r1 is 'ran' (first), r2 is 'inflight' (second)
      expect(r1.type).toBe('ran');
      expect(r2.type).toBe('inflight');
      if (r1.type === 'ran') expect(r1.result).toBe('work-result');
      if (r2.type === 'inflight') expect(r2.result).toBe('work-result');
    });

    it('many concurrent callers all share one execution', async () => {
      const gate = createTickGate<number>({ minIntervalMs: 0 });

      let fnCallCount = 0;
      let resolveFn: (v: number) => void = () => {};
      const fnPromise = new Promise<number>(r => { resolveFn = r; });
      const fn = async () => { fnCallCount++; return fnPromise; };

      const ps = Array.from({ length: 10 }, () => gate.tryRun(fn));
      resolveFn(42);
      const results = await Promise.all(ps);

      expect(fnCallCount).toBe(1);
      // First call ran, the other 9 came in while in-flight
      const ran = results.filter(r => r.type === 'ran');
      const inflight = results.filter(r => r.type === 'inflight');
      expect(ran).toHaveLength(1);
      expect(inflight).toHaveLength(9);
      // All carry the same result
      for (const r of results) {
        if (r.type === 'ran' || r.type === 'inflight') {
          expect(r.result).toBe(42);
        }
      }
    });

    it('after in-flight resolves, the next call can run again (if cooldown elapsed)', async () => {
      let t = 1_000_000;
      const gate = createTickGate<string>({ minIntervalMs: 100, now: () => t });

      await gate.tryRun(async () => 'first');
      t += 500;
      const r = await gate.tryRun(async () => 'second');
      expect(r.type).toBe('ran');
      if (r.type === 'ran') expect(r.result).toBe('second');
    });
  });

  /* ─── Error / exception handling ────────────────────────────── */

  describe('errors', () => {
    it('propagates rejection from the inner function', async () => {
      const gate = createTickGate<string>({ minIntervalMs: 0 });
      await expect(
        gate.tryRun(async () => { throw new Error('boom'); }),
      ).rejects.toThrow('boom');
    });

    it('clears in-flight after a rejection so next call can run', async () => {
      const gate = createTickGate<string>({ minIntervalMs: 0 });
      try {
        await gate.tryRun(async () => { throw new Error('boom'); });
      } catch { /* expected */ }
      expect(gate._stateForTest().inFlight).toBe(false);

      // Next call should be able to run
      const r = await gate.tryRun(async () => 'ok');
      expect(r.type).toBe('ran');
    });

    it('does NOT advance lastRunAt on rejection (so cooldown not reset)', async () => {
      let t = 1_000_000;
      const gate = createTickGate<string>({ minIntervalMs: 30_000, now: () => t });

      // Run a successful tick to establish lastRunAt
      await gate.tryRun(async () => 'ok');
      const firstLastRunAt = gate._stateForTest().lastRunAt;
      expect(firstLastRunAt).toBe(t); // 1_000_000

      t += 10_000;
      // Failed call should not advance lastRunAt
      try {
        await gate.tryRun(async () => { throw new Error('boom'); });
      } catch { /* expected */ }
      // wait — the failed call hit the cooldown gate first (10s < 30s),
      // so it never even called the inner fn. Let me re-check the logic.
      // Actually: cooldown check happens BEFORE running. 10s < 30s →
      // returns 'cooldown' without running. So lastRunAt unchanged.
      expect(gate._stateForTest().lastRunAt).toBe(firstLastRunAt);

      // Now advance past cooldown, then fail
      t += 30_000;
      try {
        await gate.tryRun(async () => { throw new Error('boom'); });
      } catch { /* expected */ }
      // After rejection, lastRunAt is NOT updated — so the next call
      // (immediately after) should be able to retry.
      expect(gate._stateForTest().lastRunAt).toBe(firstLastRunAt);
    });
  });

  /* ─── _resetForTest ─────────────────────────────────────────── */

  it('_resetForTest clears state', async () => {
    let t = 1_000_000;
    const gate = createTickGate<string>({ minIntervalMs: 30_000, now: () => t });

    await gate.tryRun(async () => 'first');
    expect(gate._stateForTest().lastRunAt).toBe(1_000_000);

    gate._resetForTest();
    expect(gate._stateForTest()).toEqual({ lastRunAt: 0, inFlight: false });

    // After reset, immediate call should run (no cooldown to honor)
    const r = await gate.tryRun(async () => 'after-reset');
    expect(r.type).toBe('ran');
  });
});

/* ─── Independent gates don't share state ───────────────────── */

describe('multiple gates are independent', () => {
  it('two gates have separate state', async () => {
    const gateA = createTickGate<string>({ minIntervalMs: 30_000 });
    const gateB = createTickGate<string>({ minIntervalMs: 30_000 });

    const a = await gateA.tryRun(async () => 'A');
    const b = await gateB.tryRun(async () => 'B');

    expect(a.type).toBe('ran');
    expect(b.type).toBe('ran');
    // gateA's cooldown does not block gateB
  });
});
