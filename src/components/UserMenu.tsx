'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { User, LogOut, Settings, ChevronDown, LayoutDashboard, Shield } from 'lucide-react';

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset image error when avatar URL changes (e.g. after re-upload)
  useEffect(() => {
    setImgError(false);
  }, [session?.user?.image]);

  // Loading state — show nothing
  if (status === 'loading') {
    return <div className="w-8 h-8 rounded-full bg-white/[0.06] animate-pulse" />;
  }

  // Not logged in — show login button
  if (!session) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
      >
        <User className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  // Logged in — show avatar + dropdown
  const initials = (session.user?.name || session.user?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-white/[0.06] transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {session.user?.image && !imgError ? (
          <Image
            src={session.user.image}
            alt={`${session.user.name || 'User'}'s avatar`}
            width={28}
            height={28}
            className="w-7 h-7 rounded-full object-cover"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-hub-yellow/20 flex items-center justify-center text-hub-yellow text-[11px] font-semibold">
            {initials}
          </div>
        )}
        <ChevronDown
          className={`w-3 h-3 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-hub-darker border border-white/[0.08] rounded-lg shadow-xl py-1 z-50">
          {/* User info */}
          <div className="px-4 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-white truncate">
                {session.user?.name || 'User'}
              </p>
              {session.user?.role === 'admin' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-hub-yellow/20 text-hub-yellow">
                  <Shield className="w-2.5 h-2.5" />
                  ADMIN
                </span>
              )}
              {session.user?.role === 'advisor' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400">
                  <Shield className="w-2.5 h-2.5" />
                  ADVISOR
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 truncate">
              {session.user?.email}
            </p>
          </div>

          {/* Dashboard */}
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </Link>

          {/* Profile */}
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            Profile
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>

          {/* Admin Panel — for admins and advisors */}
          {(session.user?.role === 'admin' || session.user?.role === 'advisor') && (
            <Link
              href="/admin-panel"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-hub-yellow hover:text-hub-yellow hover:bg-hub-yellow/[0.06] transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Panel
            </Link>
          )}

          {/* Sign out */}
          <button
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: '/' });
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
