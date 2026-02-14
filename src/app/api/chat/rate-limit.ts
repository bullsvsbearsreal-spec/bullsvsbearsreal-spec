/**
 * In-memory sliding-window rate limiter for the chat API.
 * Limits are per-IP and global. Resets on cold start (Edge Runtime).
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const ipLimits = new Map<string, RateLimitEntry>();
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_PER_IP = 15; // 15 messages per IP per day
const MAX_INPUT_LENGTH = 500;

// Global hourly limit
let globalHourlyCount = 0;
let globalHourStart = Date.now();
const MAX_GLOBAL_HOURLY = 1000;

/** Clean up expired entries periodically. */
function cleanup(): void {
  const now = Date.now();
  const toDelete: string[] = [];
  ipLimits.forEach((entry, ip) => {
    if (now - entry.windowStart > WINDOW_MS) {
      toDelete.push(ip);
    }
  });
  toDelete.forEach((ip) => ipLimits.delete(ip));
}

// Clean up every 10 minutes
let lastCleanup = Date.now();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  error?: string;
}

export function checkRateLimit(ip: string, inputLength: number): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup
  if (now - lastCleanup > 10 * 60 * 1000) {
    cleanup();
    lastCleanup = now;
  }

  // Check input length
  if (inputLength > MAX_INPUT_LENGTH) {
    return { allowed: false, remaining: 0, error: 'Message too long (max 500 characters).' };
  }

  // Check global hourly limit
  if (now - globalHourStart > 60 * 60 * 1000) {
    globalHourlyCount = 0;
    globalHourStart = now;
  }
  if (globalHourlyCount >= MAX_GLOBAL_HOURLY) {
    return { allowed: false, remaining: 0, error: 'Service is busy. Please try again later.' };
  }

  // Check per-IP limit
  let entry = ipLimits.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    ipLimits.set(ip, entry);
  }

  if (entry.count >= MAX_PER_IP) {
    return {
      allowed: false,
      remaining: 0,
      error: `You've reached the daily message limit (${MAX_PER_IP}). Come back tomorrow or explore the data pages directly.`,
    };
  }

  // Allow request
  entry.count++;
  globalHourlyCount++;

  return {
    allowed: true,
    remaining: MAX_PER_IP - entry.count,
  };
}
