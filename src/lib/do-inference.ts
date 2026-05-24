/**
 * DigitalOcean Serverless Inference client.
 *
 * DO exposes an OpenAI-compatible chat-completions endpoint that routes
 * to a catalog of foundation models (Anthropic Claude, OpenAI GPT-x,
 * Llama, etc.) on DO's infra. We use it as a unified-billing replacement
 * for the Anthropic SDK in the Telegram bot — same Claude model under
 * the hood, billed through DO alongside the rest of our DO services.
 *
 * Endpoint:  https://inference.do-ai.run/v1/chat/completions
 * Auth:      Authorization: Bearer ${DO_INFERENCE_API_KEY}
 * Models:    openai-gpt-5             (primary — best cost/quality on DO)
 *            anthropic-claude-opus-4  (reserved for trade-idea generation)
 *
 * Why GPT-5 over Claude Sonnet 4: at the time of writing (May 2026), DO's
 * GPT-5 is $1.25 input / $10 output per 1M tokens vs Sonnet 4 at $3 / $15
 * — ~42% cheaper at frontier intelligence. Switchable via BOT_LLM_MODEL
 * env var without a deploy.
 *
 * This module talks OpenAI-shaped chat-completions: the request format is
 * the OpenAI Chat Completions API (`messages: [{role, content}]`, `tools`,
 * `tool_choice`), and the response is OpenAI-shaped (`choices[0].message`,
 * `tool_calls`). The webhook layer translates from/to that shape; callers
 * here don't need to know it's "secretly Claude".
 */

const DO_INFERENCE_URL = 'https://inference.do-ai.run/v1/chat/completions';

/**
 * Default model for the Telegram bot. GPT-5 is the right cost/quality
 * tradeoff today on DO Serverless Inference:
 *   $1.25 input / $10 output per 1M tokens
 * vs Anthropic Claude Sonnet 4's $3 / $15 — ~42% cheaper at frontier
 * intelligence. Tool-use support is mature on the OpenAI side (our
 * primary use case here).
 *
 * Switchable via the BOT_LLM_MODEL env var if we ever want to A/B test
 * Sonnet 4 / GPT-5.2 / Opus 4 — the runtime reads this constant directly
 * from process.env when set.
 */
export const DO_DEFAULT_MODEL = (process.env.BOT_LLM_MODEL || 'openai-gpt-5').trim();

/**
 * Higher-quality model reserved for trade-idea synthesis (PR2). Opus 4.5
 * over GPT-5.2 because the trade-idea step needs careful multi-signal
 * reasoning — and the volume there is tiny (a few /day) so price barely
 * matters.
 */
export const DO_REASONING_MODEL = (process.env.BOT_REASONING_MODEL || 'anthropic-claude-opus-4').trim();

/** OpenAI-compatible chat message. */
export interface DOInferenceMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | DOInferenceContentBlock[];
  tool_calls?: DOInferenceToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface DOInferenceContentBlock {
  type: 'text';
  text: string;
}

export interface DOInferenceToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface DOInferenceTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface DOInferenceRequest {
  model: string;
  messages: DOInferenceMessage[];
  max_tokens?: number;
  temperature?: number;
  tools?: DOInferenceTool[];
  tool_choice?: 'auto' | 'none' | 'required';
  stream?: boolean;
}

export interface DOInferenceResponse {
  id: string;
  choices: Array<{
    index: number;
    message: DOInferenceMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DOInferenceError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`DO Inference error ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * Non-streaming chat completion. Returns the full response when the model
 * finishes — use this when you need the whole message before sending, or
 * when streaming would complicate the tool-use loop.
 */
export async function doInferenceChat(
  req: DOInferenceRequest,
  opts: { apiKey?: string; timeoutMs?: number } = {},
): Promise<DOInferenceResponse> {
  const apiKey = (opts.apiKey ?? process.env.DO_INFERENCE_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new DOInferenceError(0, 'DO_INFERENCE_API_KEY not configured');
  }
  const timeout = opts.timeoutMs ?? 60_000;

  const res = await fetch(DO_INFERENCE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...req, stream: false }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new DOInferenceError(res.status, body);
  }
  return (await res.json()) as DOInferenceResponse;
}

/**
 * Streaming chat completion. Yields successive content deltas as they
 * arrive over SSE (`data: { ... }` lines). The caller is responsible for
 * accumulating them and re-rendering (e.g. via Telegram editMessage).
 *
 * Tool calls are emitted in deltas too — partial JSON arguments arrive
 * across multiple chunks. We surface the final assembled `tool_calls`
 * array via the optional onToolCalls callback once `finish_reason ===
 * 'tool_calls'` arrives.
 *
 * Errors mid-stream throw — callers should wrap in try/catch and fall
 * back to the non-streaming path if needed.
 */
export async function* doInferenceChatStream(
  req: DOInferenceRequest,
  opts: { apiKey?: string; timeoutMs?: number } = {},
): AsyncGenerator<{
  contentDelta?: string;
  toolCalls?: DOInferenceToolCall[];
  finishReason?: string;
}> {
  const apiKey = (opts.apiKey ?? process.env.DO_INFERENCE_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new DOInferenceError(0, 'DO_INFERENCE_API_KEY not configured');
  }
  const timeout = opts.timeoutMs ?? 60_000;

  const res = await fetch(DO_INFERENCE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ ...req, stream: true }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new DOInferenceError(res.status, body);
  }

  // Assemble tool-call deltas across chunks. OpenAI-style streaming sends
  // each tool call's `arguments` field as JSON-string fragments split
  // arbitrarily — we concat per index until `finish_reason === tool_calls`.
  const toolCallAcc: Record<number, DOInferenceToolCall> = {};

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are split by double-newlines
      let nlIdx: number;
      while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 2);

        // Each frame: one or more `data: <payload>` lines
        const lines = frame.split('\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          if (!data) continue;

          let parsed: any;
          try { parsed = JSON.parse(data); } catch { continue; }

          const choice = parsed?.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta ?? {};
          const contentDelta = typeof delta.content === 'string' ? delta.content : undefined;

          // Accumulate tool-call deltas
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallAcc[idx]) {
                toolCallAcc[idx] = {
                  id: tc.id ?? '',
                  type: 'function',
                  function: { name: '', arguments: '' },
                };
              }
              if (tc.id) toolCallAcc[idx].id = tc.id;
              if (tc.function?.name) toolCallAcc[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCallAcc[idx].function.arguments += tc.function.arguments;
            }
          }

          if (contentDelta) yield { contentDelta };

          if (choice.finish_reason) {
            const assembled = Object.values(toolCallAcc);
            yield {
              finishReason: choice.finish_reason,
              toolCalls: assembled.length > 0 ? assembled : undefined,
            };
          }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

/** True when the env var is set — bot can flip to a fallback if false. */
export function isDOInferenceConfigured(): boolean {
  return Boolean((process.env.DO_INFERENCE_API_KEY || '').trim());
}

// ─── Anthropic-shape → OpenAI-shape adapters ────────────────────────────
//
// Our existing tool definitions live in chat/tools.ts in Anthropic's
// `{ name, description, input_schema }` form. DO Inference is OpenAI-
// compatible and expects `{ type: 'function', function: { name,
// description, parameters } }`. These helpers translate at the boundary
// so the rest of the codebase can keep its Anthropic-flavored tool defs.

interface AnthropicLikeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Convert Anthropic-shape tool defs into OpenAI / DO Inference shape. */
export function toDOTools(tools: AnthropicLikeTool[]): DOInferenceTool[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

/**
 * Parse the JSON `arguments` string from an OpenAI-style tool_call into
 * the structured input expected by Anthropic-shape tool executors. Defaults
 * to `{}` on parse failure rather than throwing — the executor handles
 * missing fields better than we'd handle a crash.
 */
export function parseToolArguments(argString: string): Record<string, unknown> {
  if (!argString || typeof argString !== 'string') return {};
  try {
    const parsed = JSON.parse(argString);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
