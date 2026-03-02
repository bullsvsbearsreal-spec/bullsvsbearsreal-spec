'use client';

import { SessionProvider } from 'next-auth/react';
import { useUserSync } from '@/hooks/useUserSync';
import SWRProvider from './SWRProvider';
import AuthGate from './AuthGate';

function SyncProvider({ children }: { children: React.ReactNode }) {
  useUserSync();
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRProvider>
        <SyncProvider>
          <AuthGate>
            {children}
          </AuthGate>
        </SyncProvider>
      </SWRProvider>
    </SessionProvider>
  );
}
