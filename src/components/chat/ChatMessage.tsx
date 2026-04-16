'use client';

import { useMemo, useState, useCallback } from 'react';
import { User, Loader2, Copy, Check, RotateCcw } from 'lucide-react';
import GuardIcon from './GuardIcon';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  imageDataUrl?: string;
  isStreaming?: boolean;
  toolName?: string;
  onRetry?: () => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Render inline markdown: bold, italic, strikethrough, inline code, links */
function formatInline(text: string): string {
  // Escape HTML FIRST to prevent XSS, then apply markdown formatting
  return escapeHtml(text)
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="text-white font-semibold italic">$1</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<del class="text-neutral-500">$1</del>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-white/[0.08] text-amber-300 text-[11px] font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
      // Only allow safe URLs (http, https, relative paths)
      const safeUrl = /^(https?:\/\/|\/[^/])/.test(url) ? url : '#';
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-amber-400 hover:text-amber-300 underline underline-offset-2 decoration-amber-400/30 hover:decoration-amber-300/60 transition-colors">${label}</a>`;
    });
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

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          output.push('<hr class="my-2 border-white/[0.08]" />');
          i++;
          continue;
        }

        // Blockquote
        if (trimmed.startsWith('> ')) {
          const quoteLines: string[] = [];
          while (i < lines.length && lines[i].trim().startsWith('> ')) {
            quoteLines.push(formatInline(lines[i].trim().slice(2)));
            i++;
          }
          output.push(
            `<blockquote class="my-1.5 pl-3 border-l-2 border-amber-500/30 text-neutral-400 italic">${quoteLines.join('<br/>')}</blockquote>`,
          );
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
          while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
            items.push(formatInline(lines[i].trim().replace(/^\d+[.)]\s/, '')));
            i++;
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

        // Pipe-delimited table: detect header + separator + rows
        if (trimmed.includes('|') && i + 1 < lines.length && /^\|?[\s-:|]+\|/.test(lines[i + 1]?.trim())) {
          const tableLines: string[] = [];
          while (i < lines.length && lines[i].trim().includes('|')) {
            tableLines.push(lines[i].trim());
            i++;
          }
          if (tableLines.length >= 2) {
            const parseRow = (row: string) =>
              row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

            const headers = parseRow(tableLines[0]);
            // Skip separator row (index 1)
            const dataRows = tableLines.slice(2).map(parseRow);

            const ths = headers
              .map((h) => `<th class="px-2 py-1.5 text-left text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider whitespace-nowrap">${formatInline(h)}</th>`)
              .join('');
            const trs = dataRows
              .map(
                (row) =>
                  `<tr class="border-t border-white/[0.04]">${row
                    .map((cell) => `<td class="px-2 py-1 text-[11px] font-mono text-neutral-300 whitespace-nowrap">${formatInline(cell)}</td>`)
                    .join('')}</tr>`,
              )
              .join('');

            output.push(
              `<div class="my-2 overflow-x-auto rounded-lg border border-white/[0.06]"><table class="w-full"><thead class="bg-white/[0.04]"><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`,
            );
            continue;
          }
        }

        // Regular text — collect consecutive lines into a paragraph
        const textLines: string[] = [];
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !lines[i].trim().startsWith('```') &&
          !lines[i].trim().startsWith('> ') &&
          !lines[i].trim().startsWith('### ') &&
          !lines[i].trim().startsWith('## ') &&
          !/^[-•*] /.test(lines[i].trim()) &&
          !/^\d+[.)]\s/.test(lines[i].trim()) &&
          !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
          !(lines[i].trim().includes('|') && i + 1 < lines.length && /^\|?[\s-:|]+\|/.test(lines[i + 1]?.trim()))
        ) {
          textLines.push(formatInline(lines[i]));
          i++;
        }
        if (textLines.length > 0) {
          output.push(`<p class="my-0.5 leading-relaxed">${textLines.join('<br/>')}</p>`);
        }
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
  onRetry,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const isError = !isUser && content?.startsWith('Error:');

  const handleCopy = useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [content]);

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

        {/* Action buttons — copy + retry */}
        {!isUser && content && !isStreaming && (
          <div className="flex items-center gap-1 mt-1.5 -mb-0.5">
            <button
              onClick={handleCopy}
              className="p-1 rounded text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04] transition-colors"
              title="Copy response"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
            {isError && onRetry && (
              <button
                onClick={onRetry}
                className="p-1 rounded text-neutral-600 hover:text-amber-400 hover:bg-amber-500/[0.06] transition-colors"
                title="Retry"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
