import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, PromptContext } from './system-prompt';
import { CHAT_TOOLS } from './tools';
import { executeTool } from './tool-executor';
import { checkRateLimit } from './rate-limit';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const MAX_TOOL_ROUNDS = 5;
const MAX_TOKENS = 600;

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: PromptContext;
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown';

  const body: ChatRequestBody = await request.json();
  const lastMessage = body.messages?.[body.messages.length - 1]?.content || '';

  const rateCheck = checkRateLimit(ip, lastMessage.length);
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

  // Validate
  if (!body.messages || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 });
  }

  const origin = new URL(request.url).origin;

  // Fetch live market context for system prompt (lightweight, cached)
  let btcPrice: number | undefined;
  let btcChange: number | undefined;
  let btcOI: number | undefined;
  try {
    const [tickerRes, oiRes] = await Promise.all([
      fetch(`${origin}/api/tickers`).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`${origin}/api/openinterest`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    if (tickerRes?.data) {
      const btcTickers = (tickerRes.data as any[]).filter((t: any) => t.symbol === 'BTC');
      if (btcTickers.length > 0) {
        btcPrice = btcTickers.reduce((s: number, t: any) => s + (t.lastPrice || 0), 0) / btcTickers.length;
        btcChange = btcTickers[0]?.priceChangePercent24h ?? btcTickers[0]?.change24h;
      }
    }
    if (oiRes?.data) {
      btcOI = (oiRes.data as any[])
        .filter((e: any) => e.symbol === 'BTC')
        .reduce((s: number, e: any) => s + (e.openInterest || 0), 0);
    }
  } catch {
    // Non-critical — Guard works fine without ambient context
  }

  const systemPrompt = buildSystemPrompt({
    ...body.context,
    btcPrice,
    btcChange,
    btcOI,
  });

  // Only send last 10 messages to stay within token budget
  const recentMessages = body.messages.slice(-10).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to send SSE events
  const sendEvent = async (event: string, data: string) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
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
          model: 'claude-haiku-4-5-20251001',
          max_tokens: MAX_TOKENS,
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
      const message = error instanceof Error ? error.message : 'An error occurred';
      await sendEvent('error', JSON.stringify({ message }));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-RateLimit-Remaining': String(rateCheck.remaining),
    },
  });
}
