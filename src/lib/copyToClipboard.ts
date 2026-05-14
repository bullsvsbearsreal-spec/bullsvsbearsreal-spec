/**
 * Copy text to the user's clipboard with a sane fallback path.
 *
 * Why this isn't just `navigator.clipboard.writeText`:
 *   1. The Async Clipboard API requires a secure context. In a local
 *      dev tunnel (HTTP), an iframe with no Permissions-Policy, or
 *      an embedded preview environment, `navigator.clipboard` is
 *      undefined and the bare call throws.
 *   2. The Promise rejects (not throws) if permission is denied or
 *      the document isn't focused — every callsite was using
 *      `.then(...)` with no `.catch`, so on rejection the toast
 *      never fired and the console showed an unhandled rejection.
 *
 * Returns true on success. Never rejects.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the execCommand path below — Safari throws if
      // the document isn't focused (e.g., the user clicked from a
      // devtools panel), which is recoverable.
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
