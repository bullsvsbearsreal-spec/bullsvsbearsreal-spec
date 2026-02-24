'use client';

import { SessionProvider } from 'next-auth/react';
import { useUserSync } from '@/hooks/useUserSync';

function SyncProvider({ children }: { children: React.ReactNode }) {
  useUserSync();
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SyncProvider>
        {children}
      </SyncProvider>
    </SessionProvider>
  );
}
