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
import postgres from 'postgres';
import { PostgresAdapter } from './adapter';

const DATABASE_URL = process.env.DATABASE_URL || '';

let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

// Build providers list — only include OAuth providers with configured credentials
const providers: any[] = [
  Credentials({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const db = getSQL();
      const rows = await db`
        SELECT id, name, email, image, password_hash
        FROM users WHERE email = ${credentials.email as string}
      `;

      if (rows.length === 0) return null;
      const user = rows[0];

      if (!user.password_hash) return null; // OAuth-only account
      const valid = await bcrypt.compare(credentials.password as string, user.password_hash);
      if (!valid) return null;

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
        token.image = user.image;
      }
      // Refresh image from DB on session update (after avatar change)
      if (trigger === 'update' && token.id) {
        try {
          const db = getSQL();
          const rows = await db`SELECT image FROM users WHERE id = ${token.id as string}`;
          if (rows.length > 0) token.image = rows[0].image;
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
      return session;
    },
  },
  trustHost: true,
});
