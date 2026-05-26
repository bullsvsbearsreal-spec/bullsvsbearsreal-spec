# Pre-Paid-Launch Operator Checklist

Things that need to happen on your side before / during the
"Free during launch" → "Paid live" cutover. None of these are
blocking the current code — but they should land before flipping
`LAUNCH_GATING_ENABLED` in `src/components/TierGate.tsx`.

## Quick wins (do today — 15-30 min total)

### E1 · Rotate the leaked bot tokens

You pasted `8201123874:AAG...` (@ihhubbot) and
`8715413593:AAE...` (@InfoHubRadarBot) into chat history. Those
strings now live in transcript files. Rotate both via BotFather:

```
1. Open Telegram → @BotFather
2. /revoke
3. Select @InfoHubRadarBot
4. BotFather replies with a NEW token
5. Copy that token immediately (it's shown once)
6. DO console → bullsvsbearsreal-spec → App Spec → env vars
   → TELEGRAM_BOT_TOKEN → paste new value → Save
7. Redeploy (DO usually auto-deploys on env change)
8. Re-register the webhook:
   curl "https://info-hub.io/api/telegram/setup?secret=$CRON_SECRET"
9. Verify: send /status to @InfoHubRadarBot — should reply normally
```

@ihhubbot is no longer wired up (we rolled back the AI-chat
experiment). Either rotate its token AND keep it dormant for future
use, or **delete it entirely** via BotFather `/deletebot` — cleaner.

### E2 · Drop the dead bot v2 DB tables

The `telegram_conversations` + `bot_trade_ideas` tables and the
`idea_notifications` column on `telegram_links` are leftovers from
the AI-chat experiment rollback. They have no writers — safe to drop.

```bash
# DO console → App → Console → exec into the app
# OR pgsql directly against the prod DB:

DROP TABLE IF EXISTS telegram_conversations;
DROP TABLE IF EXISTS bot_trade_ideas;
ALTER TABLE telegram_links DROP COLUMN IF EXISTS idea_notifications;
```

Migration commands are also documented inline in
`src/lib/db/index.ts` near the telegram_links init block.

### E3 · Delete @ihhubbot via BotFather (optional)

If you don't see InfoHub returning AI chat to Telegram, delete the
spare bot rather than letting it linger.

```
@BotFather → /deletebot → @ihhubbot → confirm
```

Then remove the leftover env vars from DO App Platform:
- `TELEGRAM_CHAT_BOT_TOKEN`
- `DO_INFERENCE_API_KEY`
- `BOT_LLM_MODEL`

## Pre-launch (do when payment integration is ready)

### Wire up the Whale priority alert cron

See [whale-alerts-systemd.md](./whale-alerts-systemd.md) — drop two
systemd files on the droplet, enable the timer. Lights up the
`/api/cron/whale-alerts` endpoint that ships in the current build.

### Flip `LAUNCH_GATING_ENABLED`

When NowPayments checkout is live:

```ts
// src/components/TierGate.tsx
export const LAUNCH_GATING_ENABLED = true;  // was false
```

Effects:
- `/positions/tax` paywalls Free + Trader users (Pro+ get through)
- `/breakouts` paywalls Free + Trader users
- `/dashboard/widgets` paywalls Free + Trader users
- Existing Pro/Whale features that were "free during launch" become
  real subscriptions

### Verify the affiliate flywheel

After flipping above:

1. Sign up a new test account via `?ref=<your-code>`
2. Open `/settings/referrals` — confirm code/link visible
3. Have the test account upgrade to Trader (paying via NowPayments)
4. Verify `referral_events` has a `conversion` row with
   `commission_usd = 0.20 × $12 = $2.40`
5. Confirm the affiliate's pending balance updates on
   `/settings/referrals`

### Email comms

Send a "Free during launch ends on X" email to every signed-in user
2 weeks before the cutover. Resend template should include:
- Cutover date
- Their current tier (auto-grandfathered to Pro $29 for existing
  "pro" billing_tier rows — admin role stays Whale forever)
- Pricing page link
- Reassurance: Free tier stays free, no card required
- Affiliate program reminder (turn your audience into a revenue
  stream)

## Marketing alignment (Ben Infin8 $1,200 / 90-day deal)

### Give Ben his code first

He's on a $400/mo retainer + 20% commission. The 20% needs his
referral code wired so attribution kicks in immediately:

```
1. Have Ben sign up (or sign him up under your account if he prefers)
2. Open his /settings/referrals — copy his auto-generated code
3. Send him the share link: https://info-hub.io/?ref=BENXXXXX
4. Confirm his code resolves: curl https://info-hub.io/?ref=BENXXXXX
   → response should set ih_ref cookie
```

### Custom terms (if needed)

The default program is **90-day cookie**, 20% lifetime, 10% off
referrals, $25 min payout. The 90-day window is already long enough
to cover most creator funnels (newsletter → email open → sit on it
→ sign up). For Ben specifically you may still want:

- **Higher commission** (25-30%) — pays for itself if he drives volume

This isn't in the current code as a tier — would need a
`users.affiliate_commission_pct` column for per-user override. Wait
for actual volume signals before adding the complexity.

### Promo code for his audience (optional)

If you want a "BEN20" promo code (20% off first 3 months on top of
the 10% referral discount), that's a NowPayments-side coupon. Set up
when checkout lands.

## Open work not yet shipped

| Feature                          | Status         | Notes |
|----------------------------------|----------------|-------|
| NowPayments checkout             | Stubbed        | See `/pricing` modal — replace with real provider |
| 6 stub widgets (whales/news/...) | Frame shipped  | One follow-up PR per widget |
| Setup scanner real signals       | Page shipped   | `/breakouts` has UI; scoring logic stub |
| Custom dashboards drag/drop      | ✅ Shipped     | `/dashboard/widgets` with 3 wired widgets |
| Tax CSV export                   | ✅ Shipped     | `/api/account/tax/csv` |
| Position-sizing calculator       | Page exists    | `/position-size` |
| Tape reader                      | Not started    | Trader tool — see plan menu |
| Multi-TF momentum heatmap        | Not started    | Trader tool |
| Landing page polish              | Not started    | High ROI before $1,200 ad spend |
