'use client';

import { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatSuggestions from './ChatSuggestions';
import GuardIcon from './GuardIcon';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  activeToolName?: string;
  onSuggestionSelect: (prompt: string) => void;
}

export default function ChatMessages({
  messages,
  isLoading,
  activeToolName,
  onSuggestionSelect,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, activeToolName]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center mb-4">
          <GuardIcon className="w-16 h-16" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">MK.II</h3>
        <p className="text-xs text-neutral-500 text-center mb-6 max-w-[280px]">
          AI trading assistant. Real-time data from 24+ exchanges. Ask me anything about funding, OI, or the market.
        </p>
        <ChatSuggestions onSelect={onSuggestionSelect} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          role={msg.role}
          content={msg.content}
          isStreaming={msg.isStreaming}
          toolName={msg.isStreaming ? activeToolName : undefined}
        />
      ))}

      {/* Loading indicator for new assistant message */}
      {isLoading && messages[messages.length - 1]?.role === 'user' && (
        <ChatMessage role="assistant" content="" isStreaming toolName={activeToolName} />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
