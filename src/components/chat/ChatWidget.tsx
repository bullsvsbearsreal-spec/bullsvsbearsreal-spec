'use client';

import { useState, useCallback, useRef } from 'react';
import { X, Trash2, Minus } from 'lucide-react';
import GuardIcon from './GuardIcon';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import ChatSuggestions from './ChatSuggestions';
import {
  getMessages,
  addMessage,
  clearChat,
  getSessionId,
  type ChatMessage as StoredMessage,
} from '@/lib/storage/chat';
import { getHoldings } from '@/lib/storage/portfolio';
import { getWatchlist } from '@/lib/storage/watchlist';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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

  const sendMessage = useCallback(async (text: string) => {
    if (isLoading) return;

    // Add user message
    const userMsg = addMessage({ role: 'user', content: text });
    const userUI: UIMessage = { id: userMsg.id, role: 'user', content: text };

    // Create placeholder for assistant response
    const assistantId = crypto.randomUUID();
    const assistantUI: UIMessage = { id: assistantId, role: 'assistant', content: '', isStreaming: true };

    setMessages((prev) => [...prev, userUI, assistantUI]);
    setIsLoading(true);
    setActiveToolName(undefined);

    // Build context from localStorage
    const portfolio = getHoldings().map((h) => ({
      symbol: h.symbol,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
    }));
    const watchlist = getWatchlist();

    // Build message history for API (last 10)
    const allMessages = getMessages();
    const apiMessages = allMessages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

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

      // Read remaining from header
      const remainingHeader = res.headers.get('X-RateLimit-Remaining');
      if (remainingHeader !== null) {
        setRemaining(parseInt(remainingHeader));
      }

      // Parse SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

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
              // Save to storage
              if (fullText) {
                addMessage({ role: 'assistant', content: fullText });
              }
              break;

            case 'error': {
              const { message } = JSON.parse(eventData);
              fullText = `Sorry, an error occurred: ${message}`;
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
    // Abort any ongoing request
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
          className="fixed bottom-5 right-5 z-[60] w-12 h-12 rounded-full
            bg-hub-yellow text-black shadow-lg shadow-hub-yellow/20
            hover:bg-hub-yellow-light hover:scale-105 hover:shadow-hub-yellow/30
            active:scale-95 transition-all duration-200
            flex items-center justify-center group"
          aria-label="Open Guard AI chat"
        >
          <GuardIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed z-[60] animate-scale-in
            /* Mobile: full screen */
            inset-0 sm:inset-auto
            /* Desktop: bottom-right corner */
            sm:bottom-5 sm:right-5
            sm:w-[400px] sm:h-[600px] sm:max-h-[80vh]
            sm:rounded-2xl
            bg-[#0a0a0a] border border-white/[0.08]
            flex flex-col overflow-hidden
            shadow-2xl shadow-black/50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-hub-yellow/15 flex items-center justify-center">
                <GuardIcon className="w-5 h-5 text-hub-yellow" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white leading-none">Guard</h3>
                <p className="text-[10px] text-neutral-500 mt-0.5">AI Trading Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="w-8 h-8 rounded-lg flex items-center justify-center
                    text-neutral-500 hover:text-red-400 hover:bg-red-500/10
                    transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center
                  text-neutral-500 hover:text-white hover:bg-white/[0.08]
                  transition-colors sm:hidden"
                title="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center
                  text-neutral-500 hover:text-white hover:bg-white/[0.08]
                  transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
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

          {/* Show suggestions after last assistant message if not loading */}
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
