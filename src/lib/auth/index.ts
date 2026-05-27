/**
 * NextAuth v5 configuration for InfoHub.
 * JWT sessions (best for serverless) + custom Postgres adapter for user persistence.
 * Providers: Credentials (email/password), Google, Discord, Twitter.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Discord from 'next-auth/providers/discord';
import Twitter from 'next-auth/providers/twitter';
import bcrypt from 'bcryptjs';
import { PostgresAdapter, getSQL } from './adapter';

// Build providers list — only include OAuth providers with configured credentials
const providers: any[] = [
  Credentials({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
      password: { label: 'Password', type: 'password' },
      twoFactorNonce: { label: '2FA Nonce', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const db = getSQL();
      const rows = await db`
        SELECT id, name, email, image, password_hash, email_verified
        FROM users WHERE email = ${credentials.email as string}
      `;

      // Constant-time: always run bcrypt to prevent timing-based email enumeration
      const DUMMY_HASH = '$2a$12$000000000000000000000uGBOzFBKvLMbVaFMgvweDHL8dh3M3/ZW';
      const user = rows.length > 0 ? rows[0] : null;
      const hashToCompare = user?.password_hash || DUMMY_HASH;
      const valid = await bcrypt.compare(credentials.password as string, hashToCompare);
      if (!user || !user.password_hash || !valid) return null;

      // Block unverified email accounts (!user.email_verified catches both null and undefined)
      if (!user.email_verified) {
        throw new Error('EMAIL_NOT_VERIFIED');
      }

      // Server-side 2FA enforcement — prevents bypass via direct NextAuth callback.
      // The client flow is: check-credentials → 2fa/validate → signIn(), but an attacker
      // could skip straight to signIn(). This check verifies a server-issued nonce.
      const twofa = await db`
        SELECT totp_enabled, email_2fa_enabled FROM user_2fa WHERE user_id = ${user.id}
      `;
      if (twofa.length > 0 && (twofa[0].totp_enabled || twofa[0].email_2fa_enabled)) {
        // 2FA is enabled — require a valid server-side nonce from /api/auth/2fa/validate.
        const nonce = credentials.twoFactorNonce as string | undefined;
        if (!nonce) {
          throw new Error('2FA_REQUIRED');
        }
        // Atomically claim the nonce — prevents replay and ensures server-side proof
        const claimed = await db`
          DELETE FROM twofa_nonces
          WHERE user_id = ${user.id}
            AND nonce = ${nonce}
            AND expires_at > NOW()
          RETURNING id
        `;
        if (claimed.length === 0) {
          throw new Error('2FA_REQUIRED');
        }
      }

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

// Only add OAuth providers if credentials are configured
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
  }));
}

if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) {
  providers.push(Discord({
    clientId: process.env.AUTH_DISCORD_ID,
    clientSecret: process.env.AUTH_DISCORD_SECRET,
  }));
}

if (process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET) {
  providers.push(Twitter({
    clientId: process.env.AUTH_TWITTER_ID,
    clientSecret: process.env.AUTH_TWITTER_SECRET,
  }));
}

/** Check if a user has admin role. Owner is implicitly admin. */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const db = getSQL();
    const rows = await db`SELECT role FROM users WHERE id = ${userId}`;
    const role = rows[0]?.role;
    return role === 'admin' || role === 'owner';
  } catch {
    return false;
  }
}

/** Owner role check — restricted-actions (grant admin, grant owner, etc.) */
export async function isOwner(userId: string): Promise<boolean> {
  try {
    const db = getSQL();
    const rows = await db`SELECT role FROM users WHERE id = ${userId}`;
    return rows[0]?.role === 'owner';
  } catch {
    return false;
  }
}

/**
 * Fetch a user's role with a real-time DB lookup. Used by the
 * per-role panel auth gates. Returns 'user' on any DB hiccup so a
 * transient outage doesn't accidentally grant elevated access.
 */
export async function getUserRole(userId: string): Promise<'owner' | 'admin' | 'moderator' | 'marketer' | 'support' | 'advisor' | 'user'> {
  try {
    const db = getSQL();
    const rows = await db`SELECT role FROM users WHERE id = ${userId}`;
    const r = rows[0]?.role;
    if (r === 'owner' || r === 'admin' || r === 'moderator' || r === 'marketer' || r === 'support' || r === 'advisor') return r;
    return 'user';
  } catch {
    return 'user';
  }
}

/**
 * Resolve a user's billing tier from the database. Used by tier-aware
 * enforcement (wallet watch cap, alert count cap, rate limits, history
 * window) so the rules in lib/constants/tiers.ts actually bite.
 *
 * Reads `role` + `billing_tier` from `users` in one query, then delegates
 * to `resolveUserTier` so the admin→whale grandfathering stays in a
 * single place. Defaults to 'free' on any DB error so a transient
 * outage doesn't accidentally lock a paying user out of features.
 */
export async function getUserTier(userId: string): Promise<'free' | 'trader' | 'pro' | 'whale'> {
  try {
    const db = getSQL();
    const rows = await db`SELECT role, billing_tier FROM users WHERE id = ${userId}`;
    if (rows.length === 0) return 'free';
    // Lazy import to avoid pulling tier constants into the auth module's
    // server-bundle when they're only needed for this one helper.
    const { resolveUserTier } = await import('@/lib/constants/tiers');
    return resolveUserTier({
      role: rows[0].role as string | null,
      billingTier: rows[0].billing_tier as 'free' | 'trader' | 'pro' | 'whale' | null,
    });
  } catch {
    return 'free';
  }
}

/**
 * CSRF defense via Origin header check. Reject mutation requests whose
 * Origin doesn't match our own. Browsers ALWAYS attach Origin to
 * cross-origin POST/DELETE/PUT, so this catches forged form-submits
 * from attacker-controlled pages that an admin happens to be visiting.
 *
 * NextAuth uses SameSite=Lax cookies (default) which already provides
 * baseline CSRF protection, but this is defense-in-depth — Origin
 * checks survive cookie behaviour changes and explicit browser
 * overrides.
 *
 * Returns a 403 Response on mismatch, null on pass. Treats missing
 * Origin (some old browsers, server-to-server) as failure because
 * legitimate admin browsers always send it.
 */
export function verifySameOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin');
  if (!origin) {
    return Response.json(
      { error: 'Missing Origin header — mutation requests must come from a browser' },
      { status: 403 },
    );
  }
  // Allow either the canonical BASE_URL or the live request host. The
  // BASE_URL covers production (info-hub.io) and the host fallback
  // covers preview deploys and the DO subdomain.
  const allowed = new Set<string>();
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    allowed.add(new URL(process.env.NEXT_PUBLIC_BASE_URL).origin);
  }
  try {
    allowed.add(new URL(request.url).origin);
  } catch { /* unparseable url — fall through */ }

  if (!allowed.has(origin)) {
    return Response.json(
      { error: 'Origin not allowed' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Combined admin + Origin gate for mutation endpoints. Returns a
 * Response if either check fails (401/403); returns null on pass.
 * Use at the top of every admin POST/DELETE/PUT handler.
 */
export async function requireAdminMutation(request: Request): Promise<Response | null> {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  return requireAdmin();
}

/** Require admin role — re-verifies against DB to prevent stale JWT exploits */
export async function requireAdmin(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Real-time DB check — JWT role can be stale after revocation
  if (!(await isAdmin(session.user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

/**
 * Require any dashboard-read role — owner / admin / advisor / moderator
 * / marketer. The name is historical (used to be strictly admin-or-
 * advisor); it now covers every role that has some kind of dashboard
 * access. Re-verifies against DB so a stale JWT can't bypass.
 *
 * Routes that need to gate tighter than "any dashboard read" should
 * use requireAdmin, requireOwner, requireMod, or requireMarketer
 * instead of this helper.
 */
export async function requireAdminOrAdvisor(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const db = getSQL();
    const rows = await db`SELECT role FROM users WHERE id = ${session.user.id}`;
    const role = rows.length > 0 ? rows[0].role : null;
    // NOTE: 'support' is intentionally NOT in this set. Support staff
    // get only the tickets surface via requireSupport — not raw admin
    // routes like /api/admin/login-activity or /api/admin/api-analytics
    // that would leak PII or operational data they don't need.
    const ok = role === 'owner'
            || role === 'admin'
            || role === 'advisor'
            || role === 'moderator'
            || role === 'marketer';
    if (!ok) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

/**
 * Owner-only gate — for the few mutations that require the highest
 * privilege (granting/revoking admin or owner, system-wide tier
 * comp). Re-checks the DB on every call.
 */
export async function requireOwner(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isOwner(session.user.id))) {
    return Response.json({ error: 'Owner only' }, { status: 403 });
  }
  return null;
}

/**
 * Moderator gate — moderators + admins + owner. Used by mod-panel
 * routes (Users read + notes + Feedback).
 */
export async function requireMod(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = await getUserRole(session.user.id);
  if (role !== 'moderator' && role !== 'admin' && role !== 'owner') {
    return Response.json({ error: 'Moderator access required' }, { status: 403 });
  }
  return null;
}

/**
 * Marketer gate — marketers + admins + owner. Used by marketing-panel
 * routes (Growth + Revenue + Affiliates + Broadcast).
 */
export async function requireMarketer(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = await getUserRole(session.user.id);
  if (role !== 'marketer' && role !== 'admin' && role !== 'owner') {
    return Response.json({ error: 'Marketer access required' }, { status: 403 });
  }
  return null;
}

/**
 * Support gate — anyone who can handle support tickets:
 *   owner | admin | moderator | support
 * Marketers cannot read tickets (they have their own panel + we don't
 * want a marketer reading user-private support content); advisors are
 * dashboard-read-only and explicitly excluded.
 */
export async function requireSupport(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = await getUserRole(session.user.id);
  if (role !== 'support' && role !== 'moderator' && role !== 'admin' && role !== 'owner') {
    return Response.json({ error: 'Support access required' }, { status: 403 });
  }
  return null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(),
  session: { strategy: 'jwt' }, // JWT sessions — no DB session lookups
  providers,
  pages: {
    signIn: '/login',
    // signUp handled by custom /signup page
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        // Skip data URIs in JWT — they blow common platform cookie/header
        // size limits (32KB on Cloudflare, similar on DO App Platform)
        const img = user.image as string | null;
        token.image = img && !img.startsWith('data:') ? img : null;
      }
      // Fetch role + billing_tier + refresh image from DB on login or
      // session update. billing_tier is added to the JWT so client-side
      // tier resolution (UserMenu chip, dashboard caps, /pricing current
      // tier badge) doesn't need an extra round-trip per page load.
      if ((user || trigger === 'update') && token.id) {
        try {
          const db = getSQL();
          const rows = await db`SELECT image, role, billing_tier FROM users WHERE id = ${token.id as string}`;
          if (rows.length > 0) {
            // Only store image in JWT if it's a short URL (not a base64 data URI)
            // Data URIs can be 100KB+ and blow common 32KB header limits
            const img = rows[0].image as string | null;
            token.image = img && !img.startsWith('data:') ? img : null;
            token.role = rows[0].role || 'user';
            const tier = rows[0].billing_tier;
            token.billingTier = (tier === 'trader' || tier === 'pro' || tier === 'whale') ? tier : 'free';
          }
        } catch { /* keep existing */ }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      if (token?.image) {
        session.user.image = token.image as string;
      }
      if (token?.role) {
        // Type union must mirror src/types/next-auth.d.ts — the cast
        // is what TypeScript sees in `session.user.role === 'owner'`
        // checks across the codebase.
        session.user.role = token.role as 'owner' | 'admin' | 'moderator' | 'marketer' | 'support' | 'advisor' | 'user';
      }
      if (token?.billingTier) {
        session.user.billingTier = token.billingTier as 'free' | 'trader' | 'pro' | 'whale';
      }
      return session;
    },
  },
  // Lightweight audit hooks — TRULY fire-and-forget (no `await` on the
  // DB INSERT) so a slow DB doesn't add latency to sign-in. NextAuth
  // awaits event handlers, so we let the inner SQL promise float; if
  // it rejects we just log. Recorded events power the audit log + the
  // user activity timeline.
  events: {
    signIn({ user, account, isNewUser }) {
      try {
        const db = getSQL();
        db`
          INSERT INTO admin_monitoring (metric, value, details)
          VALUES (
            ${'audit_auth_signin'},
            ${0},
            ${JSON.stringify({
              userId: user?.id ?? null,
              email: user?.email ?? null,
              provider: account?.provider ?? null,
              isNewUser: !!isNewUser,
            })}
          )
        `.catch((e: unknown) => console.warn('[auth] signIn audit failed:', e instanceof Error ? e.message : e));
      } catch (e) {
        console.warn('[auth] signIn audit failed:', e instanceof Error ? e.message : e);
      }
    },
    signOut(payload) {
      try {
        const db = getSQL();
        // NextAuth fires signOut with either { token } (JWT) or { session }
        const userId = (payload as any)?.token?.id
          ?? (payload as any)?.session?.user?.id
          ?? null;
        const email = (payload as any)?.token?.email
          ?? (payload as any)?.session?.user?.email
          ?? null;
        db`
          INSERT INTO admin_monitoring (metric, value, details)
          VALUES (${'audit_auth_signout'}, ${0}, ${JSON.stringify({ userId, email })})
        `.catch((e: unknown) => console.warn('[auth] signOut audit failed:', e instanceof Error ? e.message : e));
      } catch (e) {
        console.warn('[auth] signOut audit failed:', e instanceof Error ? e.message : e);
      }
    },
  },
  trustHost: true,
});
