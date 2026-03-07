'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Clock, Loader2, Check, ToggleLeft, ToggleRight } from 'lucide-react';

const COOLDOWN_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
];

interface Props {
  email: string;
}

export default function NotificationsSection({ email }: Props) {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) return;
        const json = await res.json();
        const prefs = json.notificationPrefs as { email?: boolean; cooldownMinutes?: number } | undefined;
        if (prefs) {
          setEmailEnabled(prefs.email ?? true);
          setCooldownMinutes(prefs.cooldownMinutes ?? 60);
        }
      } catch {}
    })();
  }, []);

  const savePrefs = async (emailVal: boolean, cooldown: number) => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPrefs: { email: emailVal, cooldownMinutes: cooldown },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-hub-yellow" />
        Notifications
      </h2>
      <div className="space-y-4">
        {/* Email toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-neutral-400" />
            <div>
              <p className="text-sm text-white">Email notifications</p>
              <p className="text-xs text-neutral-600">
                Receive email alerts at {email}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !emailEnabled;
              setEmailEnabled(next);
              savePrefs(next, cooldownMinutes);
            }}
            disabled={saving}
            className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {emailEnabled ? (
              <ToggleRight className="w-6 h-6 text-hub-yellow" />
            ) : (
              <ToggleLeft className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Cooldown selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-400" />
            <div>
              <p className="text-sm text-white">Alert cooldown</p>
              <p className="text-xs text-neutral-600">
                Min time between repeated notifications
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {COOLDOWN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setCooldownMinutes(opt.value);
                  savePrefs(emailEnabled, opt.value);
                }}
                disabled={saving}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                  cooldownMinutes === opt.value
                    ? 'bg-hub-yellow text-black'
                    : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save indicator */}
      {(saving || saved) && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2">
          {saving ? (
            <>
              <Loader2 className="w-3 h-3 text-neutral-500 animate-spin" />
              <span className="text-xs text-neutral-500">Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-500">Saved</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
