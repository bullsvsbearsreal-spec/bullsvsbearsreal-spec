/**
 * Password strength validation.
 * Requires: 8+ chars, at least one uppercase, one lowercase, one digit.
 */
export function validatePassword(password: string): { ok: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/\d/.test(password)) {
    return { ok: false, error: 'Password must contain at least one number' };
  }
  return { ok: true };
}
