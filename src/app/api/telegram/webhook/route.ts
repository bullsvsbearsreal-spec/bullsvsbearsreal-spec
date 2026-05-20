/**
 * Telegram Webhook — Hub (InfoHub AI Agent)
 *
 * Commands:
 *   /start CODE    Link your InfoHub account
 *   /stop          Pause notifications
 *   /start         Resume notifications (if already linked)
 *   /status        Show link status & mute info
 *   /mute 1h       Mute notifications (1h, 2h, 4h, 8h, 12h, 24h)
 *   /unmute         Resume notifications early
 *   /help          Show commands
 *   <any text>     AI-powered market chat via Hub
 *
 * Security: Verifies x-telegram-bot-api-secret-token header.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { sendMessage, sendMessageWithId, editMessage, answerCallbackQuery, type InlineKeyboardMarkup } from '@/lib/telegram';
import { ALL_EXCHANGES } from '@/lib/constants/exchanges';
import {
  initDB, isDBConfigured,
  consumeTelegramLinkCode, linkTelegramChat, unlinkTelegramChat,
  reactivateTelegramChat, muteTelegramChat, unmuteTelegramChat, getTelegramLink,
  pruneExpiredLinkCodes,
} from '@/lib/db';
import { buildSystemPrompt } from '@/app/api/chat/system-prompt';
import { CHAT_TOOLS } from '@/app/api/chat/tools';
import { executeTool } from '@/app/api/chat/tool-executor';
import { timingSafeEqual, createHash } from 'crypto';

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

export async function POST(request: NextRequest) {
  // Verify webhook secret — fail closed if not configured
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }
  const header = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!safeCompare(header, WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ ok: true }); // silently skip
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // ─── Callback Queries (inline keyboard button taps) ────────────────────────
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

  // ─── Reject group messages (bot is for private chats only) ─────────────────
  if (message.chat.type !== 'private') {
    return NextResponse.json({ ok: true });
  }

  // ─── Handle non-text messages gracefully ───────────────────────────────────
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

  // Prune expired codes ~10% of the time
  if (Math.random() < 0.1) {
    pruneExpiredLinkCodes().catch(e => console.warn('[telegram] prune expired codes failed:', e));
  }

  // ─── /start CODE — Link account ───────────────────────────────────────────
  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1]?.toUpperCase();

    if (code) {
      // Verify the link code
      const userId = await consumeTelegramLinkCode(code);
      if (!userId) {
        await sendMessage(chatId,
          '❌ Invalid or expired code.\n\n' +
          'Get a fresh code from <b>info-hub.io/settings</b> → Telegram section.',
        );
        return NextResponse.json({ ok: true });
      }

      await linkTelegramChat(chatId, userId);
      await sendMessage(chatId,
        '✅ <b>Account linked!</b>\n\n' +
        'You\'ll now receive notifications here for:\n' +
        '• Price, funding & OI alerts\n' +
        '• Whale trade alerts\n' +
        '• Daily market summary\n\n' +
        'You can also just chat with me. Ask anything about the market and I\'ll pull live data.\n\n' +
        'Commands:\n' +
        '/status — Check your link status\n' +
        '/mute 1h — Mute for 1/2/4/8/12/24h\n' +
        '/unmute — Resume early\n' +
        '/stop — Pause all notifications',
      );
      return NextResponse.json({ ok: true });
    }

    // /start with no code — check if already linked
    const existing = await getTelegramLink(chatId);
    if (existing) {
      if (!existing.active) {
        await reactivateTelegramChat(chatId);
        await sendMessage(chatId, '✅ Notifications resumed! You\'re back online.');
      } else {
        await sendMessage(chatId,
          '👋 You\'re already linked!\n\n' +
          'Use /status to check your settings or /stop to pause.',
        );
      }
    } else {
      await sendMessage(chatId,
        '👋 <b>You found the InfoHub bot.</b>\n\n' +
        `I sit on top of ${ALL_EXCHANGES.length} exchanges and answer questions like "what's BTC funding right now" or "biggest liquidations today" — live data, no fluff.\n\n` +
        'To get alerts (funding extremes, whale trades, your own thresholds), link your account:\n' +
        '1. Log in at <b>info-hub.io</b>\n' +
        '2. Settings → Telegram\n' +
        '3. <b>Generate Code</b>\n' +
        '4. Send <code>/start CODE</code> back here\n\n' +
        'Or skip the link — just ask me anything. Try: <i>"BTC funding right now"</i>',
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ─── /stop — Pause notifications ──────────────────────────────────────────
  if (text === '/stop') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'You\'re not linked yet. Use /start to get started.');
      return NextResponse.json({ ok: true });
    }
    await unlinkTelegramChat(chatId);
    await sendMessage(chatId,
      '⏸ Notifications paused.\n\n' +
      'Send /start to resume anytime. Your account link is preserved.',
    );
    return NextResponse.json({ ok: true });
  }

  // ─── /status — Show link status ───────────────────────────────────────────
  if (text === '/status') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, '❌ Not linked. Use /start to connect your InfoHub account.');
      return NextResponse.json({ ok: true });
    }

    const now = new Date();
    const isMuted = link.muted_until && link.muted_until > now;
    const lines = [
      '📡 <b>Hub Status</b>',
      '',
      `Active: ${link.active ? '✅ Yes' : '⏸ Paused'}`,
    ];

    if (isMuted) {
      const mins = Math.ceil((link.muted_until!.getTime() - now.getTime()) / 60000);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      lines.push(`Muted: until ${hrs > 0 ? `${hrs}h ` : ''}${remMins}m from now`);
    }

    lines.push('', 'Commands: /mute 1h · /unmute · /stop');
    await sendMessage(chatId, lines.join('\n'));
    return NextResponse.json({ ok: true });
  }

  // ─── /mute DURATION — Temporarily mute ────────────────────────────────────
  if (text.startsWith('/mute')) {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'Not linked yet. Use /start first.');
      return NextResponse.json({ ok: true });
    }

    const arg = text.split(/\s+/)[1]?.toLowerCase();
    const hours = arg ? MUTE_DURATIONS[arg] : undefined;
    if (!hours) {
      await sendMessage(chatId,
        'Usage: <code>/mute 1h</code>\n\nOptions: 1h, 2h, 4h, 8h, 12h, 24h',
      );
      return NextResponse.json({ ok: true });
    }

    const until = new Date(Date.now() + hours * 3600_000);
    await muteTelegramChat(chatId, until);
    await sendMessage(chatId, `🔇 Muted for ${hours}h. Send /unmute to resume early.`);
    return NextResponse.json({ ok: true });
  }

  // ─── /unmute — Resume early (only clears mute, does NOT reactivate stopped chats) ──
  if (text === '/unmute') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'Not linked yet. Use /start first.');
      return NextResponse.json({ ok: true });
    }
    if (!link.active) {
      await sendMessage(chatId, '⏸ Your notifications are paused. Send /start to resume first.');
      return NextResponse.json({ ok: true });
    }
    await unmuteTelegramChat(chatId);
    await sendMessage(chatId, '🔔 Unmuted! Notifications are back on.');
    return NextResponse.json({ ok: true });
  }

  // ─── /help — Show commands ─────────────────────────────────────────────────
  if (text === '/help') {
    await sendMessage(chatId,
      '📡 <b>Hub — InfoHub AI Agent</b>\n\n' +
      '<b>Commands:</b>\n' +
      '/start — Link account or resume\n' +
      '/stop — Pause notifications\n' +
      '/status — Check status\n' +
      '/mute 1h — Mute (1h/2h/4h/8h/12h/24h)\n' +
      '/unmute — Resume early\n' +
      '/help — Show this message\n\n' +
      '<b>Or just ask me anything:</b>\n' +
      '• "What\'s BTC funding right now?"\n' +
      '• "Best arb opportunities"\n' +
      '• "ETH whale positions"\n' +
      '• "Market overview"',
    );
    return NextResponse.json({ ok: true });
  }

  // ─── Unknown commands ────────────────────────────────────────────────────
  if (text.startsWith('/')) {
    await sendMessage(chatId, 'Unknown command. Send /help for options, or just ask me a market question.');
    return NextResponse.json({ ok: true });
  }

  // ─── AI Chat — Forward any non-command text to Hub ────────────────────────
  await handleAIChat(chatId, text, request);
  return NextResponse.json({ ok: true });
}


// ─── Hub AI Chat via Telegram ─────────────────────────────────────────────────

const TELEGRAM_MAX_TOKENS = 800; // More room for tool synthesis
const TELEGRAM_MAX_TOOL_ROUNDS = 3;
const TELEGRAM_HISTORY_SIZE = 6; // Keep last 6 messages (3 turns) for context

// Simple per-chat rate limit: 1 AI message per 5 seconds
const chatLastRequest = new Map<number, number>();

// In-memory conversation history per chat (lightweight, resets on cold start)
const chatHistory = new Map<number, Array<{ role: 'user' | 'assistant'; content: string; ts: number }>>();

function getChatHistory(chatId: number): Array<{ role: string; content: string }> {
  const history = chatHistory.get(chatId);
  if (!history) return [];
  // Only keep messages from last 30 minutes for relevance
  const cutoff = Date.now() - 30 * 60 * 1000;
  const recent = history.filter(m => m.ts > cutoff);
  return recent.slice(-TELEGRAM_HISTORY_SIZE).map(m => ({ role: m.role, content: m.content }));
}

function addToHistory(chatId: number, role: 'user' | 'assistant', content: string) {
  if (!chatHistory.has(chatId)) chatHistory.set(chatId, []);
  const history = chatHistory.get(chatId)!;
  history.push({ role, content, ts: Date.now() });
  // Keep only last 20 entries per chat to bound memory
  if (history.length > 20) chatHistory.set(chatId, history.slice(-20));
}

async function handleAIChat(chatId: number, userText: string, request: NextRequest) {
  // Rate limit
  const now = Date.now();
  const lastReq = chatLastRequest.get(chatId) || 0;
  if (now - lastReq < 5000) {
    await sendMessage(chatId, 'Slow down. Give me a sec to think.');
    return;
  }
  chatLastRequest.set(chatId, now);

  // Evict old entries from rate limit map
  if (chatLastRequest.size > 1000) {
    const cutoff = now - 60_000;
    Array.from(chatLastRequest.entries()).forEach(([id, ts]) => {
      if (ts < cutoff) chatLastRequest.delete(id);
    });
  }

  // Evict stale conversation histories
  if (chatHistory.size > 500) {
    const cutoff = now - 60 * 60 * 1000; // 1 hour
    Array.from(chatHistory.entries()).forEach(([id, msgs]) => {
      if (msgs.length === 0 || msgs[msgs.length - 1].ts < cutoff) chatHistory.delete(id);
    });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    await sendMessage(chatId, 'AI chat is not configured yet. Check back later.');
    return;
  }

  try {
    // Send typing indicator
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      }).catch(() => {});
    }

    const origin = new URL(request.url).origin;
    const systemPrompt = buildSystemPrompt({}) +
      '\n\nPLATFORM: Telegram. Keep responses SHORT (under 300 words). Use plain text, no markdown headers. Bold with <b>tags</b> (HTML). Telegram users want quick, punchy answers. No code blocks. Use bullet points sparingly.';

    // Build messages with conversation history
    const history = getChatHistory(chatId);
    addToHistory(chatId, 'user', userText);

    const client = new Anthropic({ apiKey });
    let messages: Anthropic.MessageParam[] = [
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userText },
    ];
    let toolRounds = 0;
    let finalText = '';

    while (toolRounds <= TELEGRAM_MAX_TOOL_ROUNDS) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: TELEGRAM_MAX_TOKENS,
        system: systemPrompt,
        tools: CHAT_TOOLS,
        messages,
      });

      // Extract text and tool calls
      let roundText = '';
      const toolCalls: Array<{ id: string; name: string; input: any }> = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          roundText += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({ id: block.id, name: block.name, input: block.input });
        }
      }

      if (toolCalls.length === 0) {
        finalText = roundText;
        break;
      }

      toolRounds++;
      if (toolRounds > TELEGRAM_MAX_TOOL_ROUNDS) {
        finalText = roundText || 'Hit my data limit for this question. Try a simpler ask.';
        break;
      }

      // Build assistant message with tool use
      const assistantContent: Anthropic.ContentBlockParam[] = [];
      if (roundText) assistantContent.push({ type: 'text', text: roundText });
      for (const tc of toolCalls) {
        assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
      }
      messages.push({ role: 'assistant', content: assistantContent });

      // Execute tools
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tc of toolCalls) {
        const result = await executeTool(tc.name, tc.input, { origin });
        toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: result });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    // Send response (split if > 4000 chars)
    if (!finalText) finalText = 'No data found for that query.';

    // Save assistant response to conversation history
    addToHistory(chatId, 'assistant', finalText);

    // Convert markdown bold to HTML bold for Telegram
    finalText = finalText.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    // Convert markdown links [text](url) to HTML <a> for Telegram
    // Relative URLs (/chart, /funding, etc.) → absolute https://info-hub.io/...
    finalText = finalText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
      const absUrl = url.startsWith('/') ? `https://info-hub.io${url}` : url;
      return `<a href="${absUrl}">${label}</a>`;
    });

    // Build follow-up keyboard based on the question topic
    const keyboard = buildFollowUpKeyboard(userText);

    if (finalText.length <= 4000) {
      await sendMessage(chatId, finalText, 'HTML', keyboard);
    } else {
      const chunks = splitMessage(finalText, 4000);
      for (let i = 0; i < chunks.length; i++) {
        // Only attach keyboard to the last chunk
        await sendMessage(chatId, chunks[i], 'HTML', i === chunks.length - 1 ? keyboard : undefined);
      }
    }

  } catch (e) {
    console.error('[telegram-hub] AI chat error:', e instanceof Error ? e.message : e);
    await sendMessage(chatId, 'Something went wrong. Try again in a sec.');
  }
}

// ─── Follow-up keyboards based on topic ──────────────────────────────────────

function buildFollowUpKeyboard(query: string): InlineKeyboardMarkup | undefined {
  const q = query.toLowerCase();

  // BTC/ETH/specific coin queries → show related actions + chart link
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

  // Market overview queries
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

  // Funding/arb queries
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

  // Default: generic follow-ups
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

// ─── Callback query handler (button taps) ────────────────────────────────────

async function handleCallbackQuery(chatId: number, data: string, request: NextRequest) {
  // Handle "q:" prefix — treat as a new AI chat query
  if (data.startsWith('q:')) {
    const query = data.slice(2);
    await handleAIChat(chatId, query, request);
    return;
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
