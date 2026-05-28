import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, PromptContext } from './system-prompt';
import { CHAT_TOOLS } from './tools';
import { executeTool } from './tool-executor';
import { checkRateLimit } from './rate-limit';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

// ─── BTC context cache (avoids 2 API calls per message) ──────────────────────
let _btcCache: { price?: number; change?: number; oi?: number; ts: number } = { ts: 0 };
const BTC_CACHE_TTL = 60_000; // 60s

async function getCachedBTCContext(origin: string): Promise<{ btcPrice?: number; btcChange?: number; btcOI?: number }> {
  const now = Date.now();
  if (now - _btcCache.ts < BTC_CACHE_TTL) {
    return { btcPrice: _btcCache.price, btcChange: _btcCache.change, btcOI: _btcCache.oi };
  }
  try {
    const [tickerRes, oiRes] = await Promise.all([
      fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(3_000) }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`${origin}/api/openinterest`, { signal: AbortSignal.timeout(3_000) }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    let price: number | undefined;
    let change: number | undefined;
    let oi: number | undefined;
    if (tickerRes?.data) {
      interface RawTicker { symbol: string; lastPrice?: number; priceChangePercent24h?: number; change24h?: number }
      const btcTickers = (tickerRes.data as RawTicker[]).filter((t) => t.symbol === 'BTC');
      if (btcTickers.length > 0) {
        price = btcTickers.reduce((s: number, t) => s + (t.lastPrice || 0), 0) / btcTickers.length;
        const changes = btcTickers.map(t => t.priceChangePercent24h ?? t.change24h).filter((c): c is number => c != null);
        change = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : undefined;
      }
    }
    if (oiRes?.data) {
      interface RawOI { symbol: string; openInterestValue?: number }
      oi = (oiRes.data as RawOI[])
        .filter((e) => e.symbol === 'BTC')
        .reduce((s: number, e) => s + (e.openInterestValue || 0), 0);
    }
    _btcCache = { price, change, oi, ts: now };
    return { btcPrice: price, btcChange: change, btcOI: oi };
  } catch {
    // Return stale cache if available, otherwise undefined
    return { btcPrice: _btcCache.price, btcChange: _btcCache.change, btcOI: _btcCache.oi };
  }
}

const MAX_TOOL_ROUNDS = 5;
const MAX_TOKENS = 1200; // enough room for tool results + synthesis
const ADMIN_MAX_TOKENS = 2000; // admins get longer responses

// Content can be a plain string or multimodal array (with images)
type MessageContent = string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>;

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: MessageContent }>;
  context?: PromptContext;
}

/** Extract text from a message content (string or array) */
function extractText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text!)
    .join(' ');
}

export async function POST(request: NextRequest) {
  // Rate limiting. We REQUIRE a real client identifier — falling back to
  // a bare 'unknown' bucket means any attacker who strips both x-real-ip
  // and x-forwarded-for shares one global limit with every other such
  // caller. Behind DO + Cloudflare these headers are always set, so an
  // empty value is anomalous and gets rejected outright.
  const realIp = request.headers.get('x-real-ip')?.trim();
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = realIp || xff || '';
  if (!ip) {
    return new Response(
      JSON.stringify({ error: 'Missing client identifier' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), { status: 400 });
  }

  // Validate every message role BEFORE we use the array. The Anthropic
  // API will happily relay role:'system' content as if it were a system
  // prompt — a client could otherwise inject "You are now an admin..."
  // with `role: 'system'` and override our buildSystemPrompt() call.
  if (Array.isArray(body.messages)) {
    body.messages = body.messages.filter(
      m => m && (m.role === 'user' || m.role === 'assistant'),
    );
  }
  const lastContent = body.messages?.[body.messages.length - 1]?.content || '';
  const lastText = extractText(lastContent);

  // Check if user is admin (bypasses rate limit, gets higher token budget)
  // Re-verify against DB to prevent stale JWT role exploit. Also resolve
  // their tier so chat history/tools can respect the actual entitlement
  // (Pro/Whale see 1y / 5y instead of the old hardcoded 90-day cap).
  let isAdminUser = false;
  let userTier: 'free' | 'trader' | 'pro' | 'whale' = 'free';
  try {
    const session = await auth();
    if (session?.user?.id) {
      const { isAdmin, getUserTier } = await import('@/lib/auth');
      const [admin, tier] = await Promise.all([
        isAdmin(session.user.id),
        getUserTier(session.user.id),
      ]);
      isAdminUser = admin;
      userTier = tier;
    }
  } catch { /* not logged in or auth error */ }

  if (!isAdminUser) {
    const rateCheck = checkRateLimit(ip, lastText.length);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateCheck.error }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }
  }

  // Validate
  if (!body.messages || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), { status: 400 });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 });
  }

  // `request.url`'s origin resolves to http://localhost:8080 inside the
  // DO App Platform container (the port Heroku buildpack binds to), so
  // any fetch(`${origin}/api/...`) from a route handler hits dead inner
  // localhost instead of the public app. Prefer the canonical public
  // base URL so live BTC context populates the AI system prompt — was
  // silently returning empty context until now (and the bot would say
  // "I don't have current market data" in production while working
  // locally).
  const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;

  // Fetch live market context for system prompt (cached 60s to avoid 2 API calls per message)
  const btcContext = await getCachedBTCContext(origin);
  const { btcPrice, btcChange, btcOI } = btcContext;

  const systemPrompt = buildSystemPrompt({
    ...body.context,
    btcPrice,
    btcChange,
    btcOI,
    tier: userTier,
  });

  // Map tier → historyDays cap once, then thread into tool executor calls
  // below so getFundingHistory + getOiHistory honour paid-tier entitlement.
  const { TIER_LIMITS } = await import('@/lib/constants/tiers');
  const userHistoryDays = TIER_LIMITS[userTier].historyDays;

  // Only send last 8 messages to stay within token budget
  const recentMessages: Anthropic.MessageParam[] = body.messages.slice(-8).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content as Anthropic.MessageParam['content'],
  }));

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to send SSE events — guards against writing to a closed/errored stream
  let streamClosed = false;
  const sendEvent = async (event: string, data: string) => {
    if (streamClosed) return;
    try {
      await writer.write(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
    } catch {
      streamClosed = true; // client disconnected
    }
  };

  // Process in background
  (async () => {
    try {
      const client = new Anthropic({ apiKey });
      let messages: Anthropic.MessageParam[] = recentMessages;
      let toolRounds = 0;

      while (toolRounds <= MAX_TOOL_ROUNDS) {
        // Check if this round should stream (only the final text response)
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: isAdminUser ? ADMIN_MAX_TOKENS : MAX_TOKENS,
          system: systemPrompt,
          tools: CHAT_TOOLS,
          messages,
          stream: true,
        });

        let fullText = '';
        let toolUseBlocks: Array<{ id: string; name: string; input: any }> = [];
        let currentToolId = '';
        let currentToolName = '';
        let currentToolInput = '';

        for await (const event of response) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'text') {
              // Text block starting
            } else if (event.content_block.type === 'tool_use') {
              currentToolId = event.content_block.id;
              currentToolName = event.content_block.name;
              currentToolInput = '';
              // Notify client that a tool is being called
              await sendEvent('tool_start', JSON.stringify({ name: currentToolName }));
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              fullText += event.delta.text;
              await sendEvent('text', event.delta.text);
            } else if (event.delta.type === 'input_json_delta') {
              currentToolInput += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolId && currentToolName) {
              let parsedInput = {};
              try {
                parsedInput = currentToolInput ? JSON.parse(currentToolInput) : {};
              } catch {
                // empty input
              }
              toolUseBlocks.push({
                id: currentToolId,
                name: currentToolName,
                input: parsedInput,
              });
              currentToolId = '';
              currentToolName = '';
              currentToolInput = '';
            }
          } else if (event.type === 'message_stop') {
            // Message complete
          }
        }

        // If no tool calls, we're done
        if (toolUseBlocks.length === 0) {
          break;
        }

        // Execute tool calls and continue the conversation
        toolRounds++;
        if (toolRounds > MAX_TOOL_ROUNDS) {
          await sendEvent('text', '\n\n_(Reached maximum tool call limit)_');
          break;
        }

        // Add assistant message with tool use
        const assistantContent: Anthropic.ContentBlockParam[] = [];
        if (fullText) {
          assistantContent.push({ type: 'text', text: fullText });
        }
        for (const tool of toolUseBlocks) {
          assistantContent.push({
            type: 'tool_use',
            id: tool.id,
            name: tool.name,
            input: tool.input,
          });
        }
        messages = [
          ...messages,
          { role: 'assistant', content: assistantContent },
        ];

        // Execute tools and add results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const tool of toolUseBlocks) {
          const result = await executeTool(tool.name, tool.input, {
            origin,
            portfolio: body.context?.portfolio,
            historyDays: userHistoryDays,
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: result,
          });
          await sendEvent('tool_done', JSON.stringify({ name: tool.name }));
        }

        messages = [
          ...messages,
          { role: 'user', content: toolResults },
        ];

        // Reset for next round
        toolUseBlocks = [];
        fullText = '';
      }

      await sendEvent('done', '{}');
    } catch (error) {
      console.error('[chat] stream error:', error instanceof Error ? error.message : error);
      await sendEvent('error', JSON.stringify({ message: 'An error occurred' }));
    } finally {
      try { await writer.close(); } catch { /* stream already closed/errored */ }
      streamClosed = true;
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-RateLimit-Remaining': isAdminUser ? '999' : '0',
    },
  });
}
