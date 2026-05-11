/**
 * Generic single-instance "tick gate" — wraps a long-running task with:
 *   1. **Mutex**: if a tick is already in-flight, subsequent callers
 *      receive the same in-flight promise rather than spawning a
 *      duplicate. Prevents two cron triggers (the snapshot piggyback
 *      and a manual /admin-panel invocation, say) from racing on the
 *      same data and double-firing side effects (e.g. duplicate
 *      Telegram pings).
 *   2. **Cooldown**: skip if the last tick completed less than
 *      `minIntervalMs` ago. Acts as a soft rate limit so admin spam
 *      can't hammer the worker.
 *
 * Extracted from `runWatchTick` in `hl-watch-runner.ts` (which the
 * Wallet Watch feature depends on) so the gating semantics can be
 * unit-tested without a DB / HTTP / Telegram stub.
 *
 * Pattern:
 *
 * ```ts
 * const gate = createTickGate<MyResult>({ minIntervalMs: 30_000 });
 *
 * async function runTick() {
 *   const r = await gate.tryRun(async () => doWork());
 *   if (r.type === 'cooldown') return shapeCooldownResult(r);
 *   return r.result;
 * }
 * ```
 */

export interface TickGateConfig {
  /** Minimum wall-clock ms between successful tick completions. */
  minIntervalMs: number;
  /** Optional clock — defaults to Date.now. Inject for deterministic tests. */
  now?: () => number;
}

export type TickGateResult<T> =
  | { type: 'ran'; result: T }
  /** A previous tick was already in-flight; we awaited it and return its result. */
  | { type: 'inflight'; result: T }
  /** The previous tick finished too recently. Caller decides how to shape the response. */
  | { type: 'cooldown'; sinceLastMs: number; minIntervalMs: number };

export interface TickGate<T> {
  tryRun(fn: () => Promise<T>): Promise<TickGateResult<T>>;
  /** Reset state for tests. NEVER call in production. */
  _resetForTest(): void;
  /** Inspect state for tests. */
  _stateForTest(): { lastRunAt: number; inFlight: boolean };
}

export function createTickGate<T>(config: TickGateConfig): TickGate<T> {
  let lastRunAt = 0;
  let inFlight: Promise<T> | null = null;
  const now = config.now ?? (() => Date.now());

  async function tryRun(fn: () => Promise<T>): Promise<TickGateResult<T>> {
    // Mutex: if a tick is currently running, return its in-flight
    // promise so the second caller waits for the first one to finish.
    // Both callers will resolve with the same result.
    if (inFlight) {
      const result = await inFlight;
      return { type: 'inflight', result };
    }

    // Cooldown: skip if a recent tick completed inside the interval.
    // We let the caller decide what shape the skip result takes (some
    // callers want a structured "skipped" sentinel, others might prefer
    // to throw — keep the gate agnostic).
    const sinceLast = now() - lastRunAt;
    if (sinceLast < config.minIntervalMs) {
      return { type: 'cooldown', sinceLastMs: sinceLast, minIntervalMs: config.minIntervalMs };
    }

    inFlight = fn();
    try {
      const result = await inFlight;
      lastRunAt = now();
      return { type: 'ran', result };
    } finally {
      inFlight = null;
    }
  }

  return {
    tryRun,
    _resetForTest() { lastRunAt = 0; inFlight = null; },
    _stateForTest() { return { lastRunAt, inFlight: inFlight !== null }; },
  };
}
