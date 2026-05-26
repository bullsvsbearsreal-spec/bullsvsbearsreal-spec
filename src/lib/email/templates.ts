/**
 * Centralized email templates — Resend / SMTP wrapper.
 *
 * Every template is a single exported function: takes typed data,
 * returns `{ subject, html }` and optionally fires via Resend in one
 * call. The dry-run path is useful for the operator to QA copy before
 * a mass send.
 *
 * Design choice: HTML inline-styled, dark-theme by default — matches
 * the InfoHub brand. Plain-text bodies are generated automatically by
 * Resend so we don't double-maintain.
 *
 * Adding a new template:
 *   1. Define a `{Name}Data` interface for the variables it takes
 *   2. Define `render{Name}({ ... }): { subject; html }`
 *   3. Define `send{Name}({ to, ...data, dryRun? })` that wraps it
 *   4. Export from this file
 *
 * No mass-send abstraction here — when you need to email "every user",
 * call the appropriate template in a loop with rate limiting in the
 * caller. Mass-send through Resend tops out around 100/s on the
 * default plan; respect that.
 */

import { Resend } from 'resend';

const FROM = 'InfoHub <noreply@info-hub.io>';
const REPLY_TO = 'team@info-hub.io';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/** Result returned by every `send*` helper. `dryRun=true` skips the
 *  network call entirely and returns the rendered subject + html so
 *  the operator can preview. */
export interface SendResult {
  ok: boolean;
  /** Resend message id when sent for real */
  id?: string;
  /** Set when dryRun=true */
  preview?: { subject: string; html: string };
  /** Set when the send failed or Resend wasn't configured */
  error?: string;
}

interface BaseSendArgs {
  to: string;
  /** Skip the Resend call entirely; return the rendered template instead. */
  dryRun?: boolean;
}

async function deliver(args: { to: string; subject: string; html: string; dryRun?: boolean }): Promise<SendResult> {
  if (args.dryRun) {
    return { ok: true, preview: { subject: args.subject, html: args.html } };
  }
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }
  try {
    const res = await resend.emails.send({
      from: FROM,
      reply_to: REPLY_TO,
      to: args.to,
      subject: args.subject,
      html: args.html,
    } as Parameters<typeof resend.emails.send>[0]);
    if (res && typeof res === 'object' && 'data' in res && res.data && 'id' in res.data) {
      return { ok: true, id: (res.data as { id: string }).id };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] send failed:', msg);
    return { ok: false, error: msg };
  }
}

/* ─── Shared HTML shell ──────────────────────────────────────────── */

/**
 * Dark-themed email shell. Inline styles only (Gmail strips <style> blocks).
 * Content area is centred with a max-width of 480px so it reads well on
 * desktop without going too wide.
 */
function shell({ headline, body, ctaLabel, ctaHref, footerNote }: {
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerNote?: string;
}): string {
  return `
<!doctype html>
<html>
<body style="margin:0; padding:0; background:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:20px;font-weight:700;color:#fff;margin:0;letter-spacing:-0.02em;">
        <span style="display:inline-block;width:24px;height:24px;background:linear-gradient(135deg,#f59e0b,#ea580c);border-radius:6px;vertical-align:middle;margin-right:8px;color:#0a0a0a;font-size:14px;line-height:24px;text-align:center;">◆</span>InfoHub
      </h1>
    </div>
    <div style="background:#171717;border:1px solid #262626;border-radius:12px;padding:32px;color:#e5e5e5;line-height:1.6;font-size:14px;">
      <h2 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 14px;letter-spacing:-0.01em;">${headline}</h2>
      ${body}
      ${ctaLabel && ctaHref ? `
        <div style="margin-top:24px;text-align:center;">
          <a href="${ctaHref}" style="display:inline-block;padding:12px 24px;background:#10b981;color:#0a0a0a;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;text-transform:uppercase;letter-spacing:0.05em;">
            ${ctaLabel}
          </a>
        </div>
      ` : ''}
    </div>
    ${footerNote ? `
      <p style="font-size:11px;color:#737373;line-height:1.5;text-align:center;margin-top:20px;">
        ${footerNote}
      </p>
    ` : ''}
    <p style="font-size:11px;color:#525252;text-align:center;margin-top:14px;">
      <a href="https://info-hub.io" style="color:#737373;text-decoration:none;">info-hub.io</a>
      &middot;
      <a href="https://info-hub.io/settings" style="color:#737373;text-decoration:none;">Email preferences</a>
    </p>
  </div>
</body>
</html>`.trim();
}

function fmtUsd(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

/* ─── Template 1: Welcome (post-verify) ──────────────────────────── */

export interface WelcomeData {
  name?: string | null;
  referralCode?: string | null;
}

export function renderWelcome(data: WelcomeData): { subject: string; html: string } {
  const subject = 'Welcome to InfoHub — start with these 3 things';
  const html = shell({
    headline: `Welcome${data.name ? ', ' + data.name.split(' ')[0] : ''}!`,
    body: `
      <p>Your data terminal is ready. Three quick things to try first:</p>
      <ol style="padding-left:20px;margin:14px 0;">
        <li style="margin-bottom:8px;">
          <strong style="color:#fff;">Funding Arb</strong> — find live A/B-graded pairs at
          <a href="https://info-hub.io/funding-arb" style="color:#34d399;">info-hub.io/funding-arb</a>
        </li>
        <li style="margin-bottom:8px;">
          <strong style="color:#fff;">Set an alert</strong> — funding flips, OI surges, or price triggers at
          <a href="https://info-hub.io/alerts" style="color:#34d399;">info-hub.io/alerts</a>
        </li>
        <li>
          <strong style="color:#fff;">Link Telegram</strong> — get pings on @InfoHubRadarBot via
          <a href="https://info-hub.io/settings" style="color:#34d399;">Settings → Telegram</a>
        </li>
      </ol>
      ${data.referralCode ? `
        <div style="margin-top:20px;padding:14px;border:1px solid #34d39940;background:#10b9810D;border-radius:8px;">
          <p style="margin:0 0 6px;color:#34d399;font-size:13px;font-weight:600;">Your affiliate code</p>
          <p style="margin:0;font-family:monospace;font-size:18px;color:#fff;letter-spacing:0.1em;">${data.referralCode}</p>
          <p style="margin:8px 0 0;color:#a3a3a3;font-size:12px;">
            Share your link to earn 20% recurring lifetime on every paid signup. Details at
            <a href="https://info-hub.io/referrals" style="color:#34d399;">info-hub.io/referrals</a>.
          </p>
        </div>
      ` : ''}
    `,
    ctaLabel: 'Open dashboard',
    ctaHref: 'https://info-hub.io/dashboard',
    footerNote: "You received this because you just verified your InfoHub account. Reply with feedback — we read it all.",
  });
  return { subject, html };
}

export async function sendWelcome(args: BaseSendArgs & WelcomeData): Promise<SendResult> {
  const { to, dryRun, ...data } = args;
  const { subject, html } = renderWelcome(data);
  return deliver({ to, subject, html, dryRun });
}

/* ─── Template 2: Affiliate — new signup via your link ───────────── */

export interface AffiliateSignupNotifData {
  affiliateName?: string | null;
  totalSignups: number;
}

export function renderAffiliateSignupNotif(data: AffiliateSignupNotifData): { subject: string; html: string } {
  const subject = "Someone signed up with your InfoHub link";
  const html = shell({
    headline: 'A new referral just joined',
    body: `
      <p>Heads up${data.affiliateName ? ', ' + data.affiliateName.split(' ')[0] : ''} — someone just signed up using your InfoHub affiliate link.</p>
      <div style="margin:20px 0;padding:16px;border:1px solid #262626;background:#0a0a0a;border-radius:8px;text-align:center;">
        <p style="margin:0;color:#737373;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Total signups via your link</p>
        <p style="margin:6px 0 0;color:#34d399;font-size:34px;font-weight:800;font-family:monospace;">${data.totalSignups}</p>
      </div>
      <p>Your 20% recurring commission kicks in the moment they upgrade past the free tier. Keep sharing — your wallet balance + recent activity live at
        <a href="https://info-hub.io/settings/referrals" style="color:#34d399;">your dashboard</a>.</p>
    `,
    ctaLabel: 'View affiliate dashboard',
    ctaHref: 'https://info-hub.io/settings/referrals',
    footerNote: "You're getting this because you have an active affiliate code. Mute these in Settings.",
  });
  return { subject, html };
}

export async function sendAffiliateSignupNotif(args: BaseSendArgs & AffiliateSignupNotifData): Promise<SendResult> {
  const { to, dryRun, ...data } = args;
  const { subject, html } = renderAffiliateSignupNotif(data);
  return deliver({ to, subject, html, dryRun });
}

/* ─── Template 3: Affiliate — commission earned (first paid month) */

export interface CommissionEarnedData {
  affiliateName?: string | null;
  referredUserEmail?: string | null;
  tierLabel: string;        // e.g. "Pro"
  paidAmountUsd: number;    // user's paid month
  commissionUsd: number;    // 20% slice
  totalPendingUsd: number;
}

export function renderCommissionEarned(data: CommissionEarnedData): { subject: string; html: string } {
  const subject = `Commission earned: ${fmtUsd(data.commissionUsd)} from a ${data.tierLabel} signup`;
  const html = shell({
    headline: 'You just earned a commission',
    body: `
      <p>One of your referrals just upgraded to <strong style="color:#fff;">${data.tierLabel}</strong>, and you're earning the recurring 20% on every month they stay subscribed.</p>
      <table style="width:100%;margin:20px 0;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:8px 0;color:#737373;">Their tier</td><td style="padding:8px 0;text-align:right;color:#fff;font-family:monospace;">${data.tierLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">They paid</td><td style="padding:8px 0;text-align:right;color:#fff;font-family:monospace;border-top:1px solid #262626;">${fmtUsd(data.paidAmountUsd)}</td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">Your commission (20%)</td><td style="padding:8px 0;text-align:right;color:#34d399;font-family:monospace;font-weight:700;border-top:1px solid #262626;">${fmtUsd(data.commissionUsd)}</td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">Total pending</td><td style="padding:8px 0;text-align:right;color:#fbbf24;font-family:monospace;font-weight:700;border-top:1px solid #262626;">${fmtUsd(data.totalPendingUsd)}</td></tr>
      </table>
      <p style="color:#a3a3a3;font-size:12px;">Payouts roll out monthly once your pending balance crosses $25. Set / update your USDT wallet at your dashboard.</p>
    `,
    ctaLabel: 'Affiliate dashboard',
    ctaHref: 'https://info-hub.io/settings/referrals',
  });
  return { subject, html };
}

export async function sendCommissionEarned(args: BaseSendArgs & CommissionEarnedData): Promise<SendResult> {
  const { to, dryRun, ...data } = args;
  const { subject, html } = renderCommissionEarned(data);
  return deliver({ to, subject, html, dryRun });
}

/* ─── Template 4: Affiliate — monthly USDT payout sent ──────────── */

export interface PayoutSentData {
  affiliateName?: string | null;
  amountUsd: number;
  chain: 'solana' | 'arbitrum' | 'base';
  wallet: string;
  txHash: string;
  remainingPendingUsd: number;
}

export function renderPayoutSent(data: PayoutSentData): { subject: string; html: string } {
  const subject = `USDT payout sent: ${fmtUsd(data.amountUsd)}`;
  // Explorer URL per chain — keeps the email link going to the right scanner.
  const explorerBase = {
    solana: 'https://solscan.io/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
    base: 'https://basescan.org/tx/',
  }[data.chain];
  const chainLabel = data.chain.charAt(0).toUpperCase() + data.chain.slice(1);
  const html = shell({
    headline: `${fmtUsd(data.amountUsd)} payout sent`,
    body: `
      <p>We just sent your affiliate commission payout in USDT.</p>
      <table style="width:100%;margin:20px 0;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:8px 0;color:#737373;">Amount</td><td style="padding:8px 0;text-align:right;color:#34d399;font-family:monospace;font-weight:700;">${fmtUsd(data.amountUsd)} USDT</td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">Chain</td><td style="padding:8px 0;text-align:right;color:#fff;font-family:monospace;border-top:1px solid #262626;">${chainLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">Wallet</td><td style="padding:8px 0;text-align:right;color:#a3a3a3;font-family:monospace;font-size:11px;border-top:1px solid #262626;">${data.wallet.slice(0, 6)}…${data.wallet.slice(-4)}</td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">Tx hash</td><td style="padding:8px 0;text-align:right;border-top:1px solid #262626;"><a href="${explorerBase}${data.txHash}" style="color:#34d399;font-family:monospace;font-size:11px;">${data.txHash.slice(0, 10)}…</a></td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">Remaining pending</td><td style="padding:8px 0;text-align:right;color:#fbbf24;font-family:monospace;border-top:1px solid #262626;">${fmtUsd(data.remainingPendingUsd)}</td></tr>
      </table>
      <p style="color:#a3a3a3;font-size:12px;">If anything looks wrong, reply to this email within 7 days and we'll sort it out.</p>
    `,
    ctaLabel: 'View on explorer',
    ctaHref: `${explorerBase}${data.txHash}`,
  });
  return { subject, html };
}

export async function sendPayoutSent(args: BaseSendArgs & PayoutSentData): Promise<SendResult> {
  const { to, dryRun, ...data } = args;
  const { subject, html } = renderPayoutSent(data);
  return deliver({ to, subject, html, dryRun });
}

/* ─── Template 5: Launch-cutover heads-up (T-14 days) ────────────── */

export interface LaunchCutoverData {
  /** ISO date, e.g. "2026-06-15" */
  cutoverDate: string;
  /** Current grandfathered tier for the recipient. Pro users get a
   *  reminder they retain the new Pro $29 features for free during
   *  launch; everyone else gets the standard pitch. */
  currentTier: 'free' | 'trader' | 'pro' | 'whale';
}

export function renderLaunchCutover(data: LaunchCutoverData): { subject: string; html: string } {
  const subject = `Heads-up: free during launch ends ${data.cutoverDate}`;
  const tierLine =
    data.currentTier === 'whale' ? "You're auto-grandfathered to Whale ($59) — same features, same price post-launch."
    : data.currentTier === 'pro'   ? "You're auto-grandfathered to Pro ($29) — the new middle tier. Same features you have today."
    : data.currentTier === 'trader' ? "You're on Trader ($12). Free during launch turns into a real subscription on the cutover date — no surprise charges, you'll need to add a payment method."
    : "Free tier stays free forever. Trader / Pro / Whale features become paid on the cutover date.";

  const html = shell({
    headline: 'Free during launch ends soon',
    body: `
      <p>You've been using InfoHub during our "free during launch" window. That ends on <strong style="color:#fff;">${data.cutoverDate}</strong>.</p>
      <p>${tierLine}</p>
      <p style="margin-top:20px;">What changes on cutover:</p>
      <ul style="padding-left:20px;margin:12px 0;">
        <li>Free tier stays free — no card required, no time limit, same data terminal.</li>
        <li>Pro / Whale features (custom dashboards, API archive, sub-second alerts, etc.) require a subscription.</li>
        <li>Crypto checkout via USDT (NowPayments). No card needed.</li>
        <li>20% lifetime affiliate program goes live the same day. Get your code at
          <a href="https://info-hub.io/settings/referrals" style="color:#34d399;">your dashboard</a>.</li>
      </ul>
      <p style="margin-top:16px;color:#a3a3a3;font-size:12px;">Questions? Reply to this email — we read everything.</p>
    `,
    ctaLabel: 'See pricing',
    ctaHref: 'https://info-hub.io/pricing',
    footerNote: "You're getting this because you have an active InfoHub account. There is no way to disable launch-related comms — they only fire at major milestones.",
  });
  return { subject, html };
}

export async function sendLaunchCutover(args: BaseSendArgs & LaunchCutoverData): Promise<SendResult> {
  const { to, dryRun, ...data } = args;
  const { subject, html } = renderLaunchCutover(data);
  return deliver({ to, subject, html, dryRun });
}

/* ─── Template 6: Subscription confirmation (post-launch) ────────── */

export interface SubscriptionConfirmedData {
  tierLabel: string;       // "Pro" / "Whale" / "Trader"
  amountUsd: number;       // monthly or annual amount paid
  period: 'monthly' | 'annual';
  nextRenewalIso: string;  // ISO date
}

export function renderSubscriptionConfirmed(data: SubscriptionConfirmedData): { subject: string; html: string } {
  const subject = `${data.tierLabel} subscription confirmed — ${fmtUsd(data.amountUsd)}`;
  const html = shell({
    headline: `Welcome to ${data.tierLabel}`,
    body: `
      <p>Payment confirmed. Your <strong style="color:#fff;">${data.tierLabel}</strong> features are live.</p>
      <table style="width:100%;margin:20px 0;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:8px 0;color:#737373;">Tier</td><td style="padding:8px 0;text-align:right;color:#fff;">${data.tierLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">Billing</td><td style="padding:8px 0;text-align:right;color:#fff;text-transform:capitalize;border-top:1px solid #262626;">${data.period}</td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">Paid</td><td style="padding:8px 0;text-align:right;color:#34d399;font-family:monospace;font-weight:700;border-top:1px solid #262626;">${fmtUsd(data.amountUsd)}</td></tr>
        <tr><td style="padding:8px 0;color:#737373;border-top:1px solid #262626;">Next renewal</td><td style="padding:8px 0;text-align:right;color:#fff;font-family:monospace;border-top:1px solid #262626;">${data.nextRenewalIso}</td></tr>
      </table>
      <p>Cancel anytime from <a href="https://info-hub.io/settings" style="color:#34d399;">Settings → Billing</a>. You keep access until the period ends.</p>
    `,
    ctaLabel: 'Explore Pro features',
    ctaHref: 'https://info-hub.io/dashboard/widgets',
  });
  return { subject, html };
}

export async function sendSubscriptionConfirmed(args: BaseSendArgs & SubscriptionConfirmedData): Promise<SendResult> {
  const { to, dryRun, ...data } = args;
  const { subject, html } = renderSubscriptionConfirmed(data);
  return deliver({ to, subject, html, dryRun });
}

/* ─── Template 7: Payment failed dunning (post-launch) ───────────── */

export interface PaymentFailedData {
  tierLabel: string;
  amountUsd: number;
  /** When their tier downgrades to Free if they don't fix it. */
  graceEndsIso: string;
}

export function renderPaymentFailed(data: PaymentFailedData): { subject: string; html: string } {
  const subject = 'Action needed: payment failed';
  const html = shell({
    headline: 'Your renewal payment didn’t go through',
    body: `
      <p>We tried to renew your <strong style="color:#fff;">${data.tierLabel}</strong> subscription for <strong>${fmtUsd(data.amountUsd)}</strong> and the payment failed.</p>
      <p style="color:#fbbf24;font-size:13px;background:#fbbf2410;padding:12px;border:1px solid #fbbf2430;border-radius:8px;margin:16px 0;">
        Your ${data.tierLabel} features stay active until <strong>${data.graceEndsIso}</strong>. After that, your account downgrades to Free.
      </p>
      <p>To keep your tier, head to <a href="https://info-hub.io/settings" style="color:#34d399;">Settings → Billing</a> and update your payment method or fund your USDT wallet for the next renewal.</p>
    `,
    ctaLabel: 'Fix payment now',
    ctaHref: 'https://info-hub.io/settings',
  });
  return { subject, html };
}

export async function sendPaymentFailed(args: BaseSendArgs & PaymentFailedData): Promise<SendResult> {
  const { to, dryRun, ...data } = args;
  const { subject, html } = renderPaymentFailed(data);
  return deliver({ to, subject, html, dryRun });
}
