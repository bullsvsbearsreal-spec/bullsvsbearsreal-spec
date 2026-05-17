import { describe, it, expect } from 'vitest';
import { getInviteCta } from '../inviteCta';

describe('getInviteCta', () => {
  it('returns null when user has no signups (banner should not render)', () => {
    expect(getInviteCta({ signups: 0, verified: 0 })).toBeNull();
  });

  it('returns null on negative input (defensive — never trust API)', () => {
    expect(getInviteCta({ signups: -1, verified: 0 })).toBeNull();
  });

  it('sends low-tier users to /invite (encourage more sharing)', () => {
    const cta = getInviteCta({ signups: 1, verified: 0 });
    expect(cta).toEqual({
      href: '/invite',
      label: 'See details',
      subline: 'Keep sharing to climb the referral leaderboard.',
    });
  });

  it('still shows /invite at 1 signup + 1 verified (under threshold)', () => {
    const cta = getInviteCta({ signups: 1, verified: 1 });
    expect(cta?.href).toBe('/invite');
  });

  it('still shows /invite at 2 verified (one below threshold)', () => {
    const cta = getInviteCta({ signups: 5, verified: 2 });
    expect(cta?.href).toBe('/invite');
  });

  it('switches to /invite/leaderboard at exactly 3 verified (threshold)', () => {
    const cta = getInviteCta({ signups: 4, verified: 3 });
    expect(cta?.href).toBe('/invite/leaderboard');
    expect(cta?.label).toBe('See leaderboard');
  });

  it('still uses leaderboard CTA at 10+ verified (top-tier)', () => {
    const cta = getInviteCta({ signups: 25, verified: 18 });
    expect(cta?.href).toBe('/invite/leaderboard');
    expect(cta?.subline).toContain('leaderboard');
  });

  it('handles signups > verified correctly (mostly unverified)', () => {
    // 5 friends signed up but only 2 verified — still under threshold
    const cta = getInviteCta({ signups: 5, verified: 2 });
    expect(cta?.href).toBe('/invite');
  });

  it('handles all-verified case (every signup completed verification)', () => {
    const cta = getInviteCta({ signups: 4, verified: 4 });
    expect(cta?.href).toBe('/invite/leaderboard');
  });
});
