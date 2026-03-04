import { fetchWithTimeout } from './fetch';
import { logExchangeError } from '@/lib/logging';

// A generic type for exchange data fetchers
export type ExchangeFetcher<T> = (
  fetchFn: typeof fetchWithTimeout
) => Promise<T[]>;

export interface ExchangeFetcherConfig<T> {
  name: string;
  fetcher: ExchangeFetcher<T>;
}

export interface ExchangeHealth {
  name: string;
  status: 'ok' | 'error' | 'empty' | 'circuit-open';
  count: number;
  latencyMs: number;
  error?: string;
}

export interface FetchAllResult<T> {
  data: T[];
  health: ExchangeHealth[];
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────
// After THRESHOLD consecutive failures within WINDOW_MS, skip the exchange
// for COOLDOWN_MS. This prevents wasting time on exchanges that are down.

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const CIRCUIT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

interface CircuitState {
  failures: number;
  firstFailureAt: number;
  openedAt: number | null; // null = circuit closed
}

const circuitStates = new Map<string, CircuitState>();

function getCircuit(name: string): CircuitState {
  if (!circuitStates.has(name)) {
    circuitStates.set(name, { failures: 0, firstFailureAt: 0, openedAt: null });
  }
  return circuitStates.get(name)!;
}

function isCircuitOpen(name: string): boolean {
  const state = getCircuit(name);
  if (!state.openedAt) return false;
  // Auto-reset after cooldown
  if (Date.now() - state.openedAt >= CIRCUIT_COOLDOWN_MS) {
    state.openedAt = null;
    state.failures = 0;
    state.firstFailureAt = 0;
    return false;
  }
  return true;
}

function recordSuccess(name: string) {
  const state = getCircuit(name);
  state.failures = 0;
  state.openedAt = null;
}

function recordFailure(name: string) {
  const state = getCircuit(name);
  const now = Date.now();

  // Reset window if first failure was too long ago
  if (now - state.firstFailureAt > CIRCUIT_WINDOW_MS) {
    state.failures = 0;
    state.firstFailureAt = now;
  }

  if (state.failures === 0) state.firstFailureAt = now;
  state.failures++;

  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.openedAt = now;
    console.warn(`[CircuitBreaker] ${name}: OPEN — ${state.failures} failures in ${Math.round((now - state.firstFailureAt) / 1000)}s, skipping for ${CIRCUIT_COOLDOWN_MS / 1000}s`);
  }
}

/** Get circuit breaker status for all tracked exchanges */
export function getCircuitBreakerStatus(): Record<string, { failures: number; isOpen: boolean; openedAt: number | null }> {
  const result: Record<string, { failures: number; isOpen: boolean; openedAt: number | null }> = {};
  circuitStates.forEach((state, name) => {
    result[name] = {
      failures: state.failures,
      isOpen: isCircuitOpen(name),
      openedAt: state.openedAt,
    };
  });
  return result;
}

// ─── Fetcher Functions ──────────────────────────────────────────────────────

// Run all exchange fetchers in parallel with error isolation and health tracking
export async function fetchAllExchanges<T>(
  configs: ExchangeFetcherConfig<T>[],
  fetchFn: typeof fetchWithTimeout
): Promise<T[]> {
  const { data } = await fetchAllExchangesWithHealth(configs, fetchFn);
  return data;
}

// Run all exchange fetchers with health tracking
// Includes one automatic retry on failure/empty to handle intermittent API blocks
export async function fetchAllExchangesWithHealth<T>(
  configs: ExchangeFetcherConfig<T>[],
  fetchFn: typeof fetchWithTimeout
): Promise<FetchAllResult<T>> {
  const health: ExchangeHealth[] = [];

  const promises = configs.map(async ({ name, fetcher }) => {
    // Circuit breaker check — skip if exchange is in cooldown
    if (isCircuitOpen(name)) {
      health.push({
        name,
        status: 'circuit-open',
        count: 0,
        latencyMs: 0,
        error: 'Circuit breaker open — exchange temporarily skipped',
      });
      return [] as T[];
    }

    const start = Date.now();
    let lastError = '';

    // Try up to 2 attempts (initial + 1 retry)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 500)); // Brief delay before retry
        const result = await fetcher(fetchFn);
        if (result.length > 0) {
          recordSuccess(name);
          health.push({
            name,
            status: 'ok',
            count: result.length,
            latencyMs: Date.now() - start,
          });
          return result;
        }
        // Empty result — retry once in case of transient issue
        if (attempt === 0) continue;
        recordFailure(name);
        health.push({ name, status: 'empty', count: 0, latencyMs: Date.now() - start });
        return [] as T[];
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        if (attempt === 0) continue; // Retry on first failure
        recordFailure(name);
        logExchangeError(name, error, { route: 'exchange-fetcher' });
        health.push({
          name,
          status: 'error',
          count: 0,
          latencyMs: Date.now() - start,
          error: lastError,
        });
        return [] as T[];
      }
    }
    return [] as T[];
  });

  const results = await Promise.all(promises);
  return { data: results.flat(), health };
}
