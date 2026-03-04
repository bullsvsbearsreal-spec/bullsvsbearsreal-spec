'use client';

import { SessionProvider } from 'next-auth/react';
import { useUserSync } from '@/hooks/useUserSync';
import SWRProvider from './SWRProvider';

function SyncProvider({ children }: { children: React.ReactNode }) {
  useUserSync();
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRProvider>
        <SyncProvider>
          {children}
        </SyncProvider>
      </SWRProvider>
    </SessionProvider>
  );
}
