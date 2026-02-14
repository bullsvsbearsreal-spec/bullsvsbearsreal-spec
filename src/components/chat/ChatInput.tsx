'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  remaining?: number;
}

export default function ChatInput({ onSend, isLoading, remaining }: ChatInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    if (trimmed.length > 500) return;
    onSend(trimmed);
    setInput('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className="border-t border-white/[0.06] p-3">
      {remaining !== undefined && remaining <= 5 && (
        <div className="text-[10px] text-neutral-600 mb-1.5 text-center">
          {remaining} messages remaining today
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask Guard anything..."
          rows={1}
          maxLength={500}
          className="flex-1 resize-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2
            text-sm text-white placeholder-neutral-600 outline-none
            focus:border-hub-yellow/30 focus:bg-white/[0.06]
            transition-colors duration-200 scrollbar-thin"
          style={{ maxHeight: 120 }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
            bg-hub-yellow text-black font-semibold
            hover:bg-hub-yellow-light active:scale-95
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
