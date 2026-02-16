'use client';

import { useState, useCallback } from 'react';
import { Share2, Check, Copy } from 'lucide-react';

interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
  className?: string;
}

export default function ShareButton({
  title = 'InfoHub - Real-Time Derivatives Data',
  text = 'Check out funding rates on InfoHub — 21 exchanges, real-time data',
  url,
  className = '',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://info-hub.io');

    // Try native Web Share API (mobile + some desktops)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [title, text, url]);

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'text-neutral-500 hover:text-white bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08]'
      } ${className}`}
      title={copied ? 'Link copied!' : 'Share this page'}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5" />
          Share
        </>
      )}
    </button>
  );
}
