'use client';

import { useMemo } from 'react';
import { User, Loader2 } from 'lucide-react';
import GuardIcon from './GuardIcon';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  imageDataUrl?: string;
  isStreaming?: boolean;
  toolName?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Render inline markdown: bold, italic, inline code, links */
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-white/[0.08] text-amber-400 text-[11px] font-mono">$1</code>');
}

/** Full markdown → HTML renderer for chat messages */
function formatMarkdown(text: string): string {
  // Split code blocks from regular text
  const segments = text.split(/(```[\s\S]*?```)/g);

  return segments
    .map((segment) => {
      // Code block
      if (segment.startsWith('```')) {
        const match = segment.match(/```(\w*)\n?([\s\S]*?)```/);
        const code = escapeHtml((match?.[2] || '').trim());
        return `<pre class="my-2 p-3 rounded-lg bg-black/30 border border-white/[0.06] overflow-x-auto"><code class="text-[11px] font-mono text-emerald-400/90 leading-relaxed whitespace-pre">${code}</code></pre>`;
      }

      // Process lines for block elements
      const lines = segment.split('\n');
      const output: string[] = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Empty line → spacer
        if (!trimmed) {
          output.push('<div class="h-1.5"></div>');
          i++;
          continue;
        }

        // Headers
        if (trimmed.startsWith('### ')) {
          output.push(
            `<div class="text-[13px] font-semibold text-white mt-3 mb-1">${formatInline(trimmed.slice(4))}</div>`,
          );
          i++;
          continue;
        }
        if (trimmed.startsWith('## ')) {
          output.push(
            `<div class="text-sm font-bold text-white mt-3 mb-1">${formatInline(trimmed.slice(3))}</div>`,
          );
          i++;
          continue;
        }

        // Bullet list: collect consecutive items
        if (/^[-•*] /.test(trimmed)) {
          const items: string[] = [];
          while (i < lines.length && /^[-•*] /.test(lines[i].trim())) {
            items.push(formatInline(lines[i].trim().replace(/^[-•*] /, '')));
            i++;
          }
          const lis = items
            .map(
              (item) =>
                `<li class="flex gap-2 leading-relaxed"><span class="text-amber-500/50 flex-shrink-0 select-none">•</span><span>${item}</span></li>`,
            )
            .join('');
          output.push(`<ul class="space-y-0.5 my-1">${lis}</ul>`);
          continue;
        }

        // Numbered list: collect consecutive items
        if (/^\d+[.)]\s/.test(trimmed)) {
          const items: string[] = [];
          let num = 1;
          while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
            items.push(formatInline(lines[i].trim().replace(/^\d+[.)]\s/, '')));
            i++;
            num++;
          }
          const lis = items
            .map(
              (item, idx) =>
                `<li class="flex gap-2 leading-relaxed"><span class="text-amber-500/50 flex-shrink-0 text-[11px] mt-[1px] font-mono select-none">${idx + 1}.</span><span>${item}</span></li>`,
            )
            .join('');
          output.push(`<ol class="space-y-0.5 my-1">${lis}</ol>`);
          continue;
        }

        // Regular text line
        output.push(formatInline(line) + '<br/>');
        i++;
      }

      return output.join('');
    })
    .join('');
}

export default function ChatMessage({
  role,
  content,
  imageDataUrl,
  isStreaming,
  toolName,
}: ChatMessageProps) {
  const isUser = role === 'user';

  const formattedContent = useMemo(() => {
    if (!content) return '';
    return formatMarkdown(content);
  }, [content]);

  return (
    <div
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 overflow-hidden ${
          isUser
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-white/[0.06]'
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : (
          <GuardIcon className="w-7 h-7" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-amber-500/10 border border-amber-500/20 text-neutral-200'
            : 'bg-white/[0.03] border border-white/[0.06] text-neutral-300'
        }`}
      >
        {/* Attached chart image */}
        {imageDataUrl && (
          <img
            src={imageDataUrl}
            alt="Chart"
            className="rounded-lg mb-2 max-h-48 w-auto border border-white/[0.08]"
          />
        )}

        {/* Tool loading indicator */}
        {toolName && (
          <div className="flex items-center gap-2 text-[11px] text-amber-400/70 mb-2 py-1.5 px-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/10">
            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
            <span className="font-mono truncate">
              {toolName.replace(/_/g, ' ')}...
            </span>
          </div>
        )}

        {/* Content */}
        {content ? (
          <div
            dangerouslySetInnerHTML={{ __html: formattedContent }}
            className="chat-markdown [&_strong]:text-white [&_strong]:font-semibold"
          />
        ) : isStreaming ? (
          <div className="flex items-center gap-1.5 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50 animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50 animate-pulse [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50 animate-pulse [animation-delay:300ms]" />
          </div>
        ) : null}

        {/* Streaming cursor */}
        {isStreaming && content && (
          <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-amber-400/60 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
