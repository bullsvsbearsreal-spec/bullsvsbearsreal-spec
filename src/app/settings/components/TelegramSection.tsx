'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Copy, Check, Loader2, Unlink, RefreshCw } from 'lucide-react';

type LinkStatus = { linked: false } | { linked: true; active: boolean; mutedUntil: string | null };

export default function TelegramSection() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/telegram/link-code');
        if (res.ok && mounted) setStatus(await res.json());
      } catch {}
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/telegram/link-code', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setCode(json.code);
      }
    } catch {}
    setGenerating(false);
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`/start ${code}`);
      setCopied(true);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const unlink = async () => {
    setUnlinking(true);
    try {
      const res = await fetch('/api/telegram/link-code', { method: 'DELETE' });
      if (res.ok) {
        setStatus({ linked: false });
        setCode(null);
      }
    } catch {}
    setUnlinking(false);
  };

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Send className="w-4 h-4 text-hub-yellow" />
        Telegram Alerts
      </h2>

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
          <span className="text-xs text-neutral-500">Loading...</span>
        </div>
      ) : status?.linked ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">
                Telegram {status.active ? 'linked' : 'paused'}
              </p>
              <p className="text-xs text-neutral-600">
                {status.active
                  ? status.mutedUntil
                    ? `Muted until ${new Date(status.mutedUntil).toLocaleString()}`
                    : 'Receiving alerts, whale trades & daily summaries'
                  : 'Paused — send /start to the bot to resume'}
              </p>
            </div>
            <span className={`w-2 h-2 rounded-full ${status.active ? 'bg-green-500' : 'bg-neutral-600'}`} />
          </div>
          <button
            onClick={unlink}
            disabled={unlinking}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            {unlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
            Unlink Telegram
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-neutral-400">
            Link your Telegram to receive price alerts, whale trade notifications, and a daily market summary via{' '}
            <a
              href="https://t.me/InfoHubRadarBot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-hub-yellow hover:underline"
            >
              @InfoHubRadarBot
            </a>
          </p>

          {code ? (
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">
                Send this command to{' '}
                <a href="https://t.me/InfoHubRadarBot" target="_blank" rel="noopener noreferrer" className="text-hub-yellow hover:underline">
                  @InfoHubRadarBot
                </a>{' '}
                on Telegram:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-hub-yellow font-mono select-all">
                  /start {code}
                </code>
                <button
                  onClick={copyCode}
                  className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-neutral-600">Expires in 10 minutes</p>
                <button
                  onClick={generateCode}
                  disabled={generating}
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                  New code
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={generateCode}
              disabled={generating}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20 text-hub-yellow text-sm font-medium hover:bg-hub-yellow/20 transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Generate Link Code
            </button>
          )}
        </div>
      )}
    </div>
  );
}
