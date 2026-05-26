'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import {
  User, LogOut, Settings, ChevronDown, LayoutDashboard, Shield, Gift,
  Sparkles, Compass, Zap, Crown, Wallet, Bell, Eye, Link2, Activity,
  ArrowUpRight,
} from 'lucide-react';
import { resolveUserTier, TIER_BRANDING, type TierBranding } from '@/lib/constants/tiers';

/**
 * User dropdown menu shown in the top-right of the terminal header.
 *
 * Organized into 4 sections for scannability:
 *   1. Identity card — avatar + name + email + tier chip + role badge
 *   2. Account     — Dashboard / Positions / Profile / Settings
 *   3. My tools    — Connections / Wallet Watch / Alerts / Invite
 *   4. Admin (gated) — Admin Panel / Endpoint Health
 *
 * Sign out lives in its own footer row with a divider + red accent so
 * it's both findable and not-too-easy-to-click-by-mistake.
 *
 * Rows are 36px tall (vs the old 32px) so they're comfortable touch
 * targets on mobile / iPad and easier to read at-a-glance on desktop.
 */
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

  // Close on Escape — standard menu UX, also helps keyboard users dismiss
  // without having to mouse over to a different spot first.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

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
  const isAdmin = session.user?.role === 'admin';
  const isAdvisor = session.user?.role === 'advisor';
  const tier = resolveUserTier({ role: session.user?.role, billingTier: session.user?.billingTier ?? null });
  const tierBranding = TIER_BRANDING[tier];
  const showUpgradeCta = tier !== 'whale' && !isAdmin;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-white/[0.06] transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Open user menu"
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
        <div
          className="absolute right-0 top-full mt-1 w-72 bg-hub-darker border border-white/[0.08] rounded-xl shadow-2xl py-1 z-50 overflow-hidden"
          role="menu"
        >
          {/* ─── Identity card ─────────────────────────────────────── */}
          <div className="px-3 py-3 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent">
            <div className="flex items-start gap-3">
              {session.user?.image && !imgError ? (
                <Image
                  src={session.user.image}
                  alt=""
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  unoptimized
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-hub-yellow/20 flex items-center justify-center text-hub-yellow text-[13px] font-bold flex-shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">
                    {session.user?.name || 'User'}
                  </span>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-400/30">
                      <Shield className="w-2.5 h-2.5" />
                      Admin
                    </span>
                  )}
                  {isAdvisor && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-400/30">
                      <Shield className="w-2.5 h-2.5" />
                      Advisor
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                  {session.user?.email}
                </p>
                {/* Tier + upgrade CTA on one row */}
                <div className="flex items-center gap-2 mt-2">
                  <TierChip tier={tier} branding={tierBranding} />
                  {showUpgradeCta && (
                    <Link
                      href="/pricing"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-hub-yellow hover:text-hub-yellow-light transition-colors"
                    >
                      Upgrade
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Account ───────────────────────────────────────────── */}
          <SectionLabel>Account</SectionLabel>
          <MenuLink href="/dashboard" onClick={() => setOpen(false)} icon={<LayoutDashboard />}>
            Dashboard
          </MenuLink>
          <MenuLink href="/positions" onClick={() => setOpen(false)} icon={<Wallet />}>
            Positions
          </MenuLink>
          <MenuLink href="/profile" onClick={() => setOpen(false)} icon={<User />}>
            Profile
          </MenuLink>
          <MenuLink href="/settings" onClick={() => setOpen(false)} icon={<Settings />}>
            Settings
          </MenuLink>

          {/* ─── My tools ──────────────────────────────────────────── */}
          <div className="h-px bg-white/[0.04] my-1" />
          <SectionLabel>My tools</SectionLabel>
          <MenuLink href="/account/connections" onClick={() => setOpen(false)} icon={<Link2 />}>
            Connections
          </MenuLink>
          <MenuLink href="/watch" onClick={() => setOpen(false)} icon={<Eye />}>
            Wallet Watch
          </MenuLink>
          <MenuLink href="/alerts" onClick={() => setOpen(false)} icon={<Bell />}>
            Alerts
          </MenuLink>
          <MenuLink href="/invite" onClick={() => setOpen(false)} icon={<Gift />} accent="emerald">
            Invite friends
          </MenuLink>

          {/* ─── Admin (gated) ─────────────────────────────────────── */}
          {(isAdmin || isAdvisor) && (
            <>
              <div className="h-px bg-white/[0.04] my-1" />
              <SectionLabel>Admin</SectionLabel>
              <MenuLink href="/admin-panel" onClick={() => setOpen(false)} icon={<Shield />} accent="amber">
                Admin Panel
              </MenuLink>
              {isAdmin && (
                <MenuLink href="/health" onClick={() => setOpen(false)} icon={<Activity />} accent="amber">
                  Endpoint health
                </MenuLink>
              )}
            </>
          )}

          {/* ─── Sign out ──────────────────────────────────────────── */}
          <div className="h-px bg-white/[0.04] my-1" />
          <button
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: '/' });
            }}
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/[0.06] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Section header inside the menu — small uppercase label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600">
      {children}
    </div>
  );
}

/**
 * One menu item — Link with consistent layout (icon + label + optional
 * keyboard chip on the right). 36px row keeps touch targets comfortable.
 */
function MenuLink({
  href, onClick, icon, accent, children,
}: {
  href: string;
  onClick?: () => void;
  icon: React.ReactNode;
  /** 'amber' for admin links, 'emerald' for the invite link, undefined for default neutral. */
  accent?: 'amber' | 'emerald';
  children: React.ReactNode;
}) {
  const accentCls =
    accent === 'amber' ? 'text-amber-300 hover:bg-amber-500/[0.06] hover:text-amber-200'
    : accent === 'emerald' ? 'text-emerald-300 hover:bg-emerald-500/[0.06] hover:text-emerald-200'
    : 'text-neutral-300 hover:text-white hover:bg-white/[0.06]';
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors ${accentCls}`}
    >
      <span className="w-3.5 h-3.5 flex-shrink-0 [&>svg]:w-full [&>svg]:h-full">
        {icon}
      </span>
      <span>{children}</span>
    </Link>
  );
}

/**
 * Plan chip — links to /pricing. Color comes from TIER_BRANDING so the
 * chip stays in sync with the rest of the tier surface (e.g. /profile
 * hero chip uses the same colors).
 */
function TierChip({
  tier, branding,
}: {
  tier: 'free' | 'trader' | 'pro' | 'whale';
  branding: TierBranding;
}) {
  const Icon = branding.iconName === 'Sparkles' ? Sparkles
    : branding.iconName === 'Compass' ? Compass
    : branding.iconName === 'Zap' ? Zap
    : Crown;
  const cls =
    tier === 'pro' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/25'
    : tier === 'whale' ? 'bg-amber-500/15 text-amber-300 border-amber-400/30 hover:bg-amber-500/25'
    : tier === 'trader' ? 'bg-sky-500/15 text-sky-300 border-sky-400/30 hover:bg-sky-500/25'
    : 'bg-white/[0.06] text-neutral-400 border-white/[0.1] hover:bg-white/[0.1] hover:text-neutral-200';
  return (
    <Link
      href="/pricing"
      title={`You're on the ${branding.label} tier · See pricing`}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${cls} transition-colors`}
    >
      <Icon className="w-2.5 h-2.5" aria-hidden />
      {branding.label}
    </Link>
  );
}
