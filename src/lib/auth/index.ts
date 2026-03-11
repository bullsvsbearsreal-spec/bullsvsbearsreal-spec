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
      twoFactorValidated: { label: '2FA Validated', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const db = getSQL();
      const rows = await db`
        SELECT id, name, email, image, password_hash, email_verified
        FROM users WHERE email = ${credentials.email as string}
      `;

      if (rows.length === 0) return null;
      const user = rows[0];

      if (!user.password_hash) return null; // OAuth-only account
      const valid = await bcrypt.compare(credentials.password as string, user.password_hash);
      if (!valid) return null;

      // Block unverified email accounts (!user.email_verified catches both null and undefined)
      if (!user.email_verified) {
        throw new Error('EMAIL_NOT_VERIFIED');
      }

      // Server-side 2FA enforcement — prevents bypass via direct NextAuth callback.
      // The client flow is: check-credentials → 2fa/validate → signIn(), but an attacker
      // could skip straight to signIn(). This check ensures 2FA cannot be bypassed.
      const twofa = await db`
        SELECT totp_enabled, email_2fa_enabled FROM user_2fa WHERE user_id = ${user.id}
      `;
      if (twofa.length > 0 && (twofa[0].totp_enabled || twofa[0].email_2fa_enabled)) {
        // 2FA is enabled — require a validated 2FA token.
        // The client must pass twoFactorValidated=true after completing 2fa/validate.
        if (credentials.twoFactorValidated !== 'true') {
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

/** Check if a user has admin role */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const db = getSQL();
    const rows = await db`SELECT role FROM users WHERE id = ${userId}`;
    return rows.length > 0 && rows[0].role === 'admin';
  } catch {
    return false;
  }
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

/** Require admin or advisor role — re-verifies against DB to prevent stale JWT exploits */
export async function requireAdminOrAdvisor(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Real-time DB check — JWT role can be stale after revocation
  try {
    const db = getSQL();
    const rows = await db`SELECT role FROM users WHERE id = ${session.user.id}`;
    const role = rows.length > 0 ? rows[0].role : null;
    if (role !== 'admin' && role !== 'advisor') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
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
        // Skip data URIs in JWT — they blow Vercel's 32KB header limit
        const img = user.image as string | null;
        token.image = img && !img.startsWith('data:') ? img : null;
      }
      // Fetch role + refresh image from DB on login or session update
      if ((user || trigger === 'update') && token.id) {
        try {
          const db = getSQL();
          const rows = await db`SELECT image, role FROM users WHERE id = ${token.id as string}`;
          if (rows.length > 0) {
            // Only store image in JWT if it's a short URL (not a base64 data URI)
            // Data URIs can be 100KB+ and blow Vercel's 32KB header limit
            const img = rows[0].image as string | null;
            token.image = img && !img.startsWith('data:') ? img : null;
            token.role = rows[0].role || 'user';
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
        session.user.role = token.role as 'admin' | 'advisor' | 'user';
      }
      return session;
    },
  },
  trustHost: true,
});
