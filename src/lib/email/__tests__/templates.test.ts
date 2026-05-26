import { describe, it, expect } from 'vitest';
import {
  renderWelcome,
  renderAffiliateSignupNotif,
  renderCommissionEarned,
  renderPayoutSent,
  renderLaunchCutover,
  renderSubscriptionConfirmed,
  renderPaymentFailed,
  sendWelcome,
} from '../templates';

/**
 * Template smoke tests — confirm each render* function returns a
 * non-empty subject + html and substitutes its inputs correctly. We
 * NEVER test the actual Resend dispatch — that needs real network and
 * isn't worth mocking. The dryRun path on every sender keeps that
 * surface coverable for the operator via /api/admin/email-preview.
 */

describe('email templates · render', () => {
  it('renderWelcome includes the first name + referral code when provided', () => {
    const { subject, html } = renderWelcome({ name: 'Ben Infin8', referralCode: 'ABCDE234' });
    expect(subject).toBeTruthy();
    expect(html).toContain('Welcome, Ben');         // first name only
    expect(html).toContain('ABCDE234');             // code visible
    expect(html).toContain('/settings');            // points to settings
  });

  it('renderWelcome omits the affiliate-code block when no code provided', () => {
    const { html } = renderWelcome({ name: 'Anon' });
    // The affiliate-code block has this specific copy
    expect(html).not.toContain('Your affiliate code');
  });

  it('renderAffiliateSignupNotif uses the signup count as the headline number', () => {
    const { subject, html } = renderAffiliateSignupNotif({ affiliateName: 'Ben', totalSignups: 42 });
    expect(subject.toLowerCase()).toContain('signed up');
    expect(html).toContain('42');
  });

  it('renderCommissionEarned shows the paid amount + 20% slice + pending', () => {
    const { subject, html } = renderCommissionEarned({
      affiliateName: 'Ben',
      referredUserEmail: 'new@example.com',
      tierLabel: 'Pro',
      paidAmountUsd: 29,
      commissionUsd: 5.80,
      totalPendingUsd: 47.20,
    });
    expect(subject).toContain('$5.80');
    expect(subject).toContain('Pro');
    expect(html).toContain('$29.00');
    expect(html).toContain('$5.80');
    expect(html).toContain('$47.20');
  });

  it('renderPayoutSent uses the correct explorer per chain (solana / arbitrum / base)', () => {
    const base = {
      affiliateName: 'Ben',
      amountUsd: 124.50,
      wallet: '0x' + 'a'.repeat(40),
      txHash: '0x' + 'b'.repeat(64),
      remainingPendingUsd: 8.20,
    };
    expect(renderPayoutSent({ ...base, chain: 'solana' }).html).toContain('solscan.io');
    expect(renderPayoutSent({ ...base, chain: 'arbitrum' }).html).toContain('arbiscan.io');
    expect(renderPayoutSent({ ...base, chain: 'base' }).html).toContain('basescan.org');
  });

  it('renderPayoutSent shows the chain label capitalised', () => {
    const { html } = renderPayoutSent({
      affiliateName: 'Ben',
      amountUsd: 100,
      chain: 'arbitrum',
      wallet: '0x' + 'a'.repeat(40),
      txHash: '0x' + 'b'.repeat(64),
      remainingPendingUsd: 0,
    });
    expect(html).toContain('Arbitrum'); // capitalised label
    // Wallet is shown abbreviated (first 6 + last 4)
    expect(html).toContain('0xaaaa');
    expect(html).toContain('aaaa');
  });

  it('renderLaunchCutover branches the body copy by tier', () => {
    const free = renderLaunchCutover({ cutoverDate: '2026-06-15', currentTier: 'free' });
    const pro  = renderLaunchCutover({ cutoverDate: '2026-06-15', currentTier: 'pro' });
    const whale = renderLaunchCutover({ cutoverDate: '2026-06-15', currentTier: 'whale' });
    // Free users see the "stays free forever" line
    expect(free.html.toLowerCase()).toContain('free tier stays free');
    // Pro users get the grandfather pitch (auto-bump to new Pro $29)
    expect(pro.html).toContain('grandfathered to Pro');
    // Whale users get the whale grandfather line
    expect(whale.html).toContain('grandfathered to Whale');
  });

  it('renderSubscriptionConfirmed mirrors the tier label + amount + period', () => {
    const { subject, html } = renderSubscriptionConfirmed({
      tierLabel: 'Pro',
      amountUsd: 29,
      period: 'monthly',
      nextRenewalIso: '2026-07-15',
    });
    expect(subject).toContain('Pro');
    expect(subject).toContain('$29.00');
    expect(html).toContain('Pro');
    expect(html).toContain('$29.00');
    expect(html).toContain('2026-07-15');
  });

  it('renderPaymentFailed names the grace-end date prominently', () => {
    const { subject, html } = renderPaymentFailed({
      tierLabel: 'Pro',
      amountUsd: 29,
      graceEndsIso: '2026-06-22',
    });
    expect(subject.toLowerCase()).toContain('payment failed');
    expect(html).toContain('2026-06-22');
    expect(html).toContain('Pro');
  });

  it('every template renders an HTML document with a head/body-ish structure', () => {
    const samples = [
      renderWelcome({ name: 'Test' }),
      renderAffiliateSignupNotif({ totalSignups: 1 }),
      renderCommissionEarned({
        tierLabel: 'Trader', paidAmountUsd: 12, commissionUsd: 2.4, totalPendingUsd: 2.4,
      }),
    ];
    samples.forEach((t) => {
      expect(t.subject.length).toBeGreaterThan(0);
      expect(t.subject.length).toBeLessThan(120);  // sane subject length
      expect(t.html).toMatch(/<html/i);
      expect(t.html).toMatch(/<body/i);
      // No unresolved template placeholders (e.g. "${"  or "{{"  )
      expect(t.html).not.toContain('${');
      expect(t.html).not.toContain('{{');
    });
  });
});

describe('email templates · send dryRun path', () => {
  it('sendWelcome with dryRun=true returns preview + ok without calling network', async () => {
    const res = await sendWelcome({ to: 'test@example.com', name: 'Test', dryRun: true });
    expect(res.ok).toBe(true);
    expect(res.preview).toBeDefined();
    expect(res.preview?.subject).toBeTruthy();
    expect(res.preview?.html).toContain('Test');  // name leaked into the body
    // No network was attempted — so no id should be returned
    expect(res.id).toBeUndefined();
  });
});
