'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, LogIn, Cloud, Mail, Key, Shield } from 'lucide-react';

type PromptVariant = 'cloud-sync' | 'email-alerts' | 'api-key' | 'generic';

const VARIANT_CONFIG: Record<PromptVariant, { icon: typeof Cloud; title: string; description: string }> = {
  'cloud-sync': {
    icon: Cloud,
    title: 'Sync across devices',
    description: 'Sign in to save your dashboard, watchlist, and settings to the cloud.',
  },
  'email-alerts': {
    icon: Mail,
    title: 'Email alerts',
    description: 'Sign in to get your alerts in email — alongside Telegram, Discord, and browser push.',
  },
  'api-key': {
    icon: Key,
    title: 'Generate API keys',
    description: 'Sign in to create API keys and access InfoHub data programmatically.',
  },
  'generic': {
    icon: Shield,
    title: 'Save your setup',
    description: 'Sign in once — your watchlist, alerts, positions, and API keys all follow you to the next device.',
  },
};

interface AuthPromptBannerProps {
  variant?: PromptVariant;
  /** If true, user can dismiss (stored in sessionStorage) */
  dismissible?: boolean;
  /** Unique key for dismiss state */
  dismissKey?: string;
  className?: string;
}

/**
 * Non-blocking inline banner encouraging sign-in at contextual moments.
 * Shows relevant benefit based on variant. Dismissible per session.
 */
export default function AuthPromptBanner({
  variant = 'generic',
  dismissible = true,
  dismissKey,
  className = '',
}: AuthPromptBannerProps) {
  const storageKey = `infohub-auth-prompt-${dismissKey || variant}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey) === '1') setDismissed(true);
    } catch {}
  }, [storageKey]);

  if (dismissed) return null;

  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(storageKey, '1'); } catch {}
  };

  return (
    <div className={`relative bg-gradient-to-r from-hub-yellow/[0.06] to-hub-orange/[0.04] border border-hub-yellow/20 rounded-xl px-4 py-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-hub-yellow/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-[18px] h-[18px] text-hub-yellow" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{config.title}</p>
          <p className="text-xs text-neutral-400 leading-relaxed">{config.description}</p>
        </div>
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hub-yellow text-black text-xs font-semibold hover:bg-hub-yellow/90 transition-colors flex-shrink-0"
        >
          <LogIn className="w-3 h-3" />
          Sign in
        </Link>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04] transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
