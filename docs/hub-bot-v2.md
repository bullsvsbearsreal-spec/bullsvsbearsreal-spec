# Hub bot v2 — design

**Status:** design draft, awaiting approval before code
**Author:** Claude + ocelot (24 May 2026)
**Scope:** rebuild of `src/app/api/telegram/webhook/route.ts` + `src/lib/telegram.ts`
**Goal:** make Hub feel personal, fast, persistent, and actually useful for trade ideas

---

## TL;DR

Hub today is a stateless, generic Telegram bot. It answers questions, but it
forgets you exist 30 min later and treats every user identically. v2 turns it
into a quant-desk co-pilot that:

1. Knows YOUR active positions + alerts + watchlist when you ask anything
2. Remembers what you talked about across days (90-day Postgres conversation log)
3. Streams responses token-by-token via message edits (looks live, no more 8-15s
   blank waits)
4. Generates trade ideas with explicit scores, signal stacks, and invalidation
   levels — gated to Pro/Whale tiers
5. Pushes high-conviction ideas (score ≥ 75/100) at most 3×/day, never two
   within 2 hours
6. Tracks every called idea publicly on `/bot/track` so the algo has accountability

---

## Architecture changes

### Model host: Anthropic-direct → DO Serverless Inference

We're swapping the Anthropic SDK for DO Serverless Inference's OpenAI-compatible
chat-completions endpoint. Same Claude model under the hood, billed through DO
(same infra as everything else), unified region (FRA1).

```
Endpoint:  https://inference.do-ai.run/v1/chat/completions
Auth:      Authorization: Bearer ${DO_INFERENCE_API_KEY}
Models:    anthropic-claude-sonnet-4   (primary — what we use for everything)
           anthropic-claude-opus-4     (reserved for trade-idea generation if we
                                       decide Sonnet 4 isn't enough)
```

**Known tradeoff:** DO Serverless Inference's Anthropic catalog shows Claude
**Sonnet 4** (not 4.5 or 4.6). Anthropic-direct gives us 4.6 today. The bot
will be 1-2 minor versions behind on intelligence in exchange for the
unified-billing/single-vendor benefits. If quality regresses noticeably we
switch back to Anthropic-direct via a single env-var change (the OpenAI-
compatible shim accepts the same message format as Anthropic native).

### New: `DO_INFERENCE_API_KEY` env var

Added to DO App Platform env vars (manual step, user-owned). Replaces
`ANTHROPIC_API_KEY` for the bot specifically. Other surfaces of the codebase
that still use Anthropic-direct (the web `/chat` page) keep `ANTHROPIC_API_KEY`
for now — migration is incremental.

### New tables

```sql
CREATE TABLE telegram_conversations (
  id            BIGSERIAL PRIMARY KEY,
  chat_id       BIGINT NOT NULL,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  tool_calls    JSONB,          -- for assistant turns that triggered tools
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_tg_conv_chat_id_created ON telegram_conversations (chat_id, created_at DESC);
-- 90-day retention via daily cron job; pruning logic in lib/telegram-memory.ts

CREATE TABLE bot_trade_ideas (
  id              BIGSERIAL PRIMARY KEY,
  symbol          TEXT NOT NULL,
  side            TEXT NOT NULL CHECK (side IN ('long', 'short')),
  setup_type      TEXT NOT NULL,   -- 'funding_arb' | 'directional' | 'liq_hunt' | 'squeeze'
  score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  signal_stack    JSONB NOT NULL,  -- the list of signals that fired
  invalidation    NUMERIC,         -- the price level
  horizon_h       INTEGER NOT NULL,
  pushed_to       BIGINT[],        -- chat_ids that got the proactive push
  status          TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'invalidated', 'expired')),
  closed_at       TIMESTAMPTZ,
  outcome_pct     NUMERIC,         -- price change vs entry over horizon_h
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_bot_ideas_status ON bot_trade_ideas (status, created_at DESC);
CREATE INDEX ix_bot_ideas_symbol_created ON bot_trade_ideas (symbol, created_at DESC);
-- Powers /bot/track + the lifecycle watcher that closes ideas when invalidated
```

---

## Personalization: positions in the system prompt

When the chat is linked to a user, every system prompt gets injected with
their live positions + watchlist + recent alerts:

```
You are Hub, an InfoHub Telegram bot...

# This user's context
Active positions (across linked exchanges):
- BTC long $42,000 @ Binance, entry $111,200, unrealized +$840 (+2.0%)
- ETH long $18,000 @ Bybit, entry $3,920, unrealized -$220 (-1.2%)
Watchlist: BTC, ETH, SOL, SUI, ARB
Recent alerts (last 24h):
- BTC funding ≤ -0.03% (Binance) fired 06:00 UTC
- ETH OI +5% / 1h fired 22:00 UTC
```

Build path: `lib/telegram-user-context.ts::buildUserContext(chatId)` →
queries `getTelegramLink(chatId)` for `user_id`, then `/api/account/positions`
+ `getUserWatchlist(user_id)` + recent alerts log. Cached 60s per user.

This is THE win that makes the bot feel different from any other crypto LLM
bot — they don't have your book, we do.

---

## Streaming via message edits

Telegram doesn't natively stream, but you can edit a sent message. v2 sends
a placeholder `<i>Hub is thinking…</i>`, then edits it every ~50 tokens.
Telegram caps `editMessage` to ~1 edit per second per chat, so we throttle:

```ts
// pseudocode
const placeholder = await sendMessage(chatId, '⌛ <i>Hub is thinking…</i>');
let accumulated = '';
let lastEdit = Date.now();

for await (const chunk of streamChatCompletion(...)) {
  accumulated += chunk;
  if (Date.now() - lastEdit > 1100) {  // 1.1s — under Telegram's cap
    await editMessage(chatId, placeholder.message_id, accumulated + '▋');
    lastEdit = Date.now();
  }
}
// Final edit removes the cursor
await editMessage(chatId, placeholder.message_id, accumulated);
```

Throttled to one edit / 1.1 seconds per chat to stay under Telegram limits.
Final edit always lands. If streaming fails or tools fire, we fall back to
the current "wait then send" flow gracefully.

---

## Persistent memory (Postgres)

The current in-process `chatHistory` Map vanishes on every cold start (App
Platform restart = lost context). v2 reads/writes Postgres on every turn:

```ts
// On message in:
const recent = await db.query(`
  SELECT role, content FROM telegram_conversations
  WHERE chat_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC LIMIT 12
`, [chatId]);
// → reversed → used as message history

// After response:
await db.query(`
  INSERT INTO telegram_conversations (chat_id, user_id, role, content)
  VALUES ($1, $2, $3, $4), ($1, $2, $5, $6)
`, [chatId, userId, 'user', userText, 'assistant', responseText]);
```

90-day retention. Daily cron job (`/api/cron/prune-tg-conversations`) deletes
rows older than 90 days. New commands:

- `/forget` — wipes this chat's history (one-row DELETE)
- `/recap` — bot summarizes the last 7 days of conversation for this chat

---

## Trade idea generation

### Signal scoring (0–100)

```
Score = sum of weighted contributions, capped at 100.

Signal                                       Max weight   Trigger
─────────────────────────────────────────────────────────────────────────────
Funding extreme/flip                              30      |rate| ≥ 98th pctile (30d), or sign-flip in last 4h
Whale positioning (HL/gTrade)                     25      ≥ 2 whales added (or cut) ≥ $20M in last 4h
OI delta + liq cluster proximity                  20      OI Δ4h ≥ ±8% AND a cluster sits within 3% of price
Cross-venue basis blowout                         15      ≥ 1 venue's funding differs ≥ 0.02% from cohort
Long/short ratio extreme                          10      L/S ratio at 95th pctile (contrarian)
```

Scoring is deterministic — same inputs always produce same score. Code lives
in `lib/bot/idea-scorer.ts` with `__tests__/` siblings covering each signal
threshold.

### Star labels

| Score | Stars | Surface |
| --- | --- | --- |
| 85–100 | ★★★★ | proactive push eligible |
| 70–84  | ★★★ | proactive push eligible |
| 55–69  | ★★ | shown only on `/ideas` |
| < 55   | hidden | never surfaced |

### Idea generation flow

1. **Universe:** Top 50 perp markets by aggregate OI (refreshed hourly)
2. **Per-coin signal scan:** runs every 5 min via cron (`/api/cron/scan-ideas`)
3. **Score + cluster** correlated coins (BTC + ETH + SOL all squeezing → single basket idea, headline coin first)
4. **Filter:**
   - For `/ideas` on-demand: return top-3 by score, min ★★ (≥ 55)
   - For proactive push: filter to ≥ 75 score AND not pushed in last 2h AND day-cap < 3
5. **Persist** to `bot_trade_ideas` with full signal stack JSON
6. **Render** in sharp-trader voice (sample below)
7. **Push** via Telegram bot API to all chats where `idea_notifications = true`

### Sample idea render

```
BTC — long bias, ★★★

Funding paid for shorts (-0.04%, top 2%). Whales loaded $42M long. OI
building 8% with no price move = coiled.

Stay above 112.3k or it dies. Magnet at 115.2k from the liq cluster.

nfa · your risk
```

### Idea lifecycle

Cron job `/api/cron/watch-ideas` runs every 5 min:
- For each `live` idea: check if invalidation level has been touched
- If invalidated → set `status = 'invalidated'`, `closed_at = now()`, send a
  follow-up Telegram message to everyone in `pushed_to`:
  `❌ BTC long invalidated at $109.5k. Closing.`
- If `horizon_h` elapsed without invalidation → `status = 'expired'`,
  compute `outcome_pct`, no follow-up message
- Outcomes drive the public `/bot/track` page

### Correlated-day clustering

If 3+ coins all hit the same setup type within 30 min, the bot synthesizes
one push with the highest-score coin as headline and lists the alts:

```
BTC — long bias, ★★★
Same setup on ETH ★★★, SOL ★★, AVAX ★★
[BTC details...]
```

Counts as 1 of 3 daily push slots, not 4.

### Position-context warnings

When generating an idea for a coin the linked user already holds:

```
BTC long bias, ★★★
⚠ You're already long $42k BTC — this would scale in.
[rest of idea...]
```

Doesn't block, just annotates. Renders only on responses going to chats
where the linked user holds a position in the same coin.

### Daily morning brief (8 AM UTC)

Cron `/api/cron/morning-brief` sends to Whale-tier opted-in users:

```
☕ Morning Brief · 24 May

Top setups:
1. BTC long ★★★★ — funding -0.04%, whales loaded $42M, OI coiling
2. ETH short ★★★ — basis blow-out vs cohort (+0.03% over avg), OI ↓
3. SOL squeeze ★★★ — 3 whales short $18M into rising OI

Regime: risk-on. BTC ETF inflows yesterday +$120M. Funding
broadly positive (median +0.012%). FOMC minutes Wednesday — flatness
into the print historically.

nfa · your risk
```

---

## Tier gating + cost controls

| Tier | /ideas | Proactive push | Morning brief | Chat |
| --- | --- | --- | --- | --- |
| Free   | ❌ ("Pro tier required") | ❌ | ❌ | ✅ (50 msgs/day) |
| Pro    | ✅                       | opt-in via `/notify on` | opt-in | ✅ (50 msgs/day) |
| Whale  | ✅                       | ON by default            | ON by default | ✅ (50 msgs/day) |

**Daily cost cap:** 50 messages/day per chat regardless of tier. After 50,
the bot replies `You've hit your daily limit. Resumes at 00:00 UTC.`
Stops runaway abuse, easy to lift per-user later if needed.

**Default notification state for new linked Pro users:** OFF. `/ideas` works
on demand. Push requires explicit `/notify on`.
**Default for Whale users:** ON. They paid for the full experience.

---

## New commands

| Command | What it does |
| --- | --- |
| `/ideas` | Top-3 setups right now (Pro+ only) |
| `/notify on \| off` | Toggle proactive push (Pro+ only) |
| `/forget` | Wipe this chat's conversation history |
| `/recap` | Summarize the last 7 days of conversation |
| `/brief` | Send today's morning brief on demand (re-sends or generates) |

---

## Track record (`/bot/track`)

New public Next.js page at `/bot/track`. Reads from `bot_trade_ideas` table.
Shows:

- Last 30 days summary: total ideas / W-L count / median R-multiple
- Per-setup-type breakdown (funding-arb wins/losses, directional, etc.)
- Full chronological log with: timestamp, coin, side, score, stars, signal
  stack, invalidation level, outcome (TARGET HIT / INVALIDATED / EXPIRED),
  net price move
- Honest reporting — no cherry-picking. Cron writes outcomes automatically.

Builds trust. Lets us tune the scorer based on real data.

---

## Disclaimer policy

- Once on `/start`: brief mention of "not financial advice"
- Every `/ideas` and proactive push: small footer `nfa · your risk` (lowercase, italic, light)
- Daily brief: same footer

Casual chat replies (no idea content) get no disclaimer — keeps the
conversational vibe.

---

## Build slice (PR 1: this PR)

What ships in the first PR:

- [ ] Postgres migrations: `telegram_conversations`, `bot_trade_ideas`
- [ ] `lib/telegram-memory.ts` — read/write conversation history
- [ ] `lib/telegram-user-context.ts` — load positions + watchlist + alerts
- [ ] `lib/do-inference.ts` — DO Serverless Inference client (OpenAI-compatible
      fetch wrapper, streaming + tool-use support)
- [ ] `src/app/api/telegram/webhook/route.ts` rewrite:
  - swap Anthropic SDK → DO Inference client
  - persistent memory via `lib/telegram-memory.ts`
  - inject user context into system prompt
  - stream responses via `editMessage` throttled to 1.1s
- [ ] `lib/bot/idea-scorer.ts` — deterministic scoring + tests
- [ ] `/api/telegram/webhook` handles new commands: `/ideas`, `/forget`, `/recap`, `/notify`, `/brief`
- [ ] Tier gating in the webhook (read `getTelegramLink → user → tier`)
- [ ] `DO_INFERENCE_API_KEY` env var documented in `.env.example`
- [ ] Tests: idea-scorer (per-signal), telegram-memory (insert/read/prune),
      telegram-user-context (position formatting), do-inference (mock fetch)

What does NOT ship in PR 1 (queued for PR 2):

- Proactive push cron (`/api/cron/scan-ideas`)
- Idea lifecycle watcher (`/api/cron/watch-ideas`)
- Morning brief cron (`/api/cron/morning-brief`)
- `/bot/track` public page
- Conversation pruning cron (`/api/cron/prune-tg-conversations`)
- Voice / vision input
- Group chat support

PR 1 lands the foundation + on-demand `/ideas`. PR 2 adds the proactive layer.

---

## Open questions for review

1. **DO Sonnet 4 vs Anthropic-direct Sonnet 4.6** — accept the version lag, or
   stay on Anthropic-direct? My recommendation: accept the lag for v1, evaluate
   after a week of real usage. If quality drops noticeably, switch back via
   env var.

2. **Free tier on chat** — should Free users get casual chat at all, or
   should it be "link your account to chat" → upgrade to Pro to actually use it?
   Doc above assumes Free gets 50/day chat. Alternative: 10/day for Free.

3. **/recap output format** — bullet summary, paragraph, or both? Doc above
   doesn't lock it. I'd default to a 3-bullet "Topics you discussed: X, Y, Z.
   Bot's latest take on each: ..." but happy to tune.

4. **Signal scorer weights** — the 30/25/20/15/10 weights above are first-pass
   estimates. We'll tune from real outcomes once `/bot/track` has 30 days of data.

---

## Estimated effort

PR 1 (this slice): ~1.5 days of focused work
PR 2 (proactive + track page + crons): ~1 day
Total to "full Hub v2": ~2.5 days
