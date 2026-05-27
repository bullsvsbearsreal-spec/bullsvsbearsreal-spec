import { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role?: 'owner' | 'admin' | 'moderator' | 'marketer' | 'support' | 'advisor' | 'user';
      /** Billing tier from users.billing_tier — admin role auto-resolves
       *  to 'whale' via resolveUserTier regardless of this value. */
      billingTier?: 'free' | 'trader' | 'pro' | 'whale';
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    billingTier?: 'free' | 'trader' | 'pro' | 'whale';
  }
}
