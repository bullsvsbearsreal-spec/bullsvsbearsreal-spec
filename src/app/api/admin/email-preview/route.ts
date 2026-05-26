/**
 * GET /api/admin/email-preview?template=<name>
 *
 * Admin-only preview endpoint for the email templates in
 * lib/email/templates.ts. Lets the operator open `?template=welcome`
 * in a browser tab and see the rendered HTML before mass-sending.
 *
 * No actual email is dispatched — every template helper supports
 * dryRun=true which short-circuits before Resend.
 *
 * Add a new template by importing its `render*` function below and
 * wiring it into the dispatch switch with reasonable sample data.
 *
 * Auth: requireAdmin (re-checks DB on every call).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  renderWelcome,
  renderAffiliateSignupNotif,
  renderCommissionEarned,
  renderPayoutSent,
  renderLaunchCutover,
  renderSubscriptionConfirmed,
  renderPaymentFailed,
} from '@/lib/email/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TemplateName =
  | 'welcome'
  | 'affiliate-signup'
  | 'commission-earned'
  | 'payout-sent'
  | 'launch-cutover'
  | 'subscription-confirmed'
  | 'payment-failed';

const ALL_TEMPLATES: TemplateName[] = [
  'welcome',
  'affiliate-signup',
  'commission-earned',
  'payout-sent',
  'launch-cutover',
  'subscription-confirmed',
  'payment-failed',
];

function pickTemplate(name: TemplateName): { subject: string; html: string } {
  switch (name) {
    case 'welcome':
      return renderWelcome({ name: 'Sample User', referralCode: 'ABCD2345' });
    case 'affiliate-signup':
      return renderAffiliateSignupNotif({ affiliateName: 'Ben Infin8', totalSignups: 12 });
    case 'commission-earned':
      return renderCommissionEarned({
        affiliateName: 'Ben Infin8',
        referredUserEmail: 'newcomer@example.com',
        tierLabel: 'Pro',
        paidAmountUsd: 29,
        commissionUsd: 5.80,
        totalPendingUsd: 47.20,
      });
    case 'payout-sent':
      return renderPayoutSent({
        affiliateName: 'Ben Infin8',
        amountUsd: 124.50,
        chain: 'solana',
        wallet: 'HN7cABqLq46Es1jh92dQQrM7nVi6cZkqHkBYC8b9aaaa',
        txHash: '5J7xpDpqLkQ2nVi6cZkqHkBYC8b9aaaa1234567890abcdef',
        remainingPendingUsd: 8.20,
      });
    case 'launch-cutover':
      return renderLaunchCutover({ cutoverDate: '2026-06-15', currentTier: 'pro' });
    case 'subscription-confirmed':
      return renderSubscriptionConfirmed({
        tierLabel: 'Pro',
        amountUsd: 29,
        period: 'monthly',
        nextRenewalIso: '2026-07-15',
      });
    case 'payment-failed':
      return renderPaymentFailed({
        tierLabel: 'Pro',
        amountUsd: 29,
        graceEndsIso: '2026-06-22',
      });
  }
}

export async function GET(req: NextRequest) {
  const adminErr = await requireAdmin();
  if (adminErr) return adminErr;

  const name = req.nextUrl.searchParams.get('template') ?? '';
  if (!name) {
    // No template specified — return an index page so the operator
    // can pick. HTML so it renders directly in a browser tab.
    const linkList = ALL_TEMPLATES
      .map((t) => `<li><a href="?template=${t}" style="color:#34d399;">${t}</a></li>`)
      .join('');
    const html = `<!doctype html>
<html><body style="font-family:system-ui;background:#0a0a0a;color:#e5e5e5;padding:40px;">
<h1 style="font-size:18px;">Email template previews</h1>
<p style="color:#a3a3a3;font-size:13px;">Open each to QA copy before mass-sending. Sample data baked in.</p>
<ul>${linkList}</ul>
</body></html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  if (!ALL_TEMPLATES.includes(name as TemplateName)) {
    return NextResponse.json(
      { error: `Unknown template. Try: ${ALL_TEMPLATES.join(', ')}` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { subject, html } = pickTemplate(name as TemplateName);
  // Wrap in a tiny shell so the operator can see the subject line too
  // (Resend / Gmail wouldn't show this — but the preview should).
  const shellHtml = `<!doctype html>
<html><body style="margin:0;background:#0a0a0a;">
  <div style="background:#171717;border-bottom:1px solid #262626;padding:12px 20px;font-family:monospace;color:#a3a3a3;font-size:12px;">
    <strong style="color:#fff;">Subject:</strong> ${subject}
    &nbsp;·&nbsp; template <code style="color:#34d399;">${name}</code>
    &nbsp;·&nbsp; <a href="/api/admin/email-preview" style="color:#34d399;">← all templates</a>
  </div>
  ${html}
</body></html>`;
  return new NextResponse(shellHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
