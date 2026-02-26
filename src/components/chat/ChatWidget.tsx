'use client';

import { useState, useCallback, useRef } from 'react';
import { X, Trash2, Minus } from 'lucide-react';
import GuardIcon from './GuardIcon';
import ChatMessages from './ChatMessages';
import ChatInput, { type ImageAttachment } from './ChatInput';
import ChatSuggestions from './ChatSuggestions';
import {
  getMessages,
  addMessage,
  clearChat,
  type ChatMessage as StoredMessage,
} from '@/lib/storage/chat';
import { getHoldings } from '@/lib/storage/portfolio';
import { getWatchlist } from '@/lib/storage/watchlist';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageDataUrl?: string;
  isStreaming?: boolean;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    return getMessages().map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | undefined>();
  const [remaining, setRemaining] = useState<number | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string, image?: ImageAttachment) => {
    if (isLoading) return;

    const userMsg = addMessage({ role: 'user', content: text });
    const userUI: UIMessage = {
      id: userMsg.id,
      role: 'user',
      content: text,
      imageDataUrl: image?.dataUrl,
    };

    const assistantId = crypto.randomUUID();
    const assistantUI: UIMessage = { id: assistantId, role: 'assistant', content: '', isStreaming: true };

    setMessages((prev) => [...prev, userUI, assistantUI]);
    setIsLoading(true);
    setActiveToolName(undefined);

    const portfolio = getHoldings().map((h) => ({
      symbol: h.symbol,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
    }));
    const watchlist = getWatchlist();

    // Build API messages from history (text only) + current message (may include image)
    const allMessages = getMessages();
    const historyMessages = allMessages.slice(-10, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Current message: if image attached, send as multimodal content array
    let currentContent: string | Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }>;
    if (image) {
      currentContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.mediaType,
            data: image.base64,
          },
        },
        { type: 'text', text },
      ];
    } else {
      currentContent = text;
    }

    const apiMessages = [
      ...historyMessages,
      { role: 'user' as const, content: currentContent },
    ];

    try {
      abortRef.current = new AbortController();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          context: {
            portfolio: portfolio.length > 0 ? portfolio : undefined,
            watchlist: watchlist.length > 0 ? watchlist : undefined,
          },
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const remainingHeader = res.headers.get('X-RateLimit-Remaining');
      if (remainingHeader !== null) {
        setRemaining(parseInt(remainingHeader));
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          const lines = eventStr.split('\n');
          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          switch (eventType) {
            case 'text':
              fullText += eventData;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullText, isStreaming: true }
                    : m,
                ),
              );
              break;

            case 'tool_start': {
              const { name } = JSON.parse(eventData);
              setActiveToolName(name);
              break;
            }

            case 'tool_done':
              setActiveToolName(undefined);
              break;

            case 'done':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, isStreaming: false }
                    : m,
                ),
              );
              if (fullText) {
                addMessage({ role: 'assistant', content: fullText });
              }
              break;

            case 'error': {
              const { message } = JSON.parse(eventData);
              fullText = `Error: ${message}`;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullText, isStreaming: false }
                    : m,
                ),
              );
              break;
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      const errMsg = error instanceof Error ? error.message : 'Something went wrong';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${errMsg}`, isStreaming: false }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
      setActiveToolName(undefined);
      abortRef.current = null;
    }
  }, [isLoading]);

  const handleClear = () => {
    clearChat();
    setMessages([]);
    setRemaining(undefined);
  };

  const handleClose = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsOpen(false);
    setIsLoading(false);
    setActiveToolName(undefined);
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full
            bg-gradient-to-br from-amber-500/20 to-amber-600/10
            border border-amber-500/30 shadow-lg shadow-amber-500/20
            hover:shadow-amber-500/30 hover:border-amber-500/40 hover:scale-105
            active:scale-95 transition-all duration-200
            flex items-center justify-center group overflow-hidden"
          aria-label="Open MK.II AI chat"
        >
          <GuardIcon className="w-14 h-14 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed z-[60] animate-scale-in
            inset-0 sm:inset-auto
            sm:bottom-5 sm:right-5
            sm:w-[420px] sm:h-[620px] sm:max-h-[80vh]
            sm:rounded-2xl
            bg-[#0c0c0e] border border-white/[0.08]
            flex flex-col overflow-hidden
            shadow-2xl shadow-black/60"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
                <GuardIcon className="w-9 h-9" />
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0c0c0e]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-none tracking-tight">MK.II</h3>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  {isLoading ? (
                    <span className="text-amber-400/70">Analyzing...</span>
                  ) : (
                    'Derivatives Intelligence'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="w-8 h-8 rounded-lg flex items-center justify-center
                    text-neutral-600 hover:text-red-400 hover:bg-red-500/10
                    transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center
                  text-neutral-600 hover:text-white hover:bg-white/[0.06]
                  transition-colors sm:hidden"
                title="Minimize"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center
                  text-neutral-600 hover:text-white hover:bg-white/[0.06]
                  transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            activeToolName={activeToolName}
            onSuggestionSelect={sendMessage}
          />

          {/* Suggestions after last assistant message */}
          {messages.length > 0 && !isLoading && messages[messages.length - 1]?.role === 'assistant' && (
            <ChatSuggestions onSelect={sendMessage} />
          )}

          {/* Input */}
          <ChatInput
            onSend={sendMessage}
            isLoading={isLoading}
            remaining={remaining}
          />
        </div>
      )}
    </>
  );
}
