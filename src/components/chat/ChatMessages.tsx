'use client';

import { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatSuggestions from './ChatSuggestions';
import GuardIcon from './GuardIcon';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageDataUrl?: string;
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
        <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
          <GuardIcon className="w-20 h-20" />
        </div>
        <h3 className="text-base font-bold text-white mb-1 tracking-tight">MK.II</h3>
        <p className="text-[11px] text-neutral-500 text-center mb-1">Derivatives Intelligence</p>
        <p className="text-[11px] text-neutral-600 text-center mb-6 max-w-[260px] leading-relaxed">
          Real-time data from 24 exchanges. Funding rates, OI, whale flows, arbitrage — ask anything.
        </p>
        <ChatSuggestions onSelect={onSuggestionSelect} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          role={msg.role}
          content={msg.content}
          imageDataUrl={msg.imageDataUrl}
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
