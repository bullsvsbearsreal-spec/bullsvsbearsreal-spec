/**
 * Custom NextAuth Postgres adapter using postgres.js driver.
 * Avoids needing a second driver (pg) just for the adapter.
 *
 * NOTE: The `role` column is added lazily via initDB(). Adapter queries
 * intentionally omit it so auth works even before initDB() runs.
 * Role is fetched separately in the JWT callback with a try/catch.
 */

import type { Adapter, AdapterUser, AdapterAccount, AdapterSession } from 'next-auth/adapters';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || '';

let sql: ReturnType<typeof postgres> | null = null;

function getSQL() {
  if (!sql) {
    sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  }
  return sql;
}

export function PostgresAdapter(): Adapter {
  const sql = getSQL();

  return {
    async createUser(user) {
      const rows = await sql`
        INSERT INTO users (name, email, email_verified, image)
        VALUES (${user.name ?? null}, ${user.email}, ${user.emailVerified ?? null}, ${user.image ?? null})
        RETURNING id, name, email, email_verified as "emailVerified", image
      `;
      return rows[0] as AdapterUser;
    },

    async getUser(id) {
      const rows = await sql`
        SELECT id, name, email, email_verified as "emailVerified", image
        FROM users WHERE id = ${id}
      `;
      return (rows[0] as AdapterUser) ?? null;
    },

    async getUserByEmail(email) {
      const rows = await sql`
        SELECT id, name, email, email_verified as "emailVerified", image
        FROM users WHERE email = ${email}
      `;
      return (rows[0] as AdapterUser) ?? null;
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const rows = await sql`
        SELECT u.id, u.name, u.email, u.email_verified as "emailVerified", u.image
        FROM users u
        JOIN accounts a ON u.id = a.user_id
        WHERE a.provider = ${provider} AND a.provider_account_id = ${providerAccountId}
      `;
      return (rows[0] as AdapterUser) ?? null;
    },

    async updateUser(user) {
      const rows = await sql`
        UPDATE users SET
          name = COALESCE(${user.name ?? null}, name),
          email = COALESCE(${user.email ?? null}, email),
          email_verified = COALESCE(${user.emailVerified ?? null}, email_verified),
          image = COALESCE(${user.image ?? null}, image)
        WHERE id = ${user.id!}
        RETURNING id, name, email, email_verified as "emailVerified", image
      `;
      return rows[0] as AdapterUser;
    },

    async deleteUser(userId) {
      await sql`DELETE FROM users WHERE id = ${userId}`;
    },

    async linkAccount(account) {
      const sessionState = account.session_state != null ? String(account.session_state) : null;
      await sql`
        INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
        VALUES (
          ${account.userId},
          ${account.type},
          ${account.provider},
          ${account.providerAccountId},
          ${account.refresh_token ?? null},
          ${account.access_token ?? null},
          ${account.expires_at ?? null},
          ${account.token_type ?? null},
          ${account.scope ?? null},
          ${account.id_token ?? null},
          ${sessionState}
        )
      `;
      return account as AdapterAccount;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      await sql`
        DELETE FROM accounts WHERE provider = ${provider} AND provider_account_id = ${providerAccountId}
      `;
    },

    async createSession(session) {
      const rows = await sql`
        INSERT INTO sessions (session_token, user_id, expires)
        VALUES (${session.sessionToken}, ${session.userId}, ${session.expires})
        RETURNING session_token as "sessionToken", user_id as "userId", expires
      `;
      return rows[0] as AdapterSession;
    },

    async getSessionAndUser(sessionToken) {
      const rows = await sql`
        SELECT s.session_token as "sessionToken", s.user_id as "userId", s.expires,
               u.id, u.name, u.email, u.email_verified as "emailVerified", u.image
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ${sessionToken} AND s.expires > NOW()
      `;
      if (rows.length === 0) return null;
      const row = rows[0] as any;
      return {
        session: { sessionToken: row.sessionToken, userId: row.userId, expires: row.expires },
        user: { id: row.id, name: row.name, email: row.email, emailVerified: row.emailVerified, image: row.image },
      };
    },

    async updateSession(session) {
      const rows = await sql`
        UPDATE sessions SET expires = ${session.expires!}
        WHERE session_token = ${session.sessionToken}
        RETURNING session_token as "sessionToken", user_id as "userId", expires
      `;
      return (rows[0] as AdapterSession) ?? null;
    },

    async deleteSession(sessionToken) {
      await sql`DELETE FROM sessions WHERE session_token = ${sessionToken}`;
    },

    async createVerificationToken(token) {
      const rows = await sql`
        INSERT INTO verification_tokens (identifier, token, expires)
        VALUES (${token.identifier}, ${token.token}, ${token.expires})
        RETURNING identifier, token, expires
      `;
      return rows[0] as any;
    },

    async useVerificationToken({ identifier, token }) {
      const rows = await sql`
        DELETE FROM verification_tokens
        WHERE identifier = ${identifier} AND token = ${token}
        RETURNING identifier, token, expires
      `;
      return (rows[0] as any) ?? null;
    },
  };
}
