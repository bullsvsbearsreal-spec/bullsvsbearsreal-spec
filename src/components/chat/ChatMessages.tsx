'use client';

import { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatSuggestions from './ChatSuggestions';
import { Bot } from 'lucide-react';

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
        <div className="w-14 h-14 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center mb-4">
          <Bot className="w-7 h-7 text-hub-yellow" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">Guard</h3>
        <p className="text-xs text-neutral-500 text-center mb-6 max-w-[280px]">
          Your AI trading assistant. 15+ years of market experience, powered by real-time data from 17+ exchanges.
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
