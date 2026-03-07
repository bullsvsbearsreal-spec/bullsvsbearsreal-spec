'use client';

import { Link2, Check } from 'lucide-react';

interface Props {
  connectedProviders: string[];
}

const PROVIDERS = [
  { id: 'google', name: 'Google', color: '#4285F4' },
  { id: 'discord', name: 'Discord', color: '#5865F2' },
  { id: 'twitter', name: 'Twitter', color: '#1DA1F2' },
];

export default function ConnectedAccountsSection({ connectedProviders }: Props) {
  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-hub-yellow" />
        Connected Accounts
      </h2>
      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const isConnected = connectedProviders.includes(provider.id);
          return (
            <div key={provider.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: isConnected ? provider.color : 'rgba(255,255,255,0.04)' }}
                >
                  {provider.name[0]}
                </div>
                <div>
                  <p className="text-sm text-white">{provider.name}</p>
                  <p className="text-xs text-neutral-600">
                    {isConnected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
              {isConnected ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <a
                  href={`/api/auth/signin/${provider.id}?callbackUrl=/settings`}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  Connect
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
