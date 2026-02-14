'use client';

import { User, Bot, Loader2 } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolName?: string;
}

/** Simple markdown-like formatting without external deps. */
function formatContent(text: string): string {
  return text
    // Bold: **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-white/[0.08] text-hub-yellow text-[11px] font-mono">$1</code>')
    // Line breaks
    .replace(/\n/g, '<br/>');
}

export default function ChatMessage({ role, content, isStreaming, toolName }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? 'bg-hub-yellow/20 text-hub-yellow'
            : 'bg-white/[0.06] text-neutral-400'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-hub-yellow/10 border border-hub-yellow/20 text-neutral-200'
            : 'bg-white/[0.03] border border-white/[0.06] text-neutral-300'
        }`}
      >
        {/* Tool loading indicator */}
        {toolName && (
          <div className="flex items-center gap-2 text-xs text-hub-yellow/70 mb-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Fetching {toolName.replace(/_/g, ' ')}...</span>
          </div>
        )}

        {/* Content */}
        {content ? (
          <div
            dangerouslySetInnerHTML={{ __html: formatContent(content) }}
            className="[&_strong]:text-white [&_br]:block"
          />
        ) : isStreaming ? (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-hub-yellow/50 animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-hub-yellow/50 animate-pulse [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-hub-yellow/50 animate-pulse [animation-delay:300ms]" />
          </div>
        ) : null}

        {/* Streaming cursor */}
        {isStreaming && content && (
          <span className="inline-block w-1 h-4 ml-0.5 bg-hub-yellow/60 animate-pulse" />
        )}
      </div>
    </div>
  );
}
