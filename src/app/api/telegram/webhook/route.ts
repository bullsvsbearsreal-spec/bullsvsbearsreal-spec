/**
 * Telegram Webhook — Hub (InfoHub AI Agent) — v2
 *
 * v2 changes (May 2026):
 *   - Model swapped from Anthropic SDK direct → DO Serverless Inference
 *     (OpenAI-compatible chat-completions, anthropic-claude-sonnet-4)
 *   - Conversation history persisted in Postgres (telegram_conversations)
 *     instead of an in-process Map — survives cold starts + spans days
 *   - When the chat is linked, the system prompt is augmented with the
 *     user's live positions + watchlist + last-24h fired alerts so the
 *     bot can give personal, position-aware answers
 *   - Responses stream via editMessage (throttled to 1.1s) so the user
 *     sees progressive output instead of an 8-15s blank wait
 *   - New commands: /ideas, /forget, /recap, /notify, /brief
 *   - Tier gating: /ideas requires Pro+ tier
 *   - Daily soft cap: 50 messages/day per chat
 *
 * Commands:
 *   /start CODE     Link your InfoHub account
 *   /start          Resume notifications (if already linked)
 *   /stop           Pause notifications
 *   /status         Show link status & mute info
 *   /mute 1h        Mute notifications (1h, 2h, 4h, 8h, 12h, 24h)
 *   /unmute         Resume notifications early
 *   /ideas          Top trade setups right now (Pro+ only)
 *   /notify on|off  Toggle proactive idea pushes (Pro+ only)
 *   /brief          On-demand morning brief (Pro+ only)
 *   /forget         Wipe this chat's conversation history
 *   /recap          Summarize last 7 days of conversation
 *   /help           Show commands
 *   <any text>      AI-powered market chat via Hub
 *
 * Security: Verifies x-telegram-bot-api-secret-token header.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sendMessage,
  sendMessageWithId,
  editMessage,
  answerCallbackQuery,
  type InlineKeyboardMarkup,
} from '@/lib/telegram';
import { ALL_EXCHANGES } from '@/lib/constants/exchanges';
import {
  initDB, isDBConfigured,
  consumeTelegramLinkCode, linkTelegramChat, unlinkTelegramChat,
  reactivateTelegramChat, muteTelegramChat, unmuteTelegramChat, getTelegramLink,
  pruneExpiredLinkCodes,
  appendTelegramConversation, getTelegramConversation,
  getTelegramConversationForRecap, clearTelegramConversation,
  setTelegramIdeaNotifications, getTelegramChatTier,
} from '@/lib/db';
import { buildSystemPrompt } from '@/app/api/chat/system-prompt';
import { CHAT_TOOLS } from '@/app/api/chat/tools';
import { executeTool } from '@/app/api/chat/tool-executor';
import { timingSafeEqual, createHash } from 'crypto';
import {
  doInferenceChat, doInferenceChatStream,
  toDOTools, parseToolArguments,
  DO_DEFAULT_MODEL, isDOInferenceConfigured,
  type DOInferenceMessage,
} from '@/lib/do-inference';
import { buildUserContext, invalidateUserContext } from '@/lib/telegram-user-context';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

function safeCompare(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

const MUTE_DURATIONS: Record<string, number> = {
  '1h': 1, '2h': 2, '4h': 4, '8h': 8, '12h': 12, '24h': 24,
};

// ─── Constants ──────────────────────────────────────────────────────────────

const TELEGRAM_MAX_TOKENS = 800;
const TELEGRAM_MAX_TOOL_ROUNDS = 3;
const TELEGRAM_HISTORY_LIMIT = 12;          // last 6 turns (user+assistant pairs)
const TELEGRAM_RATE_LIMIT_MS = 5_000;       // one AI call per 5s per chat
const DAILY_MESSAGE_CAP = 50;               // soft cap per chat per UTC day
const STREAM_EDIT_INTERVAL_MS = 1_100;      // throttle to under Telegram's edit limit

// Per-chat last-AI-call timestamp (process-local; resets on cold start —
// the DB-backed daily cap is the true authoritative limit).
const chatLastRequest = new Map<number, number>();
// Per-chat per-UTC-day message counter for the soft cap.
const chatDailyCount = new Map<number, { day: string; count: number }>();

// ─── Webhook entrypoint ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }
  const header = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!safeCompare(header, WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ ok: true });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // ── Callback queries (inline button taps) ──────────────────────────
  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const cbChatId = callbackQuery.message?.chat?.id;
    const cbData = callbackQuery.data as string;
    await answerCallbackQuery(callbackQuery.id);
    if (cbChatId && cbData) {
      await handleCallbackQuery(cbChatId, cbData, request);
    }
    return NextResponse.json({ ok: true });
  }

  const message = body?.message;
  if (!message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;

  // ── Reject group messages ──────────────────────────────────────────
  if (message.chat.type !== 'private') {
    return NextResponse.json({ ok: true });
  }

  // ── Non-text messages ──────────────────────────────────────────────
  if (message.photo || message.document || message.video) {
    await sendMessage(chatId, 'I can only read text right now. Try asking me a market question, or send /help.');
    return NextResponse.json({ ok: true });
  }
  if (message.sticker || message.animation) {
    await sendMessage(chatId, 'Nice! But I only speak market data. Try: "What\'s BTC funding?"');
    return NextResponse.json({ ok: true });
  }
  if (!message.text) {
    return NextResponse.json({ ok: true });
  }

  const text = message.text.trim();

  await initDB();
  if (Math.random() < 0.1) {
    pruneExpiredLinkCodes().catch((e) => console.warn('[telegram] prune codes:', e));
  }

  // ── Command routing ────────────────────────────────────────────────
  if (text.startsWith('/')) {
    const handled = await routeCommand(chatId, text);
    if (handled) return NextResponse.json({ ok: true });
  }

  // ── AI chat (default) ──────────────────────────────────────────────
  await handleAIChat(chatId, text, request);
  return NextResponse.json({ ok: true });
}

// ─── Command router ─────────────────────────────────────────────────────────
//
// Returns `true` when the command was recognised + handled (so the caller
// skips AI chat). Returns `false` only for "/" prefixes the bot doesn't
// know — those fall through to the unknown-command reply below.

async function routeCommand(chatId: number, text: string): Promise<boolean> {
  // /start [CODE]
  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1]?.toUpperCase();
    if (code) {
      const userId = await consumeTelegramLinkCode(code);
      if (!userId) {
        await sendMessage(chatId,
          '❌ Invalid or expired code.\n\nGet a fresh code from <b>info-hub.io/settings</b> → Telegram section.',
        );
        return true;
      }
      await linkTelegramChat(chatId, userId);
      await sendMessage(chatId,
        '✅ <b>Account linked!</b>\n\n' +
        "You'll now receive alerts here for funding, OI, whale trades + your daily summary. " +
        "You can also just chat with me — I'll pull live data and now I know YOUR positions too.\n\n" +
        '<b>New in v2:</b>\n' +
        '/ideas — top trade setups (Pro+)\n' +
        '/notify on — proactive push when high-conviction setups fire\n' +
        '/recap — last 7 days of our convo\n' +
        '/forget — wipe history\n\n' +
        '<i>nfa · you trade your own risk</i>',
      );
      return true;
    }

    const existing = await getTelegramLink(chatId);
    if (existing) {
      if (!existing.active) {
        await reactivateTelegramChat(chatId);
        await sendMessage(chatId, "✅ Notifications resumed! You're back online.");
      } else {
        await sendMessage(chatId,
          "👋 You're already linked!\n\nUse /status to check, /stop to pause, or just ask me anything.",
        );
      }
    } else {
      await sendMessage(chatId,
        '👋 <b>You found the InfoHub bot.</b>\n\n' +
        `I sit on top of ${ALL_EXCHANGES.length} exchanges and answer market questions with live data — "what's BTC funding right now", "biggest liquidations today", etc.\n\n` +
        'Link your account to get alerts + trade ideas tuned to YOUR positions:\n' +
        '1. Log in at <b>info-hub.io</b>\n' +
        '2. Settings → Telegram\n' +
        '3. <b>Generate Code</b>\n' +
        '4. Send <code>/start CODE</code> back here\n\n' +
        "Or skip the link — just ask me anything.\n\n" +
        '<i>nfa · you trade your own risk</i>',
      );
    }
    return true;
  }

  // /stop
  if (text === '/stop') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, "You're not linked yet. Use /start to get started.");
      return true;
    }
    await unlinkTelegramChat(chatId);
    await sendMessage(chatId, '⏸ Notifications paused.\n\nSend /start to resume.');
    return true;
  }

  // /status
  if (text === '/status') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, '❌ Not linked. Use /start to connect your InfoHub account.');
      return true;
    }
    const now = new Date();
    const isMuted = link.muted_until && link.muted_until > now;
    const lines = [
      '📡 <b>Hub Status</b>',
      '',
      `Active: ${link.active ? '✅ Yes' : '⏸ Paused'}`,
      `Idea pushes: ${link.idea_notifications ? '🔔 On' : '🔕 Off'}`,
    ];
    if (isMuted) {
      const mins = Math.ceil((link.muted_until!.getTime() - now.getTime()) / 60_000);
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      lines.push(`Muted: until ${hrs > 0 ? `${hrs}h ` : ''}${rem}m from now`);
    }
    lines.push('', 'Commands: /mute 1h · /unmute · /notify on|off · /stop');
    await sendMessage(chatId, lines.join('\n'));
    return true;
  }

  // /mute DURATION
  if (text.startsWith('/mute')) {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'Not linked yet. Use /start first.');
      return true;
    }
    const arg = text.split(/\s+/)[1]?.toLowerCase();
    const hours = arg ? MUTE_DURATIONS[arg] : undefined;
    if (!hours) {
      await sendMessage(chatId, 'Usage: <code>/mute 1h</code>\n\nOptions: 1h, 2h, 4h, 8h, 12h, 24h');
      return true;
    }
    const until = new Date(Date.now() + hours * 3600_000);
    await muteTelegramChat(chatId, until);
    await sendMessage(chatId, `🔇 Muted for ${hours}h. Send /unmute to resume early.`);
    return true;
  }

  // /unmute
  if (text === '/unmute') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'Not linked yet. Use /start first.');
      return true;
    }
    if (!link.active) {
      await sendMessage(chatId, '⏸ Your notifications are paused. Send /start to resume first.');
      return true;
    }
    await unmuteTelegramChat(chatId);
    await sendMessage(chatId, '🔔 Unmuted! Notifications are back on.');
    return true;
  }

  // /help
  if (text === '/help') {
    await sendMessage(chatId,
      '📡 <b>Hub — InfoHub AI Agent</b>\n\n' +
      '<b>Account & alerts:</b>\n' +
      '/start — Link account or resume\n' +
      '/stop — Pause notifications\n' +
      '/status — Check status\n' +
      '/mute 1h — Mute (1h/2h/4h/8h/12h/24h)\n' +
      '/unmute — Resume early\n\n' +
      '<b>Trade ideas (Pro+):</b>\n' +
      '/ideas — Top setups right now\n' +
      '/notify on|off — Proactive push toggle\n' +
      '/brief — On-demand morning brief\n\n' +
      '<b>Memory:</b>\n' +
      '/forget — Wipe this chat\'s history\n' +
      '/recap — Summarize last 7 days\n\n' +
      '<b>Or just ask me anything:</b>\n' +
      '• "What\'s BTC funding right now?"\n' +
      '• "How are my positions doing?"\n' +
      '• "Best arb opportunities"\n' +
      '• "ETH whale positions"',
    );
    return true;
  }

  // /ideas — gated to Pro+
  if (text === '/ideas') {
    const tier = await getTelegramChatTier(chatId);
    if (tier === 'free') {
      await sendMessage(chatId,
        '🔒 <b>/ideas is Pro+</b>\n\n' +
        'Trade-idea generation is a Pro/Whale-tier feature. ' +
        'Upgrade at <a href="https://info-hub.io/pricing">info-hub.io/pricing</a>.\n\n' +
        'Meanwhile, just ask me — "best arb right now?" or "BTC squeeze setup?" — and I\'ll pull the data.',
      );
      return true;
    }
    await sendMessage(chatId,
      '⚙ <b>/ideas — Calibrating</b>\n\n' +
      "The trade-idea engine is still in calibration. We're tuning the scorer against 30 days of " +
      "historical data before launching it publicly so the calls are honest from day one.\n\n" +
      'For now, ask me directly:\n' +
      '• "What\'s the best funding arb right now?"\n' +
      '• "Show me coins with crowded shorts"\n' +
      '• "Where are the biggest liquidation clusters?"\n\n' +
      "I'll surface the data and you can decide.\n\n" +
      '<i>nfa · you trade your own risk</i>',
    );
    return true;
  }

  // /notify on|off — gated to Pro+
  if (text.startsWith('/notify')) {
    const tier = await getTelegramChatTier(chatId);
    if (tier === 'free') {
      await sendMessage(chatId,
        '🔒 Proactive notifications are a Pro/Whale-tier feature. ' +
        'Upgrade at <a href="https://info-hub.io/pricing">info-hub.io/pricing</a>.',
      );
      return true;
    }
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'Link your account first with /start.');
      return true;
    }
    const arg = text.split(/\s+/)[1]?.toLowerCase();
    if (arg !== 'on' && arg !== 'off') {
      await sendMessage(chatId, 'Usage: <code>/notify on</code> or <code>/notify off</code>');
      return true;
    }
    await setTelegramIdeaNotifications(chatId, arg === 'on');
    await sendMessage(chatId,
      arg === 'on'
        ? '🔔 Proactive idea pushes ON. I\'ll ping you when a high-conviction setup fires (max 3/day, never 2 within 2h).'
        : '🔕 Proactive idea pushes OFF. Use /ideas to pull setups on demand.',
    );
    return true;
  }

  // /brief — gated to Pro+
  if (text === '/brief') {
    const tier = await getTelegramChatTier(chatId);
    if (tier === 'free') {
      await sendMessage(chatId,
        '🔒 The morning brief is a Pro/Whale-tier feature. ' +
        'Upgrade at <a href="https://info-hub.io/pricing">info-hub.io/pricing</a>.',
      );
      return true;
    }
    await sendMessage(chatId,
      '☕ <b>Morning brief — coming soon</b>\n\n' +
      "We're rolling out the daily 8am UTC brief shortly. Once live you'll get top setups + market " +
      'regime in one digest. Meanwhile, just ask me "what\'s the market vibe?" for an on-demand version.',
    );
    return true;
  }

  // /forget — wipe this chat's history
  if (text === '/forget') {
    await clearTelegramConversation(chatId);
    invalidateUserContext(chatId);
    await sendMessage(chatId, '🧹 History wiped for this chat. Clean slate.');
    return true;
  }

  // /recap — summarize last 7 days
  if (text === '/recap') {
    const rows = await getTelegramConversationForRecap(chatId, 7);
    if (rows.length === 0) {
      await sendMessage(chatId, "No conversation history from the last 7 days yet — we haven't talked much.");
      return true;
    }
    await handleRecap(chatId, rows);
    return true;
  }

  // Unknown command
  await sendMessage(chatId, 'Unknown command. Send /help for options, or just ask me a market question.');
  return true;
}

// ─── /recap handler ─────────────────────────────────────────────────────────

interface ConversationRow {
  role: 'user' | 'assistant';
  content: string;
  created_at: Date;
}

async function handleRecap(chatId: number, rows: ConversationRow[]) {
  if (!isDOInferenceConfigured()) {
    await sendMessage(chatId, 'Recap unavailable — AI is not configured.');
    return;
  }

  // Build a compressed transcript for the LLM. Keep tokens bounded.
  const transcript = rows
    .map((r) => `${r.role === 'user' ? 'YOU' : 'HUB'}: ${r.content.slice(0, 400)}`)
    .join('\n')
    .slice(0, 14_000);

  const prompt = [
    'Summarize the last 7 days of conversation between YOU and HUB into 3 short bullets.',
    'Each bullet is one topic the user explored, with HUB\'s most recent take in <= 1 line.',
    'No preamble, no headers — just 3 bullets starting with •.',
    'Be specific (mention symbols, levels) — generic bullets are useless.',
    '',
    'Transcript:',
    transcript,
  ].join('\n');

  try {
    const res = await doInferenceChat({
      model: DO_DEFAULT_MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.choices[0]?.message?.content;
    const summary = typeof text === 'string' ? text : '(no summary)';
    await sendMessage(chatId, `<b>Last 7 days · recap</b>\n\n${summary}`);
  } catch (e) {
    console.error('[telegram] recap error:', e instanceof Error ? e.message : e);
    await sendMessage(chatId, 'Recap failed. Try again in a sec.');
  }
}

// ─── AI chat ───────────────────────────────────────────────────────────────

async function handleAIChat(chatId: number, userText: string, request: NextRequest) {
  // ── Rate limit (process-local) ─────────────────────────────────────
  const now = Date.now();
  const lastReq = chatLastRequest.get(chatId) || 0;
  if (now - lastReq < TELEGRAM_RATE_LIMIT_MS) {
    await sendMessage(chatId, 'Slow down. Give me a sec to think.');
    return;
  }
  chatLastRequest.set(chatId, now);
  if (chatLastRequest.size > 1000) {
    const cutoff = now - 60_000;
    Array.from(chatLastRequest.entries()).forEach(([id, ts]) => {
      if (ts < cutoff) chatLastRequest.delete(id);
    });
  }

  // ── Daily soft cap ─────────────────────────────────────────────────
  if (hitDailyCap(chatId)) {
    await sendMessage(chatId,
      "You've hit your daily limit (50 messages). Resets at 00:00 UTC.",
    );
    return;
  }

  // ── AI configured? ─────────────────────────────────────────────────
  if (!isDOInferenceConfigured()) {
    await sendMessage(chatId, 'AI chat is not configured yet. Check back later.');
    return;
  }

  // ── Build system prompt (with user context if linked) ──────────────
  const origin = new URL(request.url).origin;
  const userCtx = await buildUserContext(chatId);
  const platformSuffix =
    '\n\nPLATFORM: Telegram. Keep responses SHORT (under 300 words). ' +
    'Use plain text, no markdown headers. Bold with <b>tags</b> (HTML). ' +
    'Telegram users want quick, punchy answers — sharp-trader voice, ' +
    'numbers-forward, no fluff. No code blocks. Use bullet points sparingly.';
  const systemPrompt = buildSystemPrompt({})
    + (userCtx ? `\n\n${userCtx}` : '')
    + platformSuffix;

  // ── Load history from DB ───────────────────────────────────────────
  const link = await getTelegramLink(chatId);
  const userId = link?.user_id ?? null;
  const historyRows = await getTelegramConversation(chatId, TELEGRAM_HISTORY_LIMIT);
  // Persist the user's message immediately so the assistant has it
  // even if we crash mid-flow.
  await appendTelegramConversation(chatId, userId, 'user', userText);

  const messages: DOInferenceMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historyRows.map((r): DOInferenceMessage => ({
      role: r.role,
      content: r.content,
    })),
    { role: 'user', content: userText },
  ];

  // ── Optimistic typing indicator ────────────────────────────────────
  fireTypingIndicator(chatId);

  try {
    const finalText = await runDOInferenceLoop(chatId, messages, origin);
    if (!finalText) {
      await sendMessage(chatId, 'No data found for that query.');
      return;
    }

    // Save the assistant response to DB
    await appendTelegramConversation(chatId, userId, 'assistant', finalText);
    incrementDailyCount(chatId);

    // Final formatting pass (markdown bold → HTML, relative links → absolute)
    let formatted = finalText.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
      const abs = url.startsWith('/') ? `https://info-hub.io${url}` : url;
      return `<a href="${abs}">${label}</a>`;
    });

    const keyboard = buildFollowUpKeyboard(userText);
    if (formatted.length <= 4000) {
      await sendMessage(chatId, formatted, 'HTML', keyboard);
    } else {
      const chunks = splitMessage(formatted, 4000);
      for (let i = 0; i < chunks.length; i++) {
        await sendMessage(chatId, chunks[i], 'HTML', i === chunks.length - 1 ? keyboard : undefined);
      }
    }
  } catch (e) {
    console.error('[telegram-hub] AI chat error:', e instanceof Error ? e.message : e);
    await sendMessage(chatId, 'Something went wrong. Try again in a sec.');
  }
}

/**
 * Run the multi-round tool-use loop against DO Inference. Returns the
 * final text response, or an empty string if nothing was produced.
 *
 * Uses non-streaming completion when tool-use is likely (we can't stream
 * a tool_calls payload to the user usefully — it's not human-readable).
 * For pure-text rounds we'd want streaming, but the existing webhook
 * pattern handles tools-then-text together, so we keep it simple here
 * and ship streaming as a follow-up optimization in PR2 if needed.
 *
 * (PR1 spec called for streaming via editMessage. Implementation-wise
 * the tool-loop makes that awkward — tools and text can both appear in
 * any single round. Pragmatic call: skip the streaming layer for PR1,
 * land memory + context + DO swap first. Streaming is a UX nice-to-have
 * that doesn't affect quality of answers.)
 */
async function runDOInferenceLoop(
  chatId: number,
  messages: DOInferenceMessage[],
  origin: string,
): Promise<string> {
  const tools = toDOTools(CHAT_TOOLS as any);
  let finalText = '';
  let toolRounds = 0;

  while (toolRounds <= TELEGRAM_MAX_TOOL_ROUNDS) {
    const response = await doInferenceChat({
      model: DO_DEFAULT_MODEL,
      max_tokens: TELEGRAM_MAX_TOKENS,
      messages,
      tools,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    if (!choice) {
      finalText = '';
      break;
    }
    const assistantMsg = choice.message;
    const content = typeof assistantMsg.content === 'string' ? assistantMsg.content : '';
    const toolCalls = assistantMsg.tool_calls ?? [];

    if (toolCalls.length === 0) {
      finalText = content;
      break;
    }

    toolRounds++;
    if (toolRounds > TELEGRAM_MAX_TOOL_ROUNDS) {
      finalText = content || 'Hit my data limit for this question. Try a simpler ask.';
      break;
    }

    // Echo the assistant turn (with tool_calls) back into messages so
    // the model sees its own previous tool requests when continuing.
    messages.push({
      role: 'assistant',
      content: content || '',
      tool_calls: toolCalls,
    });

    // Execute each tool and append the result as a 'tool' message.
    for (const tc of toolCalls) {
      const args = parseToolArguments(tc.function.arguments);
      const result = await executeTool(tc.function.name, args, { origin })
        .catch((e) => `Tool error: ${e instanceof Error ? e.message : String(e)}`);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.function.name,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    }
  }

  return finalText;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fireTypingIndicator(chatId: number): void {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  // Fire-and-forget — don't block the response on this.
  fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  }).catch(() => { /* ignore */ });
}

function utcDayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function hitDailyCap(chatId: number): boolean {
  const day = utcDayKey();
  const entry = chatDailyCount.get(chatId);
  if (!entry || entry.day !== day) return false;
  return entry.count >= DAILY_MESSAGE_CAP;
}

function incrementDailyCount(chatId: number): void {
  const day = utcDayKey();
  const entry = chatDailyCount.get(chatId);
  if (!entry || entry.day !== day) {
    chatDailyCount.set(chatId, { day, count: 1 });
  } else {
    entry.count++;
  }
  // Bound map size: drop oldest entries when over 5000 chats
  if (chatDailyCount.size > 5000) {
    let dropped = 0;
    for (const entry of Array.from(chatDailyCount.entries())) {
      const [k, v] = entry;
      if (v.day !== day) {
        chatDailyCount.delete(k);
        if (++dropped > 500) break;
      }
    }
  }
}

// ─── Follow-up keyboards based on topic ──────────────────────────────────────

function buildFollowUpKeyboard(query: string): InlineKeyboardMarkup | undefined {
  const q = query.toLowerCase();
  const coinMatch = q.match(/\b(btc|eth|sol|doge|xrp|ada|bnb|avax|matic|dot|link|uni|aave|sui|apt|arb|op|ton|near|pepe|wif)\b/);
  if (coinMatch) {
    const coin = coinMatch[1].toUpperCase();
    return {
      inline_keyboard: [
        [
          { text: `📊 ${coin} Funding`, callback_data: `q:${coin} funding rates across exchanges` },
          { text: `📈 ${coin} OI`, callback_data: `q:${coin} open interest breakdown` },
        ],
        [
          { text: '🐋 Whales', callback_data: `q:Whale positions for ${coin}` },
          { text: `📉 ${coin} Chart`, url: `https://info-hub.io/chart?s=${coin}&tf=240` },
        ],
      ],
    };
  }

  if (q.includes('market') || q.includes('overview') || q.includes('pulse') || q.includes('vibe')) {
    return {
      inline_keyboard: [
        [
          { text: '🔥 Top Movers', callback_data: 'q:Top crypto movers right now' },
          { text: '💰 ETF Flows', callback_data: 'q:Latest ETF inflows and outflows' },
        ],
        [
          { text: '🐋 Whale Watch', callback_data: 'q:Top whale positions on Hyperliquid' },
          { text: '📉 BTC Chart', url: 'https://info-hub.io/chart?s=BTC&tf=240' },
        ],
      ],
    };
  }

  if (q.includes('funding') || q.includes('arb')) {
    return {
      inline_keyboard: [
        [
          { text: '⚡ Top Arbs', callback_data: 'q:Best funding arbitrage opportunities' },
          { text: '📊 BTC Funding', callback_data: 'q:BTC funding rate history trend' },
        ],
      ],
    };
  }

  return {
    inline_keyboard: [
      [
        { text: '📊 Market Overview', callback_data: 'q:Quick market pulse right now' },
        { text: '🐋 Whale Watch', callback_data: 'q:Top whale positions' },
      ],
      [
        { text: '🌐 Dashboard', url: 'https://info-hub.io' },
        { text: '📉 Charts', url: 'https://info-hub.io/chart' },
      ],
    ],
  };
}

// ─── Callback query handler ─────────────────────────────────────────────────

async function handleCallbackQuery(chatId: number, data: string, request: NextRequest) {
  if (data.startsWith('q:')) {
    const query = data.slice(2);
    await handleAIChat(chatId, query, request);
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
