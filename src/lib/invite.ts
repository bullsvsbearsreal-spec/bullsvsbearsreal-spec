/**
 * Invite-code helpers — user-to-user referral system.
 *
 * Each signed-in user has a stable, opaque invite code derived from
 * their user ID via HMAC-SHA256 with INVITE_CODE_SECRET. The code is
 * deterministic (same user → same code forever) so we don't need to
 * store it in the users table — we just store the raw code string on
 * the *referred* user (users.referred_by_code) so we can count who
 * came in through each link.
 *
 * Why HMAC instead of just base36(user_id):
 *   - Doesn't leak the actual user UUID (signup-time enumeration risk)
 *   - Doesn't reveal user ordering / volume
 *   - Cheap to verify shape on the server (just check format), but
 *     proving a code belongs to a specific user requires re-hashing
 *     that user's ID — no lookup table needed.
 */

import crypto from 'crypto';

const INVITE_CODE_LENGTH = 10;
// Crockford base32 minus ambiguous chars (no 0, O, 1, I, L, U):
// 26 letters - 5 = 21 letters + 10 digits - 4 = 6 digits → too small.
// Just use base36 minus the 4 ambiguous chars (0, O, 1, I).
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function getSecret(): string {
  // Fall back to the NEXTAUTH_SECRET (already required for the app to
  // boot) so we don't need a separate env var. The secret is only
  // used to make the codes opaque — there's no auth privilege bound
  // to it.
  return (
    process.env.INVITE_CODE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'infohub-invite-fallback-dev-only'
  );
}

/**
 * Compute the invite code for a given user ID.
 *
 * The HMAC bytes are converted to base-32-ish using a 32-char alphabet
 * that excludes ambiguous glyphs (0/O/1/I/L), giving a code that's
 * easy to copy from one device to another without typos.
 */
export function computeInviteCode(userId: string): string {
  const h = crypto.createHmac('sha256', getSecret()).update(userId).digest();
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    // Each byte (0-255) mod 32 → an index into the 32-char alphabet
    out += ALPHABET[h[i] & 31];
  }
  return out;
}

/**
 * Cheap structural check — used to reject obviously-bad inputs before
 * a DB write. Doesn't prove the code belongs to a real user; that's
 * the job of the count-by-code lookup at /api/invite/stats.
 */
export function isValidInviteCodeShape(code: unknown): code is string {
  if (typeof code !== 'string') return false;
  if (code.length !== INVITE_CODE_LENGTH) return false;
  for (let i = 0; i < code.length; i++) {
    if (!ALPHABET.includes(code[i])) return false;
  }
  return true;
}

export const INVITE_CODE_FORMAT = {
  length: INVITE_CODE_LENGTH,
  alphabet: ALPHABET,
} as const;
